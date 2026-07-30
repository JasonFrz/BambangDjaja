const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-for-dev";

const authenticateToken = (req, res, next) => {
  const username = req.headers["x-username"];
  const role = req.headers["x-role"];
  const companyName = req.headers["x-company-name"];

  if (!username) {
    return res.status(401).json({ error: "Missing Authentication Headers (x-username)" });
  }

  req.user = {
    username,
    role: role || "user",
    company_name: companyName || ""
  };
  
  next();
};

module.exports = { authenticateToken };
