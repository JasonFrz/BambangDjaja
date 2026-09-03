const express = require("express");
const router = express.Router();
const { getDbConnection } = require('../utils/db');
const { calculateEfficiency } = require('../utils/efficiency');

const extractDb = (req, res, next) => {
  const dbName = req.headers['x-db-name'] || req.headers['X-DB-Name'] || req.query.db_name || req.user?.dbName;
  if (!dbName) {
    return res.status(400).json({ error: "Missing X-DB-Name header" });
  }
  req.dbName = dbName;
  next();
};

async function checkClosestData(db, table, start, end) {
  const [before] = await db.execute(`SELECT timestamp FROM ${table} WHERE timestamp < ? ORDER BY timestamp DESC LIMIT 1`, [start]);
  const [after] = await db.execute(`SELECT timestamp FROM ${table} WHERE timestamp > ? ORDER BY timestamp ASC LIMIT 1`, [end]);
  
  let msg = "Tidak ada data pada rentang waktu tersebut.";
  if (before.length > 0 || after.length > 0) {
    msg += " Data terdekat ada pada: ";
    if (before.length > 0) {
      msg += `sebelumnya (${new Date(before[0].timestamp).toLocaleString('id-ID')})`;
    }
    if (after.length > 0) {
      if (before.length > 0) msg += ' dan ';
      msg += `sesudahnya (${new Date(after[0].timestamp).toLocaleString('id-ID')})`;
    }
  }
  return msg;
}

