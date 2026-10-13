const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { getMasterDb } = require("../utils/db");
const { makeSalt, hashPassword } = require("../utils/userAuth");
const { findUserByUsername, formatUser } = require("../utils/masterModel");
const formatPhoneNumber = require("../utils/phoneFormatter");

router.use(async (req, res, next) => {
  try {
    req.masterDb = await getMasterDb();
    const row = await findUserByUsername(req.masterDb, req.user.username);
    if (!row) return res.status(404).json({ error: "User not found." });
    req.profile = row;
    next();
  } catch (error) {
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

router.get("/", (req, res) => {
  const u = formatUser(req.profile);
  res.json({
    id: u.id,
    username: u.username,
    role: u.role,
    nomor_telpon: u.nomor_telpon,
    email: u.email,
    company_name: u.company_name,
  });
});

router.put("/", async (req, res) => {
  const body = req.body || {};
  const me = req.profile;
  try {
    const updates = [];
    const params = [];

    if (body.nomor_telpon !== undefined) {
      const phone = formatPhoneNumber(body.nomor_telpon);
      if (phone && phone !== "+62" && phone !== "-") {
        const [dup] = await req.masterDb.execute(
          "SELECT user_id FROM user WHERE phone = ? AND user_id != ? LIMIT 1",
          [phone, me.user_id],
        );
        if (dup.length > 0) return res.status(400).json({ error: "Phone number is already used by another user" });
      }
      updates.push("phone = ?");
      params.push(phone || null);
    }

    if (body.email !== undefined) {
      const email = String(body.email).trim();
      if (email) {
        const [dup] = await req.masterDb.execute(
          "SELECT user_id FROM user WHERE email = ? AND user_id != ? LIMIT 1",
          [email, me.user_id],
        );
        if (dup.length > 0) return res.status(400).json({ error: "Email is already used by another user" });
      }
      updates.push("email = ?");
      params.push(email || null);
    }

    let newUsername = me.username;
    const wanted = body.username !== undefined ? String(body.username).trim() : "";
    if (wanted && wanted !== me.username) {
      const [dup] = await req.masterDb.execute("SELECT user_id FROM user WHERE username = ? LIMIT 1", [wanted]);
      if (dup.length > 0) return res.status(400).json({ error: "Username is already taken" });
      newUsername = wanted;
      updates.push("username = ?");
      params.push(newUsername);
    }

    if (body.password) {
      const salt = makeSalt();
      updates.push("password = ?, salt = ?");
      params.push(hashPassword(body.password, salt), salt);
    }

    if (updates.length > 0) {
      params.push(me.user_id);
      await req.masterDb.execute(`UPDATE user SET ${updates.join(", ")} WHERE user_id = ?`, params);
    }

    // req.user membawa iat/exp dari token lama; jwt.sign menolak exp ganda, jadi dibuang dulu.
    const { iat, exp, ...claims } = req.user;
    const newToken = jwt.sign({ ...claims, username: newUsername }, process.env.JWT_SECRET, { expiresIn: "24h" });
    res.json({ message: "Profile updated successfully", newUsername, newToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

module.exports = router;
