const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let waClient = null;
let waReady = false;

const initWhatsApp = () => {
  if (waClient) return;

  waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: './wa_session' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    }
  });

  waClient.on('qr', (qr) => {
    console.log('\n========================================');
    console.log('  SCAN QR CODE DI BAWAH UNTUK WHATSAPP');
    console.log('========================================\n');
    qrcode.generate(qr, { small: true });
    console.log('\nJika sudah terhubung, notifikasi WhatsApp otomatis aktif.\n');
  });

  waClient.on('ready', () => {
    waReady = true;
    console.log('\n✅ WhatsApp Client READY! Notifikasi siap dikirim.\n');
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
    console.log('⚠️ WhatsApp Disconnected:', reason);
    
    // Destroy client to free resources
    if (waClient) {
      waClient.destroy().catch(() => {});
    }
    
    waClient = null;
  });

  waClient.initialize().catch(err => {
    console.error('❌ Failed to initialize WhatsApp:', err);
    waReady = false;
    waClient = null;
  });
};

const sendWhatsAppMessage = async (phone, text) => {
  if (!waReady || !waClient) {
    throw new Error('WhatsApp client is not ready');
  }

  // Format phone number for WhatsApp (must end with @c.us)
  let phoneNumber = phone.replace(/\+/g, '').replace(/\s/g, '').replace(/-/g, '');
  // Ensure it starts with country code, assuming 62 for Indonesia if starting with 0
  if (phoneNumber.startsWith('0')) {
    phoneNumber = '62' + phoneNumber.substring(1);
  }
  const chatId = phoneNumber + '@c.us';

  try {
    const isRegistered = await waClient.isRegisteredUser(chatId);
    if (!isRegistered) {
      throw new Error(`Nomor telepon ${phoneNumber} tidak terdaftar di WhatsApp`);
    }
    await waClient.sendMessage(chatId, text);
    console.log(`✅ Berhasil mengirim notifikasi WA ke ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error(`❌ Gagal mengirim notifikasi WA ke ${phoneNumber}:`, error.message);
    throw error;
  }
};

const logoutWhatsApp = async () => {
  if (waClient) {
    try {
      if (waReady) {
        await waClient.logout();
      }
      await waClient.destroy();
    } catch (err) {
      console.error('Error logging out WA:', err);
    }
    waClient = null;
    waReady = false;
    
    // Optionally remove the wa_session directory so it restarts clean
    try {
      const fs = require('fs');
      if (fs.existsSync('./wa_session')) {
        fs.rmSync('./wa_session', { recursive: true, force: true });
      }
    } catch (fsErr) {
      console.error('Failed to remove wa_session directory:', fsErr.message);
    }
    
    // Re-initialize to show QR code again
    setTimeout(() => {
      initWhatsApp();
    }, 2000);
    return true;
  }
  return false;
};

module.exports = {
  initWhatsApp,
  sendWhatsAppMessage,
  logoutWhatsApp,
  get waReady() { return waReady; }
};
