# Rencana A: Fondasi Backend (DB lokal, MASTER_DB, schemaPatch, readingModel)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Catatan khusus proyek ini:** user mengetik semua kode sendiri untuk belajar. Claude memberi instruksi per langkah dan memverifikasi, tidak mengedit file kode.

**Goal:** Backend bisa terhubung ke database `master_tmu_app` dan satu database perusahaan `db_demo` yang dibuat dari dump lama, menambal skema saat startup, dan punya modul `readingModel.js` teruji yang memetakan kolom `base_tmu` ke key frontend.

**Architecture:** Nama DB master dibaca dari `MASTER_DB`. Dump `.sql` diimpor lewat script Node yang membersihkan `CREATE DATABASE`/`USE` dan collation MariaDB. `schemaPatch.js` menggantikan `autoIndex.js` dan menambah kolom/index yang dibutuhkan desain. `readingModel.js` adalah satu-satunya tempat yang tahu nama kolom `base_tmu`.

**Tech Stack:** Node 22, Express 5, mysql2/promise, MySQL 5.7 (Laragon), `node:test` bawaan Node untuk unit test.

**Spec:** `docs/superpowers/specs/2026-10-13-tmu-legacy-schema-design.md`

## Global Constraints

- MySQL server lokal versi 5.7.44. Hindari sintaks yang hanya ada di MariaDB atau MySQL 8.
- Nama DB master dari `process.env.MASTER_DB`, default `master_tmu_app`. Jangan tulis `tmu_master` baru di kode.
- Kolom `base_tmu` hanya boleh disebut di `backend/utils/readingModel.js` (untuk tabel reading) dan `schemaPatch.js`.
- Daya (`Pa..Ssig`) dibagi 1000 di `mapRow`. Key frontend lama (`phaseA`, `oil_temperature`, dst.) tidak boleh berubah nama.
- Semua script dijalankan dari folder `backend/`. Test dijalankan dengan `npm test` dari `backend/`.
- Tidak menambah dependency baru.

## Review Focus

1. Nilai dari MySQL bisa datang sebagai string (kolom `double` lewat mysql2 datang sebagai number, tapi `DECIMAL` dan hasil `ROUND(AVG())` datang sebagai string). `mapRow` harus mengubahnya jadi number. Test di Task 4.
2. Kolom `NULL` di reading harus jadi `0`, bukan `NaN` atau `null`, agar panel yang memanggil `.toFixed` tidak crash. Test di Task 4.
3. Efisiensi saat `transformer_data` belum punya konstanta (nameplate kosong) harus `null`, bukan `NaN` atau `Infinity`. Test di Task 4.
4. File dump di Windows bisa punya akhir baris CRLF. `sanitizeDump` harus tetap menghapus baris `CREATE DATABASE` dan `USE`. Test di Task 2.
5. Baris di `company.database_name` yang database-nya tidak ada (dihapus manual) tidak boleh menghentikan patch untuk perusahaan lain. Test di Task 3.

---

## Struktur file

| File | Status | Tanggung jawab |
|---|---|---|
| `backend/.env`, `backend/.env.example` | ubah | tambah `MASTER_DB` |
| `backend/package.json` | ubah | script `test` |
| `backend/utils/db.js` | ubah | ekspor `getDbConfig`, `getMasterDbName`, `getMasterDb` |
| `backend/utils/sqlTemplate.js` | baru | bersihkan dump dan buat database dari file `.sql` |
| `backend/scripts/import_sql.js` | baru | CLI: `node scripts/import_sql.js <file.sql> <dbName>` |
| `backend/utils/schemaPatch.js` | baru | tambal skema master dan perusahaan saat startup |
| `backend/utils/autoIndex.js` | hapus | digantikan `schemaPatch.js` |
| `backend/index.js` | ubah | panggil `runSchemaPatch` |
| `backend/utils/readingModel.js` | baru | peta kolom, `mapRow`, `buildSelect`, query, turunan |
| `backend/scripts/seed_demo.js` | baru | data contoh untuk `db_demo` dan `master_tmu_app` |
| `backend/tests/helpers/fakeDb.js` | baru | db palsu untuk test |
| `backend/tests/*.test.js` | baru | unit test |

---

### Task 1: `MASTER_DB` dan script test

**Files:**
- Modify: `backend/utils/db.js`
- Modify: `backend/.env`, `backend/.env.example`
- Modify: `backend/package.json`
- Test: `backend/tests/db.test.js`

**Interfaces:**
- Produces: `getDbConfig(dbName?)` (sudah ada, kini diekspor), `getMasterDbName(): string`, `getMasterDb(): Promise<Pool>`.

- [ ] **Step 1: Tambah script test di `backend/package.json`**

Di bagian `"scripts"` tambahkan baris `test`:

```json
"scripts": {
  "start": "node index.js",
  "dev": "nodemon index.js",
  "test": "node --test \"tests/**/*.test.js\""
},
```

(Node 22 memperlakukan `tests/` sebagai satu file, jadi harus pola glob. Tanda kutip dalam string JSON di-escape dengan `\"` supaya shell tidak mengembangkan `*` sendiri.)

- [ ] **Step 2: Tulis test yang gagal di `backend/tests/db.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../utils/db');

test('getMasterDbName memakai MASTER_DB dari env', () => {
  process.env.MASTER_DB = 'master_uji';
  assert.equal(db.getMasterDbName(), 'master_uji');
});

test('getMasterDbName default master_tmu_app kalau env kosong', () => {
  delete process.env.MASTER_DB;
  assert.equal(db.getMasterDbName(), 'master_tmu_app');
});

test('getDbConfig diekspor dan menyertakan database bila diminta', () => {
  const cfg = db.getDbConfig('db_x');
  assert.equal(cfg.database, 'db_x');
  assert.equal(typeof cfg.host, 'string');
});
```

- [ ] **Step 3: Jalankan test, pastikan gagal**

Run (dari `backend/`): `npm test`
Expected: FAIL dengan `db.getMasterDbName is not a function`.

- [ ] **Step 4: Ubah `backend/utils/db.js`**

Tambahkan dua fungsi sebelum `module.exports`, dan ganti daftar `systemDbs` di `getAllDatabases` supaya memakai nama master dari env:

```js
function getMasterDbName() {
  return process.env.MASTER_DB || 'master_tmu_app';
}

async function getMasterDb() {
  return getDbConnection(getMasterDbName());
}
```

Di dalam `getAllDatabases`, ganti baris `const systemDbs = [...]` menjadi:

```js
const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys', 'defaultdb', 'tmu_master', getMasterDbName()];
```

Ganti `module.exports` menjadi:

```js
module.exports = {
  getDbConfig,
  getDbConnection,
  getAllDatabases,
  getAdminPool,
  getMasterDbName,
  getMasterDb
};
```

- [ ] **Step 5: Tambah `MASTER_DB` ke env**

Di `backend/.env` tambahkan baris `MASTER_DB=master_tmu_app`. Di `backend/.env.example` tambahkan baris yang sama.

- [ ] **Step 6: Jalankan test, pastikan lulus**

