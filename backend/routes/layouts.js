const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../utils/db');

// Middleware to ensure user_layouts table exists
const ensureLayoutsTable = async (db) => {
  // Fix schema if it exists as INT auto_increment (from previous manual creation)
  const [tables] = await db.execute("SHOW TABLES LIKE 'user_layouts'");
  if (tables.length > 0) {
    const [cols] = await db.execute("SHOW COLUMNS FROM user_layouts LIKE 'id'");
    if (cols.length > 0 && cols[0].Type.includes('int')) {
      // It's empty anyway, safe to drop and recreate with correct UUID schema
      await db.execute('DROP TABLE user_layouts');
    }
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_layouts (
      id VARCHAR(255) PRIMARY KEY,
      user_id INT NOT NULL,
      layout_name VARCHAR(255),
      layout_data JSON,
      is_active BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
};

const getUserId = async (db, username) => {
  const [users] = await db.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
  if (users.length > 0) return users[0].id;

  if (username === 'admin') {
    // Lazily create a dummy admin user in the DB so foreign keys for layouts work
    await db.execute(
      'INSERT IGNORE INTO users (username, nomor_telpon, password_hash, email, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      ['admin', '0000000000', 'dummy_hash', 'admin@local', 'admin']
    );
    const [newUsers] = await db.execute('SELECT id FROM users WHERE username = ? LIMIT 1', ['admin']);
    return newUsers.length > 0 ? newUsers[0].id : null;
  }

  return null;
};


// GET all layouts for the current user
router.get('/', async (req, res) => {
  try {
    const dbName = req.headers['x-db-name'];
    if (!dbName) return res.status(400).json({ error: 'Company name is missing' });
    
    const db = await getDbConnection(dbName);
    await ensureLayoutsTable(db);
    
    const userId = await getUserId(db, req.headers['x-username'] || req.user?.username);
    if (!userId) return res.status(403).json({ error: 'User not found' });
    
    const [layouts] = await db.execute('SELECT id, layout_name, layout_data, is_active FROM user_layouts WHERE user_id = ?', [userId]);
    
    res.json(layouts);
  } catch (error) {
    console.error('Error fetching layouts:', error);
    res.status(500).json({ error: 'Server error fetching layouts' });
  }
});

// POST to create or update a layout
router.post('/', async (req, res) => {
  try {
    const { id, layout_name, layout_data, is_active } = req.body;
    
    if (!id || !layout_name || !layout_data) {
      return res.status(400).json({ error: 'Missing required fields: id, layout_name, layout_data' });
    }
    
    const dbName = req.headers['x-db-name'];
    const db = await getDbConnection(dbName);
    await ensureLayoutsTable(db);
    
    const userId = await getUserId(db, req.headers['x-username'] || req.user?.username);
    if (!userId) return res.status(403).json({ error: 'User not found' });
    
    // Check if layout exists
    const [existing] = await db.execute('SELECT id FROM user_layouts WHERE id = ? AND user_id = ?', [id, userId]);
    
    if (existing.length > 0) {
      // Update
      await db.execute(
        'UPDATE user_layouts SET layout_name = ?, layout_data = ?, is_active = ? WHERE id = ? AND user_id = ?',
        [layout_name, JSON.stringify(layout_data), is_active ? 1 : 0, id, userId]
      );
    } else {
      // Insert
      await db.execute(
        'INSERT INTO user_layouts (id, user_id, layout_name, layout_data, is_active) VALUES (?, ?, ?, ?, ?)',
        [id, userId, layout_name, JSON.stringify(layout_data), is_active ? 1 : 0]
      );
    }
    
    res.json({ success: true, message: 'Layout saved successfully' });
  } catch (error) {
    console.error('Error saving layout:', error);
    res.status(500).json({ error: 'Server error saving layout' });
  }
});

// PUT to set active layout
router.put('/active', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing layout id' });
    
    const dbName = req.headers['x-db-name'];
    const db = await getDbConnection(dbName);
    await ensureLayoutsTable(db);
    
    const userId = await getUserId(db, req.headers['x-username'] || req.user?.username);
    if (!userId) return res.status(403).json({ error: 'User not found' });
    
    // Deactivate all layouts for user
    await db.execute('UPDATE user_layouts SET is_active = 0 WHERE user_id = ?', [userId]);
    
    // Activate specific layout
    const [result] = await db.execute('UPDATE user_layouts SET is_active = 1 WHERE id = ? AND user_id = ?', [id, userId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Layout not found' });
    }
    
    res.json({ success: true, message: 'Active layout updated' });
  } catch (error) {
    console.error('Error setting active layout:', error);
    res.status(500).json({ error: 'Server error setting active layout' });
  }
});

// DELETE a layout
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const dbName = req.headers['x-db-name'];
    const db = await getDbConnection(dbName);
    await ensureLayoutsTable(db);
    
    const userId = await getUserId(db, req.headers['x-username'] || req.user?.username);
    if (!userId) return res.status(403).json({ error: 'User not found' });
    
    await db.execute('DELETE FROM user_layouts WHERE id = ? AND user_id = ?', [id, userId]);
    
    res.json({ success: true, message: 'Layout deleted successfully' });
  } catch (error) {
    console.error('Error deleting layout:', error);
    res.status(500).json({ error: 'Server error deleting layout' });
  }
});

module.exports = router;
