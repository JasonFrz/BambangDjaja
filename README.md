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
Tanpa itu frontend menunjuk ke URL cloudflare lama dan tidak akan terhubung.

### 3.5 Test

```powershell
cd backend
npm test
```

Status saat serah terima: **76 lulus, 0 gagal**. Test tidak boleh butuh MySQL.

Uji integrasi dengan server hidup (dari `backend/`):

```powershell
node scripts/smoke_api.js     # login demo, panggil 24 endpoint GET, semua harus OK (data seed < 24 jam)
node scripts/ws_probe.js      # subscribe Socket.IO, tunggu 1 event meter + 1 oil_sensor
node scripts/fake_raspi.js    # simulator Raspberry Pi: mendaftar sebagai trafo baru di db_demo, kirim data
```

`fake_raspi.js` memakai `company_key` perusahaan `db_demo` dari DB master (atau argumen pertama),
serial `FAKE-RASPI-001`, dan setiap permintaan status ke-2 dari 3 mengubah `OilTemp` ke High Alarm
sehingga jalur alert ikut teruji (lihat log server `alert db_demo/trafo N`).

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

### Rencana B — auth, route, poller: **selesai** (14 Okt 2026)

| Task | Isi | Status | Commit |
|---|---|---|---|
| 1 | Login ke `user JOIN company`, peran dari status, `userAuth.js`, `activityLog.js` | selesai, diuji live | `1fb57b5` |
| 2 | Route master: users, superuser_users, profile, admin, companies, layouts | selesai, diuji live | `4fa0884`, `4fa81c0` |
| 3 | Route trafo: daftar, nameplate, status, physical, harmonics, oil-quality (`trafoModel`, `statusModel`) | selesai, diuji live | `3a7195f`, `4fa81c0` |
| 4 | Settings: thresholds, trip, `/limits` untuk gauge, dorong ke Raspi (`limitsModel`) | selesai, diuji live 14 Okt | `4fa81c0`, `38fad9f` |
| 5 | Trends, analytics, export, report, THI, events, news (`trendsHelpers`) | selesai, diuji live 14 Okt | `d76f1e3`, `88afa1e`, `ba1ad96` |
| 6 | Poller Socket.IO baca `temp_reading_data_realtime` (`buildPayloads`), `alertSender.js`, hapus `efficiency.js` | selesai, diuji `ws_probe.js` | `e02515d` |
| 7 | `scripts/smoke_api.js` (24 GET OK), `whatsappRoutes` ke tabel baru, referensi skema lama bersih | selesai | `d708d52` |

Kode lengkap untuk setiap step ada di file Rencana B. Centang `- [x]` di file plan
diperbarui per task yang selesai.

### Rencana C — ingest Raspberry Pi + alert: **selesai** (14 Okt 2026)
Plan: `docs/superpowers/plans/2026-10-14-plan-c-raspi-ingest-alert.md`. Server menerima protokol klien
Raspi (`../tmu/tmu-app-client-deploy/websocket.js`) di `/bd-iot-socket` (port utama dan 2083):
`utils/raspiWebSocket.js` (koneksi, scheduler permintaan, alert), `utils/raspiSync.js` (penulisan DB),
`utils/alertEngine.js` (diff status, cooldown 15 menit), `scripts/fake_raspi.js` (simulator).
Alert WhatsApp/email aktif kembali: dipicu saat `transformer_status` memburuk, dikirim lewat
`utils/alertSender.js` ke user perusahaan yang punya `phone`/`email`.

### Rencana D — frontend: **selesai** (14 Okt 2026)
Plan: `docs/superpowers/plans/2026-10-14-plan-d-frontend.md`. Isi: header `X-Trafo-Id` dari
`sessionStorage.selectedTrafoId` di interceptor axios/fetch (`main.jsx`), key metric baru
(`config/metrics.js`), context memakai respons backend langsung dan `/api/settings/limits`,
lima panel baru (`harmonic`, `derating`, `trafostatus`, `physicalstatus`, `oilquality`), empat
preset (`config/presets.js`: Electrical default, Physical, Status, Oil Quality; tidak bisa diedit,
pilihan disimpan di `localStorage.tmu_active_preset`), halaman Settings per grup
`transformer_settings` + trip enable, nameplate di Transformer Data dengan edit admin.

**Verifikasi yang dilakukan:** `npm run build`, `npx oxlint` (tidak ada peringatan baru), dan
`npm run check:render` (render headless lima panel baru dengan data berbentuk respons backend
nyata + konsistensi preset). **Uji di browser belum dilakukan** karena sesi pengerjaan tidak
punya akses browser. Langkah uji manual ada di plan D Task 6 Step 2; jalankan sekali sebelum
dipakai pengguna.

---

## 6. Cara melanjutkan

Rencana A–D selesai: backend memakai `master_tmu_app` dan skema `base_tmu`, Raspi terhubung
lewat protokol lama, frontend menampilkan semuanya untuk trafo yang dipilih.