Run: `npm test`
Expected: 3 test PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/package.json backend/utils/db.js backend/.env.example backend/tests/db.test.js
git commit -m "feat(backend): MASTER_DB configurable, npm test via node:test"
```

(`backend/.env` tidak di-commit, sudah ada di `.gitignore`.)

---

### Task 2: Import dump `.sql` ke MySQL 5.7

**Files:**
- Create: `backend/utils/sqlTemplate.js`
- Create: `backend/scripts/import_sql.js`
- Test: `backend/tests/sqlTemplate.test.js`

**Interfaces:**
- Consumes: `getDbConfig()` dari Task 1.
- Produces: `sanitizeDump(text): string`, `assertValidDbName(name): void`, `createDatabaseFromSql(dbName, sqlFilePath): Promise<void>`. Rencana B memakai `createDatabaseFromSql` saat admin membuat perusahaan baru.

- [ ] **Step 1: Tulis test yang gagal di `backend/tests/sqlTemplate.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeDump, assertValidDbName } = require('../utils/sqlTemplate');

test('sanitizeDump menghapus CREATE DATABASE dan USE (LF)', () => {
  const src = [
    "CREATE DATABASE /*!32312 IF NOT EXISTS*/`base_x` /*!40100 DEFAULT CHARACTER SET utf8mb4 */;",
    "",
    "USE `base_x`;",
    "CREATE TABLE a (id int);",
  ].join('\n');
  const out = sanitizeDump(src);
  assert.doesNotMatch(out, /CREATE DATABASE/);
  assert.doesNotMatch(out, /^USE /m);
  assert.match(out, /CREATE TABLE a/);
});

test('sanitizeDump juga bekerja dengan akhir baris CRLF', () => {
  const src = "CREATE DATABASE `b`;\r\nUSE `b`;\r\nCREATE TABLE t (id int);\r\n";
  const out = sanitizeDump(src);
  assert.doesNotMatch(out, /CREATE DATABASE/);
  assert.doesNotMatch(out, /USE `b`/);
  assert.match(out, /CREATE TABLE t/);
});

test('sanitizeDump mengganti collation MariaDB yang tidak dikenal MySQL 5.7', () => {
  const src = ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_slovenian_ci;";
  const out = sanitizeDump(src);
  assert.equal(out, ") ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;");
});

test('assertValidDbName menolak nama berbahaya', () => {
  assert.throws(() => assertValidDbName('db; DROP DATABASE x'), /Nama database tidak valid/);
  assert.throws(() => assertValidDbName(''), /Nama database tidak valid/);
  assert.doesNotThrow(() => assertValidDbName('db_demo'));
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm test`
Expected: FAIL dengan `Cannot find module '../utils/sqlTemplate'`.

- [ ] **Step 3: Tulis `backend/utils/sqlTemplate.js`**

```js
const fs = require('fs');
const mysql = require('mysql2/promise');
const { getDbConfig } = require('./db');

const DB_NAME_RE = /^[A-Za-z0-9_]{1,64}$/;

function assertValidDbName(name) {
  if (typeof name !== 'string' || !DB_NAME_RE.test(name)) {
    throw new Error(`Nama database tidak valid: "${name}"`);
  }
}

// Membersihkan dump SQLyog/MariaDB supaya bisa dijalankan di MySQL 5.7
// ke database yang namanya kita tentukan sendiri.
function sanitizeDump(text) {
  return text
    .replace(/^CREATE DATABASE[^\r\n]*;[ \t]*$/gim, '')
    .replace(/^USE[ \t]+`?[A-Za-z0-9_]+`?[ \t]*;[ \t]*$/gim, '')
    .replace(/utf8mb3_slovenian_ci/g, 'utf8_general_ci')
    .replace(/CHARSET=utf8mb3/g, 'CHARSET=utf8');
}

async function createDatabaseFromSql(dbName, sqlFilePath) {
  assertValidDbName(dbName);
  const raw = fs.readFileSync(sqlFilePath, 'utf8');
  const sqlText = sanitizeDump(raw);

  const conn = await mysql.createConnection({ ...getDbConfig(), multipleStatements: true });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4`);
    await conn.query(`USE \`${dbName}\``);
    await conn.query(sqlText);
  } finally {
    await conn.end();
  }
}

module.exports = { sanitizeDump, assertValidDbName, createDatabaseFromSql };
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npm test`
Expected: semua PASS.

- [ ] **Step 5: Tulis `backend/scripts/import_sql.js`**

```js
// Pemakaian: node scripts/import_sql.js <path-file.sql> <namaDatabase>
require('dotenv').config();
const path = require('path');
const { createDatabaseFromSql } = require('../utils/sqlTemplate');

async function main() {
  const [file, dbName] = process.argv.slice(2);
  if (!file || !dbName) {
    console.error('Pemakaian: node scripts/import_sql.js <path-file.sql> <namaDatabase>');
    process.exit(1);
  }
  const abs = path.resolve(file);
  console.log(`Mengimpor ${abs} ke database ${dbName} ...`);
  await createDatabaseFromSql(dbName, abs);
  console.log('Selesai.');
}

main().catch((err) => {
  console.error('Gagal import:', err.message);
  process.exit(1);
});
```

- [ ] **Step 6: Import kedua dump**

Run dari `backend/`:

```bash
node scripts/import_sql.js ../master_tmu_app.sql master_tmu_app
node scripts/import_sql.js ../base_tmu.sql db_demo
```

Expected: dua kali `Selesai.` tanpa error.

- [ ] **Step 7: Verifikasi tabel terbentuk**

Run dari `backend/`:

```bash
node -e "require('dotenv').config();const m=require('mysql2/promise');(async()=>{const c=await m.createConnection(require('./utils/db').getDbConfig());for(const d of ['master_tmu_app','db_demo']){const [t]=await c.query('SHOW TABLES FROM '+d);console.log(d+':',t.map(x=>Object.values(x)[0]).join(', '));}await c.end();})()"
```

Expected: `master_tmu_app: company, parameter_failure_recommendation, trafo_last_connection, user, user_activity_log` dan `db_demo:` berisi 16 tabel termasuk `temp_reading_data_realtime`, `reading_data`, `transformer_data`.

- [ ] **Step 8: Commit**

```bash
git add backend/utils/sqlTemplate.js backend/scripts/import_sql.js backend/tests/sqlTemplate.test.js
git commit -m "feat(backend): import dump SQL lama ke MySQL 5.7 lewat script"
```

---

### Task 3: `schemaPatch.js` menggantikan `autoIndex.js`

**Files:**
- Create: `backend/tests/helpers/fakeDb.js`
- Create: `backend/utils/schemaPatch.js`
- Delete: `backend/utils/autoIndex.js`
- Modify: `backend/index.js` (baris `const autoAddIndexes = require("./utils/autoIndex");` dan pemanggilan `autoAddIndexes();`)
- Test: `backend/tests/schemaPatch.test.js`

**Interfaces:**
- Consumes: `getMasterDb`, `getDbConnection` dari Task 1.
- Produces: `patchMasterDb(db)`, `patchCompanyDb(db)`, `runSchemaPatch()`; helper test `makeFakeDb(responder)` yang mengembalikan `{ calls, execute, query }`.

- [ ] **Step 1: Tulis helper `backend/tests/helpers/fakeDb.js`**

```js
// Database palsu: mencatat setiap SQL dan menjawab sesuai fungsi responder.
// responder(sql, params) mengembalikan array baris, atau undefined untuk [].
function makeFakeDb(responder = () => []) {
  const calls = [];
  const run = async (sql, params = []) => {
    calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
    const rows = responder(sql, params);
    return [rows || [], []];
  };
  return { calls, execute: run, query: run };
}

