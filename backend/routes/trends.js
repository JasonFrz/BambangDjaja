const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const axios = require("axios");

const IRIV_SERVER = process.env.IRIV_SERVER;
const IRIV_API_KEY = process.env.IRIV_API_KEY;

router.get("/meter", async (req, res) => {
  const { start, end } = req.query;

  try {
    const response = await axios.get(`${IRIV_SERVER}/api/trends/meter`, {
      params: {
        start,
        end,
      },
      headers: {
        "X-API-Key": IRIV_API_KEY,
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error("error fetching data: ", error.message);
    const statusCode = error.response ? error.response.status : 500;
    res.status(statusCode).json({ error: "eror" });
  }
});

router.get("/oil", async (req, res) => {
  const { start, end } = req.query;

  try {
    const response = await axios.get(`${IRIV_SERVER}/api/trends/oil`, {
      params: {
        start,
        end,
      },
      headers: {
        "X-API-Key": IRIV_API_KEY,
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error("error fetching data", error.message);
    const statusCode = error.response ? error.response.status : 500;
    res.status(statusCode).json({ error: "error" });
  }
});

module.exports = router;
