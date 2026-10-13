# Rencana B: Auth, Route Master, Route Trafo/Settings/Trends, Poller

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Semua route HTTP dan poller Socket.IO membaca `master_tmu_app` (`user`, `company`) dan database perusahaan berskema `base_tmu` lewat `readingModel.js`, sehingga dashboard yang ada menampilkan data `db_demo`. Tidak ada lagi referensi ke `tmu_master`, `users`, `companies`, `electrical_readings`, `oil_readings`, `threshold_settings`.

**Architecture:** Login membaca `user JOIN company`, peran diturunkan dari `user.status` (9 superuser, 1 admin, 2 user), JWT membawa `companyId` dan `dbName`. Route trafo/settings/trends memakai modul kecil yang bisa diuji tanpa MySQL: `statusModel.js` (kode status, rekomendasi, flag oli), `limitsModel.js` (batas gauge dari `transformer_settings`), `trafoModel.js` (nameplate, status, online). `realtimePoller.js` tinggal membaca `temp_reading_data_realtime` lewat `readingModel` dan memancarkan `meter` + `oil_sensor`. Pengiriman alert dipindah ke `alertSender.js` untuk dipakai Rencana C.

**Tech Stack:** Node 22, Express 5, mysql2/promise, jsonwebtoken, bcryptjs, exceljs, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-13-tmu-legacy-schema-design.md` bagian 4.1, 6, 7, 9, 10 (urutan 3–7).

## Global Constraints

- Nama kolom `base_tmu` untuk tabel reading hanya boleh ada di `readingModel.js`. Kolom `transformer_settings`, `transformer_status`, `transformer_data` boleh di modul model masing-masing (`limitsModel.js`, `statusModel.js`, `trafoModel.js`) dan route yang memakainya.
- Nilai dari user ke SQL selalu lewat `?`. Nama kolom yang berasal dari body selalu lewat allowlist.
- Bentuk respons yang dibaca frontend saat ini dipertahankan kecuali yang spec sebut berubah: `/api/trends*` mengembalikan key frontend (bukan `phase_a_v`), `/api/settings/thresholds` mengembalikan `{ settings, trip }`, `/api/settings/limits` baru. Frontend disesuaikan di Rencana D; sampai itu selesai, halaman Settings dan grafik tren memakai data kosong, itu normal.
- Peran dalam JWT dan respons tetap string `admin` / `superuser` / `user` karena 15 tempat di frontend membandingkan string itu.
- Test unit tidak boleh butuh MySQL; pakai `tests/helpers/fakeDb.js`.
- Tiap task diakhiri `npm test` lulus dan satu commit.

## Review Focus

1. Trafo yang belum punya baris `transformer_settings` atau `transformer_status` (trafo baru dari Raspi yang gagal setengah jalan): `/api/settings/limits` harus `{}` dan `/api/trafo/:id/status` harus semua Normal, bukan 500. Test di Task 3 dan 4.
2. Raspi sedang offline saat admin mengubah threshold: `PUT /api/settings/thresholds/:id` tetap menyimpan ke DB dan membalas `pushed: false`, bukan gagal. Test di Task 4.
3. User lama tanpa `salt` (NULL) dengan password bcrypt dari `tmu_master` lama: login harus tetap bisa. Test di Task 1.
4. Rentang export tanpa data: `/api/trends/export` membalas 404 berisi waktu data terdekat, bukan file xlsx kosong. Test di Task 5 lewat `checkClosestData` dengan db palsu.
5. Kode status di luar 1–5 atau NULL dari Raspi versi lama: `statusModel` memperlakukan sebagai Normal (3), bukan crash saat mencari label. Test di Task 3.

## File Structure

| File | Status | Tanggung jawab |
|---|---|---|
| `backend/utils/userAuth.js` | baru | salt, sha256+salt, verifikasi bcrypt/sha256, peran dari status |
| `backend/utils/activityLog.js` | baru | tulis `user_activity_log` |
| `backend/utils/authMiddleware.js` | ubah | tambah `requireRole` |
| `backend/routes/auth.js` | tulis ulang | login ke `user JOIN company` |
| `backend/routes/users.js`, `superuser_users.js`, `profile.js`, `admin.js`, `companies.js` | tulis ulang | tabel `user` / `company` |
| `backend/routes/layouts.js` | ubah kecil | `getMasterDb`, tabel `user` |
| `backend/utils/schemaPatch.js` | ubah | tabel `trafo` (nama kustom, foto) |
| `backend/utils/statusModel.js` | baru | label status, pengelompokan rekomendasi, flag oli |
| `backend/utils/trafoModel.js` | baru | nameplate, status row, online/offline, daftar trafo |
| `backend/routes/trafo.js` | tulis ulang | daftar, nama/foto, nameplate, status, physical, harmonics, oil-quality |
| `backend/utils/limitsModel.js` | baru | batas gauge dan nilai tegangan dari threshold |
| `backend/routes/settings.js` | tulis ulang | thresholds, trip, limits, dorong ke Raspi |
| `backend/routes/trends.js` | tulis ulang | trends, meter, oil, export, report, thi, events, news |
| `backend/routes/analytics.js` | tulis ulang | katalog metric key frontend + query |
| `backend/utils/alertSender.js` | baru | `sendAlertMessage` ke `user WHERE company_id` (dipakai Rencana C) |
| `backend/utils/realtimePoller.js` | tulis ulang | emit `meter` dan `oil_sensor` dari `readingModel` |
| `backend/utils/efficiency.js` | hapus | digantikan `readingModel.computeEfficiency` |
| `backend/scripts/smoke_api.js` | baru | login demo lalu panggil semua GET, cetak status |

---

### Task 1: Auth ke tabel `user` / `company`

**Files:**
- Create: `backend/utils/userAuth.js`, `backend/utils/activityLog.js`
- Modify: `backend/utils/authMiddleware.js`
- Rewrite: `backend/routes/auth.js`
- Test: `backend/tests/userAuth.test.js`

**Interfaces:**
- Consumes: `getMasterDb`, `getMasterDbName` dari `utils/db.js`.
- Produces: `userAuth.{ makeSalt, hashPassword, verifyPassword, roleFromStatus, statusFromRole }`; `activityLog.logActivity(masterDb, info)`; `authMiddleware.requireRole(...roles)`; JWT payload `{ id, username, role, dbName, companyId, companyName, tmuVersion }` yang dipakai semua task berikutnya lewat `req.user`.

- [ ] **Step 1: Tulis test `backend/tests/userAuth.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const ua = require('../utils/userAuth');

test('hashPassword sha256(password + salt) cocok dengan seed demo', () => {
  const h = ua.hashPassword('demo123', 'ab12c');
  assert.match(h, /^[a-f0-9]{64}$/);
  assert.equal(h, require('crypto').createHash('sha256').update('demo123ab12c').digest('hex'));
});

test('makeSalt 5 karakter heksadesimal, berbeda tiap panggilan', () => {
  const a = ua.makeSalt(), b = ua.makeSalt();
  assert.match(a, /^[a-f0-9]{5}$/);
  assert.notEqual(a, b);
});

test('verifyPassword menerima sha256+salt dan bcrypt, menolak yang salah', async () => {
  const salt = 'ab12c';
  assert.equal(await ua.verifyPassword('demo123', ua.hashPassword('demo123', salt), salt), true);
  assert.equal(await ua.verifyPassword('salah', ua.hashPassword('demo123', salt), salt), false);
  const bc = await bcrypt.hash('rahasia', 4);
  assert.equal(await ua.verifyPassword('rahasia', bc, null), true);
  assert.equal(await ua.verifyPassword('rahasia', bc, 'salt-apa-saja'), true);
  assert.equal(await ua.verifyPassword('x', 'plaintext', null), false);
  assert.equal(await ua.verifyPassword('x', null, null), false);
});

test('roleFromStatus dan statusFromRole saling kebalikan', () => {
  assert.equal(ua.roleFromStatus(9), 'superuser');
  assert.equal(ua.roleFromStatus(1), 'admin');
  assert.equal(ua.roleFromStatus(2), 'user');
  assert.equal(ua.roleFromStatus('9'), 'superuser');
  assert.equal(ua.roleFromStatus(null), 'user');
  assert.equal(ua.statusFromRole('superuser'), 9);
  assert.equal(ua.statusFromRole('Admin'), 1);
  assert.equal(ua.statusFromRole('apa'), 2);
});
```

- [ ] **Step 2: Jalankan `npm test`, pastikan gagal**

Expected: `Cannot find module '../utils/userAuth'`, test lain tetap lulus.

- [ ] **Step 3: Tulis `backend/utils/userAuth.js`**

```js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// user.status: 9 superuser (pengelola perusahaan), 1 admin (platform), 2 user biasa.
const ROLE_BY_STATUS = { 9: 'superuser', 1: 'admin', 2: 'user' };
const STATUS_BY_ROLE = { superuser: 9, admin: 1, user: 2 };

function roleFromStatus(status) {
  return ROLE_BY_STATUS[Number(status)] || 'user';
}

function statusFromRole(role) {
  return STATUS_BY_ROLE[String(role || '').toLowerCase()] || 2;
}

function makeSalt(len = 5) {
  return crypto.randomBytes(8).toString('hex').slice(0, len);
}

// Format TMU lama: sha256(password + salt) dalam hex.
function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(String(password) + String(salt || '')).digest('hex');
}

async function verifyPassword(password, stored, salt) {
  if (!stored) return false;
  if (/^\$2[aby]\$/.test(stored)) return bcrypt.compare(String(password), stored);
  if (/^[a-f0-9]{64}$/i.test(stored)) return hashPassword(password, salt) === stored.toLowerCase();
  return false;
}

