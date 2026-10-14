const test = require('node:test');
const assert = require('node:assert/strict');
const { dueRequests, INTERVALS } = require('../utils/raspiWebSocket');

test('dueRequests: awal koneksi -> status, tap, sync; realtime/harmonik hanya kalau ada penonton', () => {
  const s = { lastRealtime: 0, lastHarmonic: 0, lastStatus: 0, lastSync: 0 };
  assert.deepEqual(dueRequests(s, 10_000, false), ['requestSyncUpdateStatusTransformer', 'requestTapPositionRealTime', 'requestSyncDataReading', 'requestSyncDataFailureLog']);
  assert.deepEqual(dueRequests(s, 10_000, true), ['requestReadingDataRealTime', 'requestCurrentHarmonicRealTime', 'requestVoltageHarmonicRealTime', 'requestSyncUpdateStatusTransformer', 'requestTapPositionRealTime', 'requestSyncDataReading', 'requestSyncDataFailureLog']);
});

test('dueRequests menghormati interval', () => {
  const now = 1_000_000;
  const s = { lastRealtime: now - 4_000, lastHarmonic: now - 59_000, lastStatus: now - 61_000, lastSync: now - 5 * 60_000 };
  assert.deepEqual(dueRequests(s, now, true), ['requestSyncUpdateStatusTransformer', 'requestTapPositionRealTime']);
  s.lastRealtime = now - 5_000;
  assert.deepEqual(dueRequests(s, now, true).slice(0, 1), ['requestReadingDataRealTime']);
  assert.equal(INTERVALS.realtime, 5_000);
  assert.equal(INTERVALS.sync, 10 * 60_000);
});
