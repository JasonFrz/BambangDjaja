const db = require('./db');
const whatsappClient = require('./whatsappClient');
const emailClient = require('./emailClient');
const telegramClient = require('./telegramClient');

// Dependensi yang bisa disuntik test (tanpa MySQL).
const _deps = {
  getMasterDb: () => db.getMasterDb(),
  getDbConnection: (name) => db.getDbConnection(name),
};

async function getTrafoName(db, trafoId) {
  try {
    const [rows] = await db.execute(
      'SELECT COALESCE(t.nama, td.trafoSerialNo) AS nama FROM transformer_data td LEFT JOIN trafo t ON t.id = td.trafoId WHERE td.trafoId = ? LIMIT 1', [trafoId]);
    if (rows.length > 0 && rows[0].nama) return String(rows[0].nama).trim();
  } catch (e) { /* abaikan, pakai default */ }
  return `Trafo ${trafoId}`;
}

async function getContacts(masterDb, dbName) {
  const [rows] = await masterDb.execute(
    `SELECT u.username, u.phone, u.email FROM user u JOIN company c ON u.company_id = c.company_id WHERE c.database_name = ?`, [dbName]);
  return rows
    .map(u => ({ username: u.username || 'User', phone: u.phone && u.phone.length >= 10 ? u.phone.trim() : null, email: u.email && u.email.includes('@') ? u.email.trim() : null }))
    .filter(c => c.phone || c.email);
}

// Bot + grup Telegram perusahaan; null bila salah satu kosong (Telegram nonaktif).
async function getCompanyTelegram(masterDb, dbName) {
  const [rows] = await masterDb.execute(
    'SELECT telegram_api_token, telegram_chat_id FROM company WHERE database_name = ? LIMIT 1', [dbName]);
  const row = rows[0] || {};
  const token = String(row.telegram_api_token || '').trim();
  const chatId = String(row.telegram_chat_id || '').trim();
  return token && chatId ? { token, chatId } : null;
}

function greeting() {
  const hour = (new Date().getUTCHours() + 7) % 24;
  if (hour >= 11 && hour < 15) return 'siang';
  if (hour >= 15 && hour < 18) return 'sore';
  if (hour >= 18 || hour < 4) return 'malam';
  return 'pagi';
}

const CONDITIONS = { OVER: 'Melebihi Batas Maksimal', UNDER: 'Kurang Dari Batas Minimal', TRIP: 'TRIP', ALARM: 'ALARM' };

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Daftar parameter bermasalah. bold membungkus nama + nilai (WA: *x*, Telegram: <b>x</b>),
// esc meng-escape teks dinamis (HTML untuk Telegram, tidak ada untuk WA/email).
function alertLines(alerts, bold = (s) => s, esc = (s) => s) {
  return alerts.map((a, i) => {
    const val = typeof a.val === 'number' ? Math.round(a.val * 100) / 100 : a.val;
    const name = a.sub ? `${a.name} (${a.sub})` : a.name;
    return `${i + 1}. ${bold(esc(name))}\n   Nilai Saat Ini: ${bold(esc(val))}\n   Batas: ${esc(a.limit)}\n   Kondisi: ${esc(CONDITIONS[a.type] || a.type)}`;
  }).join('\n\n');
}

// Pesan ke grup, jadi tanpa sapaan nama user seperti WA/email.
function formatTelegramAlert(label, alerts, greet) {
  const lines = alertLines(alerts, (s) => `<b>${s}</b>`, escapeHtml);
  return `⚠️ <b>TMU ALERT</b>\n\nSelamat ${greet}. Pada <b>${escapeHtml(label)}</b> terdeteksi anomali pada sensor!\n\nParameter yang bermasalah:\n${lines}\n\nSilakan segera periksa sistem Anda.\n\n<i>Pesan otomatis dari PT. Bambang Djaja - TMU System</i>`;
}

// alerts: [{ name, sub, val, limit, type: 'OVER'|'UNDER'|'TRIP'|'ALARM' }]
async function sendAlertMessage(dbName, trafoId, alerts) {
  try {
    if (!Array.isArray(alerts) || alerts.length === 0) return;
    const db = await _deps.getDbConnection(dbName);
    const master = await _deps.getMasterDb();
    const trafoName = await getTrafoName(db, trafoId);
    const label = /^(trafo|transformator)/i.test(trafoName) ? trafoName : `Trafo ${trafoName}`;

    // Telegram dikirim sekali ke grup perusahaan, lepas dari ada/tidaknya kontak WA/email.
    const tg = await getCompanyTelegram(master, dbName);
    if (tg) {
      await telegramClient.sendTelegramMessage(tg.token, tg.chatId, formatTelegramAlert(label, alerts, greeting()))
        .catch((err) => console.error(`Gagal kirim Telegram (${dbName}):`, err.message));
    }

    const contacts = await getContacts(master, dbName);
    for (const c of contacts) {
      if (c.phone && whatsappClient.waReady) {
        const msg = `Halo Pak/Bu *${c.username}*, selamat ${greeting()}.\n\nPada *${label}* terdeteksi anomali pada sensor!\n\nParameter yang bermasalah:\n${alertLines(alerts, (s) => `*${s}*`)}\n\nSilakan segera periksa sistem Anda.\n\n_Pesan otomatis dari PT. Bambang Djaja - TMU System_`;
        await whatsappClient.sendWhatsAppMessage(c.phone, msg).catch(() => {});
        await new Promise(r => setTimeout(r, 3000));
      }
      if (c.email) {
        const msg = `Halo Pak/Bu ${c.username}, selamat ${greeting()}.\n\nPada ${label} terdeteksi anomali pada sensor!\n\nParameter yang bermasalah:\n${alertLines(alerts)}\n\nSilakan segera periksa sistem Anda.\n\nPesan otomatis dari PT. Bambang Djaja - TMU System`;
        await emailClient.sendEmailMessage(c.email, `[TMU ALERT] Abnormal Parameter pada ${label}`, msg).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Error sending alert:', err.message);
  }
}

module.exports = { sendAlertMessage, getContacts, getTrafoName, getCompanyTelegram, formatTelegramAlert, _deps };
