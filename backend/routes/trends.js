const express = require('express');
const router = express.Router();
const { getDbConnection, getMasterDb } = require('../utils/db');
const rm = require('../utils/readingModel');
const sm = require('../utils/statusModel');
const tm = require('../utils/trafoModel');
const { buildLimits } = require('../utils/limitsModel');
const th = require('../utils/trendsHelpers');

router.use(async (req, res, next) => {
  const dbName = req.headers['x-db-name'] || req.query.db_name || req.user?.dbName;
  if (!dbName) return res.status(400).json({ error: 'Missing X-DB-Name header' });
  try {
    req.dbName = dbName;
    req.db = await getDbConnection(dbName);
    req.trafoId = parseInt(req.query.trafo_id || req.headers['x-trafo-id'] || 1, 10) || 1;
    next();
  } catch (e) {
    res.status(500).json({ error: 'Database tidak bisa diakses: ' + e.message });
  }
});

async function withDerived(req, points) {
  const td = await tm.getTransformerData(req.db, req.trafoId);
  return points.map(p => rm.computeDerived(p, td));
}

async function getSettings(db, trafoId) {
  const [rows] = await db.execute('SELECT * FROM transformer_settings WHERE trafoId = ? LIMIT 1', [trafoId]);
  return rows[0] || null;
}

