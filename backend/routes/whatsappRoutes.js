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
    
    // Mengecek apakah kolom nomor_telpon ada di table users
    const [columnsInfo] = await db.execute("SHOW COLUMNS FROM users");
    const columns = columnsInfo.map(c => c.Field);
    
    if (!columns.includes('nomor_telpon')) {
      return res.status(400).json({ error: 'Database tidak memiliki fitur nomor telepon untuk pengguna.' });
    }

    // Ambil SEMUA pengguna yang memiliki nomor telepon yang valid
    const [users] = await db.execute("SELECT username, nomor_telpon, role FROM users WHERE nomor_telpon IS NOT NULL AND nomor_telpon != '' AND nomor_telpon != '+62'");

    if (users.length === 0) {
      return res.status(404).json({ error: 'Tidak ada user dengan nomor telepon terdaftar di database ini.' });
    }

    const message = `🔔 *[TEST NOTIFIKASI TMU]*\n\nNotifikasi uji coba berhasil.\nFrekuensi saat ini: *${frequency.toFixed(2)} Hz*\n\n_Pesan otomatis dari PT. Bambang Djaja - TMU System_`;
    
    console.log(`\n========================================`);
    console.log(`✅ MENGIRIM PESAN WHATSAPP KE ${users.length} USER`);
    
    let successCount = 0;
    
    for (const user of users) {
      const phone = user.nomor_telpon.trim();
      if (phone.length >= 10) {
        try {
          await whatsappClient.sendWhatsAppMessage(phone, message);
          console.log(`- Berhasil: ${user.username} (${user.role}) - ${phone}`);
          successCount++;
          // Tambahkan delay agar puppeteer whatsapp tidak crash saat kirim massal
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (err) {
          console.log(`- Gagal: ${user.username} (${user.role}) - ${phone} (${err.message})`);
        }
      }
    }
    
    console.log(`========================================\n`);
    
    if (successCount === 0) {
       return res.status(500).json({ error: 'Gagal mengirim pesan ke semua nomor yang terdaftar. Pastikan nomor sudah benar dan terdaftar di WhatsApp.' });
    }
    
    return res.json({ success: true, message: `Pesan berhasil dikirim ke ${successCount} user.` });
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
