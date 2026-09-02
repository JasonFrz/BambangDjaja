const { getDbConnection } = require('./db');
const { calculateEfficiency } = require('./efficiency');
const whatsappClient = require('./whatsappClient');
const emailClient = require('./emailClient');

const waCooldowns = new Map(); 
const COOLDOWN_MS = 15 * 60 * 1000; // 15 Menit Jeda

const schemaCache = new Map(); 
const thresholdCache = new Map(); 
const CACHE_TTL_MS = 60 * 1000; // 1 menit cache TTL

const METRIC_MAPPING = {
  v_phase: { type: 'global', keys: ['phase_a_v', 'phase_b_v', 'phase_c_v'], name: 'Phase Voltage' },
  avg_phase_v: { type: 'specific', key: 'avg_phase_v', name: 'Average Phase Voltage' },
  v_line: { type: 'global', keys: ['line_ab_v', 'line_bc_v', 'line_ca_v'], name: 'Line Voltage' },
  avg_line_v: { type: 'specific', key: 'avg_line_v', name: 'Average Line Voltage' },
  current: { type: 'global', keys: ['current_a', 'current_b', 'current_c'], name: 'Phase Current' },
  avg_current: { type: 'specific', key: 'avg_current', name: 'Average Phase Current' },
  current_n: { type: 'specific', key: 'current_n', name: 'Neutral Current' },
  current_unbalance: { type: 'specific', key: 'current_unbalance', name: 'Current Unbalance' },
  power_active_phase: { type: 'global', keys: ['power_active_a', 'power_active_b', 'power_active_c'], name: 'Active Power per Phase' },
  power_active_total_kw: { type: 'specific', key: 'power_active_total_kw', name: 'Total Active Power' },
  power_reactive_total_kvar: { type: 'specific', key: 'power_reactive_total_kvar', name: 'Total Reactive Power' },
  power_apparent_total_kva: { type: 'specific', key: 'power_apparent_total_kva', name: 'Total Apparent Power' },
  pf_total: { type: 'specific', key: 'pf_total', name: 'Total Power Factor' },
  frequency: { type: 'specific', key: 'frequency', name: 'Frequency' },
  oil_temperature: { type: 'specific', key: 'oil_temperature', name: 'Oil Temperature' },
  oil_pressure: { type: 'specific', key: 'oil_pressure', name: 'Oil Pressure' }
};

