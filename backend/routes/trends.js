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
    
    let query = 'SELECT * FROM electrical_readings';
    const params = [];
    
    if (start && end) {
      query += ' WHERE timestamp >= ? AND timestamp <= ?';
      params.push(start, end);
    }
    
    query += ' ORDER BY timestamp ASC LIMIT 1000';
    
    const [rows] = await db.execute(query, params);
    
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
    
    let query = 'SELECT * FROM oil_readings';
    const params = [];
    
    if (start && end) {
      query += ' WHERE timestamp >= ? AND timestamp <= ?';
      params.push(start, end);
    }
    
    query += ' ORDER BY timestamp ASC LIMIT 1000';
    
    const [rows] = await db.execute(query, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/export", extractDb, async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: "Missing start or end parameter" });
  }

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
      useSharedStrings: false,
      zip: { zlib: { level: 9 } }
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
    const elecStream = db.pool.query(elecQuery, [start, end]).stream();

    for await (const row of elecStream) {
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
    ];

    oilSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    oilSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6600' } };
    oilSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    const oilQuery = `
      SELECT * FROM oil_readings
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `;
    const oilStream = db.pool.query(oilQuery, [start, end]).stream();

    for await (const row of oilStream) {
      oilSheet.addRow({
        time: new Date(row.timestamp).toLocaleString('id-ID'),
        oilTemp: r2(row.oil_temperature),
        oilPressure: r2(row.oil_pressure),
      }).commit();
    }
    oilSheet.commit();

    await workbook.commit();
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error saat export Excel" });
  }
});

module.exports = router;
