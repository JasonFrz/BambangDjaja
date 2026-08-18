const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../utils/db');

// Middleware to extract DB name
const extractDb = (req, res, next) => {
  const dbName = req.headers['x-db-name'];
  if (!dbName) {
    return res.status(400).json({ error: "Missing X-DB-Name header" });
  }
  req.dbName = dbName;
  next();
};

router.use(extractDb);

const initThresholdTable = async (db) => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS threshold_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      scope VARCHAR(20) NOT NULL,
      metric_key VARCHAR(50) NOT NULL UNIQUE,
      min_value FLOAT DEFAULT NULL,
      max_value FLOAT DEFAULT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `;
  await db.execute(createTableQuery);

  const insertDefaultsQuery = `
    INSERT INTO threshold_settings (scope, metric_key, min_value, max_value) VALUES
    ('global', 'v_phase', 200.0, 240.0),
    ('specific', 'avg_phase_v', 200.0, 240.0),
    ('global', 'v_line', 360.0, 415.0),
    ('specific', 'avg_line_v', 360.0, 415.0),
    ('global', 'current', 0.0, 3000.0),
    ('specific', 'avg_current', 0.0, 3000.0),
    ('specific', 'current_n', 0.0, 300.0),
    ('specific', 'current_unbalance', 0.0, 15.0),
    ('specific', 'power_active_total_kw', 0.0, 1500.0),
    ('global', 'power_active_phase', 0.0, 500.0),
    ('specific', 'power_reactive_total_kvar', 0.0, 800.0),
    ('specific', 'power_apparent_total_kva', 0.0, 2000.0),
    ('specific', 'pf_total', 0.85, 1.00),
    ('specific', 'frequency', 49.5, 50.5),
    ('specific', 'oil_temperature', 20.0, 75.0),
    ('specific', 'oil_pressure', 0.5, 2.5)
    ON DUPLICATE KEY UPDATE id=id;
  `;
  await db.execute(insertDefaultsQuery);
};

// GET all threshold settings
router.get('/thresholds', async (req, res) => {
  try {
    const db = await getDbConnection(req.dbName);
    
    // Ensure table exists and has default values
    await initThresholdTable(db);
    
    const [rows] = await db.execute('SELECT * FROM threshold_settings ORDER BY id ASC');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching threshold settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings', details: error.message });
  }
});

// PUT update a specific threshold
router.put('/thresholds/:id', async (req, res) => {
  const { id } = req.params;
  const { min_value, max_value, is_active } = req.body;
  
  try {
    const db = await getDbConnection(req.dbName);
    
    // Convert undefined to null for DB insertion if needed, or build dynamic query
    let updateFields = [];
    let queryParams = [];
    
    if (min_value !== undefined) {
      updateFields.push('min_value = ?');
      queryParams.push(min_value === '' || min_value === null ? null : parseFloat(min_value));
    }
    if (max_value !== undefined) {
      updateFields.push('max_value = ?');
      queryParams.push(max_value === '' || max_value === null ? null : parseFloat(max_value));
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      queryParams.push(is_active ? 1 : 0);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    queryParams.push(id);
    const updateQuery = `UPDATE threshold_settings SET ${updateFields.join(', ')} WHERE id = ?`;
    
    await db.execute(updateQuery, queryParams);
    res.json({ success: true, message: 'Setting updated successfully' });
  } catch (error) {
    console.error(`Error updating threshold ${id}:`, error);
    res.status(500).json({ error: 'Failed to update setting', details: error.message });
  }
});

module.exports = router;
