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

module.exports = router;
