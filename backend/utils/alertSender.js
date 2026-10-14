const { getDbConnection, getMasterDb } = require('./db');
const whatsappClient = require('./whatsappClient');
const emailClient = require('./emailClient');

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

function greeting() {
  const hour = (new Date().getUTCHours() + 7) % 24;
  if (hour >= 11 && hour < 15) return 'siang';
  if (hour >= 15 && hour < 18) return 'sore';
  if (hour >= 18 || hour < 4) return 'malam';
  return 'pagi';
}

// alerts: [{ name, sub, val, limit, type: 'OVER'|'UNDER'|'TRIP'|'ALARM' }]
async function sendAlertMessage(dbName, trafoId, alerts) {
  try {
    if (!Array.isArray(alerts) || alerts.length === 0) return;
    const db = await getDbConnection(dbName);
    const trafoName = await getTrafoName(db, trafoId);
    const contacts = await getContacts(await getMasterDb(), dbName);
    if (contacts.length === 0) return;

    const condition = (a) => ({ OVER: 'Melebihi Batas Maksimal', UNDER: 'Kurang Dari Batas Minimal', TRIP: 'TRIP', ALARM: 'ALARM' }[a.type] || a.type);
    const lines = (bold) => alerts.map((a, i) => {
      const val = typeof a.val === 'number' ? Math.round(a.val * 100) / 100 : a.val;
      const name = a.sub ? `${a.name} (${a.sub})` : a.name;
      return `${i + 1}. ${bold ? `*${name}*` : name}\n   Nilai Saat Ini: ${bold ? `*${val}*` : val}\n   Batas: ${a.limit}\n   Kondisi: ${condition(a)}`;
    }).join('\n\n');
    const label = /^(trafo|transformator)/i.test(trafoName) ? trafoName : `Trafo ${trafoName}`;

    for (const c of contacts) {
      if (c.phone && whatsappClient.waReady) {
        const msg = `Halo Pak/Bu *${c.username}*, selamat ${greeting()}.\n\nPada *${label}* terdeteksi anomali pada sensor!\n\nParameter yang bermasalah:\n${lines(true)}\n\nSilakan segera periksa sistem Anda.\n\n_Pesan otomatis dari PT. Bambang Djaja - TMU System_`;
        await whatsappClient.sendWhatsAppMessage(c.phone, msg).catch(() => {});
        await new Promise(r => setTimeout(r, 3000));
      }
      if (c.email) {
        const msg = `Halo Pak/Bu ${c.username}, selamat ${greeting()}.\n\nPada ${label} terdeteksi anomali pada sensor!\n\nParameter yang bermasalah:\n${lines(false)}\n\nSilakan segera periksa sistem Anda.\n\nPesan otomatis dari PT. Bambang Djaja - TMU System`;
        await emailClient.sendEmailMessage(c.email, `[TMU ALERT] Abnormal Parameter pada ${label}`, msg).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Error sending alert:', err.message);
  }
}

module.exports = { sendAlertMessage, getContacts, getTrafoName };