module.exports = { makeFakeDb };
```

- [ ] **Step 2: Tulis test yang gagal di `backend/tests/schemaPatch.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('./helpers/fakeDb');
const { patchMasterDb, patchCompanyDb, patchAllCompanies } = require('../utils/schemaPatch');

function alterCalls(db) {
  return db.calls.filter(c => /^(ALTER|CREATE) /i.test(c.sql)).map(c => c.sql);
}

test('patchMasterDb menambah email, phone, dan user_layouts kalau belum ada', async () => {
  const db = makeFakeDb(() => []); // semua SHOW mengembalikan kosong = belum ada
  await patchMasterDb(db);
  const sqls = alterCalls(db);
  assert.ok(sqls.some(s => /ALTER TABLE `user` ADD COLUMN `email`/.test(s)));
  assert.ok(sqls.some(s => /ALTER TABLE `user` ADD COLUMN `phone`/.test(s)));
  assert.ok(sqls.some(s => /CREATE TABLE user_layouts/.test(s)));
});

test('patchMasterDb tidak mengubah apa pun kalau sudah ada', async () => {
  const db = makeFakeDb(() => [{ ada: 1 }]); // semua SHOW mengembalikan 1 baris = sudah ada
  await patchMasterDb(db);
  assert.equal(alterCalls(db).length, 0);
});

test('patchCompanyDb menambah trafoId ke tabel temp dan index unik', async () => {
  const db = makeFakeDb((sql) => (/SHOW TABLES/i.test(sql) ? [{ t: 1 }] : []));
  await patchCompanyDb(db);
  const sqls = alterCalls(db);
  assert.ok(sqls.some(s => /ALTER TABLE `temp_reading_data_realtime` ADD COLUMN `trafoId`/.test(s)));
  assert.ok(sqls.some(s => /ALTER TABLE `temp_voltage_harmonic` ADD COLUMN `trafoId`/.test(s)));
  assert.ok(sqls.some(s => /ALTER TABLE `temp_current_harmonic` ADD COLUMN `trafoId`/.test(s)));
  assert.ok(sqls.some(s => /ALTER TABLE `reading_data` ADD UNIQUE INDEX uq_reading_trafo_ts/.test(s)));
  assert.ok(sqls.some(s => /ALTER TABLE `failure_log` ADD UNIQUE INDEX uq_failure_trafo_id/.test(s)));
});

test('patchCompanyDb melewati tabel yang tidak ada', async () => {
  const db = makeFakeDb(() => []); // SHOW TABLES kosong = tabel tidak ada
  await patchCompanyDb(db);
  assert.equal(alterCalls(db).length, 0);
});

test('patchAllCompanies melanjutkan ke perusahaan lain kalau satu DB tidak ada', async () => {
  const dicoba = [];
  const openDb = async (name) => {
    dicoba.push(name);
    if (name === 'db_hilang') { const e = new Error('Unknown database'); e.code = 'ER_BAD_DB_ERROR'; throw e; }
    return makeFakeDb(() => []);
  };
  const hasil = await patchAllCompanies(['db_hilang', 'db_ada'], openDb);
  assert.deepEqual(dicoba, ['db_hilang', 'db_ada']);
  assert.deepEqual(hasil, { ok: ['db_ada'], gagal: ['db_hilang'] });
});
```

- [ ] **Step 3: Jalankan test, pastikan gagal**

Run: `npm test`
Expected: FAIL dengan `Cannot find module '../utils/schemaPatch'`.

- [ ] **Step 4: Tulis `backend/utils/schemaPatch.js`**

```js
const { getDbConnection, getMasterDb } = require('./db');

async function hasTable(db, table) {
  const [rows] = await db.query('SHOW TABLES LIKE ?', [table]);
  return rows.length > 0;
}

async function hasColumn(db, table, column) {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  return rows.length > 0;
}

async function hasIndex(db, table, indexName) {
  const [rows] = await db.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName]);
  return rows.length > 0;
}

async function ensureColumn(db, table, column, definition) {
  if (await hasColumn(db, table, column)) return false;
  await db.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`[SchemaPatch] ${table}.${column} ditambahkan`);
  return true;
}

async function ensureIndex(db, table, indexName, definition) {
  if (await hasIndex(db, table, indexName)) return false;
  await db.execute(`ALTER TABLE \`${table}\` ADD ${definition}`);
  console.log(`[SchemaPatch] index ${indexName} di ${table} ditambahkan`);
  return true;
}