async function sendAlertMessage(db, dbName, trafoId, alerts) {
  try {
      if (!Array.isArray(alerts)) alerts = [alerts];
      if (alerts.length === 0) return;

      const lines = alerts.map((alert, index) => {
        const condition = alert.type === 'OVER' ? 'Melebihi Batas Maksimal' : 'Kurang Dari Batas Minimal';
        const val = typeof alert.val === 'number' ? (Math.round(alert.val * 100) / 100) : alert.val;
        const namePart = alert.sub ? `${alert.name} (${alert.sub})` : alert.name;
        return `${index + 1}. *${namePart}*\n   Nilai Saat Ini: *${val}*\n   Batas Toleransi: ${alert.limit}\n   Kondisi: ${condition}`;
      }).join('\n\n');

      // Placeholder for later construction inside the loop
      const emailSubject = `[TMU ALERT] Abnormal Parameter pada Trafo ${trafoId}`;

      
      let phones = [];
      let emails = [];

      // Dapatkan user (tenant) dan superuser dari tmu_master
      const masterDb = await getDbConnection('tmu_master');
      
      const cacheKeyMaster = `tmu_master_users_cols`;
      let masterColumns = schemaCache.get(cacheKeyMaster);
      if (!masterColumns) {
        const [masterColumnsInfo] = await masterDb.execute("SHOW COLUMNS FROM users");
        masterColumns = masterColumnsInfo.map(c => c.Field);
        schemaCache.set(cacheKeyMaster, masterColumns);
      }
      
      let masterSelectCols = [];
      if (masterColumns.includes('nomor_telpon')) masterSelectCols.push('nomor_telpon');
      if (masterColumns.includes('email')) masterSelectCols.push('email');
      if (masterColumns.includes('username')) masterSelectCols.push('username');
      
      let userContacts = [];
      if (masterSelectCols.length > 0) {
          const [allUsers] = await masterDb.execute(`SELECT ${masterSelectCols.join(', ')} FROM users WHERE nama_db = ?`, [dbName]);
          allUsers.forEach(u => {
              const phone = (u.nomor_telpon && u.nomor_telpon.length >= 10) ? u.nomor_telpon.trim() : null;
              const email = (u.email && u.email.includes('@')) ? u.email.trim() : null;
              const username = u.username || 'User';
              if (phone || email) {
                  userContacts.push({ phone, email, username });
              }
          });
      }
      
      // Determine greeting
      const now = new Date();
      const hour = (now.getUTCHours() + 7) % 24; // WIB
      let greeting = 'pagi';
      if (hour >= 11 && hour < 15) greeting = 'siang';
      else if (hour >= 15 && hour < 18) greeting = 'sore';
      else if (hour >= 18 || hour < 4) greeting = 'malam';
      
      // Send alerts
      for (const contact of userContacts) {
          if (contact.phone) {
              const msg = `Halo Pak/Bu *${contact.username}*, selamat ${greeting}.\n\nPada trafo *${trafoId}* mendeteksi anomali pada sensor!\n\nParameter yang bermasalah:\n${lines}\n\nSilakan segera periksa sistem Anda.\n\n_Pesan otomatis dari PT. Bambang Djaja - TMU System_`;
              await whatsappClient.sendWhatsAppMessage(contact.phone, msg).catch(() => {});
              await new Promise(resolve => setTimeout(resolve, 3000));
          }
          if (contact.email) {
              const emailLines = alerts.map((alert, index) => {
                  const condition = alert.type === 'OVER' ? 'Melebihi Batas Maksimal' : 'Kurang Dari Batas Minimal';
                  const val = typeof alert.val === 'number' ? (Math.round(alert.val * 100) / 100) : alert.val;
                  const namePart = alert.sub ? `${alert.name} (${alert.sub})` : alert.name;
                  return `${index + 1}. ${namePart}\n   Nilai Saat Ini: ${val}\n   Batas Toleransi: ${alert.limit}\n   Kondisi: ${condition}`;
              }).join('\n\n');
              const emailMsg = `Halo Pak/Bu ${contact.username}, selamat ${greeting}.\n\nPada trafo: ${trafoId}\n\nParameter yang bermasalah:\n${emailLines}\n\nSilakan segera periksa sistem Anda.\n\nPesan otomatis dari PT. Bambang Djaja - TMU System`;
              await emailClient.sendEmailMessage(contact.email, emailSubject, emailMsg).catch(() => {});
          }
      }
  } catch (err) {
      console.error("Error sending alert:", err.message);
  }
}

