const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDbConnection } = require('../utils/db');
const formatPhoneNumber = require('../utils/phoneFormatter');

const checkUser = async (req, res, next) => {
  const dbName = req.headers['x-db-name'];
  const username = req.headers['x-username'];
  
  if (!dbName || !username) {
    return res.status(400).json({ error: 'Missing X-DB-Name or X-Username header' });
  }
  
  try {
    const db = await getDbConnection(dbName);
    const [rows] = await db.execute('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    req.dbName = dbName;
    req.db = db;
    req.user = rows[0];
    req.username = username;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

router.get('/', checkUser, (req, res) => {
  // Hanya kembalikan data yang aman
  res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    nomor_telpon: req.user.nomor_telpon || '',
    email: req.user.email || ''
  });
});

router.put('/', checkUser, async (req, res) => {
  let { password, nomor_telpon } = req.body;
  nomor_telpon = formatPhoneNumber(nomor_telpon);

  try {
    const [columnsInfo] = await req.db.execute("SHOW COLUMNS FROM users");
    const columns = columnsInfo.map(c => c.Field);

    let query = 'UPDATE users SET ';
    const params = [];
    const updates = [];

    // Validasi nomor telepon
    if (nomor_telpon !== undefined && columns.includes('nomor_telpon')) {
      if (nomor_telpon.trim() !== '' && nomor_telpon !== '+62') {
        const [existingPhone] = await req.db.execute('SELECT id FROM users WHERE nomor_telpon = ? AND username != ? LIMIT 1', [nomor_telpon, req.username]);
        if (existingPhone.length > 0) {
          return res.status(400).json({ error: 'Phone number is already used by another user' });
        }
      }
      updates.push('nomor_telpon = ?');
      params.push(nomor_telpon);
    }
    
    // Validasi email
    if (req.body.email !== undefined && columns.includes('email')) {
      const email = req.body.email.trim();
      if (email !== '') {
        const [existingEmail] = await req.db.execute('SELECT id FROM users WHERE email = ? AND username != ? LIMIT 1', [email, req.username]);
        if (existingEmail.length > 0) {
          return res.status(400).json({ error: 'Email is already used by another user' });
        }
      }
      updates.push('email = ?');
      params.push(email);
    }
    
    // Validasi username
    let newUsername = req.username;
    if (req.body.username !== undefined && req.body.username.trim() !== '' && req.body.username.trim() !== req.username) {
      newUsername = req.body.username.trim();
      const [existingUsername] = await req.db.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [newUsername]);
      if (existingUsername.length > 0) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
      updates.push('username = ?');
      params.push(newUsername);
    }

    if (password) {
        if (columns.includes('password_hash')) {
          const password_hash = crypto.createHash('sha256').update(password).digest('hex');
          updates.push('password_hash = ?');
          params.push(password_hash);
        } else if (columns.includes('password')) {
          // Asumsi db admin/lainnya menggunakan bcrypt
          const hashedPassword = await bcrypt.hash(password, 10);
          updates.push('password = ?');
          params.push(hashedPassword);
        }
    }

    if (updates.length > 0) {
      query += updates.join(', ') + ' WHERE username = ?';
      params.push(req.username);
      await req.db.execute(query, params);
    }

    // Generate a new token since credentials (username/password) might have changed
    const newToken = jwt.sign(
      { id: req.user.id, username: newUsername, role: req.user.role, dbName: req.dbName },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ message: 'Profile updated successfully', newUsername, newToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

module.exports = router;
