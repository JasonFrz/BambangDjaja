const jwt = require("jsonwebtoken");
require("dotenv").config({ quiet: true });

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    // Nama DB selalu diambil dari token, bukan dari header kiriman klien, supaya user
    // perusahaan A tidak bisa membaca DB perusahaan B. Hanya admin platform yang boleh
    // memilih DB lewat X-DB-Name karena tugasnya mengelola semua perusahaan.
    const isPlatformAdmin =
      String(decoded.role || "").toLowerCase() === "admin";
    if (!isPlatformAdmin || !req.headers["x-db-name"]) {
      if (decoded.dbName) req.headers["x-db-name"] = decoded.dbName;
      else delete req.headers["x-db-name"];
    }
    req.headers["x-username"] = decoded.username;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired token." });
  }
};

// Pakai: router.put('/x', requireRole('admin', 'superuser'), handler)
const requireRole =
  (...roles) =>
  (req, res, next) => {
    const role = String(req.user?.role || "").toLowerCase();
    if (!roles.includes(role)) {
      return res
        .status(403)
        .json({ error: `Akses ditolak. Butuh peran: ${roles.join(" / ")}` });
    }
    next();
  };

module.exports = { verifyToken, requireRole };
