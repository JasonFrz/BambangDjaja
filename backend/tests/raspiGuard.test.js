const test = require('node:test');
const assert = require('node:assert/strict');
const w = require('../utils/raspiWebSocket');

function fakeWs() { const sent = []; return { readyState: 1, sent, send: (s) => sent.push(JSON.parse(s)) }; }

test('sendToRaspi menolak dorongan ke serial yang terdaftar untuk perusahaan lain', () => {
  const ws = fakeWs();
  w.raspiClients.set('S1', ws);
  w.raspiMeta.set('S1', { dbName: 'db_a', trafoId: 1, tmuVersion: 2 });
  assert.equal(w.sendToRaspi('S1', { type: 'x' }, 'db_a'), true);
  assert.equal(w.sendToRaspi('S1', { type: 'y' }, 'db_b'), false);
  assert.equal(w.sendToRaspi('S1', { type: 'z' }), true); // tanpa dbName: kompatibel dengan pemanggil lama
  assert.deepEqual(ws.sent.map((m) => m.type), ['x', 'z']);
  assert.equal(w.sendToRaspi('TIDAK-ADA', { type: 'x' }, 'db_a'), false);
  w.raspiClients.delete('S1'); w.raspiMeta.delete('S1');
});

test('canRegister menolak serial yang sedang aktif untuk perusahaan lain', () => {
  const ws = fakeWs();
  w.raspiClients.set('S2', ws);
  w.raspiMeta.set('S2', { dbName: 'db_a', trafoId: 1, tmuVersion: 2 });
  assert.equal(w.canRegister('S2', 'db_a'), true);   // perusahaan sama: reconnect boleh
  assert.equal(w.canRegister('S2', 'db_b'), false);  // perusahaan lain, koneksi masih hidup
  ws.readyState = 3;
  assert.equal(w.canRegister('S2', 'db_b'), true);   // koneksi lama mati: boleh
  assert.equal(w.canRegister('BARU', 'db_b'), true);
  w.raspiClients.delete('S2'); w.raspiMeta.delete('S2');
});