// ---- master ----
async function patchMasterDb(db) {
  await ensureColumn(db, 'user', 'email', 'VARCHAR(150) DEFAULT NULL');
  await ensureColumn(db, 'user', 'phone', 'VARCHAR(20) DEFAULT NULL');

  if (!(await hasTable(db, 'user_layouts'))) {
    await db.execute(`CREATE TABLE user_layouts (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      user_id INT NOT NULL,
      layout_name VARCHAR(100) DEFAULT NULL,
      layout_data JSON DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 0,
      trafo_id VARCHAR(50) DEFAULT NULL,
      KEY idx_user_layouts_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    console.log('[SchemaPatch] tabel user_layouts dibuat');
  }
}

// ---- perusahaan ----
const TEMP_TABLES = ['temp_reading_data_realtime', 'temp_voltage_harmonic', 'temp_current_harmonic'];

async function patchCompanyDb(db) {
  for (const table of TEMP_TABLES) {
    if (await hasTable(db, table)) {
      await ensureColumn(db, table, 'trafoId', 'INT NOT NULL DEFAULT 1');
    }
  }
  if (await hasTable(db, 'temp_reading_data_realtime')) {
    await ensureIndex(db, 'temp_reading_data_realtime', 'idx_temp_trafo_ts', 'INDEX idx_temp_trafo_ts (trafoId, timestamp)');
  }
  if (await hasTable(db, 'reading_data')) {
    await ensureIndex(db, 'reading_data', 'uq_reading_trafo_ts', 'UNIQUE INDEX uq_reading_trafo_ts (trafoId, timestamp)');
  }
  if (await hasTable(db, 'failure_log')) {
    await ensureIndex(db, 'failure_log', 'uq_failure_trafo_id', 'UNIQUE INDEX uq_failure_trafo_id (trafoId, failure_id)');
  }
}

// openDb bisa diganti di test. Mengembalikan daftar DB yang berhasil dan gagal.
async function patchAllCompanies(dbNames, openDb = getDbConnection) {
  const hasil = { ok: [], gagal: [] };
  for (const name of dbNames) {
    try {
      const db = await openDb(name);
      await patchCompanyDb(db);
      hasil.ok.push(name);
    } catch (err) {
      console.warn(`[SchemaPatch] lewati ${name}: ${err.message}`);
      hasil.gagal.push(name);
    }
  }
  return hasil;
}

async function runSchemaPatch() {
  try {
    const master = await getMasterDb();
    await patchMasterDb(master);
    const [rows] = await master.execute('SELECT database_name FROM company WHERE status = 1');
    const hasil = await patchAllCompanies(rows.map(r => r.database_name));
    console.log(`[SchemaPatch] selesai. ok=${hasil.ok.length} gagal=${hasil.gagal.length}`);
  } catch (err) {
    console.error('[SchemaPatch] gagal:', err.message);
  }
}

module.exports = { patchMasterDb, patchCompanyDb, patchAllCompanies, runSchemaPatch };
```

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `npm test`
Expected: semua PASS.

- [ ] **Step 6: Ganti pemanggilan di `backend/index.js` dan hapus `autoIndex.js`**

Ganti baris `const autoAddIndexes = require("./utils/autoIndex");` menjadi:

```js
const { runSchemaPatch } = require("./utils/schemaPatch");
```

Di dalam `server.listen(...)`, ganti `autoAddIndexes();` menjadi `runSchemaPatch();`.

Hapus file `backend/utils/autoIndex.js`. Cek `backend/scripts/add_indexes.js` juga memakai tabel lama; hapus file itu juga.

- [ ] **Step 7: Jalankan server sekali untuk menambal `master_tmu_app` dan `db_demo`**

Karena `company` masih kosong, patch perusahaan belum jalan. Isi satu baris dulu:

```bash
node -e "require('dotenv').config();const m=require('mysql2/promise');(async()=>{const c=await m.createConnection({...require('./utils/db').getDbConfig('master_tmu_app')});await c.query(\"INSERT INTO company (company_name, database_name, company_key, status, tmu_version) VALUES ('PT Demo','db_demo','demo-company-key-0001',1,2)\");await c.end();console.log('ok');})()"
```

Lalu `npm run dev`, tunggu log `[SchemaPatch] selesai. ok=1 gagal=0`, hentikan server (Ctrl+C).

- [ ] **Step 8: Verifikasi kolom dan index**

```bash
node -e "require('dotenv').config();const m=require('mysql2/promise');(async()=>{const c=await m.createConnection(require('./utils/db').getDbConfig());const [u]=await c.query('SHOW COLUMNS FROM master_tmu_app.user');console.log('user:',u.map(x=>x.Field).join(', '));const [t]=await c.query('SHOW COLUMNS FROM db_demo.temp_reading_data_realtime LIKE \"trafoId\"');console.log('temp trafoId:',t.length);const [i]=await c.query('SHOW INDEX FROM db_demo.reading_data WHERE Key_name=\"uq_reading_trafo_ts\"');console.log('uq index cols:',i.length);await c.end();})()"
```

Expected: `user:` memuat `email, phone`; `temp trafoId: 1`; `uq index cols: 2`.

- [ ] **Step 9: Commit**

```bash
git add backend/utils/schemaPatch.js backend/tests/helpers/fakeDb.js backend/tests/schemaPatch.test.js backend/index.js
git rm backend/utils/autoIndex.js backend/scripts/add_indexes.js
git commit -m "feat(backend): schemaPatch tambal skema master dan perusahaan saat startup"
```

---

### Task 4: `readingModel.js`

**Files:**
- Create: `backend/utils/readingModel.js`
- Test: `backend/tests/readingModel.test.js`

**Interfaces:**
- Consumes: `makeFakeDb` dari Task 3.
- Produces:
  - `COLUMN_MAP: { [kolomDb]: keyFrontend }`, `KEY_TO_COLUMN`, `ALL_KEYS: string[]`
  - `mapRow(row): Point` — `Point` punya `timestamp` (ISO), `time` (HH:mm:ss WIB), `trafoId`, dan semua key frontend bernilai number (0 bila NULL)
  - `buildSelect(keys, { aggregate }): string`
  - `getLatest(db, trafoId): Promise<Point|null>`
  - `getRealtimeSeries(db, trafoId, limit=60): Promise<Point[]>`
  - `getHistory(db, trafoId, start, end, intervalSec=0, keys=ALL_KEYS): Promise<Point[]>`
  - `computeEfficiency(point, transformerData): number|null`
  - `computeDerating(point, transformerData): { a, b, c }|null` dengan tiap fase `{ kRated, full, available, lost, used }` dalam kVA
  - `leadLag(q): 'leading'|'lagging'|'unity'`
  - `computeDerived(point, transformerData): Point & { efficiency, leadLag: {a,b,c}, derating }`

- [ ] **Step 1: Tulis test yang gagal di `backend/tests/readingModel.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('./helpers/fakeDb');
const rm = require('../utils/readingModel');

const TD = { ratedPower: 100, ratedCurrentLowVoltage: 144, noLoadLoss: 150, fullLoadLoss: 1200 };

test('mapRow memetakan kolom base_tmu ke key frontend dan membagi daya 1000', () => {
  const p = rm.mapRow({
    timestamp: '2026-10-13T01:02:03.000Z', trafoId: 1,
    Van: 230.1, Vab: 398.5, Ia: 10, Ineutral: 0.5, Iavg: 10,
    Pa: 2300, Psig: 6900, Qsig: -500, Ssig: 7000, PFsig: 0.98, Freq: 50,
    kWh: 123.4, OilTemp: 55, Press: 0.41, WTITemp1: 60, BusTemp2: 45,
    THDV1: 2.5, THDI3: 4.1, H2ppm: 12, Moistureppm: 8,
    deRatinga: 95, KRateda: 4, UnbalanceUV: 1.2, Level: 1,
  });
  assert.equal(p.timestamp, '2026-10-13T01:02:03.000Z');
  assert.equal(p.time, '08.02.03');
  assert.equal(p.trafoId, 1);
  assert.equal(p.phaseA, 230.1);
  assert.equal(p.lineAB, 398.5);
  assert.equal(p.currentA, 10);
  assert.equal(p.currentN, 0.5);
  assert.equal(p.avgCurrent, 10);
  assert.equal(p.powerActiveA, 2.3);
  assert.equal(p.powerActiveTotal, 6.9);
  assert.equal(p.powerReactiveTotal, -0.5);
  assert.equal(p.powerApparentTotal, 7);
  assert.equal(p.pfTotal, 0.98);
  assert.equal(p.frequency, 50);
  assert.equal(p.energyActiveTotal, 123.4);
  assert.equal(p.oil_temperature, 55);
  assert.equal(p.oil_pressure, 0.41);
  assert.equal(p.wtiA, 60);
  assert.equal(p.busTempB, 45);
  assert.equal(p.thdVA, 2.5);
  assert.equal(p.thdIC, 4.1);
  assert.equal(p.h2ppm, 12);
  assert.equal(p.moisturePpm, 8);
  assert.equal(p.deRatingA, 95);
  assert.equal(p.kRatedA, 4);
  assert.equal(p.unbalanceUV, 1.2);
  assert.equal(p.oilLevelRaw, 1);
});

test('mapRow mengubah string angka dari MySQL menjadi number', () => {
  const p = rm.mapRow({ timestamp: new Date(), Van: '229.90', Psig: '1500' });
  assert.equal(p.phaseA, 229.9);
  assert.equal(p.powerActiveTotal, 1.5);
});

test('mapRow mengisi 0 untuk NULL dan kolom yang tidak ada', () => {
  const p = rm.mapRow({ timestamp: new Date(), Van: null });
  assert.equal(p.phaseA, 0);
  assert.equal(p.phaseB, 0);
  assert.equal(p.h2ppm, 0);
});

test('buildSelect membuat daftar kolom, dengan AVG saat agregasi', () => {
  assert.equal(rm.buildSelect(['phaseA', 'oil_temperature']), '`Van`, `OilTemp`');
  assert.equal(rm.buildSelect(['phaseA'], { aggregate: true }), 'ROUND(AVG(`Van`),2) AS `Van`');
  assert.throws(() => rm.buildSelect(['tidakAda']), /Tidak ada metric valid/);
});

test('computeEfficiency rumus kuadrat dengan konstanta transformer_data', () => {
  // ratio 0.5 -> loadLoss 300 -> (1 - 450/100450)*100 = 99.55
  const eff = rm.computeEfficiency({ avgCurrent: 72 }, TD);
  assert.equal(eff, 99.55);
});

test('computeEfficiency memakai rata-rata tiga fase kalau avgCurrent tidak ada', () => {
  const eff = rm.computeEfficiency({ currentA: 72, currentB: 72, currentC: 72 }, TD);
  assert.equal(eff, 99.55);
});

test('computeEfficiency null kalau konstanta nameplate kosong', () => {
  assert.equal(rm.computeEfficiency({ avgCurrent: 72 }, {}), null);
  assert.equal(rm.computeEfficiency({ avgCurrent: 72 }, { ...TD, ratedCurrentLowVoltage: 0 }), null);
  assert.equal(rm.computeEfficiency({ avgCurrent: 72 }, null), null);
});

test('leadLag dari tanda daya reaktif', () => {
  assert.equal(rm.leadLag(0.3), 'leading');
  assert.equal(rm.leadLag(-0.3), 'lagging');
  assert.equal(rm.leadLag(0), 'unity');
});

test('computeDerating per fase dalam kVA', () => {
  const d = rm.computeDerating({ deRatingA: 90, powerApparentA: 15, kRatedA: 4 }, { ratedPower: 100 });
  assert.equal(d.a.full, 33.33);
  assert.equal(d.a.available, 30);
  assert.equal(d.a.lost, 3.33);
  assert.equal(d.a.used, 15);
  assert.equal(d.a.kRated, 4);
  assert.equal(rm.computeDerating({}, {}), null);
});

test('getLatest memakai temp_reading_data_realtime dan trafoId', async () => {
  const db = makeFakeDb(() => [{ timestamp: new Date(), Van: 1 }]);
  const p = await rm.getLatest(db, 7);
  assert.equal(p.phaseA, 1);
  assert.match(db.calls[0].sql, /FROM temp_reading_data_realtime WHERE trafoId = \? ORDER BY timestamp DESC/);
  assert.deepEqual(db.calls[0].params, [7]);
});

test('getLatest null kalau kosong', async () => {
  const db = makeFakeDb(() => []);
  assert.equal(await rm.getLatest(db, 1), null);
});

test('getRealtimeSeries membatasi limit dan mengurutkan naik', async () => {
  const db = makeFakeDb(() => []);
  await rm.getRealtimeSeries(db, 1, 9999);
  assert.match(db.calls[0].sql, /LIMIT 500\) sub ORDER BY timestamp ASC/);
});

test('getHistory tanpa interval membaca reading_data mentah', async () => {
  const db = makeFakeDb(() => []);
  await rm.getHistory(db, 1, '2026-10-01', '2026-10-02', 0, ['phaseA']);
  assert.match(db.calls[0].sql, /SELECT timestamp, `Van` FROM reading_data WHERE trafoId = \? AND timestamp >= \? AND timestamp <= \? ORDER BY timestamp ASC LIMIT 5000/);
  assert.deepEqual(db.calls[0].params, [1, '2026-10-01', '2026-10-02']);
});

test('getHistory dengan interval melakukan GROUP BY per interval', async () => {
  const db = makeFakeDb(() => []);
  await rm.getHistory(db, 1, '2026-10-01', '2026-10-02', 300, ['phaseA']);
  assert.match(db.calls[0].sql, /FROM_UNIXTIME\(UNIX_TIMESTAMP\(MIN\(timestamp\)\) DIV 300 \* 300\) AS timestamp, ROUND\(AVG\(`Van`\),2\) AS `Van`/);
  assert.match(db.calls[0].sql, /GROUP BY UNIX_TIMESTAMP\(timestamp\) DIV 300/);
});

test('computeDerived menggabungkan semuanya', () => {
  const p = rm.computeDerived(
    rm.mapRow({ timestamp: new Date(), Iavg: 72, Qa: 100, Qb: -100, Qc: 0, Sa: 15000, deRatinga: 90, KRateda: 4 }),
    TD
  );
  assert.equal(p.efficiency, 99.55);
  assert.deepEqual(p.leadLag, { a: 'leading', b: 'lagging', c: 'unity' });
  assert.equal(p.derating.a.used, 15);
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm test`
Expected: FAIL dengan `Cannot find module '../utils/readingModel'`.

- [ ] **Step 3: Tulis `backend/utils/readingModel.js`**

```js
// Satu-satunya tempat yang tahu nama kolom tabel reading di base_tmu.
// Kiri: kolom di temp_reading_data_realtime / reading_data. Kanan: key yang dipakai frontend.
const COLUMN_MAP = {
  Van: 'phaseA', Vbn: 'phaseB', Vcn: 'phaseC',
  Vab: 'lineAB', Vbc: 'lineBC', Vca: 'lineCA',
  Ia: 'currentA', Ib: 'currentB', Ic: 'currentC', Ineutral: 'currentN', Iavg: 'avgCurrent',
  Pa: 'powerActiveA', Pb: 'powerActiveB', Pc: 'powerActiveC', Psig: 'powerActiveTotal',
  Qa: 'powerReactiveA', Qb: 'powerReactiveB', Qc: 'powerReactiveC', Qsig: 'powerReactiveTotal',
  Sa: 'powerApparentA', Sb: 'powerApparentB', Sc: 'powerApparentC', Ssig: 'powerApparentTotal',
  PFa: 'pfA', PFb: 'pfB', PFc: 'pfC', PFsig: 'pfTotal',
  Freq: 'frequency',
  kWh: 'energyActiveTotal', kVARh: 'energyReactiveTotal',
  OilTemp: 'oil_temperature', Press: 'oil_pressure',
  WTITemp1: 'wtiA', WTITemp2: 'wtiB', WTITemp3: 'wtiC',
  BusTemp1: 'busTempA', BusTemp2: 'busTempB', BusTemp3: 'busTempC',
  THDV1: 'thdVA', THDV2: 'thdVB', THDV3: 'thdVC',
  THDI1: 'thdIA', THDI2: 'thdIB', THDI3: 'thdIC',
  H2ppm: 'h2ppm', Moistureppm: 'moisturePpm',
  deRatinga: 'deRatingA', deRatingb: 'deRatingB', deRatingc: 'deRatingC',
  KRateda: 'kRatedA', KRatedb: 'kRatedB', KRatedc: 'kRatedC',
  UnbalanceUV: 'unbalanceUV', UnbalanceVW: 'unbalanceVW', UnbalanceUW: 'unbalanceUW',
  Level: 'oilLevelRaw',
};

// Kolom ini disimpan dalam Watt/VAR/VA; frontend memakai kW/kVAR/kVA.
const WATT_COLUMNS = new Set(['Pa', 'Pb', 'Pc', 'Psig', 'Qa', 'Qb', 'Qc', 'Qsig', 'Sa', 'Sb', 'Sc', 'Ssig']);

const KEY_TO_COLUMN = Object.fromEntries(Object.entries(COLUMN_MAP).map(([col, key]) => [key, col]));
const ALL_KEYS = Object.values(COLUMN_MAP);

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function mapRow(row) {
  const date = row.timestamp ? new Date(row.timestamp) : new Date();
  const point = {
    timestamp: date.toISOString(),
    time: date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }),
    trafoId: row.trafoId ?? null,
  };
  for (const [col, key] of Object.entries(COLUMN_MAP)) {
    let n = toNumber(row[col]);
    if (n === null) n = 0;
    else if (WATT_COLUMNS.has(col)) n = n / 1000;
    point[key] = n;
  }
  return point;
}

function buildSelect(keys, { aggregate = false } = {}) {
  const cols = keys.map(k => KEY_TO_COLUMN[k]).filter(Boolean);
  if (cols.length === 0) throw new Error('Tidak ada metric valid');
  return cols
    .map(c => (aggregate ? `ROUND(AVG(\`${c}\`),2) AS \`${c}\`` : `\`${c}\``))
    .join(', ');
}

// ---------- query ----------

async function getLatest(db, trafoId) {
  const [rows] = await db.execute(
    'SELECT * FROM temp_reading_data_realtime WHERE trafoId = ? ORDER BY timestamp DESC, data_id DESC LIMIT 1',
    [trafoId]
  );
  return rows.length ? mapRow(rows[0]) : null;
}

async function getRealtimeSeries(db, trafoId, limit = 60) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 60, 1), 500);
  const [rows] = await db.query(
    `SELECT * FROM (SELECT * FROM temp_reading_data_realtime WHERE trafoId = ? ORDER BY timestamp DESC LIMIT ${lim}) sub ORDER BY timestamp ASC`,
    [trafoId]
  );
  return rows.map(mapRow);
}

