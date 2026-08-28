const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDbConnection } = require('../utils/db');
const formatPhoneNumber = require('../utils/phoneFormatter');

const checkAdmin = async (req, res, next) => {
  try {
    const { username, role, dbName } = req.user; // Injected by verifyToken
    
    // In database the column is ROLE, but we normalize it to lowercase 'role' in auth.js
    // Still, let's be case insensitive
    const userRole = (role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'superuser') {
      return res.status(403).json({ error: 'Unauthorized. Admin or Superuser role required.' });
    }
    
    const targetDb = req.headers['x-db-name'] || dbName;
    const masterDb = await getDbConnection('tmu_master');
    
    req.dbName = targetDb;
    req.db = masterDb;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

router.post('/', checkAdmin, async (req, res) => {
  try {
    let { username, password, role, nomor_telpon, email } = req.body;
    
    if (!username || !password || !nomor_telpon || !email) {
      return res.status(400).json({ error: 'Username, password, nomor telepon, dan email wajib diisi' });
    }
    
    nomor_telpon = formatPhoneNumber(nomor_telpon);
    
    const [existing] = await req.db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newRole = role || 'user';
    
    await req.db.execute(
      'INSERT INTO users (nama_db, username, nomor_telpon, password, email, ROLE, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [req.dbName, username, nomor_telpon, hashedPassword, email, newRole]
    );
    
    res.status(201).json({ message: 'user berhasil dibuat!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', checkAdmin, async (req, res) => {
  try {
    const [users] = await req.db.execute('SELECT u.id, u.username, u.ROLE as role, u.nama_db, u.nomor_telpon, u.email, u.created_at, c.nama_perusahaan FROM users u LEFT JOIN companies c ON u.company_id = c.id WHERE u.nama_db = ? ORDER BY u.id DESC', [req.dbName]);
    
    const usersWithDetails = users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      db_name: u.nama_db || '-',
      company_name: u.nama_perusahaan || u.nama_db || '-',
      nomor_telpon: u.nomor_telpon || '',
      email: u.email || '',
      created_at: u.created_at
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
    // Ensure they only update users in their own DB
    await req.db.execute('UPDATE users SET password = ? WHERE username = ? AND nama_db = ?', [hashedPassword, username, req.dbName]);
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:username', checkAdmin, async (req, res) => {
  const { username } = req.params;
  let { db_name, role, nomor_telpon, email } = req.body;
  
  try {
    const [existing] = await req.db.execute('SELECT id FROM users WHERE username = ? AND nama_db = ?', [username, req.dbName]);
    if (existing.length === 0) return res.status(404).json({ error: 'User not found in your database' });

    let query = 'UPDATE users SET ';
    const params = [];
    const updates = [];
    
    if (db_name !== undefined) { updates.push('nama_db = ?'); params.push(db_name); }
    if (role !== undefined) { updates.push('ROLE = ?'); params.push(role); }
    if (nomor_telpon !== undefined) { 
      updates.push('nomor_telpon = ?'); 
      params.push(formatPhoneNumber(nomor_telpon) || '-'); 
    }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }

    if (updates.length > 0) {
      query += updates.join(', ') + ' WHERE username = ? AND nama_db = ?';
      params.push(username, req.dbName);
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
    const [existing] = await req.db.execute('SELECT id FROM users WHERE username = ? AND nama_db = ?', [username, req.dbName]);
    if (existing.length === 0) return res.status(404).json({ error: 'User not found in your database' });

    await req.db.execute('DELETE FROM users WHERE username = ? AND nama_db = ?', [username, req.dbName]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
