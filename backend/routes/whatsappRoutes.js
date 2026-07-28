const express = require('express');
const router = express.Router();
const whatsappClient = require('../utils/whatsappClient');
const { getDbConnection } = require('../utils/db');

router.post('/test', async (req, res) => {
  const { frequency, dbName, username } = req.body;

  if (!whatsappClient.waReady) {
    return res.status(503).json({ error: 'WhatsApp client belum siap. Silakan scan QR code di server terminal.' });
  }

  if (!frequency || !dbName || !username) {
    return res.status(400).json({ error: 'Missing required fields (frequency, dbName, username)' });
  }

  try {
    const db = await getDbConnection(dbName);
    const [users] = await db.execute('SELECT nomor_telpon FROM users WHERE username = ?', [username]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }

    const phone = users[0].nomor_telpon;
    if (!phone) {
      return res.status(400).json({ error: 'Nomor telepon tidak terdaftar untuk user ini.' });
    }

    const message = `🔔 *[TEST NOTIFIKASI TMU]*\n\nNotifikasi uji coba berhasil.\nFrekuensi saat ini: *${frequency.toFixed(2)} Hz*\n\n_Pesan otomatis dari PT. Bambang Djaja - TMU System_`;
    
    await whatsappClient.sendWhatsAppMessage(phone, message);
    
    console.log(`\n========================================`);
    console.log(`✅ BERHASIL MENGIRIM PESAN WHATSAPP`);
    console.log(`Username : ${username}`);
    console.log(`No. HP   : ${phone}`);
    console.log(`========================================\n`);
    
    return res.json({ success: true, message: `Pesan berhasil dikirim ke ${phone}` });
  } catch (error) {
    console.error('Test WA Error:', error);
    return res.status(500).json({ error: error.message || 'Gagal mengirim pesan WhatsApp' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const success = await whatsappClient.logoutWhatsApp();
    if (success) {
      return res.json({ success: true, message: 'WhatsApp session berhasil dihapus. Terminal akan menampilkan QR code baru segera.' });
    } else {
      return res.status(400).json({ error: 'WhatsApp client belum diinisialisasi' });
    }
  } catch (error) {
    console.error('Logout WA Error:', error);
    return res.status(500).json({ error: 'Gagal menghapus session WhatsApp' });
  }
});

module.exports = router;
