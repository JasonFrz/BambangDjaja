const express = require("express");
const router = express.Router();
const { getDbConnection } = require('../utils/db');
const { calculateEfficiency } = require('../utils/efficiency');

// Middleware to extract db_name from headers
const extractDb = (req, res, next) => {
  const dbName = req.headers['x-db-name'];
  if (!dbName) {
    return res.status(400).json({ error: "Missing X-DB-Name header" });
  }
  req.dbName = dbName;
  next();
};

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


// Export Excel - server-side generation for fast large downloads
router.get("/export", extractDb, async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: "Missing start or end parameter" });
  }

  try {
    const db = await getDbConnection(req.dbName);
    const ExcelJS = require('exceljs');

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
    const [rows] = await db.execute(query, [start, end]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Tidak ada data pada rentang waktu tersebut." });
    }

    // Generate Excel di server
    const workbook = new ExcelJS.Workbook();
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

    // Style header
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0052CC' } };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data rows
    rows.forEach(row => {
      sheet.addRow({
        time: new Date(row.timestamp).toLocaleString('id-ID'),
        phaseA: parseFloat(row.phase_a_v) || 0,
        phaseB: parseFloat(row.phase_b_v) || 0,
        phaseC: parseFloat(row.phase_c_v) || 0,
        lineAB: parseFloat(row.line_ab_v) || 0,
        lineBC: parseFloat(row.line_bc_v) || 0,
        lineCA: parseFloat(row.line_ca_v) || 0,
        currentA: parseFloat(row.current_a) || 0,
        currentB: parseFloat(row.current_b) || 0,
        currentC: parseFloat(row.current_c) || 0,
        powerActiveTotal: parseFloat(row.power_active_total) || 0,
        powerReactiveTotal: parseFloat(row.power_reactive_total) || 0,
        powerApparentTotal: parseFloat(row.power_apparent_total) || 0,
        pfTotal: parseFloat(row.pf_total) || 0,
        frequency: parseFloat(row.frequency) || 0,
        energyActiveTotal: parseFloat(row.energy_active_total) || 0,
        energyReactiveTotal: parseFloat(row.energy_reactive_total) || 0,
        efficiency: calculateEfficiency(row.current_a, row.current_b, row.current_c)
      });
    });

    // Send as file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Export_${start}_to_${end}.xlsx`);
    res.setHeader('X-Row-Count', rows.length.toString());

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error saat export Excel" });
  }
});

module.exports = router;