module.exports = { roleFromStatus, statusFromRole, makeSalt, hashPassword, verifyPassword };
```

- [ ] **Step 4: Tulis `backend/utils/activityLog.js`**

```js
// Menulis ke master.user_activity_log. Tidak pernah melempar: log gagal tidak boleh menggagalkan request.
async function logActivity(masterDb, info = {}) {
  const {
    userId, companyId, username, type, description, module, trafoId, trafoSerialNo,
    oldValue, newValue, ip, userAgent,
  } = info;
  try {
    await masterDb.execute(
      `INSERT INTO user_activity_log
        (user_id, company_id, username, activity_type, activity_description, module, trafo_id, trafo_serial_no, old_value, new_value, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || 0, companyId || 0, username || null, type || 'UNKNOWN', description || null, module || null,
        trafoId != null ? String(trafoId) : null, trafoSerialNo || null,
        oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null,
        ip || null, userAgent ? String(userAgent).slice(0, 500) : null,
      ]
    );
  } catch (err) {
    console.warn('[ActivityLog] gagal menulis log:', err.message);
  }
}

module.exports = { logActivity };
```

- [ ] **Step 5: Ubah `backend/utils/authMiddleware.js`**

Ganti seluruh isi dengan:

```js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    // Nama DB selalu dari token, bukan header klien, supaya user perusahaan A tidak bisa
    // membaca DB perusahaan B. Hanya admin platform yang boleh memilih DB lewat X-DB-Name.
    const isPlatformAdmin = String(decoded.role || '').toLowerCase() === 'admin';
    if (!isPlatformAdmin || !req.headers['x-db-name']) {
      if (decoded.dbName) req.headers['x-db-name'] = decoded.dbName;
      else delete req.headers['x-db-name'];
    }
    req.headers['x-username'] = decoded.username;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

// Pakai: router.put('/x', requireRole('admin', 'superuser'), handler)
const requireRole = (...roles) => (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (!roles.includes(role)) {
    return res.status(403).json({ error: `Akses ditolak. Butuh peran: ${roles.join(' / ')}` });
  }
  next();
};

module.exports = { verifyToken, requireRole };
```

- [ ] **Step 6: Tulis ulang `backend/routes/auth.js`**

```js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { getMasterDb, getMasterDbName } = require('../utils/db');
const { verifyPassword, roleFromStatus } = require('../utils/userAuth');
const { logActivity } = require('../utils/activityLog');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Terlalu banyak percobaan login. Silakan coba lagi setelah 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  try {
    const masterDb = await getMasterDb();
    const [rows] = await masterDb.execute(
      `SELECT u.user_id, u.username, u.password, u.salt, u.status, u.company_id, u.email, u.phone,
              c.company_name, c.database_name, c.tmu_version
       FROM user u LEFT JOIN company c ON u.company_id = c.company_id
       WHERE u.username = ? OR u.email = ? OR u.phone = ? LIMIT 1`,
      [username, username, username]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Username atau password invalid' });

    const user = rows[0];
    const ok = await verifyPassword(password, user.password, user.salt);
    if (!ok) return res.status(401).json({ error: 'Username atau password invalid' });

    const role = roleFromStatus(user.status);
    const dbName = user.database_name || getMasterDbName();
    const companyName = user.company_name || dbName;
    const payload = {
      id: user.user_id,
      username: user.username,
      role,
      dbName,
      companyId: user.company_id || 0,
      companyName,
      tmuVersion: user.tmu_version || 2,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    logActivity(masterDb, {
      userId: user.user_id, companyId: user.company_id, username: user.username,
      type: 'LOGIN', description: 'Login berhasil', module: 'auth',
      ip: req.ip, userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      token,
      username: user.username,
      role,
      company_name: companyName,
      nama_perusahaan: companyName,
      db_name: dbName,
      phone: user.phone || '',
      email: user.email || '',
      tmu_version: payload.tmuVersion,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

module.exports = router;
```

- [ ] **Step 7: Jalankan `npm test`, lalu coba login sungguhan**

Run: `npm test` → semua lulus (26 + 4 = 30).

Run (server harus jalan dengan `npm start` di terminal lain):

```powershell
curl.exe -s -X POST http://localhost:5000/api/login -H "Content-Type: application/json" -d "{\"username\":\"demo\",\"password\":\"demo123\"}"
```

Expected: JSON dengan `"success":true`, `"role":"superuser"`, `"db_name":"db_demo"`, `"nama_perusahaan":"PT Demo"`. Cek log: `SELECT activity_type, username FROM user_activity_log ORDER BY log_id DESC LIMIT 1` berisi `LOGIN demo`.

- [ ] **Step 8: Commit**

```bash
git add backend/utils/userAuth.js backend/utils/activityLog.js backend/utils/authMiddleware.js backend/routes/auth.js backend/tests/userAuth.test.js
git commit -m "feat(backend): login ke tabel user/company master_tmu_app, peran dari status"
```

---

### Task 2: Route master: users, superuser_users, profile, admin, companies, layouts

**Files:**
- Rewrite: `backend/routes/users.js`, `backend/routes/superuser_users.js`, `backend/routes/profile.js`, `backend/routes/admin.js`, `backend/routes/companies.js`
- Modify: `backend/routes/layouts.js`
- Create: `backend/utils/masterModel.js`
- Test: `backend/tests/masterModel.test.js`

**Interfaces:**
- Consumes: `userAuth`, `activityLog`, `requireRole`, `sqlTemplate.createDatabaseFromSql`, `schemaPatch.patchCompanyDb`.
- Produces: `masterModel.{ getCompanyByDb, findUserByUsername, formatUser }`. Respons tetap memakai nama field lama yang dibaca frontend: `id`, `username`, `role`, `db_name`, `company_name`, `nomor_telpon`, `email`, `nama_perusahaan`, `nama_db`.

- [ ] **Step 1: Tulis test `backend/tests/masterModel.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('./helpers/fakeDb');
const mm = require('../utils/masterModel');

test('formatUser memetakan baris user+company ke field yang dibaca frontend', () => {
  const u = mm.formatUser({
    user_id: 7, username: 'budi', status: 2, company_id: 92, email: 'b@x.id', phone: '+628111',
    company_name: 'PT Demo', database_name: 'db_demo',
  });
  assert.deepEqual(u, {
    id: 7, username: 'budi', role: 'user', company_id: 92,
    db_name: 'db_demo', company_name: 'PT Demo', nama_db: 'db_demo', nama_perusahaan: 'PT Demo',
    nomor_telpon: '+628111', email: 'b@x.id', created_at: null,
  });
});

test('formatUser memberi "-" untuk user tanpa perusahaan', () => {
  const u = mm.formatUser({ user_id: 1, username: 'root', status: 1, company_id: 0 });
  assert.equal(u.role, 'admin');
  assert.equal(u.db_name, '-');
  assert.equal(u.company_name, '-');
  assert.equal(u.nomor_telpon, '');
});

test('getCompanyByDb mengembalikan baris company atau null', async () => {
  const db = makeFakeDb((sql, params) => (params[0] === 'db_demo' ? [{ company_id: 92, database_name: 'db_demo' }] : []));
  assert.equal((await mm.getCompanyByDb(db, 'db_demo')).company_id, 92);
  assert.equal(await mm.getCompanyByDb(db, 'db_lain'), null);
  assert.match(db.calls[0].sql, /FROM company WHERE database_name = \?/);
});
```

- [ ] **Step 2: Jalankan `npm test`, pastikan gagal karena modul belum ada**

- [ ] **Step 3: Tulis `backend/utils/masterModel.js`**

```js
const { roleFromStatus } = require('./userAuth');

const USER_SELECT = `SELECT u.user_id, u.username, u.status, u.company_id, u.email, u.phone, u.salt,
  c.company_name, c.database_name, c.tmu_version
  FROM user u LEFT JOIN company c ON u.company_id = c.company_id`;

async function getCompanyByDb(masterDb, dbName) {
  const [rows] = await masterDb.execute('SELECT * FROM company WHERE database_name = ? LIMIT 1', [dbName]);
  return rows[0] || null;
}

async function findUserByUsername(masterDb, username) {
  const [rows] = await masterDb.execute(`${USER_SELECT} WHERE u.username = ? LIMIT 1`, [username]);
  return rows[0] || null;
}

async function listUsersByCompany(masterDb, companyId, { excludeAdmin = false } = {}) {
  const extra = excludeAdmin ? ' AND u.status != 1' : '';
  const [rows] = await masterDb.execute(`${USER_SELECT} WHERE u.company_id = ?${extra} ORDER BY u.user_id DESC`, [companyId]);
  return rows.map(formatUser);
}

// Bentuk yang dibaca AddUser, ManageUsersSuperuser, Profile, AdminDashboard.
function formatUser(row) {
  const db = row.database_name || '-';
  const company = row.company_name || (row.database_name ? row.database_name : '-');
  return {
    id: row.user_id,
    username: row.username,
    role: roleFromStatus(row.status),
    company_id: row.company_id || 0,
    db_name: db,
    company_name: company,
    nama_db: db,
    nama_perusahaan: company,
    nomor_telpon: row.phone || '',
    email: row.email || '',
    created_at: null,
  };
}

module.exports = { USER_SELECT, getCompanyByDb, findUserByUsername, listUsersByCompany, formatUser };
```

- [ ] **Step 4: Tulis ulang `backend/routes/users.js`** (admin perusahaan: superuser; admin platform juga boleh dengan `X-DB-Name`)

```js
const express = require('express');
const router = express.Router();
const { getMasterDb } = require('../utils/db');
const { requireRole } = require('../utils/authMiddleware');
const { makeSalt, hashPassword, statusFromRole } = require('../utils/userAuth');
const { getCompanyByDb, listUsersByCompany } = require('../utils/masterModel');
const { logActivity } = require('../utils/activityLog');
const formatPhoneNumber = require('../utils/phoneFormatter');

// Menentukan perusahaan yang dikelola: superuser = perusahaannya sendiri, admin = dari X-DB-Name.
const resolveCompany = async (req, res, next) => {
  try {
    req.masterDb = await getMasterDb();
    const dbName = req.user.role === 'admin' ? (req.headers['x-db-name'] || req.user.dbName) : req.user.dbName;
    const company = await getCompanyByDb(req.masterDb, dbName);
    if (!company) return res.status(404).json({ error: `Perusahaan untuk database ${dbName} tidak ditemukan` });
    req.company = company;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

router.use(requireRole('admin', 'superuser'), resolveCompany);

router.post('/', async (req, res) => {
  try {
    let { username, password, role, nomor_telpon, email } = req.body || {};
    if (!username || !password || !nomor_telpon || !email) {
      return res.status(400).json({ error: 'Username, password, nomor telepon, dan email wajib diisi' });
    }
    nomor_telpon = formatPhoneNumber(nomor_telpon);

    const [existing] = await req.masterDb.execute('SELECT user_id FROM user WHERE username = ? LIMIT 1', [username]);
    if (existing.length > 0) return res.status(400).json({ error: 'Username already exists' });

    const salt = makeSalt();
    const status = role === 'superuser' ? 9 : 2; // superuser hanya boleh membuat superuser/user
    await req.masterDb.execute(
      'INSERT INTO user (username, password, role, salt, company_id, status, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [username, hashPassword(password, salt), status, salt, req.company.company_id, status, email, nomor_telpon]
    );
    logActivity(req.masterDb, { userId: req.user.id, companyId: req.company.company_id, username: req.user.username,
      type: 'USER_CREATE', description: `Membuat user ${username}`, module: 'users', newValue: { username, role: statusFromRole(role) === 9 ? 'superuser' : 'user' } });
    res.status(201).json({ message: 'user berhasil dibuat!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    res.json(await listUsersByCompany(req.masterDb, req.company.company_id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:username/password', async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'New password is required' });
  try {
    const salt = makeSalt();
    const [r] = await req.masterDb.execute('UPDATE user SET password = ?, salt = ? WHERE username = ? AND company_id = ?',
      [hashPassword(password, salt), salt, req.params.username, req.company.company_id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'User not found in your company' });
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:username', async (req, res) => {
  const { role, nomor_telpon, email } = req.body || {};
  try {
    const updates = [], params = [];
    if (role !== undefined) { updates.push('status = ?, role = ?'); const s = role === 'superuser' ? 9 : 2; params.push(s, s); }
    if (nomor_telpon !== undefined) { updates.push('phone = ?'); params.push(formatPhoneNumber(nomor_telpon) || null); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email || null); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(req.params.username, req.company.company_id);
    const [r] = await req.masterDb.execute(`UPDATE user SET ${updates.join(', ')} WHERE username = ? AND company_id = ?`, params);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'User not found in your company' });
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:username', async (req, res) => {
  try {
    const [r] = await req.masterDb.execute('DELETE FROM user WHERE username = ? AND company_id = ? AND status != 1',
      [req.params.username, req.company.company_id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'User not found in your company' });
    logActivity(req.masterDb, { userId: req.user.id, companyId: req.company.company_id, username: req.user.username,
      type: 'USER_DELETE', description: `Menghapus user ${req.params.username}`, module: 'users' });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

- [ ] **Step 5: Tulis ulang `backend/routes/superuser_users.js`**

```js
const express = require('express');
const router = express.Router();
const { getMasterDb } = require('../utils/db');
const { requireRole } = require('../utils/authMiddleware');
const { makeSalt, hashPassword } = require('../utils/userAuth');
const { listUsersByCompany } = require('../utils/masterModel');
const formatPhoneNumber = require('../utils/phoneFormatter');

router.use(requireRole('superuser'), async (req, res, next) => {
  try { req.masterDb = await getMasterDb(); next(); } catch (e) { res.status(500).json({ error: 'Server error: ' + e.message }); }
});

async function assertUnique(masterDb, field, value, exceptId = null) {
  if (!value || value === '-') return null;
  const [rows] = await masterDb.execute(
    `SELECT user_id FROM user WHERE ${field} = ?${exceptId ? ' AND user_id != ?' : ''} LIMIT 1`,
    exceptId ? [value, exceptId] : [value]
  );
  return rows.length > 0 ? `${field === 'phone' ? 'Phone number' : field === 'email' ? 'Email' : 'Username'} is already used by another user` : null;
}

router.post('/', async (req, res) => {
  try {
    let { username, password, nomor_telpon, email, role } = req.body || {};
    if (!username || !password || !nomor_telpon || !email) {
      return res.status(400).json({ error: 'Username, password, nomor telepon, dan email wajib diisi' });
    }
    nomor_telpon = formatPhoneNumber(nomor_telpon);
    for (const [f, v] of [['username', username], ['phone', nomor_telpon], ['email', email]]) {
      const err = await assertUnique(req.masterDb, f, v);
      if (err) return res.status(400).json({ error: err });
    }
    const salt = makeSalt();
    const status = role === 'superuser' ? 9 : 2;
    await req.masterDb.execute(
      'INSERT INTO user (username, password, role, salt, company_id, status, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [username, hashPassword(password, salt), status, salt, req.user.companyId, status, email, nomor_telpon]
    );
    res.status(201).json({ message: 'User created successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    res.json(await listUsersByCompany(req.masterDb, req.user.companyId, { excludeAdmin: true }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  let { username, password, nomor_telpon, email, role } = req.body || {};
  if (!nomor_telpon || !email) return res.status(400).json({ error: 'Nomor telepon dan email wajib diisi' });
  nomor_telpon = formatPhoneNumber(nomor_telpon);

  try {
    const [existing] = await req.masterDb.execute(
      'SELECT user_id FROM user WHERE user_id = ? AND status != 1 AND company_id = ? LIMIT 1', [id, req.user.companyId]);
    if (existing.length === 0) return res.status(404).json({ error: 'User not found in your company' });

    for (const [f, v] of [['username', username], ['phone', nomor_telpon], ['email', email]]) {
      const err = await assertUnique(req.masterDb, f, v, id);
      if (err) return res.status(400).json({ error: err });
    }

    const updates = ['phone = ?', 'email = ?'], params = [nomor_telpon, email];
    if (username !== undefined) { updates.push('username = ?'); params.push(username); }
    if (role !== undefined) { const s = role === 'superuser' ? 9 : 2; updates.push('status = ?, role = ?'); params.push(s, s); }
    if (password) { const salt = makeSalt(); updates.push('password = ?, salt = ?'); params.push(hashPassword(password, salt), salt); }
    params.push(id, req.user.companyId);
    await req.masterDb.execute(`UPDATE user SET ${updates.join(', ')} WHERE user_id = ? AND company_id = ?`, params);
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const [r] = await req.masterDb.execute('DELETE FROM user WHERE user_id = ? AND status != 1 AND company_id = ?', [id, req.user.companyId]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'User not found in your company' });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

module.exports = router;
```

- [ ] **Step 6: Tulis ulang `backend/routes/profile.js`**

```js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getMasterDb } = require('../utils/db');
const { makeSalt, hashPassword } = require('../utils/userAuth');
const { findUserByUsername, formatUser } = require('../utils/masterModel');
const formatPhoneNumber = require('../utils/phoneFormatter');

router.use(async (req, res, next) => {
  try {
    req.masterDb = await getMasterDb();
    const row = await findUserByUsername(req.masterDb, req.user.username);
    if (!row) return res.status(404).json({ error: 'User not found.' });
    req.profile = row;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.get('/', (req, res) => {
  const u = formatUser(req.profile);
  res.json({ id: u.id, username: u.username, role: u.role, nomor_telpon: u.nomor_telpon, email: u.email, company_name: u.company_name });
});

router.put('/', async (req, res) => {
  const body = req.body || {};
  const me = req.profile;
  try {
    const updates = [], params = [];

    if (body.nomor_telpon !== undefined) {
      const phone = formatPhoneNumber(body.nomor_telpon);
      if (phone && phone !== '+62' && phone !== '-') {
        const [dup] = await req.masterDb.execute('SELECT user_id FROM user WHERE phone = ? AND user_id != ? LIMIT 1', [phone, me.user_id]);
        if (dup.length > 0) return res.status(400).json({ error: 'Phone number is already used by another user' });
      }
      updates.push('phone = ?'); params.push(phone || null);
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim();
      if (email) {
        const [dup] = await req.masterDb.execute('SELECT user_id FROM user WHERE email = ? AND user_id != ? LIMIT 1', [email, me.user_id]);
        if (dup.length > 0) return res.status(400).json({ error: 'Email is already used by another user' });
      }
      updates.push('email = ?'); params.push(email || null);
    }
    let newUsername = me.username;
    if (body.username !== undefined && String(body.username).trim() && String(body.username).trim() !== me.username) {
      newUsername = String(body.username).trim();
      const [dup] = await req.masterDb.execute('SELECT user_id FROM user WHERE username = ? LIMIT 1', [newUsername]);
      if (dup.length > 0) return res.status(400).json({ error: 'Username is already taken' });
      updates.push('username = ?'); params.push(newUsername);
    }
    if (body.password) {
      const salt = makeSalt();
      updates.push('password = ?, salt = ?'); params.push(hashPassword(body.password, salt), salt);
    }
    if (updates.length > 0) {
      params.push(me.user_id);
      await req.masterDb.execute(`UPDATE user SET ${updates.join(', ')} WHERE user_id = ?`, params);
    }

    // req.user membawa iat/exp dari token lama; jwt.sign menolak exp ganda, jadi dibuang dulu.
    const { iat, exp, ...claims } = req.user;
    const newToken = jwt.sign({ ...claims, username: newUsername }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: 'Profile updated successfully', newUsername, newToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

module.exports = router;
```

- [ ] **Step 7: Tulis ulang `backend/routes/admin.js`**

```js
const express = require('express');
const router = express.Router();
const { getAllDatabases, getDbConnection, getAdminPool, getMasterDb, getMasterDbName } = require('../utils/db');
const { requireRole } = require('../utils/authMiddleware');
const { assertValidDbName } = require('../utils/sqlTemplate');
const { makeSalt, hashPassword } = require('../utils/userAuth');
const { USER_SELECT, formatUser } = require('../utils/masterModel');
const formatPhoneNumber = require('../utils/phoneFormatter');

const SYSTEM_DBS = ['information_schema', 'mysql', 'performance_schema', 'sys', 'defaultdb'];
const isProtectedDb = (name) => SYSTEM_DBS.includes(name) || name === getMasterDbName();

router.use(requireRole('admin'), (req, res, next) => {
  if (req.headers['x-super-admin'] !== 'true') return res.status(401).json({ error: 'Unauthorized. Super admin access required.' });
  next();
});

router.get('/databases', async (req, res) => {
  try {
    res.json({ success: true, databases: await getAllDatabases() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch databases', details: error.message });
  }
});

router.get('/databases/:dbName/tables', async (req, res) => {
  try {
    assertValidDbName(req.params.dbName);
    const pool = await getDbConnection(req.params.dbName);
    const [rows] = await pool.query('SHOW TABLES');
    res.json({ success: true, tables: rows.map(r => Object.values(r)[0]) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tables', details: error.message });
  }
});

router.get('/databases/:dbName/tables/:tableName', async (req, res) => {
  const { dbName, tableName } = req.params;
  const { limit, sort } = req.query;
  try {
    assertValidDbName(dbName);
    assertValidDbName(tableName);
    const pool = await getDbConnection(dbName);
    const [cols] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
    const names = cols.map(c => c.Field);
    const orderCol = ['id', 'timestamp', 'created_at', 'data_id', 'rowId', 'trafoId'].find(c => names.includes(c));
    const orderClause = orderCol && (sort === 'latest' || sort === 'oldest') ? `ORDER BY \`${orderCol}\` ${sort === 'latest' ? 'DESC' : 'ASC'}` : '';
    const parsed = parseInt(limit, 10);
    const limitClause = limit === 'all' ? '' : `LIMIT ${Number.isFinite(parsed) && parsed > 0 ? parsed : 100}`;
    const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` ${orderClause} ${limitClause}`);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch table data', details: error.message });
  }
});

router.put('/databases/:oldDbName', async (req, res) => {
  const { oldDbName } = req.params;
  const newDbName = String(req.body?.newDbName || '').trim();
  if (!newDbName) return res.status(400).json({ error: 'New database name is required' });
  if (isProtectedDb(oldDbName) || isProtectedDb(newDbName)) return res.status(403).json({ error: 'Cannot rename system database' });
  try {
    assertValidDbName(oldDbName); assertValidDbName(newDbName);
    const pool = await getAdminPool();
    const [rows] = await pool.query('SHOW DATABASES LIKE ?', [newDbName]);
    if (rows.length > 0) return res.status(400).json({ error: 'Database with new name already exists' });

    await pool.query(`CREATE DATABASE \`${newDbName}\``);
    const [tables] = await pool.query('SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ?', [oldDbName]);
    for (const t of tables) {
      await pool.query(`RENAME TABLE \`${oldDbName}\`.\`${t.TABLE_NAME}\` TO \`${newDbName}\`.\`${t.TABLE_NAME}\``);
    }
    await pool.query(`DROP DATABASE \`${oldDbName}\``);
    const master = await getMasterDb();
    await master.execute('UPDATE company SET database_name = ? WHERE database_name = ?', [newDbName, oldDbName]);
    res.json({ success: true, message: `Database successfully renamed to ${newDbName}.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename database', details: error.message });
  }
});

router.delete('/databases/:dbName', async (req, res) => {
  const { dbName } = req.params;
  if (isProtectedDb(dbName)) return res.status(403).json({ error: 'Cannot delete system database' });
  try {
    assertValidDbName(dbName);
    const pool = await getAdminPool();
    await pool.query(`DROP DATABASE \`${dbName}\``);
    res.json({ success: true, message: `Database ${dbName} successfully deleted.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete database', details: error.message });
  }
});

// Admin platform (status 1)
router.get('/users', async (req, res) => {
  try {
    const master = await getMasterDb();
    const [rows] = await master.execute(`${USER_SELECT} WHERE u.status = 1 ORDER BY u.user_id DESC`);
    res.json({ success: true, data: rows.map(formatUser) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

router.post('/users', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const master = await getMasterDb();
    const [existing] = await master.execute('SELECT user_id FROM user WHERE username = ? LIMIT 1', [username]);
    if (existing.length > 0) return res.status(400).json({ error: 'Username already exists' });
    const salt = makeSalt();
    await master.execute(
      'INSERT INTO user (username, password, role, salt, company_id, status, email, phone) VALUES (?, ?, 1, ?, 0, 1, NULL, NULL)',
      [username, hashPassword(password, salt), salt]
    );
    res.json({ success: true, message: 'Admin user created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

router.put('/users/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { username, password } = req.body || {};
  try {
    const master = await getMasterDb();
    if (username) {
      const [dup] = await master.execute('SELECT user_id FROM user WHERE username = ? AND user_id != ? LIMIT 1', [username, id]);
      if (dup.length > 0) return res.status(400).json({ error: 'Username already taken' });
    }
    const updates = [], params = [];
    if (username) { updates.push('username = ?'); params.push(username); }
    if (password) { const salt = makeSalt(); updates.push('password = ?, salt = ?'); params.push(hashPassword(password, salt), salt); }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(id);
    await master.execute(`UPDATE user SET ${updates.join(', ')} WHERE user_id = ? AND status = 1`, params);
    res.json({ success: true, message: 'Admin user updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update admin user' });
  }
});

router.delete('/users/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const master = await getMasterDb();
    const [[{ count }]] = await master.execute('SELECT COUNT(*) AS count FROM user WHERE status = 1');
    if (count <= 1) return res.status(400).json({ error: 'Cannot delete the last remaining admin user' });
    await master.execute('DELETE FROM user WHERE user_id = ? AND status = 1', [id]);
    res.json({ success: true, message: 'Admin user deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete admin user' });
  }
});

// User aplikasi (superuser + user semua perusahaan)
router.get('/all-users', async (req, res) => {
  try {
    const master = await getMasterDb();
    const [rows] = await master.execute(`${USER_SELECT} WHERE u.status != 1 ORDER BY u.user_id DESC`);
    res.json({ success: true, data: rows.map(formatUser) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all users' });
  }
});

router.put('/app-users/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { username, password, role, nama_db, nomor_telpon, email } = req.body || {};
  try {
    const master = await getMasterDb();
    if (username) {
      const [dup] = await master.execute('SELECT user_id FROM user WHERE username = ? AND user_id != ? LIMIT 1', [username, id]);
      if (dup.length > 0) return res.status(400).json({ error: 'Username already taken' });
    }
    const updates = [], params = [];
    if (username !== undefined) { updates.push('username = ?'); params.push(username); }
    if (role !== undefined) { const s = role === 'superuser' ? 9 : 2; updates.push('status = ?, role = ?'); params.push(s, s); }
    if (nama_db !== undefined) {
      const [c] = await master.execute('SELECT company_id FROM company WHERE database_name = ? LIMIT 1', [nama_db]);
      if (c.length === 0) return res.status(400).json({ error: `Database ${nama_db} tidak terdaftar sebagai perusahaan` });
      updates.push('company_id = ?'); params.push(c[0].company_id);
    }
    if (nomor_telpon !== undefined) { updates.push('phone = ?'); params.push(formatPhoneNumber(nomor_telpon) || null); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email || null); }
    if (password) { const salt = makeSalt(); updates.push('password = ?, salt = ?'); params.push(hashPassword(password, salt), salt); }
    if (updates.length > 0) {
      params.push(id);
      await master.execute(`UPDATE user SET ${updates.join(', ')} WHERE user_id = ? AND status != 1`, params);
    }
    res.json({ success: true, message: 'App user updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update app user' });
  }
});

router.delete('/app-users/:id', async (req, res) => {
  try {
    const master = await getMasterDb();
    await master.execute('DELETE FROM user WHERE user_id = ? AND status != 1', [parseInt(req.params.id, 10)]);
    res.json({ success: true, message: 'App user deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete app user' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const dbs = await getAllDatabases();
    let tables = 0;
    if (dbs.length > 0) {
      const pool = await getAdminPool();
      const [[r]] = await pool.query('SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA IN (?)', [dbs]);
      tables = r.count;
    }
    const master = await getMasterDb();
    const [[u]] = await master.execute('SELECT COUNT(*) AS count FROM user WHERE status != 1');
    const [[a]] = await master.execute('SELECT COUNT(*) AS count FROM user WHERE status = 1');
    res.json({ success: true, databases: dbs.length, tables, appUsers: u.count, activeAdmins: a.count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
```

- [ ] **Step 8: Tulis ulang `backend/routes/companies.js`** (membuat DB perusahaan dari `base_tmu.sql`)

```js
const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');
const { getMasterDb, getDbConnection, getAdminPool } = require('../utils/db');
const { requireRole } = require('../utils/authMiddleware');
const { assertValidDbName, createDatabaseFromSql } = require('../utils/sqlTemplate');
const { patchCompanyDb } = require('../utils/schemaPatch');

const TEMPLATE_SQL = path.join(__dirname, '..', '..', 'base_tmu.sql');

router.use(requireRole('admin'), (req, res, next) => {
  if (req.headers['x-super-admin'] !== 'true') return res.status(401).json({ error: 'Unauthorized. Super admin access required.' });
  next();
});

function formatCompany(c) {
  return {
    id: c.company_id, nama_perusahaan: c.company_name, nama_db: c.database_name,
    company_key: c.company_key, tmu_version: c.tmu_version, status: c.status, trafos: [],
  };
}

router.get('/', async (req, res) => {
  try {
    const master = await getMasterDb();
    const [rows] = await master.execute('SELECT * FROM company ORDER BY company_id DESC');
    const companies = rows.map(formatCompany);
    await Promise.all(companies.map(async (c) => {
      if (!c.nama_db) return;
      try {
        const db = await getDbConnection(c.nama_db);
        const [trafos] = await db.query(
          'SELECT td.trafoId AS id, COALESCE(t.nama, td.trafoSerialNo, CONCAT("Trafo ", td.trafoId)) AS nama FROM transformer_data td LEFT JOIN trafo t ON t.id = td.trafoId ORDER BY td.trafoId');
        c.trafos = trafos;
      } catch (e) {
        console.error(`Could not fetch trafos for db ${c.nama_db}:`, e.message);
      }
    }));
    res.json({ success: true, data: companies });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

router.post('/', async (req, res) => {
  const { nama_perusahaan, nama_db, tmu_version } = req.body || {};
  if (!nama_perusahaan) return res.status(400).json({ error: 'Company Name is required' });
  if (!nama_db) return res.status(400).json({ error: 'Database name is required' });
  try {
    assertValidDbName(nama_db);
    const master = await getMasterDb();
    const [dup] = await master.execute('SELECT company_id FROM company WHERE company_name = ? OR database_name = ? LIMIT 1', [nama_perusahaan, nama_db]);
    if (dup.length > 0) return res.status(400).json({ error: 'Company name or database already used by another company' });

    await createDatabaseFromSql(nama_db, TEMPLATE_SQL);
    await patchCompanyDb(await getDbConnection(nama_db));

    const companyKey = crypto.randomBytes(16).toString('hex');
    await master.execute(
      'INSERT INTO company (company_name, database_name, company_key, status, tmu_version) VALUES (?, ?, ?, 1, ?)',
      [nama_perusahaan, nama_db, companyKey, parseInt(tmu_version, 10) === 1 ? 1 : 2]
    );
    res.json({ success: true, message: 'Company created successfully', company_key: companyKey });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ error: 'Failed to create company', details: error.message });
  }
});

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { nama_perusahaan, nama_db, tmu_version } = req.body || {};
  if (!nama_perusahaan) return res.status(400).json({ error: 'Company Name is required' });
  try {
    const master = await getMasterDb();
    const [dup] = await master.execute('SELECT company_id FROM company WHERE company_name = ? AND company_id != ? LIMIT 1', [nama_perusahaan, id]);
    if (dup.length > 0) return res.status(400).json({ error: 'Company Name already used by another company' });
    const updates = ['company_name = ?'], params = [nama_perusahaan];
    if (nama_db !== undefined) { assertValidDbName(nama_db); updates.push('database_name = ?'); params.push(nama_db); }
    if (tmu_version !== undefined) { updates.push('tmu_version = ?'); params.push(parseInt(tmu_version, 10) === 1 ? 1 : 2); }
    params.push(id);
    await master.execute(`UPDATE company SET ${updates.join(', ')} WHERE company_id = ?`, params);
    res.json({ success: true, message: 'Company updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update company', details: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const master = await getMasterDb();
    const [[company]] = await master.execute('SELECT database_name FROM company WHERE company_id = ?', [id]);
    if (company && company.database_name) {
      try {
        assertValidDbName(company.database_name);
        const adminPool = await getAdminPool();
        await adminPool.query(`DROP DATABASE IF EXISTS \`${company.database_name}\``);
      } catch (dbErr) {
        console.error(`Failed to drop database ${company.database_name}:`, dbErr.message);
      }
    }
    await master.execute('DELETE FROM user WHERE company_id = ?', [id]);
    await master.execute('DELETE FROM company WHERE company_id = ?', [id]);
    res.json({ success: true, message: 'Company, its users, and database deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete company and its data' });
  }
});

module.exports = router;
```

- [ ] **Step 9: Ubah `backend/routes/layouts.js`** (tiga perubahan kecil, bukan tulis ulang)

1. Baris 4: ganti `const { getDbConnection } = require('../utils/db');` menjadi `const { getMasterDb } = require('../utils/db');`
2. Hapus seluruh fungsi `ensureTrafoIdColumn` (baris 6–20) dan variabel `isLayoutTableChecked` di atasnya, serta kedua pemanggilan `await ensureTrafoIdColumn(masterDb);` (di `GET /` dan `POST /`). Kolom `trafo_id` sudah dibuat `schemaPatch`.
3. Di `getUserId`, ganti `'SELECT id FROM users WHERE username = ? LIMIT 1'` menjadi `'SELECT user_id AS id FROM user WHERE username = ? LIMIT 1'`.
4. Ganti setiap `await getDbConnection('tmu_master')` (6 tempat) menjadi `await getMasterDb()`.

Verifikasi: `grep -n "tmu_master\|FROM users\|ensureTrafoIdColumn\|getDbConnection" backend/routes/layouts.js` harus kosong.

- [ ] **Step 10: `npm test` lulus, lalu uji manual**

Dengan server jalan dan token dari login demo (simpan ke variabel):

```powershell
$r = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/login -ContentType "application/json" -Body '{"username":"demo","password":"demo123"}'
$h = @{ Authorization = "Bearer $($r.token)" }
Invoke-RestMethod -Uri http://localhost:5000/api/profile -Headers $h
Invoke-RestMethod -Uri http://localhost:5000/api/superuser-users -Headers $h
Invoke-RestMethod -Uri http://localhost:5000/api/layouts -Headers ($h + @{ "X-DB-Name" = "db_demo" })
```

Expected: profile `{ id: 1, username: demo, role: superuser, company_name: PT Demo }`; daftar user berisi demo; layouts `[]`.

- [ ] **Step 11: Commit**

```bash
git add backend/utils/masterModel.js backend/tests/masterModel.test.js backend/routes/users.js backend/routes/superuser_users.js backend/routes/profile.js backend/routes/admin.js backend/routes/companies.js backend/routes/layouts.js
git commit -m "feat(backend): route master memakai tabel user/company; buat DB perusahaan dari base_tmu.sql"
```

---

### Task 3: Route trafo: daftar, nameplate, status, physical, harmonics, oil-quality

**Files:**
- Modify: `backend/utils/schemaPatch.js` (tabel `trafo`), `backend/tests/schemaPatch.test.js`
- Create: `backend/utils/statusModel.js`, `backend/utils/trafoModel.js`
- Rewrite: `backend/routes/trafo.js`
- Test: `backend/tests/statusModel.test.js`

**Interfaces:**
- Consumes: `readingModel.getLatest`, `raspiWebSocket.raspiClients` (Map serialNo → ws), `sendToRaspi`.
- Produces: `statusModel.{ STATUS_LABELS, STATUS_COLUMNS, groupKey, buildStatusItems, oilFlags, pressureLevel }`; `trafoModel.{ getTransformerData, getStatusRow, getRecommendations, getOnlineMap, listTrafos }`. Task 4–6 memakai `getTransformerData`, `getStatusRow`, `oilFlags`.

- [ ] **Step 1: Tambah tabel `trafo` ke `schemaPatch.js`**

Di `patchCompanyDb`, setelah loop `TEMP_TABLES` dan sebelum index, tambahkan:

```js
  if (!(await hasTable(db, 'trafo'))) {
    await db.query(`CREATE TABLE trafo (
      id INT NOT NULL PRIMARY KEY,
      nama VARCHAR(100) NULL,
      image_url VARCHAR(255) NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('[SchemaPatch] tabel trafo dibuat');
  }
```

Tabel ini hanya menyimpan nama kustom dan foto; `id` = `transformer_data.trafoId`. Dua test di `tests/schemaPatch.test.js` perlu disesuaikan:

1. Test "patchCompanyDb menambah trafoId ke tabel temp dan index unik": responder-nya sekarang menjawab semua `SHOW TABLES` dengan 1 baris, jadi `trafo` dianggap sudah ada. Ubah responder menjadi

```js
  const db = makeFakeDb((sql) => (/SHOW TABLES/i.test(sql) && !/'trafo'/.test(sql) ? [{ t: 1 }] : []));
```

dan tambahkan assert di akhir test:

```js
  assert.ok(sqls.some((s) => /CREATE TABLE trafo/.test(s)), "tabel trafo dibuat");
```

2. Test "patchCompanyDb melewati tabel yang tidak ada": responder kosong berarti `trafo` juga tidak ada, sehingga satu `CREATE TABLE trafo` memang diharapkan. Ganti assert-nya menjadi

```js
  assert.deepEqual(alterCalls(db).filter((s) => !/CREATE TABLE trafo/.test(s)), []);
```

- [ ] **Step 2: Tulis test `backend/tests/statusModel.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const sm = require('../utils/statusModel');

test('groupKey menyatukan parameter per fase ke key rekomendasi', () => {
  assert.equal(sm.groupKey('WTITemp2'), 'WTITemp');
  assert.equal(sm.groupKey('BusTemp3'), 'BusTemp');
  assert.equal(sm.groupKey('THDCurrent1'), 'THDCurrent');
  assert.equal(sm.groupKey('THDVoltage3'), 'THDVoltage');
  assert.equal(sm.groupKey('Current2'), 'Current');
  assert.equal(sm.groupKey('Vab'), 'Vab');
  assert.equal(sm.groupKey('OilLevel'), 'OilLevel');
});

test('buildStatusItems memberi label, level, dan rekomendasi hanya untuk yang tidak normal', () => {
  const recs = [
    { parameter: 'OilTemp', recommendation: 'Periksa kipas' },
    { parameter: 'WTITemp', recommendation: 'Kurangi beban' },
    { parameter: 'Vab', recommendation: 'Cek tap' },
  ];
  const row = { OilTemp: 4, WTITemp1: 5, Vab: 3, Vbc: 2 };
  const r = sm.buildStatusItems(row, recs);
  assert.equal(r.allSafe, false);
  assert.deepEqual(r.counts, { alarm: 2, trip: 1 });
  const byParam = Object.fromEntries(r.items.map(i => [i.parameter, i]));
  assert.deepEqual(byParam.OilTemp, { parameter: 'OilTemp', code: 4, label: 'High Alarm', level: 'alarm', recommendations: ['Periksa kipas'] });
  assert.deepEqual(byParam.WTITemp1, { parameter: 'WTITemp1', code: 5, label: 'High Trip', level: 'trip', recommendations: ['Kurangi beban'] });
  assert.deepEqual(byParam.Vab, { parameter: 'Vab', code: 3, label: 'Normal', level: 'normal', recommendations: [] });
  assert.equal(byParam.Vbc.label, 'Low Alarm');
  assert.equal(r.items.length, sm.STATUS_COLUMNS.length);
});

test('buildStatusItems menganggap NULL, kode asing, dan baris kosong sebagai Normal', () => {
  const r = sm.buildStatusItems({ OilTemp: null, Vab: 7 }, []);
  assert.equal(r.allSafe, true);
  assert.ok(r.items.every(i => i.code === 3));
  assert.equal(sm.buildStatusItems(null, []).allSafe, true);
});

test('oilFlags dan pressureLevel dari kode status', () => {
  assert.deepEqual(sm.oilFlags(3), { oil_level_alarm: 1, oil_level_trip: 1 });
  assert.deepEqual(sm.oilFlags(2), { oil_level_alarm: 0, oil_level_trip: 1 });
  assert.deepEqual(sm.oilFlags(1), { oil_level_alarm: 0, oil_level_trip: 0 });
  assert.deepEqual(sm.oilFlags(undefined), { oil_level_alarm: 1, oil_level_trip: 1 });
  assert.equal(sm.pressureLevel(3), 'safe');
  assert.equal(sm.pressureLevel(2), 'alarm');
  assert.equal(sm.pressureLevel(4), 'alarm');
  assert.equal(sm.pressureLevel(1), 'trip');
  assert.equal(sm.pressureLevel(5), 'trip');
});
```

- [ ] **Step 3: `npm test`, pastikan gagal karena `statusModel` belum ada**

- [ ] **Step 4: Tulis `backend/utils/statusModel.js`**

```js
// Kode status TMU: 1 Low Trip, 2 Low Alarm, 3 Normal, 4 High Alarm, 5 High Trip.
const STATUS_LABELS = { 1: 'Low Trip', 2: 'Low Alarm', 3: 'Normal', 4: 'High Alarm', 5: 'High Trip' };

// Kolom transformer_status / trip_status selain trafoId.
const STATUS_COLUMNS = [
  'Vab', 'Vbc', 'Vca', 'Current1', 'Current2', 'Current3', 'Ineutral',
  'THDVoltage1', 'THDVoltage2', 'THDVoltage3', 'THDCurrent1', 'THDCurrent2', 'THDCurrent3',
  'PF', 'Freq', 'BusTemp1', 'BusTemp2', 'BusTemp3', 'OilTemp', 'WTITemp1', 'WTITemp2', 'WTITemp3',
  'Pressure', 'OilLevel', 'H2ppm', 'Moistureppm', 'Uab', 'Ubc', 'Uca',
];

function normalizeCode(v) {
  const n = Number(v);
  return STATUS_LABELS[n] ? n : 3;
}

function levelOf(code) {
  if (code === 3) return 'normal';
  if (code === 2 || code === 4) return 'alarm';
  return 'trip';
}

// Nama parameter per fase dipetakan ke key di parameter_failure_recommendation.
function groupKey(param) {
  return String(param).replace(/^(WTITemp|BusTemp|THDCurrent|THDVoltage|Current)[123]$/, '$1');
}

function buildStatusItems(statusRow, recs = []) {
  const row = statusRow || {};
  let alarm = 0, trip = 0;
  const items = STATUS_COLUMNS.map((parameter) => {
    const code = normalizeCode(row[parameter]);
    const level = levelOf(code);
    if (level === 'alarm') alarm++;
    if (level === 'trip') trip++;
    const key = groupKey(parameter);
    const recommendations = level === 'normal' ? [] : recs.filter(r => r.parameter === key).map(r => r.recommendation);
    return { parameter, code, label: STATUS_LABELS[code], level, recommendations };
  });
  return { allSafe: alarm === 0 && trip === 0, counts: { alarm, trip }, items };
}

// Flag oli dengan arti lama di frontend: 1 = aman, 0 = alarm/trip aktif.
function oilFlags(oilLevelCode) {
  const code = normalizeCode(oilLevelCode);
  return { oil_level_alarm: code === 3 ? 1 : 0, oil_level_trip: code === 1 ? 0 : 1 };
}

function pressureLevel(code) {
  return levelOf(normalizeCode(code)) === 'normal' ? 'safe' : levelOf(normalizeCode(code));
}

module.exports = { STATUS_LABELS, STATUS_COLUMNS, normalizeCode, levelOf, groupKey, buildStatusItems, oilFlags, pressureLevel };
```

- [ ] **Step 5: Tulis `backend/utils/trafoModel.js`**

```js
const { getMasterDb } = require('./db');
const { raspiClients } = require('./raspiWebSocket');

const ONLINE_WINDOW_SEC = 120;

async function getTransformerData(db, trafoId) {
  const [rows] = await db.execute('SELECT * FROM transformer_data WHERE trafoId = ? LIMIT 1', [trafoId]);
  return rows[0] || null;
}

async function getStatusRow(db, trafoId) {
  const [rows] = await db.execute('SELECT * FROM transformer_status WHERE trafoId = ? LIMIT 1', [trafoId]);
  return rows[0] || null;
}

async function getTripStatusRow(db, trafoId) {
  const [rows] = await db.execute('SELECT * FROM trip_status WHERE trafoId = ? LIMIT 1', [trafoId]);
  return rows[0] || null;
}

async function getRecommendations(masterDb) {
  const [rows] = await masterDb.execute('SELECT parameter, recommendation FROM parameter_failure_recommendation ORDER BY id');
  return rows;
}

// Online kalau ada koneksi WebSocket aktif, atau trafo_last_connection < 2 menit lalu.
async function getOnlineMap(masterDb, serials) {
  const result = {};
  const list = serials.filter(Boolean);
  for (const s of list) {
    const ws = raspiClients.get(s);
    result[s] = !!(ws && ws.readyState === 1);
  }
  const pending = list.filter(s => !result[s]);
  if (pending.length > 0) {
    const [rows] = await masterDb.query(
      'SELECT raspi_serial_no, TIMESTAMPDIFF(SECOND, last_connection_time, NOW()) AS age FROM trafo_last_connection WHERE raspi_serial_no IN (?)',
      [pending]
    );
    for (const r of rows) {
      if (r.age !== null && r.age >= 0 && r.age <= ONLINE_WINDOW_SEC) result[r.raspi_serial_no] = true;
    }
  }
  return result;
}

// Daftar trafo untuk TransformerSelection: { id, nama, image_url, device_serial, status, ratedPower }.
async function listTrafos(db) {
  const [rows] = await db.query(
    `SELECT td.trafoId AS id, td.raspiSerialNo, td.trafoSerialNo, td.ratedPower, td.ratedLowVoltage, td.version,
            t.nama, t.image_url, t.created_at
     FROM transformer_data td LEFT JOIN trafo t ON t.id = td.trafoId ORDER BY td.trafoId ASC`
  );
  const online = await getOnlineMap(await getMasterDb(), rows.map(r => r.raspiSerialNo));
  return rows.map(r => ({
    id: r.id,
    nama: r.nama || r.trafoSerialNo || `Trafo ${r.id}`,
    image_url: r.image_url || null,
    device_serial: r.raspiSerialNo || null,
    serial_no: r.trafoSerialNo || null,
    rated_power: r.ratedPower,
    rated_low_voltage: r.ratedLowVoltage,
    tmu_version: r.version,
    created_at: r.created_at || null,
    status: online[r.raspiSerialNo] ? 'Online' : 'Offline',
  }));
}

module.exports = { ONLINE_WINDOW_SEC, getTransformerData, getStatusRow, getTripStatusRow, getRecommendations, getOnlineMap, listTrafos };
```

- [ ] **Step 6: Tulis ulang `backend/routes/trafo.js`**

```js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDbConnection, getMasterDb } = require('../utils/db');
const { requireRole } = require('../utils/authMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinaryClient');
const { sendToRaspi } = require('../utils/raspiWebSocket');
const { logActivity } = require('../utils/activityLog');
const { getCompanyByDb } = require('../utils/masterModel');
const rm = require('../utils/readingModel');
const sm = require('../utils/statusModel');
const tm = require('../utils/trafoModel');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, 'trafo-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
  }),
});

// Kolom transformer_data yang boleh diubah dari web.
const EDITABLE_TD = [
  'trafoSerialNo', 'ratedPower', 'ratedHighVoltage', 'ratedLowVoltage', 'ratedCurrentHighVoltage', 'ratedCurrentLowVoltage',
  'frequency', 'vectorGroup', 'phase', 'tapType', 'impedance', 'noLoadLoss', 'fullLoadLoss',
  'tapPercentagePlus', 'tapPercentageMinus', 'tapNumberPlus', 'tapNumberMinus',
  'topOilHv', 'topOilLv', 'gradientHv', 'gradientLv', 'windTempHv', 'windTempLv', 'losses', 'hotspotFactor',
  'ctRatio', 'coolingMode', 'SuddenPressure', 'latitude', 'longitude', 'intervalDelay', 'krated', 'productionStatus',
];

router.use(async (req, res, next) => {
  const dbName = req.headers['x-db-name'];
  if (!dbName) return res.status(400).json({ error: 'Missing X-DB-Name header' });
  try {
    req.dbName = dbName;
    req.db = await getDbConnection(dbName);
    next();
  } catch (e) {
    res.status(500).json({ error: 'Database tidak bisa diakses: ' + e.message });
  }
});

const trafoIdParam = (req) => parseInt(req.params.id, 10);

// Harus sebelum /:id
router.get('/company-info', async (req, res) => {
  try {
    const c = await getCompanyByDb(await getMasterDb(), req.dbName);
    res.json({
      success: true,
      nama_perusahaan: c ? c.company_name : req.dbName,
      nama_db: req.dbName,
      company_key: c ? c.company_key : null,
      tmu_version: c ? c.tmu_version : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    res.json(await tm.listTrafos(req.db));
  } catch (error) {
    console.error('Error fetching all trafos:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const list = await tm.listTrafos(req.db);
    const t = list.find(x => x.id === trafoIdParam(req));
    if (!t) return res.status(404).json({ error: 'Trafo not found in db' });
    res.json(t);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/name', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    await req.db.execute('INSERT INTO trafo (id, nama) VALUES (?, ?) ON DUPLICATE KEY UPDATE nama = VALUES(nama)', [trafoIdParam(req), name]);
    res.json({ success: true, message: 'Name updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/image', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  try {
    const imageUrl = await uploadToCloudinary(req.file);
    await req.db.execute('INSERT INTO trafo (id, image_url) VALUES (?, ?) ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)', [trafoIdParam(req), imageUrl]);
    res.json({ success: true, imageUrl, message: 'Image uploaded to Cloudinary successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/image', async (req, res) => {
  try {
    await req.db.execute('UPDATE trafo SET image_url = NULL WHERE id = ?', [trafoIdParam(req)]);
    res.json({ success: true, message: 'Image reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Nameplate
router.get('/:id/data', async (req, res) => {
  try {
    const td = await tm.getTransformerData(req.db, trafoIdParam(req));
    if (!td) return res.status(404).json({ error: 'transformer_data tidak ditemukan' });
    res.json({ success: true, data: td, editable: EDITABLE_TD });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/data', requireRole('admin', 'superuser'), async (req, res) => {
  const trafoId = trafoIdParam(req);
  const body = req.body || {};
  const keys = Object.keys(body).filter(k => EDITABLE_TD.includes(k));
  if (keys.length === 0) return res.status(400).json({ error: 'Tidak ada kolom nameplate yang valid' });
  try {
    const before = await tm.getTransformerData(req.db, trafoId);
    if (!before) return res.status(404).json({ error: 'transformer_data tidak ditemukan' });
    const sets = keys.map(k => `\`${k}\` = ?`).join(', ');
    const values = keys.map(k => (body[k] === '' ? null : body[k]));
    await req.db.execute(`UPDATE transformer_data SET ${sets} WHERE trafoId = ?`, [...values, trafoId]);
    const after = await tm.getTransformerData(req.db, trafoId);
    const pushed = sendToRaspi(after.raspiSerialNo, { type: 'updateSyncTransformerDataFromServer', data: after });

    const company = await getCompanyByDb(await getMasterDb(), req.dbName);
    logActivity(await getMasterDb(), {
      userId: req.user.id, companyId: company?.company_id, username: req.user.username,
      type: 'TRANSFORMER_DATA_UPDATE', description: `Ubah nameplate trafo ${trafoId}`, module: 'transformer-data',
      trafoId, trafoSerialNo: after.trafoSerialNo,
      oldValue: Object.fromEntries(keys.map(k => [k, before[k]])), newValue: Object.fromEntries(keys.map(k => [k, after[k]])),
      ip: req.ip, userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, data: after, pushed });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Status per parameter + rekomendasi
router.get('/:id/status', async (req, res) => {
  try {
    const [row, recs] = await Promise.all([tm.getStatusRow(req.db, trafoIdParam(req)), tm.getRecommendations(await getMasterDb())]);
    const trip = await tm.getTripStatusRow(req.db, trafoIdParam(req));
    res.json({ success: true, ...sm.buildStatusItems(row, recs), tripActive: trip ? sm.STATUS_COLUMNS.filter(c => Number(trip[c]) === 1) : [] });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Panel Physical: tap, oil level, pressure, gas fault, sudden pressure
router.get('/:id/physical', async (req, res) => {
  const trafoId = trafoIdParam(req);
  try {
    const [td, status, latest] = await Promise.all([
      tm.getTransformerData(req.db, trafoId), tm.getStatusRow(req.db, trafoId), rm.getLatest(req.db, trafoId),
    ]);
    const [gas] = await req.db.execute(
      "SELECT failure_id, time_start, duration, failure_type, parameter, parameterValue FROM failure_log WHERE trafoId = ? AND (failure_type LIKE '%Gas%' OR parameter = 'GasFault') ORDER BY time_start DESC LIMIT 1", [trafoId]);
    const [sudden] = await req.db.execute(
      "SELECT failure_id, time_start, duration, failure_type, parameter, parameterValue FROM failure_log WHERE trafoId = ? AND (failure_type LIKE '%Sudden%' OR parameter = 'SuddenPressure') ORDER BY time_start DESC LIMIT 1", [trafoId]);
    const oilCode = sm.normalizeCode(status && status.OilLevel);
    const pressCode = sm.normalizeCode(status && status.Pressure);
    res.json({
      success: true,
      tap: {
        type: td ? td.tapType : null,
        position: td && td.tapType === 'OCTC' ? td.impedance : null,
        plus: td ? td.tapNumberPlus : null, minus: td ? td.tapNumberMinus : null,
      },
      oilLevel: { code: oilCode, label: sm.STATUS_LABELS[oilCode], level: sm.levelOf(oilCode), raw: latest ? latest.oilLevelRaw : null },
      pressure: { value: latest ? latest.oil_pressure : null, code: pressCode, level: sm.pressureLevel(pressCode), reference: 0.5 },
      gasFault: gas[0] || null,
      suddenPressure: { flag: td ? td.SuddenPressure : null, lastLog: sudden[0] || null },
      timestamp: latest ? latest.timestamp : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Kolom oil quality tidak ada di dump base_tmu; kembalikan available:false kalau memang tidak ada.
router.get('/:id/oil-quality', async (req, res) => {
  try {
    const [rows] = await req.db.execute('SELECT waterActivity, oilBDV, oilCondition FROM transformer_data WHERE trafoId = ?', [trafoIdParam(req)]);
    const r = rows[0] || {};
    res.json({ success: true, available: true, waterActivity: r.waterActivity ?? null, oilBDV: r.oilBDV ?? null, oilCondition: r.oilCondition ?? null });
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR') return res.json({ success: true, available: false });
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

const HARMONIC_ORDERS = ['1st', '3rd', '5th', '7th', '9th', '11th', '13th', '15th', '17th', '19th', '21th', '23th', '25th', '27th', '29th', '31th'];

router.get('/:id/harmonics', async (req, res) => {
  const table = req.query.type === 'current' ? 'temp_current_harmonic' : 'temp_voltage_harmonic';
  try {
    const cols = HARMONIC_ORDERS.map(o => `\`${o}\``).join(', ');
    const [rows] = await req.db.query(`SELECT Phase, ${cols} FROM ${table} WHERE trafoId = ? ORDER BY Phase ASC`, [trafoIdParam(req)]);
    res.json({
      success: true,
      type: req.query.type === 'current' ? 'current' : 'voltage',
      orders: HARMONIC_ORDERS,
      data: rows.map(r => ({ phase: r.Phase, orders: Object.fromEntries(HARMONIC_ORDERS.map(o => [o, rm.toNumber(r[o]) ?? 0])) })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

module.exports = router;
```

`readingModel` belum mengekspor `toNumber`. Di `backend/utils/readingModel.js`, ubah baris `mapRow, buildSelect,` di `module.exports` menjadi `mapRow, buildSelect, toNumber,`.

- [ ] **Step 7: `npm test` lulus, restart server, uji manual**

```powershell
$r = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/login -ContentType "application/json" -Body '{"username":"demo","password":"demo123"}'
$h = @{ Authorization = "Bearer $($r.token)"; "X-DB-Name" = "db_demo" }
Invoke-RestMethod -Uri http://localhost:5000/api/trafo -Headers $h
Invoke-RestMethod -Uri http://localhost:5000/api/trafo/1/status -Headers $h | ConvertTo-Json -Depth 4 | Select-Object -First 30
Invoke-RestMethod -Uri http://localhost:5000/api/trafo/1/physical -Headers $h | ConvertTo-Json -Depth 4
Invoke-RestMethod -Uri "http://localhost:5000/api/trafo/1/harmonics?type=current" -Headers $h | ConvertTo-Json -Depth 4 | Select-Object -First 20
Invoke-RestMethod -Uri http://localhost:5000/api/trafo/1/oil-quality -Headers $h
```

Expected: daftar berisi `id 1, nama TRF-DEMO-001, device_serial DEMO-RASPI-001, status Offline`; status `allSafe true` dengan 29 item; physical `tap.type OCTC`, `pressure.value ~0.4`, `gasFault` berisi log 1001; harmonics 3 fase; oil-quality `available: false`. Log startup harus ada `[SchemaPatch] tabel trafo dibuat`.

- [ ] **Step 8: Commit**

```bash
git add backend/utils/schemaPatch.js backend/tests/schemaPatch.test.js backend/utils/statusModel.js backend/tests/statusModel.test.js backend/utils/trafoModel.js backend/routes/trafo.js backend/utils/readingModel.js
git commit -m "feat(backend): route trafo dari transformer_data: status, physical, harmonics, nameplate"
```

---

### Task 4: Settings: thresholds, trip, limits, dorong ke Raspi

**Files:**
- Create: `backend/utils/limitsModel.js`
- Rewrite: `backend/routes/settings.js`
- Test: `backend/tests/limitsModel.test.js`

**Interfaces:**
- Consumes: `trafoModel.getTransformerData`, `sendToRaspi`, `logActivity`.
- Produces: `limitsModel.{ SETTINGS_COLUMNS, TRIP_COLUMNS, buildLimits, computeVoltageValues }`. Task 5 (`/thi`) dan Rencana C (alert) memakai `buildLimits`.

- [ ] **Step 1: Tulis test `backend/tests/limitsModel.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const lm = require('../utils/limitsModel');

// Sama dengan seed_demo
const S = {
  voltageLowTripTreshold: 10, voltageLowTripValue: 360, voltageLowAlarmTreshold: 5, voltageLowAlarmValue: 380,
  voltageHighTripTreshold: 10, voltageHighTripValue: 440, voltageHighAlarmTreshold: 5, voltageHighAlarmValue: 420,
  frequencyLowTripTreshold: 5, frequencyLowAlarmTreshold: 2, frequencyHighTripTreshold: 5, frequencyHighAlarmTreshold: 2,
  topOilHighAlarmTreshold: 70, topOilHighTripTreshold: 85, windTempHighAlarmTreshold: 80, windTempHighTripTreshold: 95,
  powerFactorLowAlarmTreshold: 0.85, powerFactorLowTripTreshold: 0.8, currentHighAlarmTreshold: 100, currentHighTripTreshold: 120,
  tankPressureHighTripTreshold: 0.6, tankPressureHighAlarmTreshold: 0.5, busTempHighAlarmTreshold: 70, busTempHighTripTreshold: 85,
  thdCurrentAlarmTreshold: 10, thdCurrentTripTreshold: 15, thdVoltageAlarmTreshold: 5, thdVoltageTripTreshold: 8,
  IneutralHighAlarmTreshold: 20, IneutralHighTripTreshold: 30, H2ppmHighAlarmTreshold: 50, H2ppmHighTripTreshold: 100,
  MoistureppmHighAlarmTreshold: 20, MoistureppmHighTripTreshold: 30,
};
const TD = { ratedLowVoltage: 400, ratedCurrentLowVoltage: 144, frequency: 50 };

test('buildLimits menghasilkan min/max/tripMin/tripMax per metric', () => {
  const L = lm.buildLimits(S, TD);
  assert.deepEqual(L.phaseA, { min: 380, max: 420, tripMin: 360, tripMax: 440 });
  assert.deepEqual(L.lineAB, L.phaseA);
  assert.deepEqual(L.frequency, { min: 49, max: 51, tripMin: 47.5, tripMax: 52.5 });
  assert.deepEqual(L.currentA, { min: null, max: 144, tripMin: null, tripMax: 172.8 });
  assert.deepEqual(L.currentN, { min: null, max: 28.8, tripMin: null, tripMax: 43.2 });
  assert.deepEqual(L.pfTotal, { min: 0.85, max: null, tripMin: 0.8, tripMax: null });
  assert.deepEqual(L.oil_temperature, { min: null, max: 70, tripMin: null, tripMax: 85 });
  assert.deepEqual(L.wtiB, { min: null, max: 80, tripMin: null, tripMax: 95 });
  assert.deepEqual(L.busTempC, { min: null, max: 70, tripMin: null, tripMax: 85 });
  assert.deepEqual(L.thdVA, { min: null, max: 5, tripMin: null, tripMax: 8 });
  assert.deepEqual(L.thdIC, { min: null, max: 10, tripMin: null, tripMax: 15 });
  assert.deepEqual(L.oil_pressure, { min: null, max: 0.5, tripMin: null, tripMax: 0.6 });
  assert.deepEqual(L.h2ppm, { min: null, max: 50, tripMin: null, tripMax: 100 });
  assert.deepEqual(L.moisturePpm, { min: null, max: 20, tripMin: null, tripMax: 30 });
});

test('buildLimits kosong kalau settings tidak ada, tanpa crash', () => {
  assert.deepEqual(lm.buildLimits(null, TD), {});
  const L = lm.buildLimits(S, null); // nameplate kosong: arus dan frekuensi tidak bisa dihitung
  assert.deepEqual(L.phaseA, { min: 380, max: 420, tripMin: 360, tripMax: 440 });
  assert.equal(L.currentA, undefined);
  assert.equal(L.frequency, undefined);
});

test('computeVoltageValues dari persen dan tegangan nominal', () => {
  assert.deepEqual(lm.computeVoltageValues({ voltageLowAlarmTreshold: 5, voltageLowTripTreshold: 10, voltageHighAlarmTreshold: 5, voltageHighTripTreshold: 10 }, 400),
    { voltageLowAlarmValue: 380, voltageLowTripValue: 360, voltageHighAlarmValue: 420, voltageHighTripValue: 440 });
  assert.deepEqual(lm.computeVoltageValues({}, 0), {});
});
```

- [ ] **Step 2: `npm test`, pastikan gagal karena modul belum ada**

- [ ] **Step 3: Tulis `backend/utils/limitsModel.js`**

```js
// Kolom transformer_settings yang boleh diubah dari web (4 kolom *Value dihitung server).
const SETTINGS_COLUMNS = [
  'voltageLowTripTreshold', 'voltageLowAlarmTreshold', 'voltageHighTripTreshold', 'voltageHighAlarmTreshold',
  'voltageUnbalanceHighAlarmTreshold', 'voltageUnbalanceHighTripTreshold',
  'frequencyLowTripTreshold', 'frequencyLowAlarmTreshold', 'frequencyHighTripTreshold', 'frequencyHighAlarmTreshold',
  'topOilHighAlarmTreshold', 'topOilHighTripTreshold', 'windTempHighAlarmTreshold', 'windTempHighTripTreshold',
  'powerFactorLowAlarmTreshold', 'powerFactorLowTripTreshold', 'currentHighAlarmTreshold', 'currentHighTripTreshold',
  'tankPressureHighTripTreshold', 'tankPressureHighAlarmTreshold', 'busTempHighAlarmTreshold', 'busTempHighTripTreshold',
  'thdCurrentAlarmTreshold', 'thdCurrentTripTreshold', 'thdVoltageAlarmTreshold', 'thdVoltageTripTreshold',
  'IneutralHighAlarmTreshold', 'IneutralHighTripTreshold', 'H2ppmHighAlarmTreshold', 'H2ppmHighTripTreshold',
  'MoistureppmHighAlarmTreshold', 'MoistureppmHighTripTreshold',
];

const TRIP_COLUMNS = [
  'voltage', 'voltageUnbalance', 'frequency', 'topOilTemp', 'busTemp', 'powerFactor', 'current', 'pressure',
  'oilLevel', 'WTITemp', 'THDCurrent', 'THDVoltage', 'Ineutral', 'H2ppm', 'Moistureppm',
];

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const r2 = (v) => (v === null ? null : Math.round(v * 100) / 100);
const lim = (min, max, tripMin, tripMax) => ({ min: r2(min), max: r2(max), tripMin: r2(tripMin), tripMax: r2(tripMax) });

// { metricKey: { min, max, tripMin, tripMax } } untuk gauge, chart, THI, dan alert.
function buildLimits(settings, td) {
  if (!settings) return {};
  const s = settings, t = td || {};
  const L = {};

  const v = lim(num(s.voltageLowAlarmValue), num(s.voltageHighAlarmValue), num(s.voltageLowTripValue), num(s.voltageHighTripValue));
  for (const k of ['phaseA', 'phaseB', 'phaseC', 'lineAB', 'lineBC', 'lineCA']) L[k] = v;

  const fn = num(t.frequency);
  if (fn) {
    L.frequency = lim(
      fn * (1 - (num(s.frequencyLowAlarmTreshold) || 0) / 100), fn * (1 + (num(s.frequencyHighAlarmTreshold) || 0) / 100),
      fn * (1 - (num(s.frequencyLowTripTreshold) || 0) / 100), fn * (1 + (num(s.frequencyHighTripTreshold) || 0) / 100));
  }

  const ir = num(t.ratedCurrentLowVoltage);
  if (ir) {
    const c = lim(null, ir * (num(s.currentHighAlarmTreshold) || 0) / 100, null, ir * (num(s.currentHighTripTreshold) || 0) / 100);
    for (const k of ['currentA', 'currentB', 'currentC']) L[k] = c;
    L.currentN = lim(null, ir * (num(s.IneutralHighAlarmTreshold) || 0) / 100, null, ir * (num(s.IneutralHighTripTreshold) || 0) / 100);
  }

  const pf = lim(num(s.powerFactorLowAlarmTreshold), null, num(s.powerFactorLowTripTreshold), null);
  for (const k of ['pfTotal', 'pfA', 'pfB', 'pfC']) L[k] = pf;

  L.oil_temperature = lim(null, num(s.topOilHighAlarmTreshold), null, num(s.topOilHighTripTreshold));
  const wti = lim(null, num(s.windTempHighAlarmTreshold), null, num(s.windTempHighTripTreshold));
  for (const k of ['wtiA', 'wtiB', 'wtiC']) L[k] = wti;
  const bus = lim(null, num(s.busTempHighAlarmTreshold), null, num(s.busTempHighTripTreshold));
  for (const k of ['busTempA', 'busTempB', 'busTempC']) L[k] = bus;
  const thdV = lim(null, num(s.thdVoltageAlarmTreshold), null, num(s.thdVoltageTripTreshold));
  for (const k of ['thdVA', 'thdVB', 'thdVC']) L[k] = thdV;
  const thdI = lim(null, num(s.thdCurrentAlarmTreshold), null, num(s.thdCurrentTripTreshold));
  for (const k of ['thdIA', 'thdIB', 'thdIC']) L[k] = thdI;
  L.oil_pressure = lim(null, num(s.tankPressureHighAlarmTreshold), null, num(s.tankPressureHighTripTreshold));
  L.h2ppm = lim(null, num(s.H2ppmHighAlarmTreshold), null, num(s.H2ppmHighTripTreshold));
  L.moisturePpm = lim(null, num(s.MoistureppmHighAlarmTreshold), null, num(s.MoistureppmHighTripTreshold));
  const unb = lim(null, num(s.voltageUnbalanceHighAlarmTreshold), null, num(s.voltageUnbalanceHighTripTreshold));
  for (const k of ['unbalanceUV', 'unbalanceVW', 'unbalanceUW']) L[k] = unb;
  return L;
}

// Nilai tegangan absolut dari persen: Value = rated ± Treshold/100 * rated.
function computeVoltageValues(s, ratedLowVoltage) {
  const rated = num(ratedLowVoltage);
  if (!rated) return {};
  const out = {};
  const pairs = [
    ['voltageLowAlarmTreshold', 'voltageLowAlarmValue', -1], ['voltageLowTripTreshold', 'voltageLowTripValue', -1],
    ['voltageHighAlarmTreshold', 'voltageHighAlarmValue', 1], ['voltageHighTripTreshold', 'voltageHighTripValue', 1],
  ];
  for (const [pct, val, sign] of pairs) {
    const p = num(s && s[pct]);
    if (p !== null) out[val] = r2(rated + sign * (p / 100) * rated);
  }
  return out;
}

module.exports = { SETTINGS_COLUMNS, TRIP_COLUMNS, buildLimits, computeVoltageValues };
```

- [ ] **Step 4: Tulis ulang `backend/routes/settings.js`**

```js
const express = require('express');
const router = express.Router();
const { getDbConnection, getMasterDb } = require('../utils/db');
const { requireRole } = require('../utils/authMiddleware');
const { sendToRaspi } = require('../utils/raspiWebSocket');
const { logActivity } = require('../utils/activityLog');
const { getCompanyByDb } = require('../utils/masterModel');
const { getTransformerData } = require('../utils/trafoModel');
const { SETTINGS_COLUMNS, TRIP_COLUMNS, buildLimits, computeVoltageValues } = require('../utils/limitsModel');

router.use(async (req, res, next) => {
  const dbName = req.headers['x-db-name'];
  if (!dbName) return res.status(400).json({ error: 'Missing X-DB-Name header' });
  try {
    req.dbName = dbName;
    req.db = await getDbConnection(dbName);
    next();
  } catch (e) {
    res.status(500).json({ error: 'Database tidak bisa diakses: ' + e.message });
  }
});

const trafoIdOf = (req) => parseInt(req.query.trafo_id || req.params.trafoId || req.headers['x-trafo-id'] || 1, 10) || 1;

async function getSettings(db, trafoId) {
  const [rows] = await db.execute('SELECT * FROM transformer_settings WHERE trafoId = ? LIMIT 1', [trafoId]);
  return rows[0] || null;
}
async function getTrip(db, trafoId) {
  const [rows] = await db.execute('SELECT * FROM trip_settings WHERE trafoId = ? LIMIT 1', [trafoId]);
  return rows[0] || null;
}

async function writeLog(req, trafoId, type, description, oldValue, newValue) {
  const master = await getMasterDb();
  const company = await getCompanyByDb(master, req.dbName);
  logActivity(master, {
    userId: req.user.id, companyId: company?.company_id, username: req.user.username,
    type, description, module: 'settings', trafoId, oldValue, newValue, ip: req.ip, userAgent: req.headers['user-agent'],
  });
}

router.get('/thresholds', async (req, res) => {
  try {
    const trafoId = trafoIdOf(req);
    const [settings, trip] = await Promise.all([getSettings(req.db, trafoId), getTrip(req.db, trafoId)]);
    res.json({ success: true, trafoId, settings, trip, editable: SETTINGS_COLUMNS, tripColumns: TRIP_COLUMNS });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings', details: error.message });
  }
});

router.get('/limits', async (req, res) => {
  try {
    const trafoId = trafoIdOf(req);
    const [settings, td] = await Promise.all([getSettings(req.db, trafoId), getTransformerData(req.db, trafoId)]);
    res.json({ success: true, trafoId, limits: buildLimits(settings, td) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to build limits', details: error.message });
  }
});

router.put('/thresholds/:trafoId', requireRole('admin', 'superuser'), async (req, res) => {
  const trafoId = trafoIdOf(req);
  const body = req.body || {};
  const keys = Object.keys(body).filter(k => SETTINGS_COLUMNS.includes(k));
  if (keys.length === 0) return res.status(400).json({ error: 'Tidak ada kolom threshold yang valid' });
  try {
    const before = await getSettings(req.db, trafoId);
    if (!before) return res.status(404).json({ error: 'transformer_settings tidak ditemukan untuk trafo ini' });
    const td = await getTransformerData(req.db, trafoId);

    const merged = { ...before };
    for (const k of keys) merged[k] = body[k] === '' || body[k] === null ? null : Number(body[k]);
    const voltageValues = computeVoltageValues(merged, td && td.ratedLowVoltage);
    const updates = { ...Object.fromEntries(keys.map(k => [k, merged[k]])), ...voltageValues };

    const cols = Object.keys(updates);
    await req.db.execute(
      `UPDATE transformer_settings SET ${cols.map(c => `\`${c}\` = ?`).join(', ')} WHERE trafoId = ?`,
      [...cols.map(c => updates[c]), trafoId]
    );
    const after = await getSettings(req.db, trafoId);
    const pushed = sendToRaspi(td && td.raspiSerialNo, { type: 'updateSyncTransformerSettingsFromServer', data: after });
    await writeLog(req, trafoId, 'THRESHOLD_UPDATE', `Ubah threshold trafo ${trafoId}`,
      Object.fromEntries(cols.map(c => [c, before[c]])), Object.fromEntries(cols.map(c => [c, after[c]])));
    res.json({ success: true, settings: after, pushed, message: pushed ? 'Setting updated and pushed to Raspi' : 'Setting updated (Raspi offline, akan sinkron saat terhubung)' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update setting', details: error.message });
  }
});

router.put('/trip/:trafoId', requireRole('admin', 'superuser'), async (req, res) => {
  const trafoId = trafoIdOf(req);
  const body = req.body || {};
  const keys = Object.keys(body).filter(k => TRIP_COLUMNS.includes(k));
  if (keys.length === 0) return res.status(400).json({ error: 'Tidak ada kolom trip yang valid' });
  try {
    const before = await getTrip(req.db, trafoId);
    if (!before) return res.status(404).json({ error: 'trip_settings tidak ditemukan untuk trafo ini' });
    await req.db.execute(
      `UPDATE trip_settings SET ${keys.map(k => `\`${k}\` = ?`).join(', ')} WHERE trafoId = ?`,
      [...keys.map(k => (body[k] ? 1 : 0)), trafoId]
    );
    const after = await getTrip(req.db, trafoId);
    const td = await getTransformerData(req.db, trafoId);
    const pushed = sendToRaspi(td && td.raspiSerialNo, { type: 'updateSyncTripSettingsFromServer', data: after });
    await writeLog(req, trafoId, 'TRIP_SETTING_UPDATE', `Ubah trip enable trafo ${trafoId}`,
      Object.fromEntries(keys.map(k => [k, before[k]])), Object.fromEntries(keys.map(k => [k, after[k]])));
    res.json({ success: true, trip: after, pushed });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update trip settings', details: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 5: `npm test` lulus, restart server, uji manual**

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/settings/limits?trafo_id=1" -Headers $h | ConvertTo-Json -Depth 3 | Select-Object -First 20
Invoke-RestMethod -Method Put -Uri http://localhost:5000/api/settings/thresholds/1 -Headers $h -ContentType "application/json" -Body '{"voltageLowAlarmTreshold": 6}' | ConvertTo-Json -Depth 3 | Select-Object -First 12
Invoke-RestMethod -Method Put -Uri http://localhost:5000/api/settings/thresholds/1 -Headers $h -ContentType "application/json" -Body '{"voltageLowAlarmTreshold": 5}' | Out-Null
```

Expected: limits `phaseA {min 380, max 420, tripMin 360, tripMax 440}`; PUT pertama mengembalikan `settings.voltageLowAlarmValue = 376` dan `pushed: false` (Raspi belum ada); PUT kedua mengembalikan ke 380. `user_activity_log` punya baris `THRESHOLD_UPDATE`.

- [ ] **Step 6: Commit**

```bash
git add backend/utils/limitsModel.js backend/tests/limitsModel.test.js backend/routes/settings.js
git commit -m "feat(backend): settings dari transformer_settings/trip_settings, limits untuk gauge, dorong ke Raspi"
```

---

### Task 5: Trends, analytics, export, report, THI, events, news

**Files:**
- Rewrite: `backend/routes/trends.js`, `backend/routes/analytics.js`
- Create: `backend/utils/trendsHelpers.js`
- Test: `backend/tests/trendsHelpers.test.js`

**Interfaces:**
- Consumes: `readingModel` semua fungsi, `trafoModel.getTransformerData/getStatusRow`, `statusModel.buildStatusItems/oilFlags`, `limitsModel.buildLimits`.
- Produces: respons `/api/trends*` dalam key frontend; `/api/trends/report` dengan nama field lama plus baris baru; `trendsHelpers.{ checkClosestData, oilPoint, evaluateMetric, healthScore, failureToEvent }`.

- [ ] **Step 1: Tulis test `backend/tests/trendsHelpers.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('./helpers/fakeDb');
const th = require('../utils/trendsHelpers');

test('checkClosestData menyebut data sebelum dan sesudah rentang', async () => {
  const db = makeFakeDb((sql) => (/timestamp < \?/.test(sql) ? [{ timestamp: '2026-10-01T00:00:00Z' }] : []));
  const msg = await th.checkClosestData(db, 1, '2026-10-05', '2026-10-06');
  assert.match(msg, /Tidak ada data pada rentang waktu tersebut/);
  assert.match(msg, /sebelumnya/);
  assert.doesNotMatch(msg, /sesudahnya/);
  assert.match(db.calls[0].sql, /FROM reading_data WHERE trafoId = \? AND timestamp < \?/);
});

test('oilPoint memetakan point ke bentuk oil_sensor lama', () => {
  const p = th.oilPoint({ timestamp: 't', time: '08.00.00', oil_temperature: 55, oil_pressure: 0.4, oilLevelRaw: 1 }, 2);
  assert.deepEqual(p, { timestamp: 't', time: '08.00.00', oil_temperature: 55, oil_pressure: 0.4, oil_level: true, oil_level_alarm: 0, oil_level_trip: 1 });
});

test('evaluateMetric memberi skor dari limits', () => {
  const L = { min: 380, max: 420, tripMin: 360, tripMax: 440 };
  assert.equal(th.evaluateMetric('phaseA', 400, L).status, 'OPTIMAL');
  assert.equal(th.evaluateMetric('phaseA', 425, L).status, 'WARNING');
  assert.equal(th.evaluateMetric('phaseA', 445, L).status, 'CRITICAL');
  assert.equal(th.evaluateMetric('phaseA', 370, L).status, 'WARNING');
  assert.equal(th.evaluateMetric('phaseA', null, L).status, 'NO DATA');
  assert.equal(th.evaluateMetric('phaseA', 400, undefined).thresholdLabel, 'Tidak ada batas');
});

test('healthScore = 100 - 10 alarm - 25 trip, minimum 0', () => {
  assert.equal(th.healthScore({ alarm: 0, trip: 0 }), 100);
  assert.equal(th.healthScore({ alarm: 2, trip: 1 }), 55);
  assert.equal(th.healthScore({ alarm: 10, trip: 4 }), 0);
});

test('failureToEvent memetakan failure_log ke event panel', () => {
  const e = th.failureToEvent({ rowId: 5, time_start: '2026-10-10T01:00:00Z', duration: 30, failure_type: 'High Alarm', parameter: 'OilTemp', parameterValue: '72.5' });
  assert.equal(e.id, 'fl-5');
  assert.equal(e.level, 'ALARM');
  assert.equal(e.source, 'OilTemp');
  assert.match(e.msg, /High Alarm.*72\.5/);
  assert.equal(th.failureToEvent({ rowId: 6, failure_type: 'High Trip', parameter: 'Vab' }).level, 'CRITICAL');
});
```

- [ ] **Step 2: `npm test`, pastikan gagal karena modul belum ada**

- [ ] **Step 3: Tulis `backend/utils/trendsHelpers.js`**

```js
const { oilFlags } = require('./statusModel');

async function checkClosestData(db, trafoId, start, end) {
  const [before] = await db.execute('SELECT timestamp FROM reading_data WHERE trafoId = ? AND timestamp < ? ORDER BY timestamp DESC LIMIT 1', [trafoId, start]);
  const [after] = await db.execute('SELECT timestamp FROM reading_data WHERE trafoId = ? AND timestamp > ? ORDER BY timestamp ASC LIMIT 1', [trafoId, end]);
  let msg = 'Tidak ada data pada rentang waktu tersebut.';
  if (before.length > 0 || after.length > 0) {
    msg += ' Data terdekat ada pada: ';
    if (before.length > 0) msg += `sebelumnya (${new Date(before[0].timestamp).toLocaleString('id-ID')})`;
    if (after.length > 0) msg += `${before.length > 0 ? ' dan ' : ''}sesudahnya (${new Date(after[0].timestamp).toLocaleString('id-ID')})`;
  }
  return msg;
}

// Bentuk yang dibaca TemperatureDataContext dan export sheet Oil.
function oilPoint(point, oilLevelCode) {
  return {
    timestamp: point.timestamp,
    time: point.time,
    oil_temperature: point.oil_temperature,
    oil_pressure: point.oil_pressure,
    oil_level: point.oilLevelRaw === 1,
    ...oilFlags(oilLevelCode),
  };
}

const COLORS = { OPTIMAL: '#10b981', NORMAL: '#10b981', WARNING: '#f59e0b', CRITICAL: '#ef4444', 'NO DATA': '#94a3b8' };

function evaluateMetric(key, val, L) {
  const base = { key, val, tMin: L ? L.min : null, tMax: L ? L.max : null };
  if (val === null || val === undefined || Number.isNaN(Number(val))) {
    return { ...base, displayVal: '-', score: 50, status: 'NO DATA', color: COLORS['NO DATA'], thresholdLabel: 'Tidak ada data' };
  }
  const displayVal = Number(val).toFixed(['pfTotal', 'frequency', 'oil_pressure'].includes(key) ? 2 : 1);
  if (!L || (L.min === null && L.max === null)) {
    return { ...base, displayVal, score: 100, status: 'OPTIMAL', color: COLORS.OPTIMAL, thresholdLabel: 'Tidak ada batas' };
  }
  const parts = [];
  if (L.min !== null) parts.push(`Min ${L.min}`);
  if (L.max !== null) parts.push(`Max ${L.max}`);
  const thresholdLabel = parts.join(' / ');
  let status = 'OPTIMAL', score = 100;
  const beyondTrip = (L.tripMin !== null && val < L.tripMin) || (L.tripMax !== null && val > L.tripMax);
  const beyondAlarm = (L.min !== null && val < L.min) || (L.max !== null && val > L.max);
  if (beyondTrip) { status = 'CRITICAL'; score = 35; }
  else if (beyondAlarm) { status = 'WARNING'; score = 65; }
  return { ...base, displayVal, score, status, color: COLORS[status], thresholdLabel };
}

function healthScore(counts) {
  return Math.max(0, 100 - 10 * (counts.alarm || 0) - 25 * (counts.trip || 0));
}

function failureToEvent(row) {
  const ts = row.time_start ? new Date(row.time_start) : new Date();
  const type = String(row.failure_type || '');
  const level = /trip/i.test(type) ? 'CRITICAL' : /alarm/i.test(type) ? 'ALARM' : 'WARN';
  return {
    id: `fl-${row.rowId}`,
    timestamp: ts.toISOString(),
    time: ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }),
    level,
    source: row.parameter || 'Raspi',
    msg: `${type || 'Failure'} pada ${row.parameter || '-'}: nilai ${row.parameterValue ?? '-'}${row.duration ? ` (durasi ${row.duration}s)` : ''}`,
  };
}

module.exports = { checkClosestData, oilPoint, evaluateMetric, healthScore, failureToEvent };
```

- [ ] **Step 4: Tulis ulang `backend/routes/trends.js`**

```js
const express = require('express');
const router = express.Router();
const { getDbConnection, getMasterDb } = require('../utils/db');
const rm = require('../utils/readingModel');
const sm = require('../utils/statusModel');
const tm = require('../utils/trafoModel');
const { buildLimits } = require('../utils/limitsModel');
const th = require('../utils/trendsHelpers');

router.use(async (req, res, next) => {
  const dbName = req.headers['x-db-name'] || req.query.db_name || req.user?.dbName;
  if (!dbName) return res.status(400).json({ error: 'Missing X-DB-Name header' });
  try {
    req.dbName = dbName;
    req.db = await getDbConnection(dbName);
    req.trafoId = parseInt(req.query.trafo_id || req.headers['x-trafo-id'] || 1, 10) || 1;
    next();
  } catch (e) {
    res.status(500).json({ error: 'Database tidak bisa diakses: ' + e.message });
  }
});

async function withDerived(req, points) {
  const td = await tm.getTransformerData(req.db, req.trafoId);
  return points.map(p => rm.computeDerived(p, td));
}

async function getSettings(db, trafoId) {
  const [rows] = await db.execute('SELECT * FROM transformer_settings WHERE trafoId = ? LIMIT 1', [trafoId]);
  return rows[0] || null;
}

// Historis dengan rentang (dipakai TrendDataContext.fetchRangeData)
router.get('/', async (req, res) => {
  const { start, end, interval } = req.query;
  try {
    let points;
    if (start && end) {
      points = await rm.getHistory(req.db, req.trafoId, start, end, interval || 0);
      if (points.length === 0) return res.status(404).json({ error: await th.checkClosestData(req.db, req.trafoId, start, end) });
    } else {
      points = await rm.getRealtimeSeries(req.db, req.trafoId, 60);
    }
    res.json(await withDerived(req, points));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 60 baris realtime terakhir (dipakai TrendDataContext.fetchLiveInitial)
router.get('/meter', async (req, res) => {
  const { start, end } = req.query;
  try {
    const points = start && end
      ? await rm.getHistory(req.db, req.trafoId, start, end, 0)
      : await rm.getRealtimeSeries(req.db, req.trafoId, 60);
    res.json(await withDerived(req, points));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/oil', async (req, res) => {
  const { start, end } = req.query;
  try {
    const [points, status] = await Promise.all([
      start && end ? rm.getHistory(req.db, req.trafoId, start, end, 0, ['oil_temperature', 'oil_pressure', 'oilLevelRaw'])
                   : rm.getRealtimeSeries(req.db, req.trafoId, 60),
      tm.getStatusRow(req.db, req.trafoId),
    ]);
    const code = status ? status.OilLevel : 3;
    res.json(points.map(p => th.oilPoint(p, code)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export-count', async (req, res) => {
  const { start, end, interval } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'Missing start or end parameter' });
  try {
    const [[{ total }]] = await req.db.execute('SELECT COUNT(*) AS total FROM reading_data WHERE trafoId = ? AND timestamp >= ? AND timestamp <= ?', [req.trafoId, start, end]);
    const intv = parseInt(interval, 10) || 0;
    res.json({ total: intv > 60 ? Math.floor(total / (intv / 60)) : total });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

const EXPORT_ELECTRICAL = [
  ['phaseA', 'Phase A (V)'], ['phaseB', 'Phase B (V)'], ['phaseC', 'Phase C (V)'],
  ['lineAB', 'Line AB (V)'], ['lineBC', 'Line BC (V)'], ['lineCA', 'Line CA (V)'],
  ['currentA', 'Current A (A)'], ['currentB', 'Current B (A)'], ['currentC', 'Current C (A)'], ['currentN', 'Current N (A)'],
  ['powerActiveTotal', 'Power Active Total (kW)'], ['powerReactiveTotal', 'Power Reactive Total (kVAR)'], ['powerApparentTotal', 'Power Apparent Total (kVA)'],
  ['pfTotal', 'PF Total'], ['frequency', 'Frequency (Hz)'],
  ['energyActiveTotal', 'Energy Active (kWh)'], ['energyReactiveTotal', 'Energy Reactive (kVARh)'],
  ['thdVA', 'THD V A (%)'], ['thdVB', 'THD V B (%)'], ['thdVC', 'THD V C (%)'],
  ['thdIA', 'THD I A (%)'], ['thdIB', 'THD I B (%)'], ['thdIC', 'THD I C (%)'],
  ['efficiency', 'Efficiency (%)'],
];
const EXPORT_OIL = [
  ['oil_temperature', 'Oil Temperature (°C)'], ['oil_pressure', 'Oil Pressure (Bar)'],
  ['wtiA', 'WTI A (°C)'], ['wtiB', 'WTI B (°C)'], ['wtiC', 'WTI C (°C)'],
  ['busTempA', 'Bus Temp A (°C)'], ['busTempB', 'Bus Temp B (°C)'], ['busTempC', 'Bus Temp C (°C)'],
  ['h2ppm', 'H2 (ppm)'], ['moisturePpm', 'Moisture (ppm)'],
];

router.get('/export', async (req, res) => {
  const { start, end, interval } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'Missing start or end parameter' });
  try {
    const ExcelJS = require('exceljs');
    const points = await rm.getHistory(req.db, req.trafoId, start, end, parseInt(interval, 10) || 0);
    if (points.length === 0) return res.status(404).json({ error: await th.checkClosestData(req.db, req.trafoId, start, end) });
    const rows = await withDerived(req, points);
    const status = await tm.getStatusRow(req.db, req.trafoId);
    const flags = sm.oilFlags(status && status.OilLevel);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Export_${start}_to_${end}.xlsx`);
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true, useSharedStrings: false });
    const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
    const styleHeader = (sheet, argb) => {
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
      sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    };

    const sheet = workbook.addWorksheet('Trend Data');
    sheet.columns = [{ header: 'Waktu (Time)', key: 'time', width: 25 }, ...EXPORT_ELECTRICAL.map(([key, header]) => ({ header, key, width: 18 }))];
    styleHeader(sheet, 'FF0052CC');
    for (const p of rows) {
      const row = { time: new Date(p.timestamp).toLocaleString('id-ID') };
      for (const [key] of EXPORT_ELECTRICAL) row[key] = r2(p[key]);
      sheet.addRow(row).commit();
    }
    sheet.commit();

    const oilSheet = workbook.addWorksheet('Oil Data');
    oilSheet.columns = [{ header: 'Waktu (Time)', key: 'time', width: 25 }, ...EXPORT_OIL.map(([key, header]) => ({ header, key, width: 20 })),
      { header: 'Oil Level Alarm', key: 'oilAlarm', width: 18 }, { header: 'Oil Level Trip', key: 'oilTrip', width: 18 }];
    styleHeader(oilSheet, 'FFFF6600');
    for (const p of rows) {
      const row = { time: new Date(p.timestamp).toLocaleString('id-ID'), oilAlarm: flags.oil_level_alarm ? 'Safe' : 'Alarm', oilTrip: flags.oil_level_trip ? 'Safe' : 'Trip' };
      for (const [key] of EXPORT_OIL) row[key] = r2(p[key]);
      oilSheet.addRow(row).commit();
    }
    oilSheet.commit();
    await workbook.commit();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: 'Gagal mengekspor data' });
  }
});

// Nama field lama dipertahankan untuk PerformanceReport; baris baru ditambahkan.
const REPORT_FIELDS = [
  ['phaseA', 'phase_a'], ['phaseB', 'phase_b'], ['phaseC', 'phase_c'],
  ['lineAB', 'line_ab'], ['lineBC', 'line_bc'], ['lineCA', 'line_ca'],
  ['currentA', 'current_a'], ['currentB', 'current_b'], ['currentC', 'current_c'], ['currentN', 'current_n'],
  ['powerActiveTotal', 'power_active'], ['powerReactiveTotal', 'power_reactive'], ['powerApparentTotal', 'power_apparent'],
  ['pfTotal', 'pf'], ['frequency', 'frequency'], ['energyActiveTotal', 'energy_active'], ['energyReactiveTotal', 'energy_reactive'],
  ['thdVA', 'thd_v_a'], ['thdVB', 'thd_v_b'], ['thdVC', 'thd_v_c'], ['thdIA', 'thd_i_a'], ['thdIB', 'thd_i_b'], ['thdIC', 'thd_i_c'],
  ['h2ppm', 'h2ppm'], ['moisturePpm', 'moisture_ppm'], ['avgCurrent', 'avg_current'],
];
const REPORT_OIL_FIELDS = [
  ['oil_temperature', 'oil_temp'], ['oil_pressure', 'oil_press'],
  ['wtiA', 'wti_a'], ['wtiB', 'wti_b'], ['wtiC', 'wti_c'], ['busTempA', 'bus_temp_a'], ['busTempB', 'bus_temp_b'], ['busTempC', 'bus_temp_c'],
];

router.get('/report', async (req, res) => {
  const { start, end } = req.query;
  try {
    const all = [...REPORT_FIELDS, ...REPORT_OIL_FIELDS];
    const select = all.map(([key]) => {
      const col = rm.KEY_TO_COLUMN[key];
      const div = rm.WATT_COLUMNS.has(col) ? '/1000' : '';
      return `MIN(\`${col}\`)${div} AS min_${key}, MAX(\`${col}\`)${div} AS max_${key}, AVG(\`${col}\`)${div} AS avg_${key}`;
    }).join(', ');
    const where = start && end ? 'AND timestamp >= ? AND timestamp <= ?' : '';
    const params = start && end ? [req.trafoId, start, end] : [req.trafoId];
    const [[agg]] = await req.db.query(`SELECT ${select} FROM reading_data WHERE trafoId = ? ${where}`, params);

    const pick = (fields) => {
      const out = {};
      for (const [key, name] of fields) {
        for (const k of ['min', 'max', 'avg']) {
          const v = agg[`${k}_${key}`];
          out[`${k}_${name}`] = v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100;
        }
      }
      return out;
    };
    const electrical = pick(REPORT_FIELDS);
    const oil = pick(REPORT_OIL_FIELDS);

    const td = await tm.getTransformerData(req.db, req.trafoId);
    electrical.avg_efficiency = rm.computeEfficiency({ avgCurrent: agg.avg_avgCurrent }, td);

    const [[fl]] = await req.db.query(
      `SELECT SUM(CASE WHEN failure_type LIKE '%Alarm%' THEN 1 ELSE 0 END) AS alarm_triggers,
              SUM(CASE WHEN failure_type LIKE '%Trip%' THEN 1 ELSE 0 END) AS trip_triggers
       FROM failure_log WHERE trafoId = ? ${start && end ? 'AND time_start >= ? AND time_start <= ?' : ''}`, params);
    oil.alarm_triggers = Number(fl.alarm_triggers || 0);
    oil.trip_triggers = Number(fl.trip_triggers || 0);

    res.json({ electrical, oil, trafoId: req.trafoId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error generating report' });
  }
});

router.get('/thi', async (req, res) => {
  try {
    const [latest, td, settings, status] = await Promise.all([
      rm.getLatest(req.db, req.trafoId), tm.getTransformerData(req.db, req.trafoId), getSettings(req.db, req.trafoId), tm.getStatusRow(req.db, req.trafoId),
    ]);
    const limits = buildLimits(settings, td);
    const point = latest ? rm.computeDerived(latest, td) : {};
    const keys = req.query.metrics ? String(req.query.metrics).split(',').map(s => s.trim()).filter(Boolean)
      : ['phaseA', 'phaseB', 'phaseC', 'currentA', 'currentB', 'currentC', 'pfTotal', 'frequency'];
    const evaluatedMetrics = keys.map(k => th.evaluateMetric(k, point[k] ?? null, limits[k]));
    const summary = sm.buildStatusItems(status, []);
    const overallScore = th.healthScore(summary.counts);
    const overallStatus = overallScore >= 90 ? 'EXCELLENT' : overallScore >= 75 ? 'GOOD' : overallScore >= 50 ? 'FAIR / WARNING' : 'CRITICAL';
    const overallColor = overallScore >= 90 ? '#10b981' : overallScore >= 75 ? '#3b82f6' : overallScore >= 50 ? '#f59e0b' : '#ef4444';
    res.json({ success: true, overallScore, overallStatus, overallColor, counts: summary.counts, evaluatedMetrics, limits, timestamp: latest ? latest.timestamp : new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute THI', details: error.message });
  }
});

router.get('/events', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const [logs] = await req.db.query('SELECT rowId, failure_id, time_start, duration, failure_type, parameter, parameterValue FROM failure_log WHERE trafoId = ? ORDER BY time_start DESC LIMIT ?', [req.trafoId, limit]);
    const events = logs.map(th.failureToEvent);

    const status = await tm.getStatusRow(req.db, req.trafoId);
    const now = new Date();
    for (const item of sm.buildStatusItems(status, []).items) {
      if (item.level === 'normal') continue;
      events.push({ id: `st-${item.parameter}`, timestamp: now.toISOString(), time: now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }),
        level: item.level === 'trip' ? 'CRITICAL' : 'ALARM', source: item.parameter, msg: `${item.parameter} sedang ${item.label}` });
    }
    if (events.length === 0) {
      const latest = await rm.getLatest(req.db, req.trafoId);
      events.push({ id: 'ok-latest', timestamp: latest ? latest.timestamp : now.toISOString(), time: latest ? latest.time : now.toLocaleTimeString('id-ID'),
        level: 'OK', source: 'TMU', msg: latest ? `Semua parameter normal (Vab ${latest.lineAB} V, ${latest.frequency} Hz)` : 'Belum ada data dari Raspi' });
    }
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ success: true, total: events.length, events: events.slice(0, limit), source: 'database', db: req.dbName });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event stream', details: error.message });
  }
});

router.get('/news', async (req, res) => {
  try {
    const td = await tm.getTransformerData(req.db, req.trafoId);
    const latest = await rm.getLatest(req.db, req.trafoId);
    const [[agg]] = await req.db.execute(
      'SELECT COUNT(*) AS n, AVG(`OilTemp`) AS avg_temp, MAX(`OilTemp`) AS max_temp, AVG(`PFsig`) AS avg_pf, MAX(timestamp) AS latest_ts FROM reading_data WHERE trafoId = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)', [req.trafoId]);
    const status = sm.buildStatusItems(await tm.getStatusRow(req.db, req.trafoId), []);
    const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : 'Live');
    const bulletins = [
      { id: 'news-asset', tag: 'Asset', color: 'text-blue-500',
        title: `Trafo ${td ? td.trafoSerialNo : req.trafoId} (${td ? td.ratedPower : '-'} kVA) di ${req.dbName}`,
        summary: `Raspi ${td ? td.raspiSerialNo : '-'}, ${td ? td.ratedHighVoltage : '-'}/${td ? td.ratedLowVoltage : '-'} kV, vector group ${td ? td.vectorGroup : '-'}.`,
        date: 'Nameplate', timestamp: new Date().toISOString() },
    ];
    if (latest) {
      bulletins.push({ id: 'news-energy', tag: 'Telemetry', color: 'text-emerald-500',
        title: `Energi kumulatif ${(latest.energyActiveTotal / 1000).toFixed(2)} MWh`,
        summary: `${Number(agg.n || 0).toLocaleString('id-ID')} titik data 24 jam terakhir. PF rata-rata ${Number(agg.avg_pf || 0).toFixed(2)}.`,
        date: fmtTime(agg.latest_ts), timestamp: agg.latest_ts || latest.timestamp });
    }
    if (agg.avg_temp) {
      bulletins.push({ id: 'news-thermal', tag: 'Diagnostics', color: 'text-amber-500',
        title: `Suhu oli rata-rata ${Number(agg.avg_temp).toFixed(1)}°C (maks ${Number(agg.max_temp).toFixed(1)}°C)`,
        summary: `Tekanan tangki terakhir ${latest ? latest.oil_pressure : '-'} Bar, H2 ${latest ? latest.h2ppm : '-'} ppm.`,
        date: fmtTime(agg.latest_ts), timestamp: agg.latest_ts || new Date().toISOString() });
    }
    bulletins.push({ id: 'news-status', tag: 'Policy', color: status.allSafe ? 'text-indigo-500' : 'text-red-500',
      title: status.allSafe ? 'Semua 29 parameter status Normal' : `${status.counts.alarm} alarm, ${status.counts.trip} trip aktif`,
      summary: status.allSafe ? 'Threshold dari transformer_settings dipantau oleh Raspi dan server.' : status.items.filter(i => i.level !== 'normal').map(i => `${i.parameter}: ${i.label}`).join(', '),
      date: 'Status', timestamp: new Date().toISOString() });
    res.json({ success: true, total: bulletins.length, bulletins, source: 'database', db: req.dbName });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate operational news', details: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 5: Tulis ulang `backend/routes/analytics.js`** (katalog memakai key frontend)

```js
const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../utils/db');
const rm = require('../utils/readingModel');

const GROUPS = {
  'Phase Voltage': ['phaseA', 'phaseB', 'phaseC'], 'Line Voltage': ['lineAB', 'lineBC', 'lineCA'],
  Current: ['currentA', 'currentB', 'currentC', 'currentN', 'avgCurrent'],
  Power: ['powerActiveTotal', 'powerReactiveTotal', 'powerApparentTotal', 'powerActiveA', 'powerActiveB', 'powerActiveC'],
  'Power Quality': ['pfTotal', 'pfA', 'pfB', 'pfC', 'frequency', 'thdVA', 'thdVB', 'thdVC', 'thdIA', 'thdIB', 'thdIC'],
  Energy: ['energyActiveTotal', 'energyReactiveTotal'],
  Temperature: ['oil_temperature', 'wtiA', 'wtiB', 'wtiC', 'busTempA', 'busTempB', 'busTempC'],
  Oil: ['oil_pressure', 'h2ppm', 'moisturePpm'],
};

router.get('/metrics', (req, res) => {
  const metrics = {};
  for (const [group, keys] of Object.entries(GROUPS)) for (const k of keys) metrics[k] = { group, column: rm.KEY_TO_COLUMN[k] };
  res.json({ reading: { table: 'reading_data', metrics } });
});

router.get('/query', async (req, res) => {
  const { metrics, start, end, interval, limit } = req.query;
  const dbName = req.headers['x-db-name'] || req.user?.dbName;
  if (!dbName) return res.status(400).json({ error: 'Missing X-DB-Name header' });
  if (!metrics) return res.status(400).json({ error: "Missing 'metrics' parameter" });
  const keys = String(metrics).split(',').map(s => s.trim()).filter(k => rm.KEY_TO_COLUMN[k]);
  if (keys.length === 0) return res.status(400).json({ error: 'No valid metrics specified' });
  if (!start || !end) return res.status(400).json({ error: 'Missing start or end' });
  try {
    const db = await getDbConnection(dbName);
    const trafoId = parseInt(req.query.trafo_id || 1, 10) || 1;
    const rows = await rm.getHistory(db, trafoId, start, end, interval || 0, keys);
    const maxRows = Math.min(parseInt(limit, 10) || 5000, 10000);
    const data = rows.slice(0, maxRows).map(r => ({ timestamp: r.timestamp, ...Object.fromEntries(keys.map(k => [k, r[k]])) }));
    res.json({ data, meta: { table: 'reading_data', metrics: keys, count: data.length, aggregated: !!(parseInt(interval, 10) > 0), interval: parseInt(interval, 10) || null } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

- [ ] **Step 6: `npm test` lulus, restart server, uji manual**

```powershell
(Invoke-RestMethod -Uri "http://localhost:5000/api/trends/meter?trafo_id=1" -Headers $h).Count
(Invoke-RestMethod -Uri "http://localhost:5000/api/trends/meter?trafo_id=1" -Headers $h)[-1] | ConvertTo-Json -Depth 3 | Select-Object -First 15
$s = (Get-Date).AddHours(-2).ToUniversalTime().ToString("o"); $e = (Get-Date).ToUniversalTime().ToString("o")
(Invoke-RestMethod -Uri "http://localhost:5000/api/trends?trafo_id=1&start=$s&end=$e&interval=300" -Headers $h).Count
Invoke-RestMethod -Uri "http://localhost:5000/api/trends/report?trafo_id=1" -Headers $h | ConvertTo-Json -Depth 3 | Select-Object -First 12
Invoke-RestMethod -Uri "http://localhost:5000/api/trends/thi?trafo_id=1" -Headers $h | ConvertTo-Json -Depth 3 | Select-Object -First 10
Invoke-RestMethod -Uri "http://localhost:5000/api/trends/events?trafo_id=1" -Headers $h | ConvertTo-Json -Depth 3 | Select-Object -First 20
Invoke-RestMethod -Uri "http://localhost:5000/api/trends/news?trafo_id=1" -Headers $h | ConvertTo-Json -Depth 3 | Select-Object -First 12
Invoke-WebRequest -Uri "http://localhost:5000/api/trends/export?trafo_id=1&start=$s&end=$e&interval=300" -Headers $h -OutFile "$env:TEMP\export.xlsx"; (Get-Item "$env:TEMP\export.xlsx").Length
```

Expected: meter 60 baris, baris terakhir punya `phaseA`, `efficiency`, `derating`; trends 2 jam @5 menit = 24 baris; report `electrical.avg_phase_a ~230`, `avg_efficiency ~99.5`, `oil.alarm_triggers 1`, `trip_triggers 0`; thi `overallScore 100`; events 2 dari failure_log; news 4 buletin; file xlsx > 10 KB.

- [ ] **Step 7: Commit**

```bash
git add backend/utils/trendsHelpers.js backend/tests/trendsHelpers.test.js backend/routes/trends.js backend/routes/analytics.js
git commit -m "feat(backend): trends/report/export/thi/events/news dari reading_data lewat readingModel"
```

---

### Task 6: Poller Socket.IO dan pemindahan alert

**Files:**
- Create: `backend/utils/alertSender.js`
- Rewrite: `backend/utils/realtimePoller.js`
- Delete: `backend/utils/efficiency.js`
- Test: `backend/tests/realtimePoller.test.js`

**Interfaces:**
- Consumes: `readingModel.getLatest/computeDerived`, `trafoModel.getTransformerData/getStatusRow`, `statusModel.oilFlags`.
- Produces: event `meter` = semua key frontend + `efficiency`, `leadLag`, `derating`, `timestamp`, `modbus_connected: true`; event `oil_sensor` = `{ oil_temperature, oil_pressure, oil_level, oil_level_alarm, oil_level_trip, timestamp, adc_connected: true }`. `alertSender.sendAlertMessage(dbName, trafoId, alerts)` untuk Rencana C. `realtimePoller.buildPayloads(point, td, statusRow)` untuk test.

- [ ] **Step 1: Tulis test `backend/tests/realtimePoller.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPayloads } = require('../utils/realtimePoller');
const rm = require('../utils/readingModel');

test('buildPayloads membuat meter dan oil_sensor dari satu point', () => {
  const point = rm.mapRow({ timestamp: '2026-10-13T01:02:03.000Z', trafoId: 1, Van: 230, Iavg: 72, Qa: 100, Sa: 15000, deRatinga: 90, OilTemp: 55, Press: 0.41, Level: 1 });
  const td = { ratedPower: 100, ratedCurrentLowVoltage: 144, noLoadLoss: 150, fullLoadLoss: 1200 };
  const { meter, oil } = buildPayloads(point, td, { OilLevel: 2 });
  assert.equal(meter.phaseA, 230);
  assert.equal(meter.efficiency, 99.55);
  assert.equal(meter.leadLag.a, 'leading');
  assert.equal(meter.derating.a.used, 15);
  assert.equal(meter.modbus_connected, true);
  assert.equal(meter.timestamp, '2026-10-13T01:02:03.000Z');
  assert.deepEqual(oil, { oil_temperature: 55, oil_pressure: 0.41, oil_level: true, oil_level_alarm: 0, oil_level_trip: 1, timestamp: '2026-10-13T01:02:03.000Z', adc_connected: true });
});

test('buildPayloads tetap jalan tanpa nameplate dan tanpa status', () => {
  const point = rm.mapRow({ timestamp: new Date(), Van: 1 });
  const { meter, oil } = buildPayloads(point, null, null);
  assert.equal(meter.efficiency, null);
  assert.equal(meter.derating, null);
  assert.equal(oil.oil_level_alarm, 1);
});
```

- [ ] **Step 2: `npm test`, pastikan gagal (`buildPayloads is not a function`)**

- [ ] **Step 3: Tulis `backend/utils/alertSender.js`** (dipindahkan dari poller, disesuaikan ke `user`/`company`)

```js
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
```

- [ ] **Step 4: Tulis ulang `backend/utils/realtimePoller.js`**

```js
const { getDbConnection } = require('./db');
const rm = require('./readingModel');
const tm = require('./trafoModel');
const sm = require('./statusModel');

const META_TTL_MS = 60 * 1000;

// Dipisah supaya bisa diuji tanpa Socket.IO dan MySQL.
function buildPayloads(point, td, statusRow) {
  const full = rm.computeDerived(point, td);
  const meter = { ...full, modbus_connected: true };
  const oil = {
    oil_temperature: point.oil_temperature,
    oil_pressure: point.oil_pressure,
    oil_level: point.oilLevelRaw === 1,
    ...sm.oilFlags(statusRow ? statusRow.OilLevel : undefined),
    timestamp: point.timestamp,
    adc_connected: true,
  };
  return { meter, oil };
}

function startRealtimePoller(io, activeSubscriptions, roomIntervals) {
  const lastSeen = {};
  const lastEmitTime = {};
  const metaCache = new Map(); // roomName -> { at, td, status }

  async function getMeta(db, trafoId, roomName) {
    const cached = metaCache.get(roomName);
    if (cached && Date.now() - cached.at < META_TTL_MS) return cached;
    const [td, status] = await Promise.all([tm.getTransformerData(db, trafoId), tm.getStatusRow(db, trafoId)]);
    const meta = { at: Date.now(), td, status };
    metaCache.set(roomName, meta);
    return meta;
  }

  setInterval(async () => {
    try {
      const rooms = io.sockets.adapter.rooms;
      const active = [];
      for (const [roomName, clients] of rooms.entries()) {
        if (!roomName.startsWith('trafo_') || clients.size === 0) continue;
        const dbName = activeSubscriptions.get(roomName);
        if (!dbName) continue;
        const trafoId = parseInt(roomName.slice(`trafo_${dbName}_`.length), 10) || 1;
        active.push({ roomName, dbName, trafoId });
      }
      const now = Date.now();

      await Promise.allSettled(active.map(async ({ roomName, dbName, trafoId }) => {
        const interval = roomIntervals.get(roomName) ?? 0;
        if (interval > 0 && now - (lastEmitTime[roomName] || 0) < interval) return;
        try {
          const db = await getDbConnection(dbName);
          const point = await rm.getLatest(db, trafoId);
          if (!point || lastSeen[roomName] === point.timestamp) return;
          lastSeen[roomName] = point.timestamp;
          lastEmitTime[roomName] = now;
          const { td, status } = await getMeta(db, trafoId, roomName);
          const { meter, oil } = buildPayloads(point, td, status);
          io.to(roomName).emit('meter', meter);
          io.to(roomName).emit('oil_sensor', oil);
        } catch (err) {
          if (err.code === 'ER_BAD_DB_ERROR') {
            console.warn(`Database ${dbName} tidak ada. Room ${roomName} dihapus dari polling.`);
            activeSubscriptions.delete(roomName);
          } else {
            console.error(`Error polling ${dbName} untuk ${roomName}:`, err.message);
          }
        }
      }));
    } catch (error) {
      console.error('Realtime poller error:', error);
    }
  }, 1000);
}

startRealtimePoller.buildPayloads = buildPayloads;
module.exports = startRealtimePoller;
module.exports.buildPayloads = buildPayloads;
```

- [ ] **Step 5: Hapus `backend/utils/efficiency.js`**

```bash
git rm backend/utils/efficiency.js
grep -rn "efficiency')\|calculateEfficiency\|METRIC_MAPPING\|checkAndAlert\|invalidateThresholdCache" backend --include=*.js -l
```

Expected: grep tidak menemukan file apa pun (kecuali `node_modules`).

- [ ] **Step 6: `npm test` lulus, lalu uji Socket.IO dengan script kecil**

Buat sementara `backend/scripts/ws_probe.js` (boleh dibuang setelahnya, atau simpan sebagai alat uji):

```js
// node scripts/ws_probe.js  -> menunggu 1 event meter + 1 oil_sensor lalu keluar
const { io } = require('socket.io-client');
const s = io('http://localhost:5000', { transports: ['websocket'] });
let got = 0;
s.on('connect', () => { console.log('terhubung'); s.emit('subscribe_transformer', { trafoId: '1', dbName: 'db_demo' }); });
s.on('meter', (m) => { console.log('meter:', { phaseA: m.phaseA, kW: m.powerActiveTotal, eff: m.efficiency, derating: m.derating && m.derating.a }); if (++got >= 2) process.exit(0); });
s.on('oil_sensor', (o) => { console.log('oil_sensor:', o); if (++got >= 2) process.exit(0); });
setTimeout(() => { console.log('tidak ada event dalam 10 detik'); process.exit(1); }, 10000);
```

`socket.io-client` ada di `frontend/node_modules`, bukan backend; jalankan `npm i -D socket.io-client` di `backend` dulu. Expected: dua baris `meter:` dan `oil_sensor:` dengan angka dari seed.

Catatan: seed hanya menulis 60 baris sekali, jadi setelah event pertama tidak ada event baru (timestamp tidak berubah). Itu benar; data baru datang dari Raspi di Rencana C.

- [ ] **Step 7: Commit**

```bash
git add backend/utils/alertSender.js backend/utils/realtimePoller.js backend/tests/realtimePoller.test.js backend/scripts/ws_probe.js backend/package.json backend/package-lock.json
git commit -m "feat(backend): poller membaca temp_reading_data_realtime lewat readingModel; alertSender ke user/company"
```

---

### Task 7: Smoke test seluruh API dan bersih-bersih referensi lama

**Files:**
- Create: `backend/scripts/smoke_api.js`
- Modify: `backend/.env.example` (tambah `MASTER_DB=master_tmu_app` bila belum)

- [ ] **Step 1: Tulis `backend/scripts/smoke_api.js`**

```js
// node scripts/smoke_api.js [baseUrl]  -> login demo lalu panggil setiap GET, cetak status.
const BASE = process.argv[2] || 'http://localhost:5000';

async function main() {
  const login = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'demo', password: 'demo123' }) });
  const auth = await login.json();
  if (!auth.token) throw new Error('Login gagal: ' + JSON.stringify(auth));
  const H = { Authorization: `Bearer ${auth.token}`, 'X-DB-Name': auth.db_name, 'X-Trafo-Id': '1' };
  const end = new Date().toISOString(), start = new Date(Date.now() - 3600e3).toISOString();
  const urls = [
    '/api/profile', '/api/superuser-users', '/api/layouts', '/api/trafo', '/api/trafo/company-info', '/api/trafo/1', '/api/trafo/1/data',
    '/api/trafo/1/status', '/api/trafo/1/physical', '/api/trafo/1/oil-quality', '/api/trafo/1/harmonics?type=voltage', '/api/trafo/1/harmonics?type=current',
    '/api/settings/thresholds?trafo_id=1', '/api/settings/limits?trafo_id=1',
    '/api/trends/meter?trafo_id=1', `/api/trends?trafo_id=1&start=${start}&end=${end}&interval=300`, '/api/trends/oil?trafo_id=1',
    `/api/trends/export-count?trafo_id=1&start=${start}&end=${end}`, '/api/trends/report?trafo_id=1', '/api/trends/thi?trafo_id=1',
    '/api/trends/events?trafo_id=1', '/api/trends/news?trafo_id=1', '/api/analytics/metrics', `/api/analytics/query?trafo_id=1&metrics=phaseA,oil_temperature&start=${start}&end=${end}&interval=300`,
  ];
  let fail = 0;
  for (const u of urls) {
    const r = await fetch(BASE + u, { headers: H });
    const text = await r.text();
    const ok = r.status < 400;
    if (!ok) fail++;
    console.log(`${ok ? 'OK ' : 'ERR'} ${r.status} ${u}  ${text.slice(0, 90).replace(/\s+/g, ' ')}`);
  }
  console.log(fail === 0 ? 'Semua endpoint OK' : `${fail} endpoint gagal`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => { console.error('Smoke gagal:', err.message); process.exit(1); });
```

- [ ] **Step 2: Jalankan dengan server hidup**

Run: `node scripts/smoke_api.js`
Expected: 24 baris `OK`, diakhiri `Semua endpoint OK`.

- [ ] **Step 3: Pastikan tidak ada referensi skema lama**

```bash
grep -rn "tmu_master\|FROM users\|INTO users\|FROM companies\|electrical_readings\|oil_readings\|threshold_settings\|nama_db\b.*=\|nomor_telpon = ?" backend --include=*.js --exclude-dir=node_modules
```

Expected: hanya muncul di `backend/utils/db.js` (`"tmu_master"` di daftar `systemDbs`, boleh tetap) dan di respons route yang memang memakai nama field lama untuk frontend (`nama_db:`, `nama_perusahaan:` di `masterModel.js`, `companies.js`, `trafo.js`). Tidak boleh ada di SQL.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/smoke_api.js backend/.env.example
git commit -m "feat(backend): smoke test semua endpoint; Rencana B selesai"
```

---

## Selesai Rencana B

Backend sekarang sepenuhnya memakai `master_tmu_app` dan skema `base_tmu`. Login demo bekerja, daftar trafo, status, limits, trends, report, export, THI, events, news, dan poller Socket.IO semua membaca `db_demo`. Yang belum: data baru dari Raspi (Rencana C) dan frontend yang masih memetakan `phase_a_v` serta membaca `threshold_settings` (Rencana D, dimulai dari `TrendDataContext`, `ThresholdContext`, `TemperatureDataContext`).
