const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../utils/db');

let isLayoutTableChecked = false;

const ensureTrafoIdColumn = async (masterDb) => {
  if (isLayoutTableChecked) return;
  try {
    const [cols] = await masterDb.execute("SHOW COLUMNS FROM user_layouts LIKE 'trafo_id'");
    if (cols.length === 0) {
      await masterDb.execute('ALTER TABLE user_layouts ADD COLUMN trafo_id VARCHAR(50)');
      console.log('Added trafo_id to user_layouts');
    }
    isLayoutTableChecked = true;
  } catch (error) {
    console.error('Error ensuring trafo_id column:', error);
  }
};
const generateRandomLayoutId = async (masterDb) => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let isUnique = false;
  let newId = '';
  
  while (!isUnique) {
    let strPart = '';
    for (let i = 0; i < 4; i++) strPart += letters.charAt(Math.floor(Math.random() * letters.length));
    let numPart = '';
    for (let i = 0; i < 4; i++) numPart += numbers.charAt(Math.floor(Math.random() * numbers.length));
    
    newId = strPart + numPart;
    
    const [existing] = await masterDb.execute('SELECT id FROM user_layouts WHERE id = ?', [newId]);
    if (existing.length === 0) {
      isUnique = true;
    }
  }
  return newId;
};
// GET layout by ID for export/import
router.get('/export/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const masterDb = await getDbConnection('tmu_master');
    const [layouts] = await masterDb.execute('SELECT layout_name, layout_data FROM user_layouts WHERE id = ?', [id]);
    
    if (layouts.length === 0) {
      return res.status(404).json({ error: 'Layout not found' });
    }
    
    res.json(layouts[0]);
  } catch (error) {
    console.error('Error exporting layout:', error);
    res.status(500).json({ error: 'Server error exporting layout' });
  }
});

// GET all layouts for the current user AND trafo
router.get('/', async (req, res) => {
  try {
    const dbName = req.headers['x-db-name'];
    const trafoId = req.headers['x-trafo-id'];
    
    if (!dbName) return res.status(400).json({ error: 'Company name is missing' });
    
    const masterDb = await getDbConnection('tmu_master');
    await ensureTrafoIdColumn(masterDb);
    
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ error: 'User ID missing from token' });
    
    let query = 'SELECT id, layout_name, layout_data, is_active FROM user_layouts WHERE user_id = ?';
    let params = [userId];
    
    if (trafoId) {
      query += ' AND trafo_id = ?';
      params.push(trafoId);
    } else {
      query += ' AND (trafo_id IS NULL OR trafo_id = "")';
    }
    
    const [layouts] = await masterDb.execute(query, params);
    
    res.json(layouts);
  } catch (error) {
    console.error('Error fetching layouts:', error);
    res.status(500).json({ error: 'Server error fetching layouts' });
  }
});

// POST to create or update a layout
router.post('/', async (req, res) => {
  try {
    const { id, layout_name, layout_data, is_active } = req.body;
    
    if (!layout_name || !layout_data) {
      return res.status(400).json({ error: 'Missing required fields: layout_name, layout_data' });
    }
    
    const dbName = req.headers['x-db-name'];
    const trafoId = req.headers['x-trafo-id'];
    if (!dbName) return res.status(400).json({ error: 'Company name is missing' });
    
    const masterDb = await getDbConnection('tmu_master');
    await ensureTrafoIdColumn(masterDb);
    
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ error: 'User ID missing from token' });
    
    // Check if layout exists
    let existing = [];
    let isUpdate = false;
    let actualId = id;
    
    let baseQuery = 'SELECT id FROM user_layouts WHERE user_id = ?';
    let baseParams = [userId];
    
    if (trafoId) {
      baseQuery += ' AND trafo_id = ?';
      baseParams.push(trafoId);
    } else {
      baseQuery += ' AND (trafo_id IS NULL OR trafo_id = "")';
    }
    
    if (id && id !== 'default' && !id.startsWith('p_')) {
      [existing] = await masterDb.execute(baseQuery + ' AND id = ?', [...baseParams, id]);
      if (existing.length > 0) isUpdate = true;
    }
    
    if (!isUpdate) {
      // Try to find by name
      [existing] = await masterDb.execute(baseQuery + ' AND layout_name = ?', [...baseParams, layout_name]);
      if (existing.length > 0) {
        isUpdate = true;
        actualId = existing[0].id;
      }
    }
    
    const finalTrafoId = trafoId || '';
    
    if (isUpdate) {
      // Update
      await masterDb.execute(
        'UPDATE user_layouts SET layout_name = ?, layout_data = ?, is_active = ? WHERE id = ? AND user_id = ?',
        [layout_name, JSON.stringify(layout_data), is_active ? 1 : 0, actualId, userId]
      );
    } else {
      // Insert
      actualId = await generateRandomLayoutId(masterDb);
      await masterDb.execute(
        'INSERT INTO user_layouts (id, user_id, trafo_id, layout_name, layout_data, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        [actualId, userId, finalTrafoId, layout_name, JSON.stringify(layout_data), is_active ? 1 : 0]
      );
    }
    
    res.json({ success: true, message: 'Layout saved successfully', id: actualId });
  } catch (error) {
    console.error('Error saving layout:', error);
    res.status(500).json({ error: 'Server error saving layout' });
  }
});

