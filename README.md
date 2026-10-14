# TMU Web App (Bambang Djaja) — Panduan Serah Terima

Aplikasi monitoring trafo (Transformer Monitoring Unit). Backend Node/Express + MySQL,
frontend React/Vite. Sejak 13 Oktober 2026 backend sedang dipindahkan ke skema database
legacy TMU v2 (`base_tmu.sql` untuk DB perusahaan, `master_tmu_app.sql` untuk DB master).
Dokumen ini menjelaskan cara menjalankan proyek di laptop baru dan **sampai mana pekerjaan
sudah selesai** supaya bisa dilanjutkan.

---

## 1. Struktur repo

| Path | Isi |
|---|---|
| `backend/` | Express 5, mysql2/promise, Socket.IO, JWT. Jalankan dari folder ini. |
| `backend/routes/` | Route HTTP (`auth`, `users`, `trafo`, `settings`, `trends`, `analytics`, ...) |
| `backend/utils/` | Modul inti: `db.js`, `readingModel.js`, `trafoModel.js`, `statusModel.js`, `limitsModel.js`, `trendsHelpers.js`, `schemaPatch.js`, `realtimePoller.js` |
| `backend/scripts/` | CLI: `import_sql.js`, `seed_demo.js`, `add_company.js`, `check_schema.js` |
| `backend/tests/` | Unit test `node:test`, tidak butuh MySQL (pakai `tests/helpers/fakeDb.js`) |
| `frontend/` | React + Vite + Tailwind. Belum disesuaikan ke skema baru (Rencana D). |
| `base_tmu.sql` | Dump skema DB perusahaan legacy (satu DB per perusahaan) |
| `master_tmu_app.sql` | Dump DB master legacy: `company`, `user`, `parameter_failure_recommendation` (91 baris rekomendasi nyata) |
| `dashboard-documentation.md` | Dokumentasi dashboard TMU v2 lama (acuan rumus dan panel) |
| `docs/superpowers/specs/2026-10-13-tmu-legacy-schema-design.md` | **Spec desain**, sumber kebenaran untuk semua keputusan |
| `docs/superpowers/plans/2026-10-13-plan-a-fondasi-backend.md` | Rencana A (selesai) |
| `docs/superpowers/plans/2026-10-13-plan-b-auth-route-poller.md` | Rencana B (sedang dikerjakan), berisi kode lengkap tiap langkah |

Baca urutannya: README ini → spec bagian 1–3 dan 10 → Rencana B dari Task 5.

---

## 2. Prasyarat

- Node.js 22 (dipakai v22.14.0)
- MySQL **5.7.44** (dipakai Laragon). Hindari sintaks MariaDB atau MySQL 8.
  MySQL harus dinyalakan manual; kalau mati, backend gagal dengan `AggregateError` kosong.
- npm

---

## 3. Setup pertama kali

### 3.1 Install dependency

```powershell
cd backend
npm install
cd ../frontend
npm install
```

### 3.2 File `backend/.env`

Salin `backend/.env.example` ke `backend/.env`. Yang wajib untuk pengembangan lokal:

```
HOST=localhost
PORT=3306
USER=root
PASSWORD=
MASTER_DB=master_tmu_app
JWT_SECRET=isi_bebas_yang_panjang
```

`PORT` di sini adalah port MySQL. Port HTTP backend default 5000 (atau `SERVER_PORT`).
Key lain (`SMTP_*`, `FONNTE_TOKEN`, `GEMINI_API_KEY`, `CLOUDINARY_*`, `IRIV_*`) hanya
dibutuhkan fitur email/WhatsApp/AI/foto; boleh dibiarkan placeholder.
`.env` tidak di-commit; minta nilai aslinya ke pemilik sebelumnya kalau perlu.

### 3.3 Buat database

Semua perintah dijalankan dari folder `backend/`:

```powershell
node scripts/import_sql.js ../master_tmu_app.sql master_tmu_app
node scripts/import_sql.js ../base_tmu.sql db_demo
node scripts/seed_demo.js
```

`seed_demo.js` mengisi perusahaan demo (company_id 92, database `db_demo`), user
**demo / demo123** (status 9 = superuser), satu trafo (trafoId 1) beserta
`transformer_data`, `transformer_settings`, `trip_settings`, data realtime dan historis.

Perusahaan tambahan: `node scripts/add_company.js "<Nama>" <namaDatabase>`.
Cek skema: `node scripts/check_schema.js`.

