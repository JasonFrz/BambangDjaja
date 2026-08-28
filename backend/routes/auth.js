const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDbConnection, getAllDatabases } = require('../utils/db');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per `window`
  message: { error: 'Terlalu banyak percobaan login. Silakan coba lagi setelah 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }
  
  try {
    const masterDb = await getDbConnection('tmu_master');
    
    const query = 'SELECT u.*, c.nama_perusahaan, c.company_code FROM users u LEFT JOIN companies c ON u.company_id = c.id WHERE u.username = ? OR u.email = ? OR u.nomor_telpon = ? LIMIT 1';
    const queryParams = [username, username, username];
    
    const [rows] = await masterDb.execute(query, queryParams);
    
    if (rows.length === 0) {
      console.log('Login failed: user not found.');
      return res.status(401).json({ error: 'Username atau password invalid' });
    }
    
    const user = rows[0];
    const storedHash = user.password;
    
    let isMatch = false;
    if (storedHash) {
      if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(password, storedHash);
      } else if (storedHash.length === 64 && /^[a-f0-9]+$/i.test(storedHash)) {
        const sha256 = crypto.createHash('sha256').update(password).digest('hex');
        isMatch = sha256 === storedHash;
      } else if (storedHash.length === 32 && /^[a-f0-9]+$/i.test(storedHash)) {
        const md5 = crypto.createHash('md5').update(password).digest('hex');
        isMatch = md5 === storedHash;
      } else {
        isMatch = password === storedHash;
      }
    }
    
    if (!isMatch) {
      console.log('Login failed: password incorrect.');
      return res.status(401).json({ error: 'Username atau password invalid' });
    }
    
    console.log('User found and authenticated via tmu_master');
    const foundDbName = user.nama_db || 'tmu_master';
    const userRole = user.ROLE || user.role || 'user';
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: userRole, dbName: foundDbName },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      success: true,
      token,
      username: user.username, 
      role: userRole, 
      company_name: user.nama_perusahaan || foundDbName,
      company_code: user.company_code || '',
      phone: user.nomor_telpon || '' 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});
module.exports = router;