// Historis dengan rentang (dipakai TrendDataContext.fetchRangeData)
router.get('/', async (req, res) => {
  const { start, end, interval } = req.query;
  try {
    let points;
    if (start && end) {
      points = await rm.getHistory(req.db, req.trafoId, start, end, interval || 0);
      if (points.length === 0) return res.status(404).json({ error: await th.checkClosestData(req.db, req.trafoId, start, end) });
    } else {
      points = await rm.getRealtimeSeries(req.db, req.trafoId, 60);
    }
    res.json(await withDerived(req, points));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 60 baris realtime terakhir (dipakai TrendDataContext.fetchLiveInitial)
router.get('/meter', async (req, res) => {
  const { start, end } = req.query;
  try {
    const points = start && end
      ? await rm.getHistory(req.db, req.trafoId, start, end, 0)
      : await rm.getRealtimeSeries(req.db, req.trafoId, 60);
    res.json(await withDerived(req, points));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/oil', async (req, res) => {
  const { start, end } = req.query;
  try {
    const [points, status] = await Promise.all([
      start && end ? rm.getHistory(req.db, req.trafoId, start, end, 0, ['oil_temperature', 'oil_pressure', 'oilLevelRaw'])
                   : rm.getRealtimeSeries(req.db, req.trafoId, 60),
      tm.getStatusRow(req.db, req.trafoId),
    ]);
    const code = status ? status.OilLevel : 3;
    res.json(points.map(p => th.oilPoint(p, code)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export-count', async (req, res) => {
  const { start, end, interval } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'Missing start or end parameter' });
  try {
    const [[{ total }]] = await req.db.execute('SELECT COUNT(*) AS total FROM reading_data WHERE trafoId = ? AND timestamp >= ? AND timestamp <= ?', [req.trafoId, start, end]);
    const intv = parseInt(interval, 10) || 0;
    res.json({ total: intv > 60 ? Math.floor(total / (intv / 60)) : total });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

const EXPORT_ELECTRICAL = [
  ['phaseA', 'Phase A (V)'], ['phaseB', 'Phase B (V)'], ['phaseC', 'Phase C (V)'],
  ['lineAB', 'Line AB (V)'], ['lineBC', 'Line BC (V)'], ['lineCA', 'Line CA (V)'],
  ['currentA', 'Current A (A)'], ['currentB', 'Current B (A)'], ['currentC', 'Current C (A)'], ['currentN', 'Current N (A)'],
  ['powerActiveTotal', 'Power Active Total (kW)'], ['powerReactiveTotal', 'Power Reactive Total (kVAR)'], ['powerApparentTotal', 'Power Apparent Total (kVA)'],
  ['pfTotal', 'PF Total'], ['frequency', 'Frequency (Hz)'],
  ['energyActiveTotal', 'Energy Active (kWh)'], ['energyReactiveTotal', 'Energy Reactive (kVARh)'],
  ['thdVA', 'THD V A (%)'], ['thdVB', 'THD V B (%)'], ['thdVC', 'THD V C (%)'],
  ['thdIA', 'THD I A (%)'], ['thdIB', 'THD I B (%)'], ['thdIC', 'THD I C (%)'],
  ['efficiency', 'Efficiency (%)'],
];
const EXPORT_OIL = [
  ['oil_temperature', 'Oil Temperature (°C)'], ['oil_pressure', 'Oil Pressure (Bar)'],
  ['wtiA', 'WTI A (°C)'], ['wtiB', 'WTI B (°C)'], ['wtiC', 'WTI C (°C)'],
  ['busTempA', 'Bus Temp A (°C)'], ['busTempB', 'Bus Temp B (°C)'], ['busTempC', 'Bus Temp C (°C)'],
  ['h2ppm', 'H2 (ppm)'], ['moisturePpm', 'Moisture (ppm)'],
];

router.get('/export', async (req, res) => {
  const { start, end, interval } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'Missing start or end parameter' });
  try {
    const ExcelJS = require('exceljs');
    const points = await rm.getHistory(req.db, req.trafoId, start, end, parseInt(interval, 10) || 0);
    if (points.length === 0) return res.status(404).json({ error: await th.checkClosestData(req.db, req.trafoId, start, end) });
    const rows = await withDerived(req, points);
    const status = await tm.getStatusRow(req.db, req.trafoId);
    const flags = sm.oilFlags(status && status.OilLevel);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Export_${start}_to_${end}.xlsx`);
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true, useSharedStrings: false });
    const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
    const styleHeader = (sheet, argb) => {
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
      sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    };

    const sheet = workbook.addWorksheet('Trend Data');
    sheet.columns = [{ header: 'Waktu (Time)', key: 'time', width: 25 }, ...EXPORT_ELECTRICAL.map(([key, header]) => ({ header, key, width: 18 }))];
    styleHeader(sheet, 'FF0052CC');
    for (const p of rows) {
      const row = { time: new Date(p.timestamp).toLocaleString('id-ID') };
      for (const [key] of EXPORT_ELECTRICAL) row[key] = r2(p[key]);
      sheet.addRow(row).commit();
    }
    sheet.commit();

    const oilSheet = workbook.addWorksheet('Oil Data');
    oilSheet.columns = [{ header: 'Waktu (Time)', key: 'time', width: 25 }, ...EXPORT_OIL.map(([key, header]) => ({ header, key, width: 20 })),
      { header: 'Oil Level Alarm', key: 'oilAlarm', width: 18 }, { header: 'Oil Level Trip', key: 'oilTrip', width: 18 }];
    styleHeader(oilSheet, 'FFFF6600');
    for (const p of rows) {
      const row = { time: new Date(p.timestamp).toLocaleString('id-ID'), oilAlarm: flags.oil_level_alarm ? 'Safe' : 'Alarm', oilTrip: flags.oil_level_trip ? 'Safe' : 'Trip' };
      for (const [key] of EXPORT_OIL) row[key] = r2(p[key]);
      oilSheet.addRow(row).commit();
    }
    oilSheet.commit();
    await workbook.commit();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: 'Gagal mengekspor data' });
  }
});

// Nama field lama dipertahankan untuk PerformanceReport; baris baru ditambahkan.
const REPORT_FIELDS = [
  ['phaseA', 'phase_a'], ['phaseB', 'phase_b'], ['phaseC', 'phase_c'],
  ['lineAB', 'line_ab'], ['lineBC', 'line_bc'], ['lineCA', 'line_ca'],
  ['currentA', 'current_a'], ['currentB', 'current_b'], ['currentC', 'current_c'], ['currentN', 'current_n'],
  ['powerActiveTotal', 'power_active'], ['powerReactiveTotal', 'power_reactive'], ['powerApparentTotal', 'power_apparent'],
  ['pfTotal', 'pf'], ['frequency', 'frequency'], ['energyActiveTotal', 'energy_active'], ['energyReactiveTotal', 'energy_reactive'],
  ['thdVA', 'thd_v_a'], ['thdVB', 'thd_v_b'], ['thdVC', 'thd_v_c'], ['thdIA', 'thd_i_a'], ['thdIB', 'thd_i_b'], ['thdIC', 'thd_i_c'],
  ['h2ppm', 'h2ppm'], ['moisturePpm', 'moisture_ppm'], ['avgCurrent', 'avg_current'],
];
const REPORT_OIL_FIELDS = [
  ['oil_temperature', 'oil_temp'], ['oil_pressure', 'oil_press'],
  ['wtiA', 'wti_a'], ['wtiB', 'wti_b'], ['wtiC', 'wti_c'], ['busTempA', 'bus_temp_a'], ['busTempB', 'bus_temp_b'], ['busTempC', 'bus_temp_c'],
];

router.get('/report', async (req, res) => {
  const { start, end } = req.query;
  try {
    const all = [...REPORT_FIELDS, ...REPORT_OIL_FIELDS];
    const select = all.map(([key]) => {
      const col = rm.KEY_TO_COLUMN[key];
      const div = rm.WATT_COLUMNS.has(col) ? '/1000' : '';
      return `MIN(\`${col}\`)${div} AS min_${key}, MAX(\`${col}\`)${div} AS max_${key}, AVG(\`${col}\`)${div} AS avg_${key}`;
    }).join(', ');
    const where = start && end ? 'AND timestamp >= ? AND timestamp <= ?' : '';
    const params = start && end ? [req.trafoId, start, end] : [req.trafoId];
    const [[agg]] = await req.db.query(`SELECT ${select} FROM reading_data WHERE trafoId = ? ${where}`, params);

    const pick = (fields) => {
      const out = {};
      for (const [key, name] of fields) {
        for (const k of ['min', 'max', 'avg']) {
          const v = agg[`${k}_${key}`];
          out[`${k}_${name}`] = v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100;
        }
      }
      return out;
    };
    const electrical = pick(REPORT_FIELDS);
    const oil = pick(REPORT_OIL_FIELDS);

    const td = await tm.getTransformerData(req.db, req.trafoId);
    electrical.avg_efficiency = rm.computeEfficiency({ avgCurrent: agg.avg_avgCurrent }, td);

    const [[fl]] = await req.db.query(
      `SELECT SUM(CASE WHEN failure_type LIKE '%Alarm%' THEN 1 ELSE 0 END) AS alarm_triggers,
              SUM(CASE WHEN failure_type LIKE '%Trip%' THEN 1 ELSE 0 END) AS trip_triggers
       FROM failure_log WHERE trafoId = ? ${start && end ? 'AND time_start >= ? AND time_start <= ?' : ''}`, params);
    oil.alarm_triggers = Number(fl.alarm_triggers || 0);
    oil.trip_triggers = Number(fl.trip_triggers || 0);

    res.json({ electrical, oil, trafoId: req.trafoId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error generating report' });
  }
});

router.get('/thi', async (req, res) => {
  try {
    const [latest, td, settings, status] = await Promise.all([
      rm.getLatest(req.db, req.trafoId), tm.getTransformerData(req.db, req.trafoId), getSettings(req.db, req.trafoId), tm.getStatusRow(req.db, req.trafoId),
    ]);
    const limits = buildLimits(settings, td);
    const point = latest ? rm.computeDerived(latest, td) : {};
    const keys = req.query.metrics ? String(req.query.metrics).split(',').map(s => s.trim()).filter(Boolean)
      : ['phaseA', 'phaseB', 'phaseC', 'currentA', 'currentB', 'currentC', 'pfTotal', 'frequency'];
    const evaluatedMetrics = keys.map(k => th.evaluateMetric(k, point[k] ?? null, limits[k]));
    const summary = sm.buildStatusItems(status, []);
    const overallScore = th.healthScore(summary.counts);
    const overallStatus = overallScore >= 90 ? 'EXCELLENT' : overallScore >= 75 ? 'GOOD' : overallScore >= 50 ? 'FAIR / WARNING' : 'CRITICAL';
    const overallColor = overallScore >= 90 ? '#10b981' : overallScore >= 75 ? '#3b82f6' : overallScore >= 50 ? '#f59e0b' : '#ef4444';
    res.json({ success: true, overallScore, overallStatus, overallColor, counts: summary.counts, evaluatedMetrics, limits, timestamp: latest ? latest.timestamp : new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute THI', details: error.message });
  }
});

router.get('/events', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const [logs] = await req.db.query('SELECT rowId, failure_id, time_start, duration, failure_type, parameter, parameterValue FROM failure_log WHERE trafoId = ? ORDER BY time_start DESC LIMIT ?', [req.trafoId, limit]);
    const events = logs.map(th.failureToEvent);

    const status = await tm.getStatusRow(req.db, req.trafoId);
    const now = new Date();
    for (const item of sm.buildStatusItems(status, []).items) {
      if (item.level === 'normal') continue;
      events.push({ id: `st-${item.parameter}`, timestamp: now.toISOString(), time: now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }),
        level: item.level === 'trip' ? 'CRITICAL' : 'ALARM', source: item.parameter, msg: `${item.parameter} sedang ${item.label}` });
    }
    if (events.length === 0) {
      const latest = await rm.getLatest(req.db, req.trafoId);
      events.push({ id: 'ok-latest', timestamp: latest ? latest.timestamp : now.toISOString(), time: latest ? latest.time : now.toLocaleTimeString('id-ID'),
        level: 'OK', source: 'TMU', msg: latest ? `Semua parameter normal (Vab ${latest.lineAB} V, ${latest.frequency} Hz)` : 'Belum ada data dari Raspi' });
    }
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ success: true, total: events.length, events: events.slice(0, limit), source: 'database', db: req.dbName });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event stream', details: error.message });
  }
});

router.get('/news', async (req, res) => {
  try {
    const td = await tm.getTransformerData(req.db, req.trafoId);
    const latest = await rm.getLatest(req.db, req.trafoId);
    const [[agg]] = await req.db.execute(
      'SELECT COUNT(*) AS n, AVG(`OilTemp`) AS avg_temp, MAX(`OilTemp`) AS max_temp, AVG(`PFsig`) AS avg_pf, MAX(timestamp) AS latest_ts FROM reading_data WHERE trafoId = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)', [req.trafoId]);
    const status = sm.buildStatusItems(await tm.getStatusRow(req.db, req.trafoId), []);
    const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : 'Live');
    const bulletins = [
      { id: 'news-asset', tag: 'Asset', color: 'text-blue-500',
        title: `Trafo ${td ? td.trafoSerialNo : req.trafoId} (${td ? td.ratedPower : '-'} kVA) di ${req.dbName}`,
        summary: `Raspi ${td ? td.raspiSerialNo : '-'}, ${td ? td.ratedHighVoltage : '-'}/${td ? td.ratedLowVoltage : '-'} kV, vector group ${td ? td.vectorGroup : '-'}.`,
        date: 'Nameplate', timestamp: new Date().toISOString() },
    ];
    if (latest) {
      bulletins.push({ id: 'news-energy', tag: 'Telemetry', color: 'text-emerald-500',
        title: `Energi kumulatif ${(latest.energyActiveTotal / 1000).toFixed(2)} MWh`,
        summary: `${Number(agg.n || 0).toLocaleString('id-ID')} titik data 24 jam terakhir. PF rata-rata ${Number(agg.avg_pf || 0).toFixed(2)}.`,
        date: fmtTime(agg.latest_ts), timestamp: agg.latest_ts || latest.timestamp });
    }
    if (agg.avg_temp) {
      bulletins.push({ id: 'news-thermal', tag: 'Diagnostics', color: 'text-amber-500',
        title: `Suhu oli rata-rata ${Number(agg.avg_temp).toFixed(1)}°C (maks ${Number(agg.max_temp).toFixed(1)}°C)`,
        summary: `Tekanan tangki terakhir ${latest ? latest.oil_pressure : '-'} Bar, H2 ${latest ? latest.h2ppm : '-'} ppm.`,
        date: fmtTime(agg.latest_ts), timestamp: agg.latest_ts || new Date().toISOString() });
    }
    bulletins.push({ id: 'news-status', tag: 'Policy', color: status.allSafe ? 'text-indigo-500' : 'text-red-500',
      title: status.allSafe ? 'Semua 29 parameter status Normal' : `${status.counts.alarm} alarm, ${status.counts.trip} trip aktif`,
      summary: status.allSafe ? 'Threshold dari transformer_settings dipantau oleh Raspi dan server.' : status.items.filter(i => i.level !== 'normal').map(i => `${i.parameter}: ${i.label}`).join(', '),
      date: 'Status', timestamp: new Date().toISOString() });
    res.json({ success: true, total: bulletins.length, bulletins, source: 'database', db: req.dbName });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate operational news', details: error.message });
  }
});

module.exports = router;
