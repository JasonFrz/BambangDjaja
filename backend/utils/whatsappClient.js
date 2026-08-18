const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let waClient = null;
let waReady = false;
let qrString = '';
let connectionState = 'DISCONNECTED'; // DISCONNECTED, NEEDS_SCAN, CONNECTING, CONNECTED

let connectedSince = null;
let messagesSentToday = 0;
let connectedPhone = '';
let lastMessageDate = null;

const os = require('os');
const isArm = os.platform() === 'linux' && os.arch().includes('arm');

const initWhatsApp = () => {
  if (waClient) return;

  connectionState = 'CONNECTING';
  qrString = '';

  waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: './wa_session' }),
    webVersionCache: {
      type: 'none'
    },
    puppeteer: {
      headless: true,
      executablePath: isArm ? '/usr/bin/chromium-browser' : undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--no-first-run',
        '--no-zygote',
        '--mute-audio',
        '--disable-background-networking',
        '--disable-background-timer-throttling'
      ]
    }
  });

  waClient.on('qr', (qr) => {
    qrString = qr;
    connectionState = 'NEEDS_SCAN';
  });

  waClient.on('ready', () => {
    waReady = true;
    qrString = '';
    connectionState = 'CONNECTED';
    connectedSince = new Date().toISOString();
    messagesSentToday = 0;
    lastMessageDate = new Date().toDateString();
    
    if (waClient.info && waClient.info.wid) {
      connectedPhone = '+' + waClient.info.wid.user;
    }
    
    console.log('\n✅ WhatsApp Client READY! Notifikasi siap dikirim.\n');
  });

  waClient.on('authenticated', () => {
    console.log('✅ WhatsApp Authenticated!');
    connectionState = 'CONNECTING';
    qrString = '';
  });

  waClient.on('auth_failure', (msg) => {
    waReady = false;
    qrString = '';
    connectionState = 'DISCONNECTED';
    console.error('❌ WhatsApp Auth Failure:', msg);
  });

  waClient.on('disconnected', (reason) => {
    waReady = false;
    qrString = '';
    connectionState = 'DISCONNECTED';
    connectedSince = null;
    connectedPhone = '';
    console.log('⚠️ WhatsApp Disconnected:', reason);

    if (waClient) {
      waClient.destroy().catch(() => { });
    }

    waClient = null;
  });

  waClient.initialize().catch(err => {
    console.error('❌ Failed to initialize WhatsApp:', err);
    waReady = false;
    qrString = '';
    connectionState = 'DISCONNECTED';
    waClient = null;
  });
};

const sendWhatsAppMessage = async (phone, text) => {
  if (!waReady || !waClient) {
    throw new Error('WhatsApp client is not ready');
  }

  let phoneNumber = phone.replace(/\+/g, '').replace(/\s/g, '').replace(/-/g, '');
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
    
    // Update tracking
    const today = new Date().toDateString();
    if (lastMessageDate !== today) {
      messagesSentToday = 1;
      lastMessageDate = today;
    } else {
      messagesSentToday++;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Gagal mengirim notifikasi WA ke ${phoneNumber}:`, error.message);
    throw error;
  }
};

const logoutWhatsApp = async () => {
  try {
    if (waClient) {
      await waClient.logout().catch(() => { });
      await waClient.destroy().catch(() => { });
      waClient = null;
    }
    waReady = false;
    qrString = '';
    connectionState = 'DISCONNECTED';
    connectedSince = null;
    connectedPhone = '';

    const fs = require('fs');
    if (fs.existsSync('./wa_session')) {
      try {
        await fs.promises.rm('./wa_session', { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
      } catch (err) {
        console.warn('⚠️ Could not completely remove wa_session directory (might be locked):', err.message);
      }
    }

    setTimeout(() => {
      initWhatsApp();
    }, 2000);

    return true;
  } catch (err) {
    console.error('Error logging out WA:', err);
    return false;
  }
};

module.exports = {
  initWhatsApp,
  sendWhatsAppMessage,
  logoutWhatsApp,
  get waReady() { return waReady; },
  get qrString() { return qrString; },
  get connectionState() { return connectionState; },
  get connectedSince() { return connectedSince; },
  get messagesSentToday() { return messagesSentToday; },
  get connectedPhone() { return connectedPhone; }
};
