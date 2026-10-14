// Kirim pesan lewat Telegram Bot API. Token bot dan chat ID disimpan per perusahaan
// di master_tmu_app.company (telegram_api_token, telegram_chat_id), jadi tidak ada state global.

const TIMEOUT_MS = 10_000;

// Token BotFather: "<id bot>:<rahasia>", dibatasi varchar(50) kolom company.telegram_api_token.
const TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,}$/;
// Chat ID: angka (grup/supergroup negatif, mis. -1001234567890) atau @username channel publik.
const CHAT_ID_RE = /^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/;

async function sendTelegramMessage(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || `Telegram error ${data.error_code}`);
  return data.result;
}

// Baca telegram_api_token + telegram_chat_id dari body request.
// { config: undefined } = tidak dikirim (jangan ubah), { config: { token: null, chatId: null } } = nonaktifkan,
// { error } = input salah. Keduanya harus terisi atau keduanya kosong.
function parseTelegramConfig(body) {
  if (!body || (body.telegram_api_token === undefined && body.telegram_chat_id === undefined)) {
    return { config: undefined };
  }
  const token = String(body.telegram_api_token ?? '').trim();
  const chatId = String(body.telegram_chat_id ?? '').trim();
  if (!token && !chatId) return { config: { token: null, chatId: null } };
  if (!token || !chatId) return { error: 'Isi Bot Token dan Chat ID Telegram keduanya, atau kosongkan keduanya.' };
  if (token.length > 50 || !TOKEN_RE.test(token)) return { error: 'Format Bot Token Telegram tidak valid.' };
  if (chatId.length > 25 || !CHAT_ID_RE.test(chatId)) return { error: 'Format Chat ID Telegram tidak valid.' };
  return { config: { token, chatId } };
}

module.exports = { sendTelegramMessage, parseTelegramConfig };