1. **Rencana C selesai.** Untuk Raspi asli: isi `COMPANY_KEY` di Raspi dengan `company.company_key`
   perusahaan (lihat halaman admin perusahaan) dan `SERVER_DOMAIN` ke host server ini. Trafo akan
   muncul otomatis di daftar saat Raspi pertama kali terhubung.
2. **Rencana D selesai.** Yang tersisa adalah uji browser manual (plan D Task 6 Step 2) dan
   perbaikan yang muncul darinya.
3. Di luar cakupan yang disengaja (spec bagian 11): halaman `ManageTransformers.jsx` (tidak
   dirutekan), interval 1/5/10/15 menit, laporan instantaneous/performance dari Raspi, Telegram,
   migrasi password bcrypt ke sha256.
4. Sebelum tiap commit cek `git status`; `git add` banyak file kadang hanya men-stage sebagian.

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
- **Autentikasi Raspi** hanya `companyKey` (acak 32 hex, unik per perusahaan) dan `raspiSerialNo`
  yang dikirim perangkat, mengikuti protokol klien yang sudah terpasang. Siapa pun yang memegang
  `company_key` bisa mengirim data atas nama perusahaan itu; serial yang sedang aktif untuk
  perusahaan lain ditolak, dan dorongan setting dari web dicek ke perusahaan pemilik serial.
- **Heartbeat Raspi.** Server mengirim ping tiap 30 detik; tanpa pong koneksi diputus, dan koneksi
  tanpa `createConnection` dalam 30 detik ditutup. Registrasi yang gagal (DB perusahaan tidak ada)
  menutup socket supaya klien reconnect. Pesan `updateSync*FromClient` (perubahan dari UI lokal
  Raspi) ditulis ke DB server.
- **Timestamp dari Raspi.** String ISO ber-`Z` dipakai apa adanya; string polos `YYYY-MM-DD HH:mm:ss`
  (dari view `shrink_data_temp` di Raspi) dianggap waktu lokal Raspi dengan `RASPI_TZ_OFFSET`
  (default `+07:00`). Nama kolom dicocokkan tanpa peduli huruf besar-kecil (`TIMESTAMP`, `deRatingB`).
- **Header `X-Trafo-Id`.** Interceptor frontend mengirim trafo terpilih di setiap request; backend
  `trends`/`settings` membacanya saat `trafo_id` tidak ada di query. Ganti trafo memancarkan event
  `trafoChanged` yang membuat context (trend, oli, limits) dan panel mengambil ulang data.
- **Zona waktu.** Driver mysql2 memakai `timezone: "Z"` dan tiap koneksi pool menjalankan
  `SET time_zone = '+00:00'` (`utils/db.js`, juga `seed_demo.js`). Jadi `NOW()` di SQL dan
  `new Date()` di JS sama-sama UTC. Script baru yang membuka koneksi sendiri harus ikut
  men-set itu. Rencana C harus mengonversi timestamp kiriman Raspi (kemungkinan WIB) ke UTC.
- **Batas tegangan fasa.** Threshold di `transformer_settings` adalah tegangan line (400 V).
  `buildLimits` membagi √3 untuk `phaseA/B/C` (230 V). Spec 6.2 menulis keduanya sama; itu
  sudah diputuskan diubah pada 14 Okt karena THI menilai trafo sehat sebagai CRITICAL.
- **Hasil review akhir Rencana B (14 Okt).** Sudah diperbaiki: penjaga peran di rename/foto trafo
  dan uji WhatsApp, validasi angka di PUT settings, `oilFlags` kode 5. Masih ditunda (kecil):
  `details: error.message` bocor di banyak route; `/news` memakai kolom `OilTemp`/`PFsig` langsung
  (harus lewat `KEY_TO_COLUMN`); `SET time_zone` di `db.js` tanpa callback error; fallback
  `req.query.db_name` di `trends.js` sebaiknya dihapus; validasi numerik nameplate butuh daftar
  tipe per kolom. Spec perlu disesuaikan: bentuk `/limits` adalah `{ success, trafoId, limits }`,
  dan tabel `trafo` di DB perusahaan dibuat `schemaPatch`.
- Data seed lama di `failure_log` tidak ikut diperbarui saat `seed_demo.js` dijalankan ulang
  (`ON DUPLICATE KEY`), jadi event demo bisa bertanggal lama. DB baru tidak terdampak.
- Jangan tambah dependency npm baru tanpa alasan kuat.

---

## 8. Alur kerja yang dipakai sejauh ini

Pekerjaan dibuat dengan bantuan Claude Code memakai skill `superpowers` (spec → plan → eksekusi
per task dengan TDD). Plan ditulis cukup rinci sehingga bisa diikuti tanpa Claude: tiap step
punya kode dan hasil yang diharapkan (`Expected:`). Kalau memakai Claude Code lagi, perintah
yang cocok: "lanjutkan Rencana B Task 5 Step 4 dengan superpowers:executing-plans".
