const express = require("express");
const router = express.Router();
const { getDbConnection } = require('../utils/db');

const extractDb = (req, res, next) => {
  const dbName = req.headers['x-db-name'];
  if (!dbName) {
    return res.status(400).json({ error: "Missing X-DB-Name header" });
  }
  req.dbName = dbName;
  next();
};

// All available metrics with metadata
const METRICS_CATALOG = {
  electrical: {
    table: 'electrical_readings',
    timestampCol: 'timestamp',
    metrics: {
      phase_a_v: { label: 'Phase A Voltage', unit: 'V', color: '#ef4444', group: 'Phase Voltage' },
      phase_b_v: { label: 'Phase B Voltage', unit: 'V', color: '#f59e0b', group: 'Phase Voltage' },
      phase_c_v: { label: 'Phase C Voltage', unit: 'V', color: '#3b82f6', group: 'Phase Voltage' },
      line_ab_v: { label: 'Line AB Voltage', unit: 'V', color: '#ec4899', group: 'Line Voltage' },
      line_bc_v: { label: 'Line BC Voltage', unit: 'V', color: '#8b5cf6', group: 'Line Voltage' },
      line_ca_v: { label: 'Line CA Voltage', unit: 'V', color: '#06b6d4', group: 'Line Voltage' },
      current_a: { label: 'Current A', unit: 'A', color: '#ef4444', group: 'Current' },
      current_b: { label: 'Current B', unit: 'A', color: '#f59e0b', group: 'Current' },
      current_c: { label: 'Current C', unit: 'A', color: '#3b82f6', group: 'Current' },
      power_active_total_kw: { label: 'Active Power', unit: 'kW', color: '#10b981', group: 'Power' },
      power_reactive_total_kvar: { label: 'Reactive Power', unit: 'kVAR', color: '#f59e0b', group: 'Power' },
      power_apparent_total_kva: { label: 'Apparent Power', unit: 'kVA', color: '#8b5cf6', group: 'Power' },
      pf_total: { label: 'Power Factor', unit: '', color: '#14b8a6', group: 'Power Quality' },
      frequency: { label: 'Frequency', unit: 'Hz', color: '#6366f1', group: 'Power Quality' },
      energy_active_total: { label: 'Active Energy', unit: 'kWh', color: '#22c55e', group: 'Energy' },
      energy_reactive_total: { label: 'Reactive Energy', unit: 'kVARh', color: '#eab308', group: 'Energy' },
    }
  },
  oil: {
    table: 'oil_readings',
    timestampCol: 'timestamp',
    metrics: {
      oil_temperature: { label: 'Oil Temperature', unit: '°C', color: '#ef4444', group: 'Oil' },
      oil_pressure: { label: 'Oil Pressure', unit: 'Bar', color: '#3b82f6', group: 'Oil' },
    }
  }
};

// GET /api/analytics/metrics — Return available metrics catalog
router.get("/metrics", (req, res) => {
  const result = {};
  for (const [category, info] of Object.entries(METRICS_CATALOG)) {
    result[category] = {
      table: info.table,
      metrics: info.metrics
    };
  }
  res.json(result);
});

// GET /api/analytics/query — Query data with flexible params
// Query params:
//   metrics: comma-separated metric keys (e.g. "phase_a_v,phase_b_v,current_a")
//   table: "electrical" or "oil" (default: auto-detect from metrics)
//   start: ISO datetime string
//   end: ISO datetime string
//   interval: aggregation interval in seconds (0 = raw data)
//   limit: max number of rows (default 5000)
router.get("/query", extractDb, async (req, res) => {
  const { metrics, start, end, interval, limit } = req.query;

  if (!metrics) {
    return res.status(400).json({ error: "Missing 'metrics' parameter" });
  }

  const requestedMetrics = metrics.split(',').map(m => m.trim()).filter(Boolean);
  if (requestedMetrics.length === 0) {
    return res.status(400).json({ error: "No valid metrics specified" });
  }

  // Determine which table(s) the metrics belong to
  let tableCategory = null;
  let tableInfo = null;

  for (const [category, info] of Object.entries(METRICS_CATALOG)) {
    const hasMetric = requestedMetrics.some(m => info.metrics[m]);
    if (hasMetric) {
      tableCategory = category;
      tableInfo = info;
      break;
    }
  }

  if (!tableInfo) {
    return res.status(400).json({ error: "No valid metrics found in catalog" });
  }

  // Filter to only valid metrics for this table
  const validMetrics = requestedMetrics.filter(m => tableInfo.metrics[m]);
  if (validMetrics.length === 0) {
    return res.status(400).json({ error: "No valid metrics for the detected table" });
  }

  const tableName = tableInfo.table;
  const tsCol = tableInfo.timestampCol;
  const isAggregated = interval && parseInt(interval) > 0;
  const maxRows = Math.min(parseInt(limit) || 5000, 10000);

  try {
    const db = await getDbConnection(req.dbName);
    const params = [];
    let query = '';

    if (isAggregated) {
      const intv = parseInt(interval);
      const selectCols = validMetrics.map(m => `AVG(\`${m}\`) as \`${m}\``).join(', ');
      query = `
        SELECT 
          FROM_UNIXTIME(UNIX_TIMESTAMP(MIN(${tsCol})) DIV ? * ?) AS timestamp,
          ${selectCols}
        FROM \`${tableName}\`
      `;
      params.push(intv, intv);
    } else {
      const selectCols = validMetrics.map(m => `\`${m}\``).join(', ');
      query = `SELECT ${tsCol} AS timestamp, ${selectCols} FROM \`${tableName}\``;
    }

    if (start && end) {
      query += ` WHERE ${tsCol} >= ? AND ${tsCol} <= ?`;
      params.push(start, end);
    }

    if (isAggregated) {
      query += ` GROUP BY UNIX_TIMESTAMP(${tsCol}) DIV ?`;
      params.push(parseInt(interval));
    }

    query += ` ORDER BY timestamp ASC LIMIT ${maxRows}`;

    const [rows] = await db.execute(query, params);

    // Format numeric values
    const formattedRows = rows.map(row => {
      const formatted = { timestamp: row.timestamp };
      for (const m of validMetrics) {
        formatted[m] = row[m] !== null && row[m] !== undefined
          ? Math.round(parseFloat(row[m]) * 100) / 100
          : null;
      }
      return formatted;
    });

    res.json({
      data: formattedRows,
      meta: {
        table: tableName,
        metrics: validMetrics,
        count: formattedRows.length,
        aggregated: !!isAggregated,
        interval: isAggregated ? parseInt(interval) : null
      }
    });

  } catch (error) {
    console.error("Analytics query error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
