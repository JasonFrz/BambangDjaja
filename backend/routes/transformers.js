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
      // Filter by user's company_name
      transformers = await prisma.transformer.findMany({
        where: { company_name: req.user.company_name },
        orderBy: { id: 'desc' }
      });
    }
    res.json(transformers);
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

module.exports = router;
