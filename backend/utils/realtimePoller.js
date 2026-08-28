const { getDbConnection } = require('./db');
const { calculateEfficiency } = require('./efficiency');
const whatsappClient = require('./whatsappClient');
const emailClient = require('./emailClient');

const waCooldowns = new Map(); 
const COOLDOWN_MS = 15 * 60 * 1000; // 15 Menit Jeda

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

async function sendAlertMessage(db, dbName, trafoId, alert) {
  try {
      const condition = alert.type === 'OVER' ? 'Melebihi Batas Maksimal' : 'Kurang Dari Batas Minimal';
      const msg = `⚠️ *[TMU ALERT - ABNORMAL PARAMETER]*\n\nTrafo *${trafoId}* (DB: ${dbName}) mendeteksi anomali pada sensor!\nParameter: *${alert.name} ${alert.sub ? '('+alert.sub+')' : ''}*\nKondisi: *${alert.type}* (${condition})\n\nNilai Saat Saat Ini: *${alert.val}*\nBatas Toleransi: *${alert.limit}*\n\nSilakan segera periksa sistem Anda.\n\n_Pesan otomatis dari PT. Bambang Djaja - TMU System_`;
      
      const emailSubject = `[TMU ALERT] Abnormal Parameter pada Trafo ${trafoId}`;
      const emailMsg = `Peringatan: Anomali sensor terdeteksi!\n\nTrafo: ${trafoId}\nDatabase: ${dbName}\nParameter: ${alert.name} ${alert.sub ? '('+alert.sub+')' : ''}\nKondisi: ${alert.type} (${condition})\nNilai Saat Ini: ${alert.val}\nBatas Toleransi: ${alert.limit}\n\nSilakan segera periksa sistem Anda.\n\nPesan otomatis dari PT. Bambang Djaja - TMU System`;

      // Log alert to DB
      try {

        await db.execute(
          `INSERT INTO alert_logs (alert_type, parameter_name, condition_text, current_value, threshold_limit) VALUES (?, ?, ?, ?, ?)`,
          [alert.type, `${alert.name} ${alert.sub ? '('+alert.sub+')' : ''}`, condition, alert.val.toString(), alert.limit.toString()]
        );
      } catch (dbErr) {
        console.error("Failed to log alert to DB:", dbErr.message);
      }
      
      let phones = [];
      let emails = [];

      // Dapatkan user dari tenant DB
      const [columnsInfo] = await db.execute("SHOW COLUMNS FROM users");
      const columns = columnsInfo.map(c => c.Field);
      
      let selectCols = [];
      if (columns.includes('nomor_telpon')) selectCols.push('nomor_telpon');
      if (columns.includes('email')) selectCols.push('email');
      
      if (selectCols.length > 0) {
          const [tenantUsers] = await db.execute(`SELECT ${selectCols.join(', ')} FROM users`);
          tenantUsers.forEach(u => {
              if (u.nomor_telpon && u.nomor_telpon.length >= 10) phones.push(u.nomor_telpon.trim());
              if (u.email && u.email.includes('@')) emails.push(u.email.trim());
          });
      }
      
      // Dapatkan superuser dari tmu_master
      const masterDb = await getDbConnection('tmu_master');
      const [masterColumnsInfo] = await masterDb.execute("SHOW COLUMNS FROM users");
      const masterColumns = masterColumnsInfo.map(c => c.Field);
      
      let masterSelectCols = [];
      if (masterColumns.includes('nomor_telpon')) masterSelectCols.push('nomor_telpon');
      if (masterColumns.includes('email')) masterSelectCols.push('email');
      
      if (masterSelectCols.length > 0) {
          const [superusers] = await masterDb.execute(`SELECT ${masterSelectCols.join(', ')} FROM users WHERE role = 'superuser'`);
          superusers.forEach(u => {
              if (u.nomor_telpon && u.nomor_telpon.length >= 10) phones.push(u.nomor_telpon.trim());
              if (u.email && u.email.includes('@')) emails.push(u.email.trim());
          });
      }
      
      // Hilangkan duplikat
      phones = [...new Set(phones)];
      emails = [...new Set(emails)];
      
      // Kirim WhatsApp satu-satu dengan jeda 3 detik
      for (const phone of phones) {
          await whatsappClient.sendWhatsAppMessage(phone, msg).catch(() => {});
          await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Kirim Email
      for (const email of emails) {
          await emailClient.sendEmailMessage(email, emailSubject, emailMsg).catch(() => {});
      }
  } catch (err) {
      console.error("Error sending alert:", err.message);
  }
}

async function checkAndAlert(db, dbName, trafoId, data, isOil = false) {
  if (!whatsappClient.waReady) return;

  try {
      const [tables] = await db.execute("SHOW TABLES LIKE 'threshold_settings'");
      if (tables.length === 0) return;

      const [thresholds] = await db.execute("SELECT * FROM threshold_settings WHERE is_active = 1");
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

      for (const alert of alerts) {
          const cooldownKey = `${dbName}_${trafoId}_${alert.key}_${alert.sub}_${alert.type}`;
          const lastSent = waCooldowns.get(cooldownKey) || 0;
          const now = Date.now();
          
          if (now - lastSent > COOLDOWN_MS) {
              waCooldowns.set(cooldownKey, now);
              // Jalankan secara asinkron agar tidak mem-blokir poller
              sendAlertMessage(db, dbName, trafoId, alert);
          }
      }
  } catch (err) {
      console.error("Error checking thresholds:", err.message);
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
            const trafoId = roomName.replace("trafo_", "");
            activeTrafos.push({ trafoId, dbName, roomName });
          }
        }
      }

      const now = Date.now();

      for (const { trafoId, dbName, roomName } of activeTrafos) {
        const interval = roomIntervals.get(roomName) ?? 5000; 
        const lastEmit = lastEmitTime[roomName] || 0;
        
        if (interval > 0 && now - lastEmit < interval) {
          continue; 
        }

        try {
          const db = await getDbConnection(dbName);

          const [elecRows] = await db.execute(
            'SELECT * FROM electrical_readings ORDER BY timestamp DESC LIMIT 1'
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
                pfTotal: parseFloat(latestElectrical.pf_total) || 0,
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
              checkAndAlert(db, dbName, trafoId, latestElectrical, false);
            }
          }

          const [oilRows] = await db.execute(
            'SELECT * FROM oil_readings ORDER BY timestamp DESC LIMIT 1'
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
              checkAndAlert(db, dbName, trafoId, latestOil, true);
            }
          }
        } catch (dbErr) {
          if (dbErr.code === 'ER_BAD_DB_ERROR') {
            console.warn(`Database ${dbName} does not exist. Removing room ${roomName} from active subscriptions to stop polling.`);
            activeSubscriptions.delete(roomName);
          } else {
            console.error(`Error polling DB ${dbName} for ${roomName}:`, dbErr.message);
          }
        }
      }
    } catch (error) {
      console.error("Realtime poller error:", error);
    }
  }, 1000); 
};

module.exports = startRealtimePoller;