async function checkAndAlert(db, dbName, trafoId, data, isOil = false) {
  if (!whatsappClient.waReady) return [];

  try {
      const cacheKey = `${dbName}_${trafoId}_thresholds`;
      let cached = thresholdCache.get(cacheKey);
      let thresholds = null;

      if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        thresholds = cached.data;
      } else {
        const [tables] = await db.execute("SHOW TABLES LIKE 'threshold_settings'");
        if (tables.length === 0) {
          thresholdCache.set(cacheKey, { timestamp: Date.now(), data: [] });
          return [];
        }

        let dbThresholds = [];
        try {
          const [rows] = await db.execute("SELECT * FROM threshold_settings WHERE is_active = 1 AND trafo_id = ?", [trafoId]);
          dbThresholds = rows;
        } catch (e) {
          if (e.code === 'ER_BAD_FIELD_ERROR') {
            const [rows] = await db.execute("SELECT * FROM threshold_settings WHERE is_active = 1");
            dbThresholds = rows;
          } else {
            throw e;
          }
        }
        
        thresholds = dbThresholds;
        thresholdCache.set(cacheKey, { timestamp: Date.now(), data: thresholds });
      }

      if (!thresholds || thresholds.length === 0) return;

      let alerts = [];

      thresholds.forEach(t => {
          const map = METRIC_MAPPING[t.metric_key];
          if (!map) return;

          const isOilMetric = t.metric_key.startsWith('oil_');
          if (isOil !== isOilMetric) return;

          const checkValue = (val, keyName) => {
              if (val === null || val === undefined) return;
              const v = parseFloat(val);
              if (isNaN(v)) return;
              
              if (t.max_value !== null && v > t.max_value) {
                  alerts.push({ key: t.metric_key, name: map.name, sub: keyName, val: v, limit: t.max_value, type: 'OVER' });
              } else if (t.min_value !== null && v < t.min_value) {
                  alerts.push({ key: t.metric_key, name: map.name, sub: keyName, val: v, limit: t.min_value, type: 'UNDER' });
              }
          };

          if (map.type === 'global') {
              map.keys.forEach(k => {
                let suffix = k.replace(/_v$/,'').split('_').pop().toUpperCase(); // e.g., 'a', 'ab'
                checkValue(data[k], `Fasa ${suffix}`);
              });
          } else {
              checkValue(data[map.key], '');
          }
      });

      let activeAlerts = [];
      for (const alert of alerts) {
          const cooldownKey = `${dbName}_${trafoId}_${alert.key}_${alert.sub}_${alert.type}`;
          const lastSent = waCooldowns.get(cooldownKey) || 0;
          const now = Date.now();
          
          if (now - lastSent > COOLDOWN_MS) {
              waCooldowns.set(cooldownKey, now);
              activeAlerts.push(alert);
          }
      }

      return activeAlerts;
  } catch (err) {
      console.error("Error checking thresholds:", err.message);
      return [];
  }
}

