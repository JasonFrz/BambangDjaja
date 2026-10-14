const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../utils/db');
const rm = require('../utils/readingModel');

const GROUPS = {
  'Phase Voltage': ['phaseA', 'phaseB', 'phaseC'], 'Line Voltage': ['lineAB', 'lineBC', 'lineCA'],
  Current: ['currentA', 'currentB', 'currentC', 'currentN', 'avgCurrent'],
  Power: ['powerActiveTotal', 'powerReactiveTotal', 'powerApparentTotal', 'powerActiveA', 'powerActiveB', 'powerActiveC'],
  'Power Quality': ['pfTotal', 'pfA', 'pfB', 'pfC', 'frequency', 'thdVA', 'thdVB', 'thdVC', 'thdIA', 'thdIB', 'thdIC'],
  Energy: ['energyActiveTotal', 'energyReactiveTotal'],
  Temperature: ['oil_temperature', 'wtiA', 'wtiB', 'wtiC', 'busTempA', 'busTempB', 'busTempC'],
  Oil: ['oil_pressure', 'h2ppm', 'moisturePpm'],
};

router.get('/metrics', (req, res) => {
  const metrics = {};
  for (const [group, keys] of Object.entries(GROUPS)) for (const k of keys) metrics[k] = { group, column: rm.KEY_TO_COLUMN[k] };
  res.json({ reading: { table: 'reading_data', metrics } });
});

router.get('/query', async (req, res) => {
  const { metrics, start, end, interval, limit } = req.query;
  const dbName = req.headers['x-db-name'] || req.user?.dbName;
  if (!dbName) return res.status(400).json({ error: 'Missing X-DB-Name header' });
  if (!metrics) return res.status(400).json({ error: "Missing 'metrics' parameter" });
  const keys = String(metrics).split(',').map(s => s.trim()).filter(k => rm.KEY_TO_COLUMN[k]);
  if (keys.length === 0) return res.status(400).json({ error: 'No valid metrics specified' });
  if (!start || !end) return res.status(400).json({ error: 'Missing start or end' });
  try {
    const db = await getDbConnection(dbName);
    const trafoId = parseInt(req.query.trafo_id || 1, 10) || 1;
    const rows = await rm.getHistory(db, trafoId, start, end, interval || 0, keys);
    const maxRows = Math.min(parseInt(limit, 10) || 5000, 10000);
    const data = rows.slice(0, maxRows).map(r => ({ timestamp: r.timestamp, ...Object.fromEntries(keys.map(k => [k, r[k]])) }));
    res.json({ data, meta: { table: 'reading_data', metrics: keys, count: data.length, aggregated: !!(parseInt(interval, 10) > 0), interval: parseInt(interval, 10) || null } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
