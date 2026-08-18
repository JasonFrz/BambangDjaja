const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDbConnection } = require('../utils/db');
const formatPhoneNumber = require('../utils/phoneFormatter');

const checkAdmin = async (req, res, next) => {
  try {
    const { username, role, dbName } = req.user; // Injected by verifyToken
    
    if (role !== 'admin' && role !== 'superuser') {
      return res.status(403).json({ error: 'Unauthorized. Admin or Superuser role required.' });
    }
    
    const targetDb = req.headers['x-db-name'] || dbName;
    const db = await getDbConnection(targetDb);
    
    req.dbName = targetDb;
    req.db = db;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

router.post('/', checkAdmin, async (req, res) => {
  try {
    let { username, password, role, company_name, nomor_telpon } = req.body;
    nomor_telpon = formatPhoneNumber(nomor_telpon);
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const [existing] = await req.db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await req.db.execute(
      'INSERT INTO users (username, password, role, company_name, db_name, nomor_telpon) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, role || 'user', company_name || req.dbName, req.dbName, nomor_telpon || null]
    );
    
    res.status(201).json({ message: 'user berhasil dibuat!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', checkAdmin, async (req, res) => {
  try {
    const [users] = await req.db.execute('SELECT id, username, role, company_name, db_name, nomor_telpon FROM users ORDER BY id DESC');
    
    const usersWithDetails = users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      company_name: u.company_name || '-',
      db_name: u.db_name || '-',
      nomor_telpon: u.nomor_telpon || ''
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
  let { company_name, db_name, role, nomor_telpon } = req.body;
  nomor_telpon = formatPhoneNumber(nomor_telpon);

  try {
    const [existing] = await req.db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length === 0) return res.status(404).json({ error: 'User not found' });

    let query = 'UPDATE users SET ';
    const params = [];
    const updates = [];
    
    if (company_name !== undefined) { updates.push('company_name = ?'); params.push(company_name); }
    if (db_name !== undefined) { updates.push('db_name = ?'); params.push(db_name); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (nomor_telpon !== undefined) { updates.push('nomor_telpon = ?'); params.push(nomor_telpon); }

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