async function getHistory(db, trafoId, start, end, intervalSec = 0, keys = ALL_KEYS) {
  const intv = parseInt(intervalSec, 10) || 0;
  let sql;
  if (intv > 0) {
    sql = `SELECT FROM_UNIXTIME(UNIX_TIMESTAMP(MIN(timestamp)) DIV ${intv} * ${intv}) AS timestamp, ${buildSelect(keys, { aggregate: true })}
      FROM reading_data WHERE trafoId = ? AND timestamp >= ? AND timestamp <= ?
      GROUP BY UNIX_TIMESTAMP(timestamp) DIV ${intv} ORDER BY timestamp ASC LIMIT 5000`;
  } else {
    sql = `SELECT timestamp, ${buildSelect(keys)} FROM reading_data WHERE trafoId = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC LIMIT 5000`;
  }
  const [rows] = await db.query(sql, [trafoId, start, end]);
  return rows.map(mapRow);
}

// ---------- turunan ----------

function computeEfficiency(point, td) {
  const rated = toNumber(td && td.ratedCurrentLowVoltage);
  const fullLoadLoss = toNumber(td && td.fullLoadLoss);
  const noLoadLoss = toNumber(td && td.noLoadLoss);
  const ratedPower = toNumber(td && td.ratedPower);
  if (!rated || fullLoadLoss === null || noLoadLoss === null || !ratedPower) return null;

  const iavg = toNumber(point.avgCurrent) || (((point.currentA || 0) + (point.currentB || 0) + (point.currentC || 0)) / 3);
  const ratio = iavg / rated;
  const loadLoss = ratio * ratio * fullLoadLoss;
  const inputPower = ratedPower * 1000 + noLoadLoss + loadLoss;
  const eff = (1 - (noLoadLoss + loadLoss) / inputPower) * 100;
  return Number.isFinite(eff) ? round2(eff) : null;
}

