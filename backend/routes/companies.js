const express = require('express');
const router = express.Router();
const { getDbConnection, getAdminPool } = require('../utils/db');

// Ensure schema matches our requirements
const ensureCompaniesSchema = async (pool) => {
  try {
    const [columns] = await pool.execute("SHOW COLUMNS FROM companies LIKE 'nama_db'");
    if (columns.length === 0) {
      await pool.execute("ALTER TABLE companies ADD COLUMN nama_db VARCHAR(255) NULL");
      console.log("Added nama_db column to companies table");
    }
  } catch (err) {
    console.error("Error ensuring companies schema:", err);
  }
};

// GET all companies along with their trafo lists
router.get('/', async (req, res) => {
  try {
    const pool = await getDbConnection('tmu_master');
    await ensureCompaniesSchema(pool);
    
    const [companies] = await pool.execute('SELECT id, nama_perusahaan, nama_db FROM companies ORDER BY id DESC');
    
    // Fetch trafos for all companies in parallel
    await Promise.all(companies.map(async (company) => {
      company.trafos = [];
      if (company.nama_db) {
        try {
          const dbPool = await getDbConnection(company.nama_db);
          // check if trafo table exists
          const [tables] = await dbPool.execute("SHOW TABLES LIKE 'trafo'");
          if (tables.length > 0) {
            const [trafos] = await dbPool.execute('SELECT id, nama FROM trafo ORDER BY id ASC');
            company.trafos = trafos;
          }
        } catch (dbErr) {
          console.error(`Could not fetch trafos for db ${company.nama_db}:`, dbErr.message);
        }
      }
    }));
    
    res.json({ success: true, data: companies });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});


// POST create company
router.post('/', async (req, res) => {
  const { nama_perusahaan, nama_db } = req.body;
  
  if (!nama_perusahaan) {
    return res.status(400).json({ error: 'Company Name is required' });
  }
  
  try {
    const pool = await getDbConnection('tmu_master');
    await ensureCompaniesSchema(pool);
    
    // Check if nama_perusahaan is used by another company
    const [existing] = await pool.execute('SELECT id FROM companies WHERE nama_perusahaan = ?', [nama_perusahaan]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Company Name already used by another company' });
    }
    
    await pool.execute(
      'INSERT INTO companies (nama_perusahaan, nama_db) VALUES (?, ?)',
      [nama_perusahaan, nama_db || null]
    );
    
    res.json({ success: true, message: 'Company created successfully' });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// PUT update company
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nama_perusahaan, nama_db } = req.body;
  
  if (!nama_perusahaan) {
    return res.status(400).json({ error: 'Company Name is required' });
  }
  
  try {
    const pool = await getDbConnection('tmu_master');
    await ensureCompaniesSchema(pool);
    
    // Check if nama_perusahaan is used by another company
    const [existing] = await pool.execute('SELECT id FROM companies WHERE nama_perusahaan = ? AND id != ?', [nama_perusahaan, id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Company Name already used by another company' });
    }
    
    await pool.execute(
      'UPDATE companies SET nama_perusahaan = ?, nama_db = ? WHERE id = ?',
      [nama_perusahaan, nama_db || null, id]
    );
    
    res.json({ success: true, message: 'Company updated successfully' });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// DELETE company
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const pool = await getDbConnection('tmu_master');
    
    // Get company details first to drop its database
    const [companyRows] = await pool.execute('SELECT nama_db FROM companies WHERE id = ?', [id]);
    const company = companyRows[0];
    
    if (company && company.nama_db) {
      const adminPool = await getAdminPool();
      try {
        await adminPool.execute(`DROP DATABASE IF EXISTS \`${company.nama_db}\``);
        console.log(`Database ${company.nama_db} dropped successfully.`);
      } catch (dbErr) {
        console.error(`Failed to drop database ${company.nama_db}:`, dbErr);
      }
      
      // Delete users associated with this nama_db
      await pool.execute('DELETE FROM users WHERE nama_db = ?', [company.nama_db]);
    }
    
    // Delete users associated with this company_id
    await pool.execute('DELETE FROM users WHERE company_id = ?', [id]);
    
    // Finally, delete the company
    await pool.execute('DELETE FROM companies WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Company, its users, and database deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Failed to delete company and its data' });
  }
});

module.exports = router;
