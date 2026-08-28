const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDbConnection } = require('../utils/db');
const formatPhoneNumber = require('../utils/phoneFormatter');

const checkSuperuser = async (req, res, next) => {
  const dbName = req.headers['x-db-name'];
  const username = req.headers['x-username'];
  
  if (!dbName || !username) {
    return res.status(400).json({ error: 'Missing X-DB-Name or X-Username header' });
  }
  
  try {
    const masterDb = await getDbConnection('tmu_master');
    const [rows] = await masterDb.execute('SELECT ROLE as role FROM users WHERE username = ? LIMIT 1', [username]);
    
    if (rows.length === 0 || (rows[0].role || '').toLowerCase() !== 'superuser') {
      return res.status(403).json({ error: 'Unauthorized. Superuser role required.' });
    }
    
    req.dbName = dbName;
    req.db = masterDb;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

router.post('/', checkSuperuser, async (req, res) => {
  try {
    let { username, password, nomor_telpon, email, role } = req.body;
    
    if (!username || !password || !nomor_telpon || !email) {
      return res.status(400).json({ error: 'Username, password, nomor telepon, dan email wajib diisi' });
    }
    
    nomor_telpon = formatPhoneNumber(nomor_telpon);
    
    const [existing] = await req.db.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    if (nomor_telpon !== '-') {
      const [existingPhone] = await req.db.execute('SELECT id FROM users WHERE nomor_telpon = ? LIMIT 1', [nomor_telpon]);
      if (existingPhone.length > 0) {
        return res.status(400).json({ error: 'Phone number is already used by another user' });
      }
    }
    
    if (email !== '-') {
      const [existingEmail] = await req.db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      if (existingEmail.length > 0) {
        return res.status(400).json({ error: 'Email is already used by another user' });
      }
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newRole = (role === 'superuser') ? 'superuser' : 'user';
    
    await req.db.execute(
      'INSERT INTO users (nama_db, username, nomor_telpon, password, email, ROLE, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [req.dbName, username, nomor_telpon, hashedPassword, email, newRole]
    );
    
    res.status(201).json({ message: 'User created successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.get('/', checkSuperuser, async (req, res) => {
  try {
    const query = "SELECT u.id, u.username, u.ROLE as role, u.nama_db, u.nomor_telpon, u.email, u.created_at, c.nama_perusahaan FROM users u LEFT JOIN companies c ON u.company_id = c.id WHERE u.ROLE != 'admin' AND u.nama_db = ? ORDER BY u.id DESC";
    const [users] = await req.db.execute(query, [req.dbName]);
    const formattedUsers = users.map(u => ({
      ...u,
      company_name: u.nama_perusahaan || u.nama_db || '-'
    }));
    res.json(formattedUsers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.put('/:id', checkSuperuser, async (req, res) => {
  const { id } = req.params;
  let { username, password, nomor_telpon, email, role } = req.body;
  if (!nomor_telpon || !email) {
    return res.status(400).json({ error: 'Nomor telepon dan email wajib diisi' });
  }
  nomor_telpon = formatPhoneNumber(nomor_telpon);

  try {
    const [existing] = await req.db.execute("SELECT id FROM users WHERE id = ? AND ROLE != 'admin' AND nama_db = ? LIMIT 1", [id, req.dbName]);
    if (existing.length === 0) return res.status(404).json({ error: 'User not found in your database' });

    let query = 'UPDATE users SET ';
    const params = [];
    const updates = [];
    
    if (nomor_telpon !== '-') {
      const [existingPhone] = await req.db.execute('SELECT id FROM users WHERE nomor_telpon = ? AND id != ? LIMIT 1', [nomor_telpon, id]);
      if (existingPhone.length > 0) {
        return res.status(400).json({ error: 'Phone number is already used by another user' });
      }
    }

    if (email && email !== '-') {
      const [existingEmail] = await req.db.execute('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [email, id]);
      if (existingEmail.length > 0) {
        return res.status(400).json({ error: 'Email is already used by another user' });
      }
    }

    if (username !== undefined) { 
      const [existingUser] = await req.db.execute('SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1', [username, id]);
      if (existingUser.length > 0) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
      updates.push('username = ?'); params.push(username); 
    }
    if (nomor_telpon !== undefined) { updates.push('nomor_telpon = ?'); params.push(nomor_telpon); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (role !== undefined) { 
      updates.push('ROLE = ?'); 
      params.push(role === 'superuser' ? 'superuser' : 'user'); 
    }
    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updates.push('password = ?');
        params.push(hashedPassword);
    }

    if (updates.length > 0) {
      query += updates.join(', ') + ' WHERE id = ? AND nama_db = ?';
      params.push(id, req.dbName);
      await req.db.execute(query, params);
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.delete('/:id', checkSuperuser, async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await req.db.execute("SELECT id FROM users WHERE id = ? AND ROLE != 'admin' AND nama_db = ? LIMIT 1", [id, req.dbName]);
    if (existing.length === 0) return res.status(404).json({ error: 'User not found in your database' });

    await req.db.execute('DELETE FROM users WHERE id = ? AND nama_db = ?', [id, req.dbName]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

module.exports = router;
