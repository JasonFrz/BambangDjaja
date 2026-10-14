// Validasi input kecil yang dipakai route; murni supaya mudah diuji.

// Bilangan bulat positif dari string/angka, selain itu null.
function parsePositiveInt(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// Ambil kolom numerik dari body sesuai allowlist. '' / null -> null (kosongkan),
// angka valid -> Number, selain itu masuk daftar invalid.
function parseNumericBody(body, allowlist) {
  const values = {};
  const invalid = [];
  if (!body || typeof body !== 'object') return { values, invalid };
  for (const k of allowlist) {
    if (!(k in body)) continue;
    const raw = body[k];
    if (raw === '' || raw === null) { values[k] = null; continue; }
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (String(raw).trim() === '' || !Number.isFinite(n)) invalid.push(k);
    else values[k] = n;
  }
  return { values, invalid };
}

module.exports = { parsePositiveInt, parseNumericBody };
