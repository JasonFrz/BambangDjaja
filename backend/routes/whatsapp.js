const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middleware/auth');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// ---------------------------------------------------------
// WhatsApp Client Singleton
// ---------------------------------------------------------
let waClient = null;
let waReady = false;
let waQrCode = null;

const initWhatsApp = () => {
  if (waClient) return; // Already initialized

  waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: './wa_session' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    },
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
  });

  waClient.on('qr', (qr) => {
    waQrCode = qr;
    console.log('\n========================================');
    console.log('  SCAN QR CODE DI BAWAH UNTUK WHATSAPP');
    console.log('========================================\n');
    qrcode.generate(qr, { small: true });
    console.log('\nAtau buka http://localhost:5000/api/whatsapp/qr di browser untuk melihat QR Code.\n');
  });

  waClient.on('ready', () => {
    waReady = true;
    waQrCode = null;
    console.log('\n✅ WhatsApp Client READY! Pesan bisa dikirim.\n');
  });

  waClient.on('authenticated', () => {
    console.log('✅ WhatsApp Authenticated!');
  });

  waClient.on('auth_failure', (msg) => {
    waReady = false;
    console.error('❌ WhatsApp Auth Failure:', msg);
  });

  waClient.on('disconnected', (reason) => {
    waReady = false;
    waQrCode = null;
    console.log('⚠️ WhatsApp Disconnected:', reason);
    // Reinitialize after disconnect
    waClient = null;
    setTimeout(() => initWhatsApp(), 5000);
  });

  waClient.initialize();
};

// Initialize WhatsApp only when needed (e.g., via QR endpoint)
// initWhatsApp();

// ---------------------------------------------------------
// Routes
// ---------------------------------------------------------

// GET /api/whatsapp/status - Check WhatsApp connection status
router.get('/status', authenticateToken, (req, res) => {
  res.json({
    connected: waReady,
    needsQR: !!waQrCode,
    message: waReady
      ? 'WhatsApp terhubung dan siap mengirim pesan'
      : waQrCode
        ? 'Scan QR Code untuk menghubungkan WhatsApp'
        : 'WhatsApp sedang menginisialisasi...'
  });
});

// GET /api/whatsapp/qr - Get QR Code as HTML page (for easy scanning)
router.get('/qr', (req, res) => {
  if (!waClient) {
    initWhatsApp();
  }

  if (waReady) {
    return res.send(`
      <html><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#0a0a0a;color:#25D366;font-family:sans-serif;flex-direction:column">
        <h1>✅ WhatsApp Sudah Terhubung!</h1>
        <p style="color:#888">Anda bisa menutup halaman ini.</p>
      </body></html>
    `);
  }

  if (!waQrCode) {
    return res.send(`
      <html><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#0a0a0a;color:#fff;font-family:sans-serif;flex-direction:column">
        <h1>⏳ Menunggu QR Code...</h1>
        <p style="color:#888">Refresh halaman ini dalam beberapa detik.</p>
        <script>setTimeout(() => location.reload(), 3000);</script>
      </body></html>
    `);
  }

  // Generate QR as image using a simple library
  const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(waQrCode)}`;
  res.send(`
    <html><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#0a0a0a;color:#fff;font-family:sans-serif;flex-direction:column">
      <h1 style="color:#25D366">📱 Scan QR Code WhatsApp</h1>
      <p style="color:#888;margin-bottom:20px">Buka WhatsApp di HP > Linked Devices > Link a Device</p>
      <img src="${qrImage}" style="border-radius:12px;border:4px solid #25D366" />
      <p style="color:#666;margin-top:20px;font-size:12px">Halaman ini auto-refresh setiap 5 detik...</p>
      <script>setTimeout(() => location.reload(), 5000);</script>
    </body></html>
  `);
});

// POST /api/whatsapp/send - Send WhatsApp message
router.post('/send', authenticateToken, async (req, res) => {
  const { transformer_id, transformer_name, message_type } = req.body;

  if (!transformer_id && !transformer_name) {
    return res.status(400).json({ error: 'Transformer info is required' });
  }

  try {
    // Get the logged-in user's phone from DB
    const user = await prisma.user.findUnique({
      where: { username: req.user.username }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.phone) {
      return res.status(400).json({ error: 'Nomor telepon belum terdaftar. Hubungi admin untuk menambahkan nomor WhatsApp Anda.' });
    }

    // Build the message
    const msgType = message_type || 'report';
    let messageText = '';

    switch (msgType) {
      case 'temperature':
        messageText = `⚠️ *[TMU ALERT - SUHU]*\n\nHalo ${user.username},\nTrafo *${transformer_name}* (ID: ${transformer_id}) terdeteksi memiliki masalah suhu.\n\nSilakan segera cek kondisi transformer Anda.\n\n_Pesan otomatis dari PT. Bambang Djaja - TMU System_`;
        break;
      case 'pressure':
        messageText = `⚠️ *[TMU ALERT - TEKANAN]*\n\nHalo ${user.username},\nTrafo *${transformer_name}* (ID: ${transformer_id}) terdeteksi memiliki masalah tekanan minyak.\n\nSilakan segera cek kondisi transformer Anda.\n\n_Pesan otomatis dari PT. Bambang Djaja - TMU System_`;
        break;
      case 'report':
        messageText = `📋 *[TMU REPORT]*\n\nHalo ${user.username},\nLaporan masalah pada Trafo *${transformer_name}* (ID: ${transformer_id}) telah dikirim ke tim teknis PT. Bambang Djaja.\n\nTim kami akan segera menghubungi Anda.\n\n_Pesan otomatis dari PT. Bambang Djaja - TMU System_`;
        break;
      default:
        messageText = `📢 *[TMU NOTIFICATION]*\n\nHalo ${user.username},\nNotifikasi terkait Trafo *${transformer_name}* (ID: ${transformer_id}).\n\nSilakan cek dashboard TMU untuk informasi lebih lanjut.\n\n_Pesan otomatis dari PT. Bambang Djaja - TMU System_`;
    }

    // Format phone number for WhatsApp (must end with @c.us)
    let phoneNumber = user.phone.replace(/\+/g, '').replace(/\s/g, '').replace(/-/g, '');
    // Ensure it starts with country code
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '62' + phoneNumber.substring(1);
    }
    const chatId = phoneNumber + '@c.us';

    // Check if WhatsApp is ready
    if (!waReady || !waClient) {
      if (!waClient) {
        initWhatsApp();
      }
      return res.status(503).json({
        error: 'WhatsApp belum terhubung. Admin perlu scan QR Code terlebih dahulu.',
        needsQR: true
      });
    }

    // Send message
    await waClient.sendMessage(chatId, messageText);

    return res.json({
      success: true,
      message: `Pesan WhatsApp berhasil dikirim ke ${user.phone}`
    });

  } catch (error) {
    console.error('WhatsApp send error:', error);
    res.status(500).json({ error: 'Gagal mengirim pesan WhatsApp: ' + error.message });
  }
});

module.exports = router;