### 3.4 Jalankan

```powershell
# terminal 1
cd backend
npm start          # atau npm run dev (nodemon)

# terminal 2
cd frontend
npm run dev
```

Saat start, backend memanggil `runSchemaPatch()` yang menambal kolom/index yang kurang
(mis. `user.email`, `user.phone`, tabel `user_layouts`). Server butuh beberapa detik
sebelum listen di port 5000.

Frontend membaca `VITE_PUBLIC_API_URL` (lihat `frontend/src/contexts/ApiContext.jsx`).
Untuk lokal buat `frontend/.env.local` berisi `VITE_PUBLIC_API_URL=http://localhost:5000`.

### 3.5 Test

```powershell
cd backend
npm test
```

Status saat serah terima: **46 lulus, 0 gagal**. Test tidak boleh butuh MySQL.

---

## 4. Konsep penting (ringkasan spec)

- **Dua jenis DB.** `master_tmu_app` (tabel `company`, `user`, `parameter_failure_recommendation`,
  `trafo_last_connection`, `user_activity_log`, plus `user_layouts` milik proyek ini) dan satu
  DB per perusahaan berskema `base_tmu` (`temp_reading_data_realtime`, `reading_data`,
  `transformer_data`, `transformer_settings`, `transformer_status`, `trip_settings`,
  `temp_*_harmonic`, `failure_log`).
- **Tidak ada fallback ke tabel lama** (`electrical_readings`, `oil_readings`,
  `threshold_settings`, `tmu_master`, `users`, `companies`). Kalau masih ada referensi, itu
  sisa yang harus dibersihkan (Rencana B Task 7).
- **`readingModel.js` satu-satunya tempat yang tahu nama kolom reading `base_tmu`.**
  Ia memetakan ke key frontend lama (`phaseA`, `currentA`, `oil_temperature`, `pfTotal`, ...).
  Kolom `transformer_settings`/`transformer_status`/`transformer_data` boleh di
  `limitsModel.js`, `statusModel.js`, `trafoModel.js`.
- **Peran** diturunkan dari `user.status`: 9 superuser, 1 admin, 2 user. JWT dan respons tetap
  memakai string `superuser` / `admin` / `user` karena frontend membandingkan string itu.
- **Password**: legacy `sha256(password + salt)`; bcrypt lama juga diterima saat login.
- **Header `X-DB-Name`** wajib di route perusahaan (`/api/trafo`, `/api/settings`, `/api/trends`,
  `/api/layouts`); isinya `database_name` perusahaan, misalnya `db_demo`.
- **Nilai user ke SQL selalu lewat `?`**; nama kolom dari body selalu lewat allowlist
  (`SETTINGS_COLUMNS`, `TRIP_COLUMNS`).
- Perbedaan skema asli vs dokumentasi (tabel temp tanpa `trafoId`, kolom harmonik `21th`/`23th`,
  dst.) tercatat di spec bagian 3. Percaya dump `.sql`, bukan dokumen.

---

## 5. Progres pekerjaan

### Rencana A — fondasi backend: **selesai** (13 Okt 2026)
`db.js` + `MASTER_DB`, `import_sql.js`, `schemaPatch.js`, `readingModel.js` + test, seed demo.

### Rencana B — auth, route, poller: **Task 1–4 selesai, Task 5 setengah jalan**

| Task | Isi | Status | Commit |
|---|---|---|---|
| 1 | Login ke `user JOIN company`, peran dari status, `userAuth.js`, `activityLog.js` | selesai, diuji live | `1fb57b5` |
| 2 | Route master: users, superuser_users, profile, admin, companies, layouts | selesai, diuji live | `4fa0884`, `4fa81c0` |
| 3 | Route trafo: daftar, nameplate, status, physical, harmonics, oil-quality (`trafoModel`, `statusModel`) | selesai, diuji live | `3a7195f`, `4fa81c0` |
| 4 | Settings: thresholds, trip, `/limits` untuk gauge, dorong ke Raspi (`limitsModel`) | selesai, diuji live 14 Okt | `4fa81c0`, `38fad9f` |
| 5 | Trends, analytics, export, report, THI, events, news | **Step 1–3 selesai** (test + `trendsHelpers.js`, 46 test lulus). **Sisa Step 4–7**: tulis ulang `routes/trends.js`, `routes/analytics.js`, uji manual, commit | belum |
| 6 | Poller Socket.IO baca `temp_reading_data_realtime`, `alertSender.js`, hapus `efficiency.js` | belum | |
| 7 | `scripts/smoke_api.js`, bersihkan referensi skema lama | belum | |