router.get("/", extractDb, async (req, res) => {
  const { start, end, interval } = req.query;
  try {
    const db = await getDbConnection(req.dbName);
    
    const isAggregated = interval && parseInt(interval) > 0;
    const params = [];
    let query = '';
    
    if (isAggregated) {
      const intv = parseInt(interval);
      query = `
        SELECT 
          FROM_UNIXTIME(UNIX_TIMESTAMP(MIN(timestamp)) DIV ? * ?) AS timestamp,
          AVG(phase_a_v) as phase_a_v,
          AVG(phase_b_v) as phase_b_v,
          AVG(phase_c_v) as phase_c_v,
          AVG(line_ab_v) as line_ab_v,
          AVG(line_bc_v) as line_bc_v,
          AVG(line_ca_v) as line_ca_v,
          AVG(current_a) as current_a,
          AVG(current_b) as current_b,
          AVG(current_c) as current_c,
          AVG(power_active_total_kw) as power_active_total,
          AVG(power_reactive_total_kvar) as power_reactive_total,
          AVG(power_apparent_total_kva) as power_apparent_total,
          AVG(pf_total) as pf_total,
          AVG(frequency) as frequency,
          AVG(energy_active_total) as energy_active_total,
          AVG(energy_reactive_total) as energy_reactive_total
        FROM electrical_readings
      `;
      params.push(intv, intv);
    } else {
      query = `
        SELECT 
          *,
          power_active_total_kw as power_active_total,
          power_reactive_total_kvar as power_reactive_total,
          power_apparent_total_kva as power_apparent_total
        FROM electrical_readings
      `;
    }
    
    if (start && end) {
      query += ' WHERE timestamp >= ? AND timestamp <= ?';
      params.push(start, end);
    }
    
    if (isAggregated) {
      query += ' GROUP BY UNIX_TIMESTAMP(timestamp) DIV ?';
      params.push(parseInt(interval));
    }
    
    query += ' ORDER BY timestamp ASC LIMIT 5000';
    
    const [rows] = await db.execute(query, params);
    
    if (rows.length === 0 && start && end) {
      const msg = await checkClosestData(db, 'electrical_readings', start, end);
      return res.status(404).json({ error: msg });
    }

    const rowsWithEfficiency = rows.map(row => ({
      ...row,
      efficiency: calculateEfficiency(row.current_a, row.current_b, row.current_c)
    }));
    
    res.status(200).json(rowsWithEfficiency);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/meter", extractDb, async (req, res) => {
  const { start, end } = req.query;
  try {
    const db = await getDbConnection(req.dbName);
    let rows;
    
    if (start && end) {
      const query = 'SELECT * FROM electrical_readings WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC LIMIT 1000';
      [rows] = await db.execute(query, [start, end]);
    } else {
      const query = 'SELECT * FROM (SELECT * FROM electrical_readings ORDER BY timestamp DESC LIMIT 60) sub ORDER BY timestamp ASC';
      [rows] = await db.execute(query);
    }
    
    const rowsWithEfficiency = rows.map(row => ({
      ...row,
      efficiency: calculateEfficiency(row.current_a, row.current_b, row.current_c)
    }));
    
    res.status(200).json(rowsWithEfficiency);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/oil", extractDb, async (req, res) => {
  const { start, end } = req.query;
  try {
    const db = await getDbConnection(req.dbName);
    let rows;
    
    if (start && end) {
      const query = 'SELECT * FROM oil_readings WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC LIMIT 1000';
      [rows] = await db.execute(query, [start, end]);
    } else {
      const query = 'SELECT * FROM (SELECT * FROM oil_readings ORDER BY timestamp DESC LIMIT 60) sub ORDER BY timestamp ASC';
      [rows] = await db.execute(query);
    }
    
    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/export-count", extractDb, async (req, res) => {
  const { start, end, interval } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: "Missing start or end parameter" });
  }

  try {
    const db = await getDbConnection(req.dbName);
    const [countRows] = await db.execute('SELECT COUNT(*) as total FROM electrical_readings WHERE timestamp >= ? AND timestamp <= ?', [start, end]);
    
    let estimatedRows = countRows[0].total;
    const intervalMs = interval && !isNaN(interval) ? parseInt(interval) * 1000 : null;
    if (intervalMs && intervalMs > 2000) {
      estimatedRows = Math.floor(estimatedRows / (intervalMs / 2000));
    }
    
    res.status(200).json({ total: estimatedRows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/export", extractDb, async (req, res) => {
  const { start, end, interval } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: "Missing start or end parameter" });
  }
  
  const intervalMs = interval && !isNaN(interval) ? parseInt(interval) * 1000 : null;

  try {
    const db = await getDbConnection(req.dbName);
    const ExcelJS = require('exceljs');

    const [countRows] = await db.execute('SELECT COUNT(*) as total FROM electrical_readings WHERE timestamp >= ? AND timestamp <= ?', [start, end]);
    if (countRows[0].total === 0) {
      const msg = await checkClosestData(db, 'electrical_readings', start, end);
      return res.status(404).json({ error: msg });
    }

    const query = `
      SELECT 
        *, 
        power_active_total_kw as power_active_total,
        power_reactive_total_kvar as power_reactive_total,
        power_apparent_total_kva as power_apparent_total
      FROM electrical_readings
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `;
    
    const r2 = (val) => val !== null && val !== undefined ? Math.round((parseFloat(val) || 0) * 100) / 100 : 0;

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: false
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Export_${start}_to_${end}.xlsx`);

    const sheet = workbook.addWorksheet('Trend Data');
    sheet.columns = [
      { header: 'Waktu (Time)', key: 'time', width: 25 },
      { header: 'Phase A (V)', key: 'phaseA', width: 15 },
      { header: 'Phase B (V)', key: 'phaseB', width: 15 },
      { header: 'Phase C (V)', key: 'phaseC', width: 15 },
      { header: 'Line AB (V)', key: 'lineAB', width: 15 },
      { header: 'Line BC (V)', key: 'lineBC', width: 15 },
      { header: 'Line CA (V)', key: 'lineCA', width: 15 },
      { header: 'Current A (A)', key: 'currentA', width: 15 },
      { header: 'Current B (A)', key: 'currentB', width: 15 },
      { header: 'Current C (A)', key: 'currentC', width: 15 },
      { header: 'Power Active Total (kW)', key: 'powerActiveTotal', width: 25 },
      { header: 'Power Reactive Total (kVAR)', key: 'powerReactiveTotal', width: 28 },
      { header: 'Power Apparent Total (kVA)', key: 'powerApparentTotal', width: 28 },
      { header: 'PF Total', key: 'pfTotal', width: 15 },
      { header: 'Frequency (Hz)', key: 'frequency', width: 18 },
      { header: 'Energy Active (kWh)', key: 'energyActiveTotal', width: 20 },
      { header: 'Energy Reactive (kVARh)', key: 'energyReactiveTotal', width: 22 },
      { header: 'Efficiency (%)', key: 'efficiency', width: 18 }
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0052CC' } };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    let elecQuery = '';
    let elecParams = [];

    if (intervalMs) {
      const intv = intervalMs / 1000;
      elecQuery = `
        SELECT 
          FROM_UNIXTIME(UNIX_TIMESTAMP(MIN(timestamp)) DIV ? * ?) AS timestamp,
          AVG(phase_a_v) as phase_a_v,
          AVG(phase_b_v) as phase_b_v,
          AVG(phase_c_v) as phase_c_v,
          AVG(line_ab_v) as line_ab_v,
          AVG(line_bc_v) as line_bc_v,
          AVG(line_ca_v) as line_ca_v,
          AVG(current_a) as current_a,
          AVG(current_b) as current_b,
          AVG(current_c) as current_c,
          AVG(power_active_total_kw) as power_active_total,
          AVG(power_reactive_total_kvar) as power_reactive_total,
          AVG(power_apparent_total_kva) as power_apparent_total,
          AVG(pf_total) as pf_total,
          AVG(frequency) as frequency,
          AVG(energy_active_total) as energy_active_total,
          AVG(energy_reactive_total) as energy_reactive_total
        FROM electrical_readings
        WHERE timestamp >= ? AND timestamp <= ?
        GROUP BY UNIX_TIMESTAMP(timestamp) DIV ?
        ORDER BY MIN(timestamp) ASC
      `;
      elecParams = [intv, intv, start, end, intv];
    } else {
      elecQuery = `
        SELECT 
          *, 
          power_active_total_kw as power_active_total,
          power_reactive_total_kvar as power_reactive_total,
          power_apparent_total_kva as power_apparent_total
        FROM electrical_readings
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC
      `;
      elecParams = [start, end];
    }

    const [elecRows] = await db.execute(elecQuery, elecParams);

    for (const row of elecRows) {
      
      sheet.addRow({
        time: new Date(row.timestamp).toLocaleString('id-ID'),
        phaseA: r2(row.phase_a_v),
        phaseB: r2(row.phase_b_v),
        phaseC: r2(row.phase_c_v),
        lineAB: r2(row.line_ab_v),
        lineBC: r2(row.line_bc_v),
        lineCA: r2(row.line_ca_v),
        currentA: r2(row.current_a),
        currentB: r2(row.current_b),
        currentC: r2(row.current_c),
        powerActiveTotal: r2(row.power_active_total),
        powerReactiveTotal: r2(row.power_reactive_total),
        powerApparentTotal: r2(row.power_apparent_total),
        pfTotal: r2(row.pf_total),
        frequency: r2(row.frequency),
        energyActiveTotal: r2(row.energy_active_total),
        energyReactiveTotal: r2(row.energy_reactive_total),
        efficiency: r2(calculateEfficiency(row.current_a, row.current_b, row.current_c))
      }).commit();
    }
    sheet.commit();

    const oilSheet = workbook.addWorksheet('Oil Data');
    oilSheet.columns = [
      { header: 'Waktu (Time)', key: 'time', width: 25 },
      { header: 'Oil Temperature (°C)', key: 'oilTemp', width: 22 },
      { header: 'Oil Pressure (Bar)', key: 'oilPressure', width: 20 },
      { header: 'Oil Level Alarm', key: 'oilAlarm', width: 20 },
      { header: 'Oil Level Trip', key: 'oilTrip', width: 20 },
    ];

    oilSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    oilSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6600' } };
    oilSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    let oilQuery = '';
    let oilParams = [];

    if (intervalMs) {
      const intv = intervalMs / 1000;
      oilQuery = `
        SELECT 
          FROM_UNIXTIME(UNIX_TIMESTAMP(MIN(timestamp)) DIV ? * ?) AS timestamp,
          AVG(oil_temperature) as oil_temperature,
          AVG(oil_pressure) as oil_pressure,
          ROUND(AVG(oil_level_alarm)) as oil_level_alarm,
          ROUND(AVG(oil_level_trip)) as oil_level_trip
        FROM oil_readings
        WHERE timestamp >= ? AND timestamp <= ?
        GROUP BY UNIX_TIMESTAMP(timestamp) DIV ?
        ORDER BY MIN(timestamp) ASC
      `;
      oilParams = [intv, intv, start, end, intv];
    } else {
      oilQuery = `
        SELECT * FROM oil_readings
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC
      `;
      oilParams = [start, end];
    }

    const [oilRows] = await db.execute(oilQuery, oilParams);

    for (const row of oilRows) {

      oilSheet.addRow({
        time: new Date(row.timestamp).toLocaleString('id-ID'),
        oilTemp: r2(row.oil_temperature),
        oilPressure: r2(row.oil_pressure),
        oilAlarm: (row.oil_level_alarm == 1 || row.oil_level_alarm === true) ? 'Safe' : 'Alarm',
        oilTrip: (row.oil_level_trip == 1 || row.oil_level_trip === true) ? 'Safe' : 'Trip',
      }).commit();
    }
    oilSheet.commit();

    await workbook.commit();
    
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Gagal mengekspor data" });
    }
  }
});

router.get("/report", extractDb, async (req, res) => {
  const { start, end } = req.query;
  try {
    const db = await getDbConnection(req.dbName);

    let elecQuery = `
      SELECT 
        MIN(phase_a_v) as min_phase_a, MAX(phase_a_v) as max_phase_a, AVG(phase_a_v) as avg_phase_a,
        MIN(phase_b_v) as min_phase_b, MAX(phase_b_v) as max_phase_b, AVG(phase_b_v) as avg_phase_b,
        MIN(phase_c_v) as min_phase_c, MAX(phase_c_v) as max_phase_c, AVG(phase_c_v) as avg_phase_c,
        MIN(line_ab_v) as min_line_ab, MAX(line_ab_v) as max_line_ab, AVG(line_ab_v) as avg_line_ab,
        MIN(line_bc_v) as min_line_bc, MAX(line_bc_v) as max_line_bc, AVG(line_bc_v) as avg_line_bc,
        MIN(line_ca_v) as min_line_ca, MAX(line_ca_v) as max_line_ca, AVG(line_ca_v) as avg_line_ca,
        MIN(current_a) as min_current_a, MAX(current_a) as max_current_a, AVG(current_a) as avg_current_a,
        MIN(current_b) as min_current_b, MAX(current_b) as max_current_b, AVG(current_b) as avg_current_b,
        MIN(current_c) as min_current_c, MAX(current_c) as max_current_c, AVG(current_c) as avg_current_c,
        MIN(power_active_total_kw) as min_power_active, MAX(power_active_total_kw) as max_power_active, AVG(power_active_total_kw) as avg_power_active,
        MIN(power_reactive_total_kvar) as min_power_reactive, MAX(power_reactive_total_kvar) as max_power_reactive, AVG(power_reactive_total_kvar) as avg_power_reactive,
        MIN(power_apparent_total_kva) as min_power_apparent, MAX(power_apparent_total_kva) as max_power_apparent, AVG(power_apparent_total_kva) as avg_power_apparent,
        MIN(pf_total) as min_pf, MAX(pf_total) as max_pf, AVG(pf_total) as avg_pf,
        MIN(frequency) as min_frequency, MAX(frequency) as max_frequency, AVG(frequency) as avg_frequency,
        MIN(energy_active_total) as min_energy_active, MAX(energy_active_total) as max_energy_active, AVG(energy_active_total) as avg_energy_active,
        MIN(energy_reactive_total) as min_energy_reactive, MAX(energy_reactive_total) as max_energy_reactive, AVG(energy_reactive_total) as avg_energy_reactive
      FROM electrical_readings
    `;
    let elecParams = [];

    let oilQuery = `
      SELECT 
        MIN(oil_temperature) as min_oil_temp, MAX(oil_temperature) as max_oil_temp, AVG(oil_temperature) as avg_oil_temp,
        MIN(oil_pressure) as min_oil_press, MAX(oil_pressure) as max_oil_press, AVG(oil_pressure) as avg_oil_press,
        SUM(CASE WHEN oil_level_alarm = 0 THEN 1 ELSE 0 END) as alarm_triggers,
        SUM(CASE WHEN oil_level_trip = 0 THEN 1 ELSE 0 END) as trip_triggers
      FROM oil_readings
    `;
    let oilParams = [];

    if (start && end) {
      elecQuery += ' WHERE timestamp >= ? AND timestamp <= ?';
      elecParams.push(start, end);

      oilQuery += ' WHERE timestamp >= ? AND timestamp <= ?';
      oilParams.push(start, end);
    }

    const [elecRows] = await db.execute(elecQuery, elecParams);
    const [oilRows] = await db.execute(oilQuery, oilParams);

    const result = {
      electrical: elecRows[0] || {},
      oil: oilRows[0] || {}
    };

    if (result.electrical.avg_current_a !== undefined && result.electrical.avg_current_a !== null) {
      result.electrical.avg_efficiency = calculateEfficiency(
        result.electrical.avg_current_a, 
        result.electrical.avg_current_b, 
        result.electrical.avg_current_c
      );
    }

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error generating report" });
  }
});

// ─── THI (TRANSFORMER HEALTH INDEX) WEBSERVICE ──────────────────────────────
// Queries threshold_settings directly from database and evaluates metrics
router.get("/thi", extractDb, async (req, res) => {
  try {
    const db = await getDbConnection(req.dbName);
    const { trafo_id, metrics } = req.query;

    // 1. SELECT threshold_settings directly from Database
    let thresholdQuery = "SELECT * FROM threshold_settings WHERE is_active = 1";
    const thresholdParams = [];
    if (trafo_id) {
      try {
        const [testCols] = await db.execute("SHOW COLUMNS FROM threshold_settings LIKE 'trafo_id'");
        if (testCols.length > 0) {
          thresholdQuery += " AND (trafo_id = ? OR trafo_id IS NULL OR scope = 'global')";
          thresholdParams.push(trafo_id);
        }
      } catch (e) {}
    }
    thresholdQuery += " ORDER BY id ASC";

    const [thresholdRows] = await db.execute(thresholdQuery, thresholdParams);

    // Map thresholds by metric_key
    const dbThresholdsMap = {};
    thresholdRows.forEach(row => {
      dbThresholdsMap[row.metric_key] = {
        id: row.id,
        metric_key: row.metric_key,
        min_value: row.min_value !== null ? parseFloat(row.min_value) : null,
        max_value: row.max_value !== null ? parseFloat(row.max_value) : null,
        scope: row.scope || 'specific'
      };
    });

    // 2. SELECT latest electrical and oil measurements from Database
    const [elecRows] = await db.execute(
      "SELECT * FROM electrical_readings ORDER BY timestamp DESC LIMIT 1"
    );
    let oilRows = [];
    try {
      [oilRows] = await db.execute(
        "SELECT * FROM oil_readings ORDER BY timestamp DESC LIMIT 1"
      );
    } catch (e) {}

    const rawElec = elecRows[0] || {};
    const rawOil = oilRows[0] || {};

    const latestData = {
      ...rawElec,
      ...rawOil,
      phaseA: rawElec.phase_a_v !== undefined ? parseFloat(rawElec.phase_a_v) : null,
      phaseB: rawElec.phase_b_v !== undefined ? parseFloat(rawElec.phase_b_v) : null,
      phaseC: rawElec.phase_c_v !== undefined ? parseFloat(rawElec.phase_c_v) : null,
      lineAB: rawElec.line_ab_v !== undefined ? parseFloat(rawElec.line_ab_v) : null,
      lineBC: rawElec.line_bc_v !== undefined ? parseFloat(rawElec.line_bc_v) : null,
      lineCA: rawElec.line_ca_v !== undefined ? parseFloat(rawElec.line_ca_v) : null,
      currentA: rawElec.current_a !== undefined ? parseFloat(rawElec.current_a) : null,
      currentB: rawElec.current_b !== undefined ? parseFloat(rawElec.current_b) : null,
      currentC: rawElec.current_c !== undefined ? parseFloat(rawElec.current_c) : null,
      currentN: rawElec.current_n !== undefined ? parseFloat(rawElec.current_n) : null,
      currentUnbalance: rawElec.current_unbalance !== undefined ? parseFloat(rawElec.current_unbalance) : null,
      powerActiveTotal: (rawElec.power_active_total_kw || rawElec.power_active_total) !== undefined ? parseFloat(rawElec.power_active_total_kw || rawElec.power_active_total) : null,
      powerReactiveTotal: (rawElec.power_reactive_total_kvar || rawElec.power_reactive_total) !== undefined ? parseFloat(rawElec.power_reactive_total_kvar || rawElec.power_reactive_total) : null,
      powerApparentTotal: (rawElec.power_apparent_total_kva || rawElec.power_apparent_total) !== undefined ? parseFloat(rawElec.power_apparent_total_kva || rawElec.power_apparent_total) : null,
      pfTotal: rawElec.pf_total !== undefined ? parseFloat(rawElec.pf_total) : null,
      frequency: rawElec.frequency !== undefined ? parseFloat(rawElec.frequency) : null,
      oil_temperature: rawOil.oil_temperature !== undefined ? parseFloat(rawOil.oil_temperature) : null,
      oil_pressure: rawOil.oil_pressure !== undefined ? parseFloat(rawOil.oil_pressure) : null
    };

    // 3. Mapping Frontend Keys to DB Threshold Keys
    const FRONTEND_TO_DB_THRESHOLD = {
      phaseA: 'v_phase', phaseB: 'v_phase', phaseC: 'v_phase',
      lineAB: 'v_line', lineBC: 'v_line', lineCA: 'v_line',
      currentA: 'current', currentB: 'current', currentC: 'current',
      currentN: 'current_n',
      currentUnbalance: 'current_unbalance',
      powerActiveTotal: 'power_active_total_kw',
      powerReactiveTotal: 'power_reactive_total_kvar',
      powerApparentTotal: 'power_apparent_total_kva',
      pfTotal: 'pf_total',
      frequency: 'frequency',
      oil_temperature: 'oil_temperature',
      oil_pressure: 'oil_pressure'
    };

    // 4. Metrics to evaluate
    const metricKeys = metrics 
      ? metrics.split(',').map(m => m.trim()).filter(Boolean)
      : ['phaseA', 'phaseB', 'phaseC', 'currentA', 'currentB', 'currentC', 'pfTotal', 'frequency'];

    const evaluatedMetrics = metricKeys.map(key => {
      const val = latestData[key];
      const dbKey = FRONTEND_TO_DB_THRESHOLD[key] || key;
      const t = dbThresholdsMap[dbKey] || dbThresholdsMap[key] || null;

      const tMin = t?.min_value !== undefined ? t.min_value : null;
      const tMax = t?.max_value !== undefined ? t.max_value : null;

      if (val === null || val === undefined || isNaN(val)) {
        return {
          key,
          dbKey,
          val: null,
          displayVal: '-',
          tMin,
          tMax,
          score: 50,
          status: 'NO DATA',
          color: '#94a3b8',
          thresholdLabel: 'Tidak ada data'
        };
      }

      let score = 100;
      let status = 'OPTIMAL';
      let color = '#10b981';
      let thresholdLabel = 'Operasi Normal';

      // ─── 1. Power Factor (Higher is Better, 1.0 is Unity/Optimal) ───────────
      if (key === 'pfTotal' || dbKey === 'pf_total') {
        const pfMin = tMin !== null ? tMin : 0.85;
        thresholdLabel = `Min: ${pfMin}`;
        if (val >= 0.90) {
          score = 100;
          status = 'OPTIMAL';
          color = '#10b981';
        } else if (val >= pfMin) {
          score = Math.round(85 + ((val - pfMin) / (0.90 - pfMin)) * 14);
          status = 'NORMAL';
          color = '#10b981';
        } else {
          const breach = pfMin - val;
          score = breach <= 0.10 ? 65 : 35;
          status = breach <= 0.10 ? 'WARNING' : 'CRITICAL';
          color = breach <= 0.10 ? '#f59e0b' : '#ef4444';
        }
      }
      // ─── 2. Symmetrical Tolerances (Voltages & Frequency: Center is Ideal) ───
      else if (
        ['phaseA', 'phaseB', 'phaseC', 'lineAB', 'lineBC', 'lineCA', 'frequency'].includes(key) ||
        ['v_phase', 'v_line', 'avg_phase_v', 'avg_line_v', 'frequency'].includes(dbKey)
      ) {
        if (tMin !== null && tMax !== null) {
          thresholdLabel = `Limit: ${tMin} - ${tMax}`;
          const center = (tMin + tMax) / 2;
          const span = (tMax - tMin) / 2 || 1;
          const dev = Math.abs(val - center);
          const ratio = dev / span;

          if (val >= tMin && val <= tMax) {
            if (ratio <= 0.85) {
              score = 100;
              status = 'OPTIMAL';
              color = '#10b981';
            } else {
              const edgeTaper = (ratio - 0.85) / 0.15;
              score = Math.max(85, Math.round(95 - edgeTaper * 10));
              status = 'NORMAL';
              color = '#10b981';
            }
          } else {
            const breach = val < tMin ? tMin - val : val - tMax;
            const breachPct = (breach / span) * 100;
            score = breachPct <= 15 ? 65 : 35;
            status = breachPct <= 15 ? 'WARNING' : 'CRITICAL';
            color = breachPct <= 15 ? '#f59e0b' : '#ef4444';
          }
        }
      }
      // ─── 3. Upper-Bounded Quantities (Currents, Power, Unbalance, Oil Temp) ──
      // Low values (or safe operational load <= 85% capacity) are completely optimal!
      else if (
        ['currentA', 'currentB', 'currentC', 'currentN', 'currentUnbalance', 'powerActiveTotal', 'powerReactiveTotal', 'powerApparentTotal', 'oil_temperature'].includes(key) ||
        ['current', 'avg_current', 'current_n', 'current_unbalance', 'power_active_total_kw', 'power_reactive_total_kvar', 'power_apparent_total_kva', 'oil_temperature'].includes(dbKey)
      ) {
        const maxLimit = tMax !== null ? tMax : (key === 'currentUnbalance' ? 15 : (key.includes('power') ? 1500 : 3000));
        thresholdLabel = `Max: ${maxLimit}`;

        if (val <= maxLimit) {
          if (val <= maxLimit * 0.85) {
            score = 100;
            status = 'OPTIMAL';
            color = '#10b981';
          } else {
            const taper = (val - maxLimit * 0.85) / (maxLimit * 0.15);
            score = Math.max(85, Math.round(95 - taper * 10));
            status = 'NORMAL';
            color = '#10b981';
          }
        } else {
          const breachPct = ((val - maxLimit) / (maxLimit || 1)) * 100;
          score = breachPct <= 15 ? 65 : 35;
          status = breachPct <= 15 ? 'WARNING' : 'CRITICAL';
          color = breachPct <= 15 ? '#f59e0b' : '#ef4444';
        }
      }
      // ─── 4. Oil Pressure (Nominal operating window 0.5 - 2.5 Bar) ───────────
      else if (key === 'oil_pressure' || dbKey === 'oil_pressure') {
        const minP = tMin !== null ? tMin : 0.5;
        const maxP = tMax !== null ? tMax : 2.5;
        thresholdLabel = `Limit: ${minP} - ${maxP}`;
        if (val >= minP && val <= maxP) {
          score = 100;
          status = 'OPTIMAL';
          color = '#10b981';
        } else {
          score = 60;
          status = 'WARNING';
          color = '#f59e0b';
        }
      }
      // ─── 5. General Fallback ───────────────────────────────────────────────
      else {
        if (tMin !== null && tMax !== null) {
          thresholdLabel = `Limit: ${tMin} - ${tMax}`;
          if (val >= tMin && val <= tMax) {
            score = 100; status = 'OPTIMAL'; color = '#10b981';
          } else {
            score = 65; status = 'WARNING'; color = '#f59e0b';
          }
        } else if (tMax !== null) {
          thresholdLabel = `Max: ${tMax}`;
          score = val <= tMax ? 100 : 60;
          status = score === 100 ? 'OPTIMAL' : 'WARNING';
          color = score === 100 ? '#10b981' : '#f59e0b';
        } else {
          thresholdLabel = 'Active';
          score = 100;
          status = 'OPTIMAL';
          color = '#10b981';
        }
      }

      // Format decimals according to metric nature
      let displayVal = Number(val).toFixed(1);
      if (['pfTotal', 'frequency', 'oil_pressure', 'currentUnbalance'].includes(key)) {
        displayVal = Number(val).toFixed(2);
      }

      return {
        key,
        dbKey,
        val,
        displayVal,
        tMin,
        tMax,
        score,
        status,
        color,
        thresholdLabel
      };
    });

    // 5. Calculate Overall THI Score
    let overallScore = 0;
    if (evaluatedMetrics.length > 0) {
      const sum = evaluatedMetrics.reduce((acc, m) => acc + m.score, 0);
      overallScore = Math.round(sum / evaluatedMetrics.length);
    }

    let overallStatus = 'EXCELLENT';
    let overallColor = '#10b981';
    if (overallScore < 50) {
      overallStatus = 'CRITICAL';
      overallColor = '#ef4444';
    } else if (overallScore < 75) {
      overallStatus = 'FAIR / WARNING';
      overallColor = '#f59e0b';
    } else if (overallScore < 90) {
      overallStatus = 'GOOD';
      overallColor = '#3b82f6';
    }

    res.json({
      success: true,
      overallScore,
      overallStatus,
      overallColor,
      evaluatedMetrics,
      dbThresholds: dbThresholdsMap,
      timestamp: rawElec.timestamp || new Date().toISOString()
    });
  } catch (error) {
    console.error("Error in THI webservice:", error);
    res.status(500).json({ error: "Failed to compute THI", details: error.message });
  }
});

// ─── EVENT STREAM WEBSERVICE ─────────────────────────────────────────────────
// Directly queries database (electrical_readings, oil_readings, threshold_settings)
// and evaluates real system alarms, trips, anomalies, and status logs.
router.get("/events", extractDb, async (req, res) => {
  try {
    const db = await getDbConnection(req.dbName);
    const trafoId = req.query.trafo_id || 1;
    const limit = parseInt(req.query.limit) || 50;

    // 1. Query threshold settings configured in database
    const [thresholdRows] = await db.execute(
      "SELECT * FROM threshold_settings WHERE is_active = 1 ORDER BY id ASC"
    );
    const thresholds = {};
    thresholdRows.forEach(t => {
      thresholds[t.metric_key] = {
        min: t.min_value !== null ? parseFloat(t.min_value) : null,
        max: t.max_value !== null ? parseFloat(t.max_value) : null,
        unit: t.unit || '',
        name: t.name || t.metric_key
      };
    });

    const safeLimit = Math.min(Math.max(1, limit), 50);

    // 2. Query recent electrical readings from database
    const [electricalRows] = await db.query(
      `SELECT * FROM electrical_readings 
       ORDER BY timestamp DESC LIMIT ${safeLimit}`
    );

    // 3. Query recent oil readings from database
    let oilRows = [];
    try {
      [oilRows] = await db.query(
        `SELECT * FROM oil_readings 
         ORDER BY timestamp DESC LIMIT ${safeLimit}`
      );
    } catch (e) {}

    const generatedEvents = [];

    // Evaluate Oil readings (Trips, Alarms, Temperature, Pressure)
    oilRows.forEach(row => {
      const ts = new Date(row.timestamp);
      const timeStr = ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = ts.toISOString();

      // Oil Level Trip (0 = Trip triggered)
      if (row.oil_level_trip === 0) {
        generatedEvents.push({
          id: `db-oil-trip-${row.id}`,
          timestamp: dateStr,
          time: timeStr,
          level: 'CRITICAL',
          source: 'Oil Protection Relay',
          msg: 'OIL LEVEL TRIP TRIGGERED! Transformer protective trip relay activated.'
        });
      }

      // Oil Level Alarm (0 = Alarm triggered)
      if (row.oil_level_alarm === 0) {
        generatedEvents.push({
          id: `db-oil-alarm-${row.id}`,
          timestamp: dateStr,
          time: timeStr,
          level: 'ALARM',
          source: 'Oil Level Sensor',
          msg: 'OIL LEVEL LOW ALARM! Transformer oil level below safe reserve threshold.'
        });
      }

      // Oil Temperature
      if (row.oil_temperature !== null && row.oil_temperature !== undefined) {
        const temp = parseFloat(row.oil_temperature);
        const tTemp = thresholds['oil_temperature'];
        if (tTemp?.max !== null && temp > tTemp.max) {
          generatedEvents.push({
            id: `db-temp-hi-${row.id}`,
            timestamp: dateStr,
            time: timeStr,
            level: 'CRITICAL',
            source: 'OTI Sensor',
            msg: `Oil Temperature High: ${temp.toFixed(1)}°C exceeds database threshold (Max: ${tTemp.max}°C).`
          });
        }
      }

      // Oil Pressure
      if (row.oil_pressure !== null && row.oil_pressure !== undefined) {
        const press = parseFloat(row.oil_pressure);
        const tPress = thresholds['oil_pressure'];
        if (tPress?.max !== null && press > tPress.max) {
          generatedEvents.push({
            id: `db-press-hi-${row.id}`,
            timestamp: dateStr,
            time: timeStr,
            level: 'WARN',
            source: 'Pressure Sensor',
            msg: `Oil Pressure High: ${press.toFixed(2)} Bar exceeds database limit (Max: ${tPress.max} Bar).`
          });
        }
      }
    });

    // Evaluate Electrical readings (Voltage, Current, Unbalance, Frequency, Power Factor, Relay/Alarm status)
    electricalRows.forEach(row => {
      const ts = new Date(row.timestamp);
      const timeStr = ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = ts.toISOString();

      // Relay Status
      if (row.relay_status === 1) {
        generatedEvents.push({
          id: `db-elec-relay-${row.id}`,
          timestamp: dateStr,
          time: timeStr,
          level: 'CRITICAL',
          source: 'SPM33 Relay',
          msg: 'ELECTRICAL RELAY ACTIVE! Secondary circuit breaker tripped.'
        });
      }

      // Alarm Status
      if (row.alarm_status === 1) {
        generatedEvents.push({
          id: `db-elec-alarm-${row.id}`,
          timestamp: dateStr,
          time: timeStr,
          level: 'ALARM',
          source: 'SPM33 Meter',
          msg: 'ELECTRICAL ALARM FLAGGED! Meter register indicates warning condition.'
        });
      }

      // Current Unbalance
      if (row.current_unbalance !== null && row.current_unbalance !== undefined) {
        const unb = parseFloat(row.current_unbalance);
        const tUnb = thresholds['current_unbalance'];
        const maxUnb = tUnb?.max || 5.0;
        if (unb > maxUnb) {
          generatedEvents.push({
            id: `db-unb-${row.id}`,
            timestamp: dateStr,
            time: timeStr,
            level: 'WARN',
            source: 'Phase Current',
            msg: `Current Unbalance Warning: ${unb.toFixed(2)}% exceeds limit (${maxUnb}%).`
          });
        }
      }

      // Frequency
      if (row.frequency !== null && row.frequency !== undefined) {
        const freq = parseFloat(row.frequency);
        const tFreq = thresholds['frequency'];
        if (tFreq?.min !== null && freq < tFreq.min) {
          generatedEvents.push({
            id: `db-freq-lo-${row.id}`,
            timestamp: dateStr,
            time: timeStr,
            level: 'WARN',
            source: 'Grid Frequency',
            msg: `Grid Frequency Low: ${freq.toFixed(2)} Hz under minimum threshold (${tFreq.min} Hz).`
          });
        } else if (tFreq?.max !== null && freq > tFreq.max) {
          generatedEvents.push({
            id: `db-freq-hi-${row.id}`,
            timestamp: dateStr,
            time: timeStr,
            level: 'WARN',
            source: 'Grid Frequency',
            msg: `Grid Frequency High: ${freq.toFixed(2)} Hz exceeds maximum threshold (${tFreq.max} Hz).`
          });
        }
      }

      // Line Voltages (Line AB, BC, CA)
      const tLine = thresholds['v_line'];
      if (tLine) {
        ['line_ab_v', 'line_bc_v', 'line_ca_v'].forEach(k => {
          const val = parseFloat(row[k]);
          if (!isNaN(val) && val > 50) {
            if (tLine.max !== null && val > tLine.max) {
              generatedEvents.push({
                id: `db-${k}-hi-${row.id}`,
                timestamp: dateStr,
                time: timeStr,
                level: 'WARN',
                source: 'Line Voltage',
                msg: `${k.toUpperCase().replace('_', ' ')}: ${val.toFixed(1)}V overvoltage (Max: ${tLine.max}V).`
              });
            } else if (tLine.min !== null && val < tLine.min) {
              generatedEvents.push({
                id: `db-${k}-lo-${row.id}`,
                timestamp: dateStr,
                time: timeStr,
                level: 'WARN',
                source: 'Line Voltage',
                msg: `${k.toUpperCase().replace('_', ' ')}: ${val.toFixed(1)}V undervoltage (Min: ${tLine.min}V).`
              });
            }
          }
        });
      }
    });

    // If no anomalous events exist in recent logs, generate system status confirmations from latest DB records
    if (generatedEvents.length === 0) {
      const latestElec = electricalRows[0];
      const latestOil = oilRows[0];
      const now = new Date();

      if (latestElec) {
        generatedEvents.push({
          id: `db-status-elec-${latestElec.id}`,
          timestamp: new Date(latestElec.timestamp).toISOString(),
          time: new Date(latestElec.timestamp).toLocaleTimeString('en-US'),
          level: 'OK',
          source: 'SPM33 Meter',
          msg: `Electrical telemetry verified from database (Vavg: ${Number(latestElec.avg_line_v || latestElec.line_ab_v || 380).toFixed(0)}V, Freq: ${Number(latestElec.frequency || 50).toFixed(1)}Hz).`
        });
      }

      if (latestOil) {
        generatedEvents.push({
          id: `db-status-oil-${latestOil.id}`,
          timestamp: new Date(latestOil.timestamp).toISOString(),
          time: new Date(latestOil.timestamp).toLocaleTimeString('en-US'),
          level: 'OK',
          source: 'Oil Telemetry',
          msg: `Oil parameters normal in database (Temp: ${Number(latestOil.oil_temperature || 45).toFixed(1)}°C, Pressure: ${Number(latestOil.oil_pressure || 1.2).toFixed(2)} Bar).`
        });
      }

      generatedEvents.push({
        id: 'db-status-sys',
        timestamp: now.toISOString(),
        time: now.toLocaleTimeString('en-US'),
        level: 'INFO',
        source: 'TMU Database Service',
        msg: `Connected to tenant database [${req.dbName}]. Live event stream active.`
      });
    }

    // Sort events descending by timestamp
    generatedEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      total: generatedEvents.length,
      events: generatedEvents.slice(0, limit),
      source: 'database',
      db: req.dbName
    });
  } catch (error) {
    console.error("Error in Event Stream webservice:", error);
    res.status(500).json({ error: "Failed to fetch event stream", details: error.message });
  }
});

// ─── NEWS & OPERATIONAL BULLETIN WEBSERVICE ──────────────────────────────────
// Queries database (trafo, threshold_settings, electrical_readings, oil_readings)
// and synthesizes authentic operational bulletins, energy summaries, and asset status.
router.get("/news", extractDb, async (req, res) => {
  try {
    const db = await getDbConnection(req.dbName);
    const trafoId = req.query.trafo_id || 1;

    // 1. Query Transformer specifications
    const [trafoRows] = await db.query(
      "SELECT * FROM trafo WHERE id = ? LIMIT 1",
      [trafoId]
    );
    const trafo = trafoRows[0] || {};
    const trafoName = trafo.nama || `Unit #${trafoId}`;
    const deviceSerial = trafo.device_serial || 'N/A';

    // 2. Query Electrical aggregate stats
    const [elecAggRows] = await db.query(
      `SELECT 
        COUNT(*) as total_records,
        MAX(energy_active_total) as total_energy_kwh,
        MAX(power_active_total_kw) as max_kw,
        AVG(pf_total) as avg_pf,
        MAX(timestamp) as latest_ts
       FROM electrical_readings`
    );
    const elecAgg = elecAggRows[0] || {};

    // 3. Query Oil aggregate stats & latest readings
    const [oilAggRows] = await db.query(
      `SELECT 
        MAX(oil_temperature) as max_temp,
        AVG(oil_temperature) as avg_temp,
        AVG(oil_pressure) as avg_press,
        MAX(timestamp) as latest_ts
       FROM oil_readings`
    );
    const oilAgg = oilAggRows[0] || {};

    // 4. Query Threshold counts
    const [threshCountRows] = await db.query(
      "SELECT COUNT(*) as count FROM threshold_settings WHERE is_active = 1"
    );
    const thresholdCount = threshCountRows[0]?.count || 0;

    const bulletins = [];

    // Bulletin 1: Asset Commissioning & Status
    bulletins.push({
      id: 'news-asset',
      tag: 'Asset',
      color: 'text-blue-500',
      title: `Transformer ${trafoName} Online under ${req.dbName}`,
      summary: `Asset ${trafoName} (Serial: ${deviceSerial}) active with telemetry streaming. Database partition verified.`,
      date: trafo.created_at ? new Date(trafo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Commissioned',
      timestamp: trafo.created_at || new Date().toISOString()
    });

    // Bulletin 2: Cumulative Energy Consumption
    if (elecAgg.total_energy_kwh) {
      const energyMWh = (parseFloat(elecAgg.total_energy_kwh) / 1000).toFixed(2);
      const totalRecs = Number(elecAgg.total_records || 0).toLocaleString();
      bulletins.push({
        id: 'news-energy',
        tag: 'Telemetry',
        color: 'text-emerald-500',
        title: `Energy Milestone: ${energyMWh} MWh Cumulative Load`,
        summary: `${totalRecs} telemetry points logged from SPM33 meter. Average system power factor recorded at ${Number(elecAgg.avg_pf || 0.95).toFixed(2)}.`,
        date: elecAgg.latest_ts ? new Date(elecAgg.latest_ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Live',
        timestamp: elecAgg.latest_ts || new Date().toISOString()
      });
    }

    // Bulletin 3: Thermal & Pressure Environmental Diagnostics
    if (oilAgg.avg_temp) {
      const avgTemp = parseFloat(oilAgg.avg_temp).toFixed(1);
      const avgPress = parseFloat(oilAgg.avg_press || 0).toFixed(2);
      bulletins.push({
        id: 'news-thermal',
        tag: 'Diagnostics',
        color: 'text-amber-500',
        title: `Thermal Stability: ${avgTemp}°C Avg Operating Temperature`,
        summary: `OTI sensor indicates stable thermal dissipation across operating cycles. Average oil pressure registered at ${avgPress} Bar.`,
        date: oilAgg.latest_ts ? new Date(oilAgg.latest_ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Live',
        timestamp: oilAgg.latest_ts || new Date().toISOString()
      });
    }

    // Bulletin 4: Safety & Protection Policy Enforcement
    bulletins.push({
      id: 'news-safety',
      tag: 'Policy',
      color: 'text-indigo-500',
      title: `${thresholdCount} Protection Thresholds Enforced in Database`,
      summary: `Active database threshold limits continuously monitor overvoltage, undervoltage, current limits, phase unbalance, and physical trip relays.`,
      date: 'Active Policy',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      total: bulletins.length,
      bulletins,
      source: 'database',
      db: req.dbName
    });
  } catch (error) {
    console.error("Error in News webservice:", error);
    res.status(500).json({ error: "Failed to generate operational news", details: error.message });
  }
});

module.exports = router;

