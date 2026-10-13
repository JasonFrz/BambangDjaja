const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const ROLE_BY_STATUS = { 9: "superuser", 1: "admin", 2: "user" };
const STATUS_BY_ROLE = { superuser: 9, admin: 1, user: 2 };

function roleFromStatus(status) {
  return ROLE_BY_STATUS[Number(status)] || "user";
}

function statusFromRole(role) {
  return STATUS_BY_ROLE[String(role || "").toLowerCase()] || 2;
}

function makeSalt(len = 5) {
  return crypto.randomBytes(8).toString("hex").slice(0, len);
}

function hashPassword(password, salt) {
  return crypto
    .createHash("sha256")
    .update(String(password) + String(salt || ""))
    .digest("hex");
}

async function verifyPassword(password, stored, salt) {
  if (!stored) return false;
  if (/^\$2[aby]\$/.test(stored))
    return bcrypt.compare(String(password), stored);
  if (/^[a-f0-9]{64}$/i.test(stored))
    return hashPassword(password, salt) === stored.toLowerCase();
  return false;
}

module.exports = {
  roleFromStatus,
  statusFromRole,
  makeSalt,
  hashPassword,
  verifyPassword,
};