function leadLag(q) {
  if (q > 0) return 'leading';
  if (q < 0) return 'lagging';
  return 'unity';
}

function computeDerating(point, td) {
  const ratedPower = toNumber(td && td.ratedPower);
  if (!ratedPower) return null;
  const full = ratedPower / 3;
  const phase = (deRating, apparentKva, kRated) => {
    const available = ((toNumber(deRating) ?? 100) / 100) * full;
    return {
      kRated: toNumber(kRated),
      full: round2(full),
      available: round2(available),
      lost: round2(full - available),
      used: round2(toNumber(apparentKva) || 0),
    };
  };
  return {
    a: phase(point.deRatingA, point.powerApparentA, point.kRatedA),
    b: phase(point.deRatingB, point.powerApparentB, point.kRatedB),
    c: phase(point.deRatingC, point.powerApparentC, point.kRatedC),
  };
}

function computeDerived(point, td) {
  return {
    ...point,
    efficiency: computeEfficiency(point, td),
    leadLag: {
      a: leadLag(point.powerReactiveA),
      b: leadLag(point.powerReactiveB),
      c: leadLag(point.powerReactiveC),
    },
    derating: computeDerating(point, td),
  };
}

module.exports = {
  COLUMN_MAP, KEY_TO_COLUMN, ALL_KEYS, WATT_COLUMNS,
  mapRow, buildSelect,
  getLatest, getRealtimeSeries, getHistory,
  computeEfficiency, leadLag, computeDerating, computeDerived,
};
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npm test`
Expected: semua PASS. Kalau test `time` gagal karena format lokal (`08.02.03` vs `08:02:03`), ubah assert di test menjadi `assert.match(p.time, /^08.02.03$/)`; format pemisah tergantung data ICU Node, bukan kode kita.

- [ ] **Step 5: Commit**

```bash
git add backend/utils/readingModel.js backend/tests/readingModel.test.js
git commit -m "feat(backend): readingModel memetakan kolom base_tmu ke key frontend"
```

---

### Task 5: Data contoh `seed_demo.js`

**Files:**
- Create: `backend/scripts/seed_demo.js`

**Interfaces:**
- Consumes: `getDbConfig`, `getMasterDbName` dari Task 1.
- Produces: database `db_demo` berisi trafo 1 lengkap, 60 baris `temp_reading_data_realtime`, 1440 baris `reading_data`; `master_tmu_app` berisi perusahaan `db_demo`, user `demo`/`demo123` (superuser), dan rekomendasi contoh. Rencana B memverifikasi route dengan data ini.

- [ ] **Step 1: Tulis `backend/scripts/seed_demo.js`**

```js
// Pemakaian: node scripts/seed_demo.js [namaDbPerusahaan]   (default: db_demo)
require('dotenv').config();
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { getDbConfig, getMasterDbName } = require('../utils/db');

