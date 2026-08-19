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

async function initAlertsTable(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS alert_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      alert_type VARCHAR(50) NOT NULL,
      parameter_name VARCHAR(100) NOT NULL,
      condition_text VARCHAR(255) NOT NULL,
      current_value VARCHAR(50) NOT NULL,
      threshold_limit VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

router.get("/", extractDb, async (req, res) => {
  const { limit = 50 } = req.query;
  try {
    const db = await getDbConnection(req.dbName);
    await initAlertsTable(db);
    
    const [rows] = await db.execute(`SELECT * FROM alert_logs ORDER BY created_at DESC LIMIT ?`, [parseInt(limit).toString()]);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching alert logs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = { router, initAlertsTable };
