const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDbConnection } = require('../utils/db');
const { uploadToCloudinary } = require('../utils/cloudinaryClient');

// Setup multer untuk local storage sementara sebelum diupload ke Cloudinary
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

// Fungsi utilitas untuk memastikan tabel ada (mengikuti skema dari user)
const ensureTrafoTable = async (db, dbName) => {
  if (checkedTrafoTables.has(dbName)) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS trafo (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      image_url VARCHAR(255)
    )
  `);
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
    
    // Upload ke Cloudinary
    const imageUrl = await uploadToCloudinary(req.file);

    // Cek apakah trafo ada di db
    const [existing] = await db.execute('SELECT id FROM trafo WHERE id = ?', [trafoId]);
    
    if (existing.length === 0) {
      // Jika trafo belum ada di db, insert dulu (meskipun dengan id string sementara, kalau skema int auto increment akan bermasalah. Kita asumsikan id sudah ada dari db.)
      await db.execute('INSERT INTO trafo (id, nama, image_url) VALUES (?, ?, ?)', [trafoId, 'Trafo ' + trafoId, imageUrl]);
    } else {
      // Update image
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

    let isOnline = false;
    try {
      const [readings] = await db.execute('SELECT timestamp FROM electrical_readings ORDER BY timestamp DESC LIMIT 1');
      if (readings.length > 0) {
        const lastDataTime = new Date(readings[0].timestamp).getTime();
        const now = Date.now();
        if (now - lastDataTime < 20000) { // 20s threshold to match dashboard's 15s + network buffer
          isOnline = true;
        }
      }
    } catch (err) {
      // Ignore error if table doesn't exist yet
    }

    const transformers = rows.map(t => ({
      ...t,
      status: isOnline ? 'Online' : 'Offline'
    }));

    res.json(transformers);
  } catch (error) {
    console.error('Error fetching all trafos:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
