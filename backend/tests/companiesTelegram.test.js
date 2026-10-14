const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0';

// Router companies dipasang di app kecil dengan req.user super admin (verifyToken dilewati).
async function startApp(t) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { role: 'admin' }; next(); });
  app.use('/api/admin/companies', require('../routes/companies'));
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}/api/admin/companies`;
}

// Hanya panggilan ke api.telegram.org yang dipalsukan; request test ke app tetap fetch asli.
function mockTelegram(t, reply = { ok: true, result: { message_id: 7 } }) {
  const realFetch = global.fetch;
  const calls = [];
  t.mock.method(global, 'fetch', async (url, opts) => {
    if (!String(url).startsWith('https://api.telegram.org/')) return realFetch(url, opts);
    calls.push({ url, body: JSON.parse(opts.body) });
    return { json: async () => reply };
  });
  return calls;
}

function send(base, path, method, body) {
  return fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-super-admin': 'true' },
    body: JSON.stringify(body),
  });
}

test('POST /telegram-test mengirim pesan uji ke chat yang diisi di form', async (t) => {
  const base = await startApp(t);
  const calls = mockTelegram(t);
  const res = await send(base, '/telegram-test', 'POST', { telegram_api_token: TOKEN, telegram_chat_id: '-1001234567890' });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://api.telegram.org/bot${TOKEN}/sendMessage`);
  assert.equal(calls[0].body.chat_id, '-1001234567890');
  assert.match(calls[0].body.text, /TEST NOTIFIKASI TMU/);
});

test('POST /telegram-test menolak token/chat ID kosong tanpa memanggil Telegram', async (t) => {
  const base = await startApp(t);
  const calls = mockTelegram(t);
  const res = await send(base, '/telegram-test', 'POST', { telegram_api_token: '', telegram_chat_id: '' });
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('POST /telegram-test meneruskan pesan error Telegram dengan status 502', async (t) => {
  const base = await startApp(t);
  mockTelegram(t, { ok: false, error_code: 401, description: 'Unauthorized' });
  const res = await send(base, '/telegram-test', 'POST', { telegram_api_token: TOKEN, telegram_chat_id: '-100999' });
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /Unauthorized/);
});

test('POST /telegram-test hanya untuk super admin', async (t) => {
  const base = await startApp(t);
  const calls = mockTelegram(t);
  const res = await fetch(`${base}/telegram-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegram_api_token: TOKEN, telegram_chat_id: '-100999' }),
  });
  assert.equal(res.status, 401);
  assert.equal(calls.length, 0);
});

test('PUT /:id menolak konfigurasi Telegram yang tidak lengkap sebelum menyentuh DB', async (t) => {
  const base = await startApp(t);
  const res = await send(base, '/5', 'PUT', { nama_perusahaan: 'PT A', telegram_api_token: TOKEN, telegram_chat_id: '' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Telegram/);
});
