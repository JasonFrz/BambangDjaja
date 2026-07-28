const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const prisma = require("../prismaClient");
const CryptoJS = require("crypto-js");
const { authenticateToken, authenticateDevice } = require("../middleware/auth");
const { generateApiKey, hashApiKey } = require("../utils/apiKey");

const CLOUD_URL = process.env.CLOUD_URL;

router.get("/verify", authenticateDevice, async (req, res) => {
  return res.status(200).json({
    serial_number: req.device.serial_number,
  });
});

router.post("/generate-token", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Unauthorized. Admin role required." });
  }

  const {
    company_code,
    company_name,
    db_name,
    tmu_username,
    tmu_password,
    tmu_nomor_telpon,
    transformer_name,
    tmu_version,
  } = req.body;

  if (
    !company_code ||
    !company_name ||
    !db_name ||
    !tmu_username ||
    !tmu_password ||
    !tmu_nomor_telpon ||
    !transformer_name
  ) {
    return res.status(400).json({
      error:
        "Semua field (company_code, company_name, db_name, username, password, nomor_telpon, transformer_name) wajib diisi",
    });
  }

  if (tmu_version !== 1 && tmu_version !== 2) {
    return res.status(400).json({ error: "Invalid version" });
  }

  try {
    let token;
    let isUnique = false;
    while (!isUnique) {
      token = Math.floor(100000 + Math.random() * 900000).toString();
      const existingToken = await prisma.provisionToken.findUnique({
        where: { token },
      });
      if (!existingToken) isUnique = true;
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); 

    await prisma.provisionToken.create({
      data: {
        token,
        company_code,
        company_name,
        db_name,
        tmu_username,
        tmu_password,
        tmu_nomor_telpon,
        transformer_name,
        tmu_version,
        expires_at: expiresAt,
        created_by: req.user.username,
      },
    });

    res.json({
      status: 200,
      token,
      expires_at: expiresAt,
      message: "Token berlaku 10 menit, single-use",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/tokens", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Unauthorized. Admin role required." });
  }
  try {
    const tokens = await prisma.provisionToken.findMany({
      orderBy: { created_at: "desc" },
      take: 50,
    });
    res.json(tokens);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/tokens/:id", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const { id } = req.params;
  const {
    company_code,
    company_name,
    db_name,
    tmu_username,
    tmu_password,
    tmu_nomor_telpon,
    transformer_name,
    tmu_version,
  } = req.body;

  try {
    const token = await prisma.provisionToken.findUnique({
      where: { id: parseInt(id) },
    });
    if (!token) return res.status(404).json({ error: "Token not found" });
    if (token.is_used)
      return res
        .status(400)
        .json({ error: "Cannot edit an already used token" });

    const updated = await prisma.provisionToken.update({
      where: { id: parseInt(id) },
      data: {
        company_code,
        company_name,
        db_name,
        tmu_username,
        tmu_password,
        tmu_nomor_telpon,
        transformer_name,
        tmu_version,
      },
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/tokens/:id", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const { id } = req.params;

  try {
    const token = await prisma.provisionToken.findUnique({
      where: { id: parseInt(id) },
    });
    if (!token) return res.status(404).json({ error: "Token not found" });

    if (token.tmu_username) {
      await prisma.user.deleteMany({ where: { username: token.tmu_username } });
    }

    await prisma.provisionToken.delete({ where: { id: parseInt(id) } });
    res.json({ message: "Token and associated user deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/generate-company-code", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "Company name is required" });

  try {
    const cleanName = name
      .replace(/^(PT\.|PT|CV\.|CV|UD\.|UD)\s+/i, "")
      .replace(/[^a-zA-Z\s]/g, "")
      .trim();

    const words = cleanName.split(/\s+/);
    let initials = "";
    if (words.length >= 3) {
      initials = words[0][0] + words[1][0] + words[2][0];
    } else if (words.length === 2) {
      initials = words[0][0] + words[1][0] + (words[1][1] || "X");
    } else if (words.length === 1) {
      initials = words[0].substring(0, 3);
    }
    initials = initials.toUpperCase().padEnd(3, "X");

    let isUnique = false;
    let finalCode = "";

    while (!isUnique) {
      const digits = Math.floor(1000 + Math.random() * 9000).toString();
      finalCode = `${initials}${digits}`;

      const existingInTokens = await prisma.provisionToken.findFirst({
        where: { company_code: finalCode },
      });
      const existingInDevices = await prisma.registeredDevice.findFirst({
        where: { company_code: finalCode },
      });

      if (!existingInTokens && !existingInDevices) {
        isUnique = true;
      }
    }

    res.json({ company_code: finalCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/devices", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Unauthorized. Admin role required." });
  }
  try {
    const devices = await prisma.registeredDevice.findMany({
      orderBy: { provisioned_at: "desc" },
    });
    res.json(devices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/activate", async (req, res) => {
  const { provision_token, serial_number } = req.body;
  if (!provision_token || !serial_number) {
    return res
      .status(400)
      .json({ status: 400, message: "Missing token or serial_number" });
  }

  try {
    const tokenRow = await prisma.provisionToken.findUnique({
      where: { token: provision_token },
    });

    if (!tokenRow || tokenRow.is_used === 1) {
      return res
        .status(400)
        .json({ status: 400, message: "Token tidak valid atau sudah dipakai" });
    }

    if (new Date() > new Date(tokenRow.expires_at)) {
      return res
        .status(400)
        .json({ status: 400, message: "Token sudah expired" });
    }

    const companyData = {
      company_key: `${tokenRow.company_code}-KEY-001`,
      telegram_api_token: "bot123:ABC...",
      telegram_chat_id: "-100123456",
    };

    const SECRET_KEY = process.env.SECRET_KEY || "b@mB4nG_dJaJ@";
    const hashedSerial = CryptoJS.SHA256(serial_number).toString();
    const programKey = CryptoJS.AES.encrypt(
      hashedSerial,
      SECRET_KEY,
    ).toString();

    await prisma.provisionToken.update({
      where: { token: provision_token },
      data: {
        is_used: 1,
        used_at: new Date(),
        used_by_serial: serial_number,
      },
    });

    const apiKey = generateApiKey();

    const clientUsername = tokenRow.tmu_username;
    const clientPassword = tokenRow.tmu_password;

    if (!clientUsername || !clientPassword) {
      return res.status(400).json({
        status: 400,
        message:
          "Token tidak lengkap (dibuat di versi lama). Harap generate ulang token baru.",
      });
    }

    const hashedPassword = await bcrypt.hash(clientPassword, 10);

    await prisma.user.upsert({
      where: { username: clientUsername },
      update: {
        password: hashedPassword,
        company_name: tokenRow.company_name,
        db_name: tokenRow.db_name,
        nomor_telpon: tokenRow.tmu_nomor_telpon,
      },
      create: {
        username: clientUsername,
        password: hashedPassword,
        role: "user",
        company_name: tokenRow.company_name,
        db_name: tokenRow.db_name,
        nomor_telpon: tokenRow.tmu_nomor_telpon,
      },
    });

    let trafoRecord = null;

    if (tokenRow.transformer_name) {
      trafoRecord = await prisma.transformer.findFirst({
        where: {
          name: tokenRow.transformer_name,
          company_name: tokenRow.company_name,
        },
      });
      if (!trafoRecord) {
        trafoRecord = await prisma.transformer.create({
          data: {
            name: tokenRow.transformer_name,
            company_name: tokenRow.company_name,
            username: clientUsername,
          },
        });
      }
    }

    await prisma.registeredDevice.upsert({
      where: { serial_number },
      update: {
        provision_token,
        provisioned_at: new Date(),
        status: "provisioned",
        ...(trafoRecord ? { transformer_id: trafoRecord.id } : ),
      },
      create: {
        serial_number,
        company_code: tokenRow.company_code,
        tmu_version: tokenRow.tmu_version,
        provision_token,
        api_key: hashApiKey(apiKey),
        status: "provisioned",
        ...(trafoRecord ? { transformer_id: trafoRecord.id } : ),
      },
    });

    return res.json({
      status: 200,
      env_config: {
        MODBUS_PORT: "/dev/ttyACM0",
        MODBUS_BAUDRATE: 9600,
        MODBUS_PARITY: "N",
        MODBUS_STOPBITS: 1,
        MODBUS_BYTESIZE: 8,
        ADC_ADDRESS: "0x48",
        ADC_BUSNUM: 1,
        CLOUD_URL: CLOUD_URL,
        API_KEY: apiKey,
      },
      tmu_version: tokenRow.tmu_version,
      message: "Provisioning successful",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 500, message: "Server error" });
  }
});

module.exports = router;