const startRealtimePoller = (io, activeSubscriptions, roomIntervals) => {
  const lastSeenElectrical = {};
  const lastSeenOil = {};
  const lastEmitTime = {}; 

  setInterval(async () => {
    try {
      const rooms = io.sockets.adapter.rooms;
      const activeTrafos = [];

      for (const [roomName, clients] of rooms.entries()) {
        if (roomName.startsWith("trafo_") && clients.size > 0) {
          const dbName = activeSubscriptions.get(roomName);
          if (dbName) {
            let trafoId = roomName.replace("trafo_", "");
            const prefix = `${dbName}_`;
            if (trafoId.startsWith(prefix)) {
              trafoId = trafoId.substring(prefix.length);
            }
            activeTrafos.push({ trafoId, dbName, roomName });
          }
        }
      }

      const now = Date.now();

      await Promise.allSettled(activeTrafos.map(async ({ trafoId, dbName, roomName }) => {
        const interval = roomIntervals.get(roomName) ?? 5000; 
        const lastEmit = lastEmitTime[roomName] || 0;
        
        if (interval > 0 && now - lastEmit < interval) {
          return; 
        }

        try {
          const db = await getDbConnection(dbName);
          let allAlerts = [];

          const [elecRows] = await db.execute(
            'SELECT * FROM electrical_readings WHERE trafo_id = ? ORDER BY timestamp DESC LIMIT 1',
            [trafoId]
          );
          
          if (elecRows.length > 0) {
            const latestElectrical = elecRows[0];
            const lastId = lastSeenElectrical[roomName];
            if (lastId !== latestElectrical.id) {
              lastSeenElectrical[roomName] = latestElectrical.id;
              lastEmitTime[roomName] = now;
              io.to(roomName).emit("meter", {
                phaseA: parseFloat(latestElectrical.phase_a_v) || 0,
                phaseB: parseFloat(latestElectrical.phase_b_v) || 0,
                phaseC: parseFloat(latestElectrical.phase_c_v) || 0,
                lineAB: parseFloat(latestElectrical.line_ab_v) || 0,
                lineBC: parseFloat(latestElectrical.line_bc_v) || 0,
                lineCA: parseFloat(latestElectrical.line_ca_v) || 0,
                currentA: parseFloat(latestElectrical.current_a) || 0,
                currentB: parseFloat(latestElectrical.current_b) || 0,
                currentC: parseFloat(latestElectrical.current_c) || 0,
                currentN: parseFloat(latestElectrical.current_n) || 0,
                currentUnbalance: parseFloat(latestElectrical.current_unbalance) || 0,
                powerActiveTotal: parseFloat(latestElectrical.power_active_total_kw) || 0,
                powerReactiveTotal: parseFloat(latestElectrical.power_reactive_total_kvar) || 0,
                powerApparentTotal: parseFloat(latestElectrical.power_apparent_total_kva) || 0,
                pfTotal: Number((parseFloat(latestElectrical.pf_total) || 0).toFixed(2)),
                powerActiveA: parseFloat(latestElectrical.power_active_a) || 0,
                powerActiveB: parseFloat(latestElectrical.power_active_b) || 0,
                powerActiveC: parseFloat(latestElectrical.power_active_c) || 0,
                frequency: parseFloat(latestElectrical.frequency) || 0,
                energyActiveTotal: parseFloat(latestElectrical.energy_active_total) || 0,
                energyReactiveTotal: parseFloat(latestElectrical.energy_reactive_total) || 0,
                avgPhaseV: parseFloat(latestElectrical.avg_phase_v) || 0,
                avgLineV: parseFloat(latestElectrical.avg_line_v) || 0,
                avgCurrent: parseFloat(latestElectrical.avg_current) || 0,
                onOffStatus: parseInt(latestElectrical.on_off_status) || 0,
                relayStatus: parseInt(latestElectrical.relay_status) || 0,
                alarmStatus: parseInt(latestElectrical.alarm_status) || 0,
                synced: parseInt(latestElectrical.synced) || 0,
                efficiency: calculateEfficiency(latestElectrical.current_a, latestElectrical.current_b, latestElectrical.current_c),
                timestamp: latestElectrical.timestamp,
                modbus_connected: true,
              });

              // Check thresholds
              const elecAlerts = await checkAndAlert(db, dbName, trafoId, latestElectrical, false);
              if (elecAlerts && elecAlerts.length > 0) allAlerts.push(...elecAlerts);
            }
          }

          const [oilRows] = await db.execute(
            'SELECT * FROM oil_readings WHERE trafo_id = ? ORDER BY timestamp DESC LIMIT 1',
            [trafoId]
          );

          if (oilRows.length > 0) {
            const latestOil = oilRows[0];
            const lastId = lastSeenOil[roomName];
            if (lastId !== latestOil.id) {
              lastSeenOil[roomName] = latestOil.id;
              io.to(roomName).emit("oil_sensor", {
                oil_temperature: parseFloat(latestOil.oil_temperature) || 0,
                oil_pressure: parseFloat(latestOil.oil_pressure) || 0,
                oil_level: latestOil.oil_level == 1,
                oil_level_alarm: (latestOil.oil_level_alarm == 1 || latestOil.oil_level_alarm === true) ? 1 : 0,
                oil_level_trip: (latestOil.oil_level_trip == 1 || latestOil.oil_level_trip === true) ? 1 : 0,
                timestamp: latestOil.timestamp,
                adc_connected: true,
              });

              // Check thresholds
              const oilAlerts = await checkAndAlert(db, dbName, trafoId, latestOil, true);
              if (oilAlerts && oilAlerts.length > 0) allAlerts.push(...oilAlerts);
            }
          }
          
          if (allAlerts.length > 0) {
            sendAlertMessage(db, dbName, trafoId, allAlerts);
          }
        } catch (dbErr) {
          if (dbErr.code === 'ER_BAD_DB_ERROR') {
            console.warn(`Database ${dbName} does not exist. Removing room ${roomName} from active subscriptions to stop polling.`);
            activeSubscriptions.delete(roomName);
          } else {
            console.error(`Error polling DB ${dbName} for ${roomName}:`, dbErr.message);
          }
        }
      }));
    } catch (error) {
      console.error("Realtime poller error:", error);
    }
  }, 1000); 
};

module.exports = startRealtimePoller;
