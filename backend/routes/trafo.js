const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDbConnection } = require('../utils/db');
const { uploadToCloudinary } = require('../utils/cloudinaryClient');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'trafo-' + uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

const checkedTrafoTables = new Set();

const ensureTrafoTable = async (db, dbName) => {
  if (checkedTrafoTables.has(dbName)) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS trafo (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      image_url VARCHAR(255),
      device_serial VARCHAR(100)
    )
  `);
  
  try {
    await db.execute('ALTER TABLE trafo ADD COLUMN device_serial VARCHAR(100)');
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') {
      console.error('Error adding device_serial column:', err);
    }
  }
  
  checkedTrafoTables.add(dbName);
};

router.post('/:id/image', upload.single('image'), async (req, res) => {
  const trafoId = req.params.id;
  const dbName = req.headers['x-db-name'];
  
  if (!dbName) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Missing X-DB-Name header' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  try {
    const db = await getDbConnection(dbName);
    await ensureTrafoTable(db, dbName);
    
    const imageUrl = await uploadToCloudinary(req.file);

    const [existing] = await db.execute('SELECT id FROM trafo WHERE id = ?', [trafoId]);
    
    if (existing.length === 0) {
      await db.execute('INSERT INTO trafo (id, nama, image_url) VALUES (?, ?, ?)', [trafoId, 'Trafo ' + trafoId, imageUrl]);
    } else {
      await db.execute('UPDATE trafo SET image_url = ? WHERE id = ?', [imageUrl, trafoId]);
    }

    res.json({ success: true, imageUrl, message: 'Image uploaded to Cloudinary successfully' });
  } catch (error) {
    console.error('Error uploading trafo image:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/image', async (req, res) => {
  const trafoId = req.params.id;
  const dbName = req.headers['x-db-name'];
  
  if (!dbName) return res.status(400).json({ error: 'Missing X-DB-Name header' });

  try {
    const db = await getDbConnection(dbName);
    await ensureTrafoTable(db, dbName);
    
    await db.execute('UPDATE trafo SET image_url = NULL WHERE id = ?', [trafoId]);
    res.json({ success: true, message: 'Image reset successfully' });
  } catch (error) {
    console.error('Error resetting trafo image:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/name', async (req, res) => {
  const trafoId = req.params.id;
  const dbName = req.headers['x-db-name'];
  const { name } = req.body;
  
  if (!dbName) return res.status(400).json({ error: 'Missing X-DB-Name header' });
  if (!name || name.trim() === '') return res.status(400).json({ error: 'Name is required' });

  try {
    const db = await getDbConnection(dbName);
    await ensureTrafoTable(db, dbName);
    
    await db.execute('UPDATE trafo SET nama = ? WHERE id = ?', [name.trim(), trafoId]);
    res.json({ success: true, message: 'Name updated successfully' });
  } catch (error) {
    console.error('Error updating trafo name:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  const trafoId = req.params.id;
  const dbName = req.headers['x-db-name'];
  
  if (!dbName) return res.status(400).json({ error: 'Missing X-DB-Name header' });

  try {
    const db = await getDbConnection(dbName);
    await ensureTrafoTable(db, dbName);
    
    const [rows] = await db.execute('SELECT * FROM trafo WHERE id = ?', [trafoId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Trafo not found in db' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching trafo:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  const dbName = req.headers['x-db-name'];
  if (!dbName) return res.status(400).json({ error: 'Missing X-DB-Name header' });

  try {
    const db = await getDbConnection(dbName);
    await ensureTrafoTable(db, dbName);
    
    const [rows] = await db.execute('SELECT * FROM trafo ORDER BY id ASC');

    const transformers = await Promise.all(rows.map(async (t) => {
      let isOnline = false;
      try {
        let lastDiffSeconds = null;

        // Cek data sensor electrical_readings
        try {
          const [elecReadings] = await db.execute(
            'SELECT timestamp, TIMESTAMPDIFF(SECOND, timestamp, NOW()) AS sec_diff FROM electrical_readings WHERE trafo_id = ? ORDER BY timestamp DESC LIMIT 1',
            [t.id]
          );
          if (elecReadings.length > 0) {
            const row = elecReadings[0];
            const mySqlDiff = row.sec_diff !== null && row.sec_diff !== undefined ? Number(row.sec_diff) : null;
            const nodeDiff = row.timestamp ? (Date.now() - new Date(row.timestamp).getTime()) / 1000 : null;
            
            const candidates = [mySqlDiff, nodeDiff].filter(d => d !== null && !isNaN(d) && d >= 0);
            if (candidates.length > 0) {
              lastDiffSeconds = Math.min(...candidates);
            }
          }
        } catch (elecErr) {
          if (elecErr.code === 'ER_BAD_FIELD_ERROR' && rows.length === 1) {
            try {
              const [elecReadings] = await db.execute(
                'SELECT timestamp, TIMESTAMPDIFF(SECOND, timestamp, NOW()) AS sec_diff FROM electrical_readings ORDER BY timestamp DESC LIMIT 1'
              );
              if (elecReadings.length > 0) {
                const row = elecReadings[0];
                const mySqlDiff = row.sec_diff !== null && row.sec_diff !== undefined ? Number(row.sec_diff) : null;
                const nodeDiff = row.timestamp ? (Date.now() - new Date(row.timestamp).getTime()) / 1000 : null;
                const candidates = [mySqlDiff, nodeDiff].filter(d => d !== null && !isNaN(d) && d >= 0);
                if (candidates.length > 0) {
                  lastDiffSeconds = Math.min(...candidates);
                }
              }
            } catch (_) {}
          }
        }

        // Jika belum ada data atau belum online, periksa juga oil_readings
        if (lastDiffSeconds === null || lastDiffSeconds > 20) {
          try {
            const [oilReadings] = await db.execute(
              'SELECT timestamp, TIMESTAMPDIFF(SECOND, timestamp, NOW()) AS sec_diff FROM oil_readings WHERE trafo_id = ? ORDER BY timestamp DESC LIMIT 1',
              [t.id]
            );
            if (oilReadings.length > 0) {
              const row = oilReadings[0];
              const mySqlDiff = row.sec_diff !== null && row.sec_diff !== undefined ? Number(row.sec_diff) : null;
              const nodeDiff = row.timestamp ? (Date.now() - new Date(row.timestamp).getTime()) / 1000 : null;
              const candidates = [mySqlDiff, nodeDiff].filter(d => d !== null && !isNaN(d) && d >= 0);
              if (candidates.length > 0) {
                const oilDiff = Math.min(...candidates);
                if (lastDiffSeconds === null || oilDiff < lastDiffSeconds) {
                  lastDiffSeconds = oilDiff;
                }
              }
            }
          } catch (_) {}
        }

        // HANYA Online jika benar-benar ada data masuk dalam 20 detik terakhir!
        // Jika tidak ada data (null) atau data lama (> 20s), status tetap Offline!
        if (lastDiffSeconds !== null && lastDiffSeconds >= 0 && lastDiffSeconds <= 20) {
          isOnline = true;
        }
      } catch (err) {
        console.error(`Error checking status for trafo ${t.id}:`, err.message);
      }

      return {
        ...t,
        status: isOnline ? 'Online' : 'Offline'
      };
    }));

    res.json(transformers);
  } catch (error) {
    console.error('Error fetching all trafos:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/company-info', async (req, res) => {
  const dbName = req.headers['x-db-name'];
  if (!dbName) return res.status(400).json({ error: 'Missing X-DB-Name header' });

  try {
    const masterDb = await getDbConnection('tmu_master');
    const [rows] = await masterDb.execute(
      'SELECT id, nama_perusahaan, nama_db FROM companies WHERE nama_db = ? LIMIT 1',
      [dbName]
    );

    if (rows.length > 0 && rows[0].nama_perusahaan) {
      return res.json({ success: true, nama_perusahaan: rows[0].nama_perusahaan, nama_db: rows[0].nama_db });
    }

    const username = req.user?.username || req.headers['x-username'];
    if (username) {
      const [uRows] = await masterDb.execute(
        'SELECT c.nama_perusahaan FROM users u JOIN companies c ON (u.company_id = c.id OR u.nama_db = c.nama_db) WHERE u.username = ? LIMIT 1',
        [username]
      );
      if (uRows.length > 0 && uRows[0].nama_perusahaan) {
        return res.json({ success: true, nama_perusahaan: uRows[0].nama_perusahaan, nama_db: dbName });
      }
    }

    res.json({ success: true, nama_perusahaan: dbName, nama_db: dbName });
  } catch (error) {
    console.error('Error fetching company info:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