Kode lengkap untuk setiap step ada di file Rencana B. Centang `- [x]` di file plan
diperbarui per task yang selesai.

### Rencana C — ingest Raspberry Pi + alert: **belum dibuat plannya**
Spec bagian 5 dan 6.4. Protokol klien ada di repo lain (`../tmu/tmu-app-client-deploy/websocket.js`,
tidak ada di repo ini). Server lama tidak ada sumbernya; harus ditulis ulang dari protokol klien.
Alert memakai nama parameter dari `parameter_failure_recommendation` (BusTemp, WTITemp, OilTemp,
Vab/Vbc/Vca, Uab/Ubc/Uca).

### Rencana D — frontend: **belum dibuat plannya**
Spec bagian 8. Sampai Rencana D selesai, halaman Settings dan grafik tren di frontend memakai
data kosong. Itu normal, bukan bug.

---

## 6. Cara melanjutkan (Rencana B Task 5 Step 4)

1. Nyalakan MySQL, `cd backend`, `npm test` harus 46 lulus.
2. Buka `docs/superpowers/plans/2026-10-13-plan-b-auth-route-poller.md`, cari
   `### Task 5`, lanjut dari **Step 4: Tulis ulang `backend/routes/trends.js`**. Kode ada di plan;
   ia memakai `readingModel`, `trafoModel`, `statusModel`, `limitsModel.buildLimits`, dan
   `trendsHelpers` (`checkClosestData`, `oilPoint`, `evaluateMetric`, `healthScore`, `failureToEvent`).
3. Step 5: tulis ulang `routes/analytics.js` (katalog metric memakai key frontend).
4. Step 6: `npm test`, restart server, uji manual dengan snippet PowerShell di plan.
5. Step 7: commit dengan pesan yang tertulis di plan. Cek `git status` dulu; `git add` banyak file
   kadang hanya men-stage sebagian.
6. Lanjut Task 6 dan 7 dengan pola yang sama: test dulu (merah), implementasi (hijau), uji live, commit.

### Snippet uji manual (PowerShell)

```powershell
$r = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/login -ContentType "application/json" -Body '{"username":"demo","password":"demo123"}'
$h = @{ Authorization = "Bearer $($r.token)"; "X-DB-Name" = "db_demo" }
Invoke-RestMethod -Uri "http://localhost:5000/api/settings/limits?trafo_id=1" -Headers $h | ConvertTo-Json -Depth 3
Invoke-RestMethod -Uri "http://localhost:5000/api/trafo" -Headers $h | ConvertTo-Json -Depth 3
```

Endpoint login adalah `POST /api/login` (bukan `/api/auth/login`).

---

## 7. Jebakan yang sudah ditemukan

- MySQL Laragon tidak auto-start. Gejala: backend diam atau `AggregateError` tanpa pesan.
- Backend butuh 5–10 detik sebelum port 5000 terbuka karena `runSchemaPatch`.
- `master_tmu_app.sql` bukan hanya struktur: ada 91 baris `parameter_failure_recommendation`
  (SQLyog menulis `insert  into` huruf kecil). Jangan ditimpa.
- `company.AUTO_INCREMENT` mulai 92, jadi perusahaan demo punya `company_id` 92.
- `PUT /api/settings/thresholds/:id` saat Raspi offline tetap menyimpan dan membalas
  `pushed: false`. Itu perilaku yang diinginkan.
- Trafo tanpa baris `transformer_settings`/`transformer_status` harus menghasilkan
  `/limits` = `{}` dan status semua Normal, bukan 500.
- Unit test tidak boleh menyentuh MySQL. Pakai `tests/helpers/fakeDb.js`.
- Jangan tambah dependency npm baru tanpa alasan kuat.

---

## 8. Alur kerja yang dipakai sejauh ini

Pekerjaan dibuat dengan bantuan Claude Code memakai skill `superpowers` (spec → plan → eksekusi
per task dengan TDD). Plan ditulis cukup rinci sehingga bisa diikuti tanpa Claude: tiap step
punya kode dan hasil yang diharapkan (`Expected:`). Kalau memakai Claude Code lagi, perintah
yang cocok: "lanjutkan Rencana B Task 5 Step 4 dengan superpowers:executing-plans".