const DB = process.argv[2] || 'db_demo';
const TRAFO_ID = 1;

function rand(min, max, dec = 2) {
  const v = min + Math.random() * (max - min);
  return Number(v.toFixed(dec));
}

// Satu baris reading realistis untuk trafo 100 kVA, 400 V, 50 Hz.
function makeReading(ts) {
  const van = rand(225, 235), vbn = rand(225, 235), vcn = rand(225, 235);
  const ia = rand(60, 90), ib = rand(60, 90), ic = rand(60, 90);
  const pf = rand(0.85, 0.99);
  const sa = van * ia, sb = vbn * ib, sc = vcn * ic;
  const pa = sa * pf, pb = sb * pf, pc = sc * pf;
  const qa = Math.sqrt(sa * sa - pa * pa), qb = Math.sqrt(sb * sb - pb * pb), qc = Math.sqrt(sc * sc - pc * pc);
  return {
    trafoId: TRAFO_ID, timestamp: ts,
    Van: van, Vbn: vbn, Vcn: vcn,
    Vab: rand(395, 405), Vbc: rand(395, 405), Vca: rand(395, 405),
    Ia: ia, Ib: ib, Ic: ic, Iavg: Number(((ia + ib + ic) / 3).toFixed(2)), Ineutral: rand(0, 5),
    THDV1: rand(1, 4), THDV2: rand(1, 4), THDV3: rand(1, 4),
    THDI1: rand(3, 9), THDI2: rand(3, 9), THDI3: rand(3, 9),
    Pa: pa, Pb: pb, Pc: pc, Psig: pa + pb + pc,
    Qa: qa, Qb: -qb, Qc: qc, Qsig: qa - qb + qc,
    Sa: sa, Sb: sb, Sc: sc, Ssig: sa + sb + sc,
    PFa: pf, PFb: pf, PFc: pf, PFsig: pf,
    Freq: rand(49.9, 50.1, 3),
    kWh: 12345 + Math.floor(ts.getTime() / 3600000) % 1000, kVARh: 2345,
    BusTemp1: rand(40, 50), BusTemp2: rand(40, 50), BusTemp3: rand(40, 50),
    OilTemp: rand(50, 60), WTITemp1: rand(55, 65), WTITemp2: rand(55, 65), WTITemp3: rand(55, 65),
    Press: rand(0.38, 0.45), Level: 1,
    KRateda: 4, deRatinga: rand(88, 96), KRatedb: 4, deRatingb: rand(88, 96), KRatedc: 4, deRatingc: rand(88, 96),
    H2ppm: Math.floor(rand(5, 20, 0)), Moistureppm: Math.floor(rand(5, 15, 0)),
    UnbalanceUV: rand(0, 2), UnbalanceVW: rand(0, 2), UnbalanceUW: rand(0, 2),
  };
}

async function insertRows(conn, table, rows) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const values = rows.map(r => cols.map(c => r[c]));
  await conn.query(`INSERT INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(',')}) VALUES ?`, [values]);
}

async function seedCompany(conn) {
  await conn.query(`INSERT INTO transformer_data
    (trafoId, raspiSerialNo, trafoSerialNo, ratedPower, ratedHighVoltage, ratedLowVoltage, ratedCurrentHighVoltage, ratedCurrentLowVoltage,
     frequency, vectorGroup, phase, tapType, impedance, noLoadLoss, fullLoadLoss, status, SuddenPressure, latitude, longitude, version, productionStatus)
    VALUES (?, 'DEMO-RASPI-001', 'TRF-DEMO-001', 100, 20, 400, 2.89, 144, 50, 'Dyn5', 3, 'OCTC', 4, 150, 1200, 1, 0, -7.2575, 112.7521, 2, 1)
    ON DUPLICATE KEY UPDATE raspiSerialNo = VALUES(raspiSerialNo), ratedPower = VALUES(ratedPower)`, [TRAFO_ID]);

  await conn.query(`INSERT INTO transformer_settings
    (trafoId, voltageLowTripTreshold, voltageLowTripValue, voltageLowAlarmTreshold, voltageLowAlarmValue,
     voltageHighTripTreshold, voltageHighTripValue, voltageHighAlarmTreshold, voltageHighAlarmValue,
     voltageUnbalanceHighAlarmTreshold, voltageUnbalanceHighTripTreshold,
     frequencyLowTripTreshold, frequencyLowAlarmTreshold, frequencyHighTripTreshold, frequencyHighAlarmTreshold,
     topOilHighAlarmTreshold, topOilHighTripTreshold, windTempHighAlarmTreshold, windTempHighTripTreshold,
     powerFactorLowAlarmTreshold, powerFactorLowTripTreshold, currentHighAlarmTreshold, currentHighTripTreshold,
     tankPressureHighTripTreshold, tankPressureHighAlarmTreshold, busTempHighAlarmTreshold, busTempHighTripTreshold,
     thdCurrentAlarmTreshold, thdCurrentTripTreshold, thdVoltageAlarmTreshold, thdVoltageTripTreshold,
     IneutralHighAlarmTreshold, IneutralHighTripTreshold, H2ppmHighAlarmTreshold, H2ppmHighTripTreshold,
     MoistureppmHighAlarmTreshold, MoistureppmHighTripTreshold)
    VALUES (?, 10, 360, 5, 380, 10, 440, 5, 420, 3, 5, 5, 2, 5, 2, 70, 85, 80, 95, 0.85, 0.8, 100, 120, 0.6, 0.5, 70, 85, 10, 15, 5, 8, 20, 30, 50, 100, 20, 30)
    ON DUPLICATE KEY UPDATE trafoId = trafoId`, [TRAFO_ID]);

  await conn.query(`INSERT INTO trip_settings (trafoId, voltage, voltageUnbalance, frequency, topOilTemp, busTemp, powerFactor, current, pressure, oilLevel, WTITemp, THDCurrent, THDVoltage, Ineutral, H2ppm, Moistureppm)
    VALUES (?, 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1) ON DUPLICATE KEY UPDATE trafoId = trafoId`, [TRAFO_ID]);

  const statusCols = ['Vab','Vbc','Vca','Current1','Current2','Current3','Ineutral','THDVoltage1','THDVoltage2','THDVoltage3',
    'THDCurrent1','THDCurrent2','THDCurrent3','PF','Freq','BusTemp1','BusTemp2','BusTemp3','OilTemp','WTITemp1','WTITemp2','WTITemp3',
    'Pressure','OilLevel','H2ppm','Moistureppm','Uab','Ubc','Uca'];
  const colList = statusCols.map(c => `\`${c}\``).join(',');
  await conn.query(`INSERT INTO transformer_status (trafoId, ${colList}) VALUES (?, ${statusCols.map(() => '3').join(',')}) ON DUPLICATE KEY UPDATE trafoId = trafoId`, [TRAFO_ID]);
  await conn.query(`INSERT INTO trip_status (trafoId, ${colList}) VALUES (?, ${statusCols.map(() => '0').join(',')}) ON DUPLICATE KEY UPDATE trafoId = trafoId`, [TRAFO_ID]);

  await conn.query('DELETE FROM temp_reading_data_realtime WHERE trafoId = ?', [TRAFO_ID]);
  await conn.query('DELETE FROM reading_data WHERE trafoId = ?', [TRAFO_ID]);

  const now = Date.now();
  const temp = [];
  for (let i = 59; i >= 0; i--) temp.push(makeReading(new Date(now - i * 1000)));
  await insertRows(conn, 'temp_reading_data_realtime', temp);

  const hist = [];
  for (let i = 1440; i >= 1; i--) hist.push(makeReading(new Date(now - i * 60000)));
  for (let i = 0; i < hist.length; i += 200) await insertRows(conn, 'reading_data', hist.slice(i, i + 200));

  const harmonics = [1, 2, 3].map(phase => {
    const row = { trafoId: TRAFO_ID, Phase: phase, '1st': 100 };
    for (const o of ['3rd','5th','7th','9th','11th','13th','15th','17th','19th','21th','23th','25th','27th','29th','31th']) row[o] = rand(0.2, 6);
    return row;
  });
  await conn.query('DELETE FROM temp_voltage_harmonic WHERE trafoId = ?', [TRAFO_ID]);
  await conn.query('DELETE FROM temp_current_harmonic WHERE trafoId = ?', [TRAFO_ID]);
  await insertRows(conn, 'temp_voltage_harmonic', harmonics);
  await insertRows(conn, 'temp_current_harmonic', harmonics);

  await conn.query(`INSERT INTO failure_log (trafoId, failure_id, time_start, duration, failure_type, parameter, parameterValue)
    VALUES (?, 1001, DATE_SUB(NOW(), INTERVAL 3 DAY), 120, 'Gas Fault', 'OilLevel', '2'),
           (?, 1002, DATE_SUB(NOW(), INTERVAL 1 DAY), 30, 'High Alarm', 'OilTemp', '72.5')
    ON DUPLICATE KEY UPDATE failure_id = failure_id`, [TRAFO_ID, TRAFO_ID]);
}

