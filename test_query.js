const { getDbConnection } = require('./backend/utils/db');

(async () => {
  try {
    const db = await getDbConnection('JasonFrz/BambangDjaja');
    const start = '2026-07-26T17:03:00.000Z'; // some ISO string
    const end = '2026-07-26T22:04:00.000Z';

    const intv = 3600;
    const query = `
        SELECT 
          FROM_UNIXTIME(UNIX_TIMESTAMP(MIN(timestamp)) DIV ? * ?) AS timestamp,
          AVG(phase_a_v) as phase_a_v
        FROM electrical_readings
        WHERE timestamp >= ? AND timestamp <= ?
        GROUP BY UNIX_TIMESTAMP(timestamp) DIV ?
        ORDER BY timestamp ASC LIMIT 5000
      `;
    const params = [intv, intv, start, end, intv];

    const [rows] = await db.execute(query, params);
    console.log("Aggregated rows:", rows.length);
    console.log(rows);
    
    // Compare with Raw
    const queryRaw = `
        SELECT timestamp, phase_a_v
        FROM electrical_readings
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC LIMIT 5
      `;
    const [rawRows] = await db.execute(queryRaw, [start, end]);
    console.log("Raw rows sample:", rawRows.length);
    console.log(rawRows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
