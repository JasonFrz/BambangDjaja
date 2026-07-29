const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getDbConnection } = require('../utils/db');

const checkSuperuser = async (req, res, next) => {
  const dbName = req.headers['x-db-name'];
  const username = req.headers['x-username'];
  
  if (!dbName || !username) {
    return res.status(400).json({ error: 'Missing X-DB-Name or X-Username header' });
  }
  
  try {
    const db = await getDbConnection(dbName);
    const [rows] = await db.execute('SELECT role FROM users WHERE username = ? LIMIT 1', [username]);
    
    if (rows.length === 0 || rows[0].role !== 'superuser') {
      return res.status(403).json({ error: 'Unauthorized. Superuser role required.' });
    }
    
    req.dbName = dbName;
    req.db = db;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

router.post('/', checkSuperuser, async (req, res) => {
  try {
    const { username, password, nomor_telpon, email } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const [existing] = await req.db.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Pengecekan nomor telepon (jika diisi)
    if (nomor_telpon && nomor_telpon.trim() !== '' && nomor_telpon !== '+62') {
      const [columnsInfo] = await req.db.execute("SHOW COLUMNS FROM users");
      const columns = columnsInfo.map(c => c.Field);
      
      if (columns.includes('nomor_telpon')) {
        const [existingPhone] = await req.db.execute('SELECT id FROM users WHERE nomor_telpon = ? LIMIT 1', [nomor_telpon]);
        if (existingPhone.length > 0) {
          return res.status(400).json({ error: 'Phone number is already used by another user' });
        }
      }
    }
    
    // Pengecekan email (jika diisi)
    if (email && email.trim() !== '') {
      const [columnsInfo] = await req.db.execute("SHOW COLUMNS FROM users");
      const columns = columnsInfo.map(c => c.Field);
      
      if (columns.includes('email')) {
        const [existingEmail] = await req.db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
        if (existingEmail.length > 0) {
          return res.status(400).json({ error: 'Email is already used by another user' });
        }
      }
    }
    
    const password_hash = crypto.createHash('sha256').update(password).digest('hex');
    
    const [columnsInfo] = await req.db.execute("SHOW COLUMNS FROM users");
    const columns = columnsInfo.map(c => c.Field);
    
    let queryCols = ['username', 'role'];
    let queryVals = [username, 'user'];
    let placeholders = ['?', '?'];

    if (columns.includes('password_hash')) {
      queryCols.push('password_hash');
      queryVals.push(password_hash);
      placeholders.push('?');
    } else if (columns.includes('password')) {
      queryCols.push('password');
      queryVals.push(password_hash);
      placeholders.push('?');
    }
    
    if (columns.includes('nomor_telpon')) {
      queryCols.push('nomor_telpon');
      queryVals.push(nomor_telpon || null);
      placeholders.push('?');
    }
    
    if (columns.includes('email')) {
      queryCols.push('email');
      queryVals.push(email || null);
      placeholders.push('?');
    }

    if (columns.includes('company_name')) {
      queryCols.push('company_name');
      queryVals.push(req.dbName);
      placeholders.push('?');
    }
    
    if (columns.includes('db_name')) {
      queryCols.push('db_name');
      queryVals.push(req.dbName);
      placeholders.push('?');
    }
    
    if (columns.includes('created_at')) {
      queryCols.push('created_at');
      queryVals.push(new Date());
      placeholders.push('?');
    }
    
    const query = `INSERT INTO users (${queryCols.join(', ')}) VALUES (${placeholders.join(', ')})`;
    await req.db.execute(query, queryVals);
    
    res.status(201).json({ message: 'User created successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.get('/', checkSuperuser, async (req, res) => {
  try {
    const [columnsInfo] = await req.db.execute("SHOW COLUMNS FROM users");
    const columns = columnsInfo.map(c => c.Field);
    
    let selectCols = ['id', 'username', 'role'];
    if (columns.includes('nomor_telpon')) selectCols.push('nomor_telpon');
    if (columns.includes('email')) selectCols.push('email');
    if (columns.includes('created_at')) selectCols.push('created_at');
    if (columns.includes('company_name')) selectCols.push('company_name');
    
    const query = `SELECT ${selectCols.join(', ')} FROM users WHERE role = ? ORDER BY id DESC`;
    const [users] = await req.db.execute(query, ['user']);
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.put('/:id', checkSuperuser, async (req, res) => {
  const { id } = req.params;
  const { username, password, nomor_telpon, email } = req.body;

  try {
    const [existing] = await req.db.execute('SELECT id FROM users WHERE id = ? AND role = ? LIMIT 1', [id, 'user']);
    if (existing.length === 0) return res.status(404).json({ error: 'User not found' });

    let query = 'UPDATE users SET ';
    const params = [];
    const updates = [];
    
    const [columnsInfo] = await req.db.execute("SHOW COLUMNS FROM users");
    const columns = columnsInfo.map(c => c.Field);

    if (nomor_telpon && nomor_telpon.trim() !== '' && nomor_telpon !== '+62' && columns.includes('nomor_telpon')) {
      const [existingPhone] = await req.db.execute('SELECT id FROM users WHERE nomor_telpon = ? AND id != ? LIMIT 1', [nomor_telpon, id]);
      if (existingPhone.length > 0) {
        return res.status(400).json({ error: 'Phone number is already used by another user' });
      }
    }

    if (email && email.trim() !== '' && columns.includes('email')) {
      const [existingEmail] = await req.db.execute('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [email, id]);
      if (existingEmail.length > 0) {
        return res.status(400).json({ error: 'Email is already used by another user' });
      }
    }

    if (username !== undefined) { updates.push('username = ?'); params.push(username); }
    if (nomor_telpon !== undefined && columns.includes('nomor_telpon')) { updates.push('nomor_telpon = ?'); params.push(nomor_telpon); }
    if (email !== undefined && columns.includes('email')) { updates.push('email = ?'); params.push(email); }
    if (password) {
        const password_hash = crypto.createHash('sha256').update(password).digest('hex');
        if (columns.includes('password_hash')) {
          updates.push('password_hash = ?');
          params.push(password_hash);
        } else if (columns.includes('password')) {
          updates.push('password = ?');
          params.push(password_hash);
        }
    }

    if (updates.length > 0) {
      query += updates.join(', ') + ' WHERE id = ?';
      params.push(id);
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
    const [existing] = await req.db.execute('SELECT id FROM users WHERE id = ? AND role = ? LIMIT 1', [id, 'user']);
    if (existing.length === 0) return res.status(404).json({ error: 'User not found' });

    await req.db.execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

module.exports = router;
