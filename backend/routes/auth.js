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
    let foundUser = null;
    let foundDbName = null;

    // 1. FAST PATH: Check Centralized tmu_master.users first (O(1) time)
    try {
      const [columnsInfo] = await masterDb.execute("SHOW COLUMNS FROM users");
      const columns = columnsInfo.map(c => c.Field);
      
      let query = 'SELECT * FROM users WHERE username = ? LIMIT 1';
      let queryParams = [username];
      
      if (columns.includes('email')) {
        query = 'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1';
        queryParams = [username, username];
      }
      
      const [rows] = await masterDb.execute(query, queryParams);
      if (rows.length > 0) {
        const user = rows[0];
        const storedHash = user.password_hash || user.password;
        
        if (storedHash) {
          let isMatch = false;
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
          
          if (isMatch) {
            console.log('User found and authenticated via tmu_master');
            foundUser = user;
            foundDbName = user.tenant_db || 'tmu_master';
          }
        }
      }
    } catch (err) {
      console.error('Error checking tmu_master.users:', err.message);
    }

    // 2. SLOW PATH: Fallback to querying all tenant databases if not found in master
    if (!foundUser) {
      const databases = await getAllDatabases();
      console.log('User not found in master, fallback to tenant databases...');
      
      for (const dbName of databases) {
        try {
          const db = await getDbConnection(dbName);
          const [columnsInfo] = await db.execute("SHOW COLUMNS FROM users");
          const columns = columnsInfo.map(c => c.Field);
          
          let query = 'SELECT * FROM users WHERE username = ? LIMIT 1';
          let queryParams = [username];
          
          if (columns.includes('email')) {
            query = 'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1';
            queryParams = [username, username];
          }
          
          const [rows] = await db.execute(query, queryParams);
          
          if (rows.length > 0) {
            const user = rows[0];
            const storedHash = user.password_hash || user.password;
            
            if (!storedHash) continue;
            
            let isMatch = false;
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
            
            if (isMatch) {
              console.log(`Password matched for user in ${dbName}`);
              foundUser = user;
              foundDbName = dbName;
              break;
            }
          }
        } catch (err) {
          continue;
        }
      }
    }
    
    if (!foundUser) {
      console.log('Login failed: user not found or password incorrect.');
      return res.status(401).json({ error: 'Username atau password invalid' });
    }
    
    const token = jwt.sign(
      { username: foundUser.username, role: foundUser.role || 'user', dbName: foundDbName },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      success: true,
      token,
      username: foundUser.username, 
      role: foundUser.role || 'user', 
      company_name: foundDbName,
      phone: foundUser.nomor_telpon || '' 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

module.exports = router;

