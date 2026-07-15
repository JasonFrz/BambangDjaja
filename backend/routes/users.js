const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin role required.' });
  }
  
  try {
    const { username, password, role, company_name, db_name, phone } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: role || 'user',
        company_name,
        db_name,
        phone: phone || null
      }
    });
    
    res.status(201).json({ message: 'user berhasil dibuat!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin role required.' });
  }
  
  try {
    const users = await prisma.user.findMany({
      orderBy: { id: 'desc' }
    });
    
    const usersWithDetails = users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      company_name: u.company_name || '-',
      db_name: u.db_name || '-',
      phone: u.phone || ''
    }));
    
    res.json(usersWithDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:username/password', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin role required.' });
  }
  
  const { username } = req.params;
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'New password is required' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { username },
      data: { password: hashedPassword }
    });
    
    // Also update provision token if exists
    await prisma.provisionToken.updateMany({
      where: { tmu_username: username },
      data: { tmu_password: password }
    });
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:username', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin role required.' });
  }

  const { username } = req.params;
  const { company_name, db_name, role, phone } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updateData = {};
    if (company_name !== undefined) updateData.company_name = company_name;
    if (db_name !== undefined) updateData.db_name = db_name;
    if (role !== undefined) updateData.role = role;
    if (phone !== undefined) updateData.phone = phone;

    await prisma.user.update({
      where: { username },
      data: updateData
    });

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:username', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin role required.' });
  }

  const { username } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await prisma.user.delete({ where: { username } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
