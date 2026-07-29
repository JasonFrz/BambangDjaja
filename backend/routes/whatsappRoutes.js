const express = require('express');
const router = express.Router();
const whatsappClient = require('../utils/whatsappClient');
const emailClient = require('../utils/emailClient');
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
    
    // Mengecek apakah kolom nomor_telpon atau email ada di table users
    const [columnsInfo] = await db.execute("SHOW COLUMNS FROM users");
    const columns = columnsInfo.map(c => c.Field);
    
    if (!columns.includes('nomor_telpon') && !columns.includes('email')) {
      return res.status(400).json({ error: 'Database tidak memiliki fitur nomor telepon atau email untuk pengguna.' });
    }

    let selectCols = ['username', 'role'];
    if (columns.includes('nomor_telpon')) selectCols.push('nomor_telpon');
    if (columns.includes('email')) selectCols.push('email');

    // Ambil SEMUA pengguna
    const [users] = await db.execute(`SELECT ${selectCols.join(', ')} FROM users`);

    if (users.length === 0) {
      return res.status(404).json({ error: 'Tidak ada user di database ini.' });
    }

    const message = `🔔 *[TEST NOTIFIKASI TMU]*\n\nNotifikasi uji coba berhasil.\nFrekuensi saat ini: *${frequency.toFixed(2)} Hz*\n\n_Pesan otomatis dari PT. Bambang Djaja - TMU System_`;
    const emailSubject = `[TEST NOTIFIKASI TMU]`;
    const emailMsg = `Notifikasi uji coba berhasil.\nFrekuensi saat ini: ${frequency.toFixed(2)} Hz\n\nPesan otomatis dari PT. Bambang Djaja - TMU System`;
    
    console.log(`\n========================================`);
    console.log(`✅ MENGIRIM PESAN WHATSAPP & EMAIL KE ${users.length} USER`);
    
    let successCount = 0;
    
    for (const user of users) {
      const phone = user.nomor_telpon ? user.nomor_telpon.trim() : '';
      const email = user.email ? user.email.trim() : '';
      let sentToUser = false;

      if (phone.length >= 10 && phone !== '+62') {
        try {
          await whatsappClient.sendWhatsAppMessage(phone, message);
          console.log(`- Berhasil WA: ${user.username} (${user.role}) - ${phone}`);
          sentToUser = true;
          // Tambahkan delay agar puppeteer whatsapp tidak crash saat kirim massal
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (err) {
          console.log(`- Gagal WA: ${user.username} (${user.role}) - ${phone} (${err.message})`);
        }
      }

      if (email && email.includes('@')) {
        try {
          await emailClient.sendEmailMessage(email, emailSubject, emailMsg);
          console.log(`- Berhasil Email: ${user.username} (${user.role}) - ${email}`);
          sentToUser = true;
        } catch (err) {
          console.log(`- Gagal Email: ${user.username} (${user.role}) - ${email} (${err.message})`);
        }
      }

      if (sentToUser) successCount++;
    }
    
    console.log(`========================================\n`);
    
    if (successCount === 0) {
       return res.status(500).json({ error: 'Gagal mengirim pesan ke semua kontak yang terdaftar. Pastikan nomor/email valid.' });
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
