const test = require('node:test');
const assert = require('node:assert/strict');
const as = require('../utils/alertSender');
const emailClient = require('../utils/emailClient');
const { makeFakeDb } = require('./helpers/fakeDb');

const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0';

// Bentuk alert sama dengan alertEngine.buildAlerts.
const ALERTS = [
  { name: 'OilTemp', sub: 'High Trip', val: 97.456, limit: 'Trip Min 0 / Trip Max 95', type: 'TRIP' },
  { name: 'Vab', sub: 'Low Alarm', val: '-', limit: 'Min 360', type: 'ALARM' },
];

// master_tmu_app palsu: baris company (Telegram) dan daftar kontak user.
function fakeMaster({ telegram = { telegram_api_token: null, telegram_chat_id: null }, contacts = [] } = {}) {
  return makeFakeDb((sql) => {
    if (sql.includes('telegram_api_token')) return [telegram];
    if (sql.includes('FROM user')) return contacts;
    return [];
  });
}

function fakeCompanyDb(nama = 'Trafo Utama') {
  return makeFakeDb((sql) => (sql.includes('transformer_data') ? [{ nama }] : []));
}

function telegramFetch(reply = { ok: true, result: { message_id: 1 } }) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return { json: async () => reply };
  };
  fn.calls = calls;
  return fn;
}

function useDbs(t, master, company) {
  t.mock.method(as._deps, 'getMasterDb', async () => master);
  t.mock.method(as._deps, 'getDbConnection', async () => company);
}

test('formatTelegramAlert menyusun pesan HTML dan meng-escape nama trafo', () => {
  const msg = as.formatTelegramAlert('Trafo A&B <Gardu 1>', ALERTS, 'siang');
  assert.equal(msg, [
    '⚠️ <b>TMU ALERT</b>',
    '',
    'Selamat siang. Pada <b>Trafo A&amp;B &lt;Gardu 1&gt;</b> terdeteksi anomali pada sensor!',
    '',
    'Parameter yang bermasalah:',
    '1. <b>OilTemp (High Trip)</b>',
    '   Nilai Saat Ini: <b>97.46</b>',
    '   Batas: Trip Min 0 / Trip Max 95',
    '   Kondisi: TRIP',
    '',
    '2. <b>Vab (Low Alarm)</b>',
    '   Nilai Saat Ini: <b>-</b>',
    '   Batas: Min 360',
    '   Kondisi: ALARM',
    '',
    'Silakan segera periksa sistem Anda.',
    '',
    '<i>Pesan otomatis dari PT. Bambang Djaja - TMU System</i>',
  ].join('\n'));
});

test('sendAlertMessage mengirim satu pesan ke grup Telegram perusahaan walau tidak ada kontak WA/email', async (t) => {
  const master = fakeMaster({ telegram: { telegram_api_token: TOKEN, telegram_chat_id: '-1001234567890' } });
  useDbs(t, master, fakeCompanyDb('Trafo Utama'));
  const f = telegramFetch();
  t.mock.method(global, 'fetch', f);

  await as.sendAlertMessage('db_demo', 1, ALERTS);

  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, `https://api.telegram.org/bot${TOKEN}/sendMessage`);
  assert.equal(f.calls[0].body.chat_id, '-1001234567890');
  assert.match(f.calls[0].body.text, /Pada <b>Trafo Utama<\/b> terdeteksi/);
  assert.match(f.calls[0].body.text, /1\. <b>OilTemp \(High Trip\)<\/b>/);
  const tgQuery = master.calls.find((c) => c.sql.includes('telegram_api_token'));
  assert.deepEqual(tgQuery.params, ['db_demo']);
});

test('sendAlertMessage tidak memanggil Telegram bila token/chat ID perusahaan kosong', async (t) => {
  useDbs(t, fakeMaster({ telegram: { telegram_api_token: TOKEN, telegram_chat_id: '' } }), fakeCompanyDb());
  const f = telegramFetch();
  t.mock.method(global, 'fetch', f);

  await as.sendAlertMessage('db_demo', 1, ALERTS);

  assert.equal(f.calls.length, 0);
});

test('sendAlertMessage tetap mengirim email (format lama) walau Telegram gagal', async (t) => {
  const master = fakeMaster({
    telegram: { telegram_api_token: TOKEN, telegram_chat_id: '-100999' },
    contacts: [{ username: 'budi', phone: null, email: 'budi@example.com' }],
  });
  useDbs(t, master, fakeCompanyDb('Trafo Utama'));
  t.mock.method(global, 'fetch', telegramFetch({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }));
  const emails = [];
  t.mock.method(emailClient, 'sendEmailMessage', async (to, subject, text) => { emails.push({ to, subject, text }); return true; });
  t.mock.method(console, 'error', () => {});

  await as.sendAlertMessage('db_demo', 1, ALERTS);

  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'budi@example.com');
  assert.equal(emails[0].subject, '[TMU ALERT] Abnormal Parameter pada Trafo Utama');
  assert.ok(emails[0].text.includes(
    'Parameter yang bermasalah:\n'
    + '1. OilTemp (High Trip)\n   Nilai Saat Ini: 97.46\n   Batas: Trip Min 0 / Trip Max 95\n   Kondisi: TRIP\n\n'
    + '2. Vab (Low Alarm)\n   Nilai Saat Ini: -\n   Batas: Min 360\n   Kondisi: ALARM\n\n'
    + 'Silakan segera periksa sistem Anda.',
  ), emails[0].text);
});
