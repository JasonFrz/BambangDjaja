const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../utils/validate');

test('parsePositiveInt hanya menerima bilangan bulat positif', () => {
  assert.equal(v.parsePositiveInt('1'), 1);
  assert.equal(v.parsePositiveInt(7), 7);
  assert.equal(v.parsePositiveInt('0'), null);
  assert.equal(v.parsePositiveInt('-3'), null);
  assert.equal(v.parsePositiveInt('2.5'), null);
  assert.equal(v.parsePositiveInt('abc'), null);
  assert.equal(v.parsePositiveInt(undefined), null);
});

test('parseNumericBody memakai allowlist, kosong jadi null, non-angka ditolak', () => {
  const r = v.parseNumericBody({ a: '5', b: '', c: null, d: 0.5, zz: 9 }, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(r, { values: { a: 5, b: null, c: null, d: 0.5 }, invalid: [] });
  const bad = v.parseNumericBody({ a: 'abc', b: '1e400', c: '3' }, ['a', 'b', 'c']);
  assert.deepEqual(bad.invalid, ['a', 'b']);
  assert.deepEqual(bad.values, { c: 3 });
  assert.deepEqual(v.parseNumericBody(null, ['a']), { values: {}, invalid: [] });
});