// PUT to set active layout
router.put('/active', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing layout id' });
    
    const dbName = req.headers['x-db-name'];
    const trafoId = req.headers['x-trafo-id'];
    if (!dbName) return res.status(400).json({ error: 'Company name is missing' });
    
    const masterDb = await getDbConnection('tmu_master');
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ error: 'User ID missing from token' });
    
    // Deactivate all layouts for user and trafo
    let deactivateQuery = 'UPDATE user_layouts SET is_active = 0 WHERE user_id = ?';
    let params = [userId];
    if (trafoId) {
      deactivateQuery += ' AND trafo_id = ?';
      params.push(trafoId);
    } else {
      deactivateQuery += ' AND (trafo_id IS NULL OR trafo_id = "")';
    }
    
    await masterDb.execute(deactivateQuery, params);
    
    // Activate specific layout
    let result = { affectedRows: 0 };
    if (id === 'default') {
      [result] = await masterDb.execute("UPDATE user_layouts SET is_active = 1 WHERE layout_name = 'Main Dashboard' AND user_id = ?", [userId]);
    } else {
      [result] = await masterDb.execute('UPDATE user_layouts SET is_active = 1 WHERE id = ? AND user_id = ?', [id, userId]);
    }
    
    // Removed affectedRows check because MySQL returns 0 if is_active was already 1
    
    res.json({ success: true, message: 'Active layout updated' });
  } catch (error) {
    console.error('Error setting active layout:', error);
    res.status(500).json({ error: 'Server error setting active layout' });
  }
});

// PUT to rename a layout
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { layout_name } = req.body;
    
    if (!layout_name) return res.status(400).json({ error: 'Missing layout_name' });
    
    const dbName = req.headers['x-db-name'];
    if (!dbName) return res.status(400).json({ error: 'Company name is missing' });
    
    const masterDb = await getDbConnection('tmu_master');
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ error: 'User ID missing from token' });
    
    if (id === 'default') {
      const [result] = await masterDb.execute("UPDATE user_layouts SET layout_name = ? WHERE layout_name = 'Main Dashboard' AND user_id = ?", [layout_name, userId]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Layout not found' });
    } else {
      const [result] = await masterDb.execute('UPDATE user_layouts SET layout_name = ? WHERE id = ? AND user_id = ?', [layout_name, id, userId]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Layout not found' });
    }
    
    res.json({ success: true, message: 'Layout renamed successfully' });
  } catch (error) {
    console.error('Error renaming layout:', error);
    res.status(500).json({ error: 'Server error renaming layout' });
  }
});

// DELETE a layout
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const dbName = req.headers['x-db-name'];
    if (!dbName) return res.status(400).json({ error: 'Company name is missing' });
    
    const masterDb = await getDbConnection('tmu_master');
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ error: 'User ID missing from token' });
    
    if (id === 'default') {
      await masterDb.execute("DELETE FROM user_layouts WHERE layout_name = 'Main Dashboard' AND user_id = ?", [userId]);
    } else {
      await masterDb.execute('DELETE FROM user_layouts WHERE id = ? AND user_id = ?', [id, userId]);
    }
    
    res.json({ success: true, message: 'Layout deleted successfully' });
  } catch (error) {
    console.error('Error deleting layout:', error);
    res.status(500).json({ error: 'Server error deleting layout' });
  }
});

module.exports = router;
