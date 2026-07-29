const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDbConnection, getAllDatabases } = require('../utils/db');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }
  
  try {
    const databases = await getAllDatabases();
    console.log('Databases found:', databases);
    let foundUser = null;
    let foundDbName = null;

    for (const dbName of databases) {
      console.log(`Checking database: ${dbName}...`);
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
          console.log(`User found in DB: ${dbName}`);
          const user = rows[0];

          const storedHash = user.password_hash || user.password;
          
          if (!storedHash) {
            console.log(`No password/password_hash column found for user in ${dbName}`);
            continue;
          }

          console.log(`Stored hash starts with: ${storedHash.substring(0, 10)}... (length: ${storedHash.length})`);
          
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
          } else {
            console.log(`Password did NOT match for user in ${dbName}`);
          }
        } else {
          console.log(`User not found in ${dbName}`);
        }
      } catch (err) {
        console.error(`Skipping DB ${dbName} due to error:`, err.message);
        continue;
      }
    }
    
    if (!foundUser) {
      console.log('Login failed: user not found or password incorrect across all databases.');
      return res.status(401).json({ error: 'Username atau password invalid' });
    }
    
    res.json({ 
      success: true,
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

