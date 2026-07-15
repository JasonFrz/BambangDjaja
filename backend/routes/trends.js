const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

router.get('/meter', async (req, res) => {
  const { start, end } = req.query;
  try {
    let whereClause = {};
    if (start && end) {
      whereClause = {
        timestamp: {
          gte: new Date(start),
          lte: new Date(end)
        }
      };
    }
    
    const readings = await prisma.electricalReading.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: start && end ? 300 : 60
    });
    
    res.json(readings.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/oil', async (req, res) => {
  const { start, end } = req.query;
  try {
    let whereClause = {};
    if (start && end) {
      whereClause = {
        timestamp: {
          gte: new Date(start),
          lte: new Date(end)
        }
      };
    }
    
    const readings = await prisma.oilReading.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: start && end ? 300 : 60
    });
    
    res.json(readings.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
