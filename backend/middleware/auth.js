const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Token is missing' });
  
  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token is invalid or expired' });
    
    try {
      const user = await prisma.user.findUnique({ where: { username: decoded.username } });
      if (!user) return res.status(401).json({ error: 'User not found' });
      req.user = user;
      next();
    } catch (dbErr) {
      return res.status(500).json({ error: 'Database error' });
    }
  });
};

module.exports = { authenticateToken };