async function seedMaster(conn) {
  await conn.query(`INSERT INTO company (company_name, database_name, company_key, status, tmu_version)
    VALUES ('PT Demo', ?, 'demo-company-key-0001', 1, 2)
    ON DUPLICATE KEY UPDATE company_name = VALUES(company_name)`, [DB]);
  const [[company]] = await conn.query('SELECT company_id FROM company WHERE database_name = ?', [DB]);

  const salt = 'ab12c';
  const password = crypto.createHash('sha256').update('demo123' + salt).digest('hex');
  const [exists] = await conn.query('SELECT user_id FROM user WHERE username = ?', ['demo']);
  if (exists.length === 0) {
    await conn.query('INSERT INTO user (username, password, role, salt, company_id, status, email, phone) VALUES (?, ?, 1, ?, ?, 9, NULL, NULL)',
      ['demo', password, salt, company.company_id]);
  }

  const recs = [
    ['OilTemp', 'Periksa sistem pendingin dan kipas radiator.'],
    ['OilTemp', 'Kurangi beban trafo sementara.'],
    ['WTITemp', 'Periksa beban per fase, kemungkinan beban tidak seimbang.'],
    ['BusTemp', 'Periksa kekencangan sambungan busbar.'],
    ['Vab', 'Periksa tegangan sisi sumber dan posisi tap changer.'],
    ['Current', 'Periksa beban berlebih pada fase terkait.'],
    ['PF', 'Periksa kapasitor bank dan beban induktif.'],
    ['Freq', 'Periksa kestabilan sumber atau genset.'],
    ['Pressure', 'Periksa relief valve dan kemungkinan gas internal.'],
    ['OilLevel', 'Periksa kebocoran dan tambah minyak bila perlu.'],
    ['H2ppm', 'Lakukan DGA, indikasi partial discharge atau overheating.'],
    ['Moistureppm', 'Lakukan filtrasi minyak atau penggantian silica gel.'],
    ['THDCurrent', 'Periksa beban non-linear dan pertimbangkan filter harmonik.'],
    ['THDVoltage', 'Periksa kualitas tegangan sumber.'],
    ['Ineutral', 'Periksa keseimbangan beban satu fasa.'],
  ];
  const [cnt] = await conn.query('SELECT COUNT(*) AS n FROM parameter_failure_recommendation');
  if (cnt[0].n === 0) {
    await conn.query('INSERT INTO parameter_failure_recommendation (parameter, recommendation) VALUES ?', [recs]);
  }
}

async function main() {
  const master = await mysql.createConnection(getDbConfig(getMasterDbName()));
  const company = await mysql.createConnection(getDbConfig(DB));
  try {
    await seedMaster(master);
    await seedCompany(company);
    console.log(`Seed selesai: ${getMasterDbName()} + ${DB}. Login: demo / demo123`);
  } finally {
    await master.end();
    await company.end();
  }
}

main().catch(err => { console.error('Seed gagal:', err.message); process.exit(1); });
```

- [ ] **Step 2: Jalankan seed**

Run: `node scripts/seed_demo.js`
Expected: `Seed selesai: master_tmu_app + db_demo. Login: demo / demo123`.

Script aman dijalankan berulang: `company` punya UNIQUE `company_key` dan seed memakai key yang sama dengan Task 3 Step 7 (`demo-company-key-0001`), jadi barisnya diperbarui, bukan digandakan. Tabel reading dihapus dulu per `trafoId` lalu diisi ulang.

- [ ] **Step 3: Verifikasi dengan readingModel sungguhan**

```bash
node -e "require('dotenv').config();const {getDbConnection}=require('./utils/db');const rm=require('./utils/readingModel');(async()=>{const db=await getDbConnection('db_demo');const [[td]]=await db.query('SELECT * FROM transformer_data WHERE trafoId=1');const p=rm.computeDerived(await rm.getLatest(db,1),td);console.log('latest phaseA',p.phaseA,'kW',p.powerActiveTotal,'eff',p.efficiency,'derating.a',p.derating.a);const h=await rm.getHistory(db,1,new Date(Date.now()-3600e3),new Date(),300,['phaseA','oil_temperature']);console.log('history 1 jam @5 menit:',h.length,'baris');process.exit(0);})()"
```

Expected: `latest phaseA 2xx kW ~1x eff 99.xx`, objek derating fase a, dan `history 1 jam @5 menit: 12 baris` (bisa 12 atau 13).

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/seed_demo.js
git commit -m "feat(backend): seed data demo untuk db_demo dan master_tmu_app"
```

---

## Selesai Rencana A

Setelah Task 5, backend punya: koneksi master lewat `MASTER_DB`, dua database lokal dari dump, patch skema otomatis, `readingModel.js` teruji, dan data contoh. Server masih memakai route lama (`electrical_readings`) sampai Rencana B; itu normal, dashboard belum berfungsi dengan `db_demo` sampai Rencana B selesai.
