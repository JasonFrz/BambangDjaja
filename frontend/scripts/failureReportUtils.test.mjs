// node --test scripts/failureReportUtils.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { toUtcRange, formatDuration } from '../src/utils/failureReportUtils.js';

test('toUtcRange: satu hari WIB = 17:00 UTC hari sebelumnya s/d 16:59:59.999 UTC', () => {
  assert.deepEqual(toUtcRange('2026-10-16', '2026-10-16'), {
    start: '2026-10-15T17:00:00.000Z',
    end: '2026-10-16T16:59:59.999Z',
  });
});

test('toUtcRange: rentang beberapa hari, pergantian bulan', () => {
  assert.deepEqual(toUtcRange('2026-09-30', '2026-10-02'), {
    start: '2026-09-29T17:00:00.000Z',
    end: '2026-10-02T16:59:59.999Z',
  });
});

test('formatDuration: hanya bagian yang tidak nol', () => {
  assert.equal(formatDuration(45), '45d');
  assert.equal(formatDuration(3600), '1j');
  assert.equal(formatDuration(3665), '1j 1m 5d');
  assert.equal(formatDuration(90061), '1h 1j 1m 1d');
});

test('formatDuration: nol detik = "0d"', () => {
  assert.equal(formatDuration(0), '0d');
});

test('formatDuration: angka dalam bentuk teks dari database tetap dibaca', () => {
  assert.equal(formatDuration('125'), '2m 5d');
});

test('formatDuration: kosong, bukan angka, atau negatif = "-"', () => {
  assert.equal(formatDuration(null), '-');
  assert.equal(formatDuration(undefined), '-');
  assert.equal(formatDuration('abc'), '-');
  assert.equal(formatDuration(-5), '-');
});
