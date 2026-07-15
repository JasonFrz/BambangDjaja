const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
  
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'username atau password invalid' });
    }
    
    const token = jwt.sign({ username: user.username, role: user.role, company_name: user.company_name }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token, username: user.username, role: user.role, company_name: user.company_name, phone: user.phone || '' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
