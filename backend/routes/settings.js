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


// GET all threshold settings
router.get('/thresholds', async (req, res) => {
  try {
    const db = await getDbConnection(req.dbName);
    
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
