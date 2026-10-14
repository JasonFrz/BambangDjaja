const test = require('node:test');
const assert = require('node:assert/strict');
const tg = require('../utils/telegramClient');

const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0';

// fetch palsu: catat permintaan, balas dengan body JSON yang diberikan (bentuk asli Bot API).
function fakeFetch(reply) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts, body: JSON.parse(opts.body) });
    return { json: async () => reply };
  };
  fn.calls = calls;
  return fn;
}

test('sendTelegramMessage mengirim POST sendMessage dengan chat_id, teks, dan parse_mode HTML', async (t) => {
  const f = fakeFetch({ ok: true, result: { message_id: 42, chat: { id: -1001234567890 }, date: 1760400000, text: 'halo' } });
  t.mock.method(global, 'fetch', f);
  const res = await tg.sendTelegramMessage(TOKEN, '-1001234567890', '<b>halo</b>');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, `https://api.telegram.org/bot${TOKEN}/sendMessage`);
  assert.equal(f.calls[0].opts.method, 'POST');
  assert.equal(f.calls[0].opts.headers['Content-Type'], 'application/json');
  assert.equal(f.calls[0].body.chat_id, '-1001234567890');
  assert.equal(f.calls[0].body.text, '<b>halo</b>');
  assert.equal(f.calls[0].body.parse_mode, 'HTML');
  assert.equal(res.message_id, 42);
});

test('sendTelegramMessage melempar error berisi deskripsi Telegram saat ok:false', async (t) => {
  t.mock.method(global, 'fetch', fakeFetch({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }));
  await assert.rejects(tg.sendTelegramMessage(TOKEN, '-100999', 'x'), /chat not found/);
});

test('parseTelegramConfig: kedua field tidak dikirim berarti tidak ada perubahan', () => {
  assert.deepEqual(tg.parseTelegramConfig({ nama_perusahaan: 'PT A' }), { config: undefined });
  assert.deepEqual(tg.parseTelegramConfig(undefined), { config: undefined });
});

test('parseTelegramConfig: keduanya kosong menonaktifkan Telegram (null)', () => {
  assert.deepEqual(
    tg.parseTelegramConfig({ telegram_api_token: '  ', telegram_chat_id: '' }),
    { config: { token: null, chatId: null } },
  );
  assert.deepEqual(
    tg.parseTelegramConfig({ telegram_api_token: null, telegram_chat_id: null }),
    { config: { token: null, chatId: null } },
  );
});

test('parseTelegramConfig: nilai valid di-trim', () => {
  assert.deepEqual(
    tg.parseTelegramConfig({ telegram_api_token: ` ${TOKEN} `, telegram_chat_id: ' -1001234567890 ' }),
    { config: { token: TOKEN, chatId: '-1001234567890' } },
  );
  assert.deepEqual(
    tg.parseTelegramConfig({ telegram_api_token: TOKEN, telegram_chat_id: '@tmu_alert_pt' }),
    { config: { token: TOKEN, chatId: '@tmu_alert_pt' } },
  );
});

test('parseTelegramConfig: hanya satu field terisi ditolak', () => {
  assert.ok(tg.parseTelegramConfig({ telegram_api_token: TOKEN, telegram_chat_id: '' }).error);
  assert.ok(tg.parseTelegramConfig({ telegram_api_token: '', telegram_chat_id: '-100123' }).error);
  assert.ok(tg.parseTelegramConfig({ telegram_chat_id: '-100123' }).error);
});

test('parseTelegramConfig: format token dan chat ID yang salah ditolak', () => {
  const bad = (token, chatId) => tg.parseTelegramConfig({ telegram_api_token: token, telegram_chat_id: chatId }).error;
  assert.ok(bad('bukan-token', '-100123'), 'token tanpa titik dua');
  assert.ok(bad('123:abc', '-100123'), 'bagian rahasia token terlalu pendek');
  assert.ok(bad(`${TOKEN}${'x'.repeat(20)}`, '-100123'), 'token melebihi varchar(50)');
  assert.ok(bad(TOKEN, 'grup saya'), 'chat ID bukan angka/@username');
  assert.ok(bad(TOKEN, '-1'.padEnd(27, '1')), 'chat ID melebihi varchar(25)');
});
