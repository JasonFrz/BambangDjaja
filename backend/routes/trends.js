const express = require("express");
const router = express.Router();
const { getDbConnection } = require('../utils/db');
const { calculateEfficiency } = require('../utils/efficiency');

const extractDb = (req, res, next) => {
  const dbName = req.headers['x-db-name'];
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

    const elecQuery = `
      SELECT 
        *, 
        power_active_total_kw as power_active_total,
        power_reactive_total_kvar as power_reactive_total,
        power_apparent_total_kva as power_apparent_total
      FROM electrical_readings
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `;
    const [elecRows] = await db.execute(elecQuery, [start, end]);

    let lastElecTs = null;
    for (const row of elecRows) {
      const currentTs = new Date(row.timestamp).getTime();
      if (intervalMs && lastElecTs && (currentTs - lastElecTs < intervalMs)) {
        continue;
      }
      lastElecTs = currentTs;
      
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

    const oilQuery = `
      SELECT * FROM oil_readings
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `;
    const [oilRows] = await db.execute(oilQuery, [start, end]);

    let lastOilTs = null;
    for (const row of oilRows) {
      const currentTs = new Date(row.timestamp).getTime();
      if (intervalMs && lastOilTs && (currentTs - lastOilTs < intervalMs)) {
        continue;
      }
      lastOilTs = currentTs;

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

module.exports = router;
