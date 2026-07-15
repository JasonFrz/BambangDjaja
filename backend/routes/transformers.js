const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    let transformers;
    if (req.user.role === 'admin') {
      transformers = await prisma.transformer.findMany({
        orderBy: { id: 'desc' }
      });
    } else {
      // Filter by user's username
      transformers = await prisma.transformer.findMany({
        where: { username: req.user.username },
        orderBy: { id: 'desc' }
      });
    }
    res.json(transformers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin role required.' });
  }
  
  const { name, power_capacity, type, status, company_name, username } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const newTrafo = await prisma.transformer.create({
      data: {
        name,
        power_capacity: power_capacity || '1000kVA',
        type: type || 'DyN',
        status: status || 'Offline',
        company_name: company_name || null,
        username: username || null
      }
    });
    res.json(newTrafo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin role required.' });
  }

  const { id } = req.params;
  const { name, power_capacity, type, status, company_name, username } = req.body;

  try {
    const trafo = await prisma.transformer.findUnique({ where: { id: parseInt(id) } });
    if (!trafo) return res.status(404).json({ error: 'Transformer not found' });

    const updatedTrafo = await prisma.transformer.update({
      where: { id: parseInt(id) },
      data: {
        name: name !== undefined ? name : trafo.name,
        power_capacity: power_capacity !== undefined ? power_capacity : trafo.power_capacity,
        type: type !== undefined ? type : trafo.type,
        status: status !== undefined ? status : trafo.status,
        company_name: company_name !== undefined ? company_name : trafo.company_name,
        username: username !== undefined ? username : trafo.username
      }
    });
    res.json(updatedTrafo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin role required.' });
  }

  const { id } = req.params;

  try {
    await prisma.transformer.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Transformer deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
