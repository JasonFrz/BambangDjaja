const crypto = require("crypto");

const generateApiKey = () => crypto.randomBytes(24).toString("base64url");
const hashApiKey = (key) =>
  crypto.createHash("sha256").update(key).digest("hex");

module.exports = { generateApiKey, hashApiKey };
