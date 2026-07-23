const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDbConnection } = require('../utils/db');

// Middleware to extract db_name and verify admin role (optional, based on headers for now since tokens are removed)
const checkAdmin = async (req, res, next) => {
  const dbName = req.headers['x-db-name'];
  const username = req.headers['x-username'];
  
  if (!dbName || !username) {
    return res.status(400).json({ error: 'Missing X-DB-Name or X-Username header' });
  }
  
  try {
    const db = await getDbConnection(dbName);
    const [rows] = await db.execute('SELECT role FROM users WHERE username = ?', [username]);
    
    if (rows.length === 0 || rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin role required.' });
    }
    
    req.dbName = dbName;
    req.db = db;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

router.post('/', checkAdmin, async (req, res) => {
  try {
    const { username, password, role, company_name, phone } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const [existing] = await req.db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await req.db.execute(
      'INSERT INTO users (username, password, role, company_name, db_name, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, role || 'user', company_name || req.dbName, req.dbName, phone || null]
    );
    
    res.status(201).json({ message: 'user berhasil dibuat!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', checkAdmin, async (req, res) => {
  try {
    const [users] = await req.db.execute('SELECT id, username, role, company_name, db_name, phone FROM users ORDER BY id DESC');
    
    const usersWithDetails = users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      company_name: u.company_name || '-',
      db_name: u.db_name || '-',
      phone: u.phone || ''
    }));
    
    res.json(usersWithDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:username/password', checkAdmin, async (req, res) => {
  const { username } = req.params;
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'New password is required' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await req.db.execute('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username]);
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:username', checkAdmin, async (req, res) => {
  const { username } = req.params;
  const { company_name, db_name, role, phone } = req.body;

  try {
    const [existing] = await req.db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length === 0) return res.status(404).json({ error: 'User not found' });

    let query = 'UPDATE users SET ';
    const params = [];
    const updates = [];
    
    if (company_name !== undefined) { updates.push('company_name = ?'); params.push(company_name); }
    if (db_name !== undefined) { updates.push('db_name = ?'); params.push(db_name); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }

    if (updates.length > 0) {
      query += updates.join(', ') + ' WHERE username = ?';
      params.push(username);
      await req.db.execute(query, params);
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:username', checkAdmin, async (req, res) => {
  const { username } = req.params;

  try {
    const [existing] = await req.db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length === 0) return res.status(404).json({ error: 'User not found' });

    await req.db.execute('DELETE FROM users WHERE username = ?', [username]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
