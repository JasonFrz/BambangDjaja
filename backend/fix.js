const mysql = require('mysql2/promise');
require('dotenv').config();

async function fix() {
  const db = await mysql.createConnection({
    host: process.env.AIVEN_DB_HOST,
    port: process.env.AIVEN_DB_PORT,
    user: process.env.AIVEN_DB_USER,
    password: process.env.AIVEN_DB_PASSWORD,
    database: 'db_baru_v2'
  });

  try {
    const [layouts] = await db.execute('SELECT * FROM user_layouts');
    for (const l of layouts) {
      let data = typeof l.layout_data === 'string' ? JSON.parse(l.layout_data) : l.layout_data;
      if (data.panels && data.panels.length < 10) {
        // Clear layout items that don't belong to any panel
        const panelIds = new Set(data.panels.map(p => p.id));
        const newLayouts = {};
        for (const bp of Object.keys(data.layouts)) {
          newLayouts[bp] = data.layouts[bp].filter(item => panelIds.has(item.i));
          
          // Reset y positions to 0 so they pack at the top
          newLayouts[bp] = newLayouts[bp].map((item, idx) => ({
            ...item,
            y: idx * 5, // give them a fresh y stacking
            x: 0
          }));
        }
        data.layouts = newLayouts;
        
        await db.execute('UPDATE user_layouts SET layout_data = ? WHERE id = ?', [JSON.stringify(data), l.id]);
        console.log(`Fixed layout ${l.id}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
  await db.end();
}
fix();
