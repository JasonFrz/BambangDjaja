const jwt = require("jsonwebtoken");
const prisma = require("../prismaClient");
const { generateApiKey, hashApiKey } = require("../utils/apiKey");

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-for-dev";

const authenticateToken = (req, res, next) => {
  const username = req.headers["x-username"];
  const role = req.headers["x-role"];
  const companyName = req.headers["x-company-name"];

  if (!username) {
    return res.status(401).json({ error: "Missing Authentication Headers (x-username)" });
  }

  // Populate req.user to match legacy JWT behavior
  req.user = {
    username,
    role: role || "user",
    company_name: companyName || ""
  };
  
  next();
};

const authenticateDevice = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const apiKey = authHeader && authHeader.split(" ")[1];
  if (!apiKey) return res.status(401).json({ error: "API key is missing" });

  try {
    const device = await prisma.registeredDevice.findUnique({
      where: { api_key: hashApiKey(apiKey) },
    });
    if (!device) return res.status(401).json({ error: "API key is invalid" });

    req.device = device;
    next();
  } catch (dbErr) {
    return res.status(500).json({ error: "Database error" });
  }
};

module.exports = { authenticateToken, authenticateDevice };
