# Panduan Developer TMU (Versi Santai)

Halo! Kalau kamu baru pertama kali membuka project ini dan belum tahu apa-apa, dokumen ini untuk kamu.
Kita akan jalan pelan-pelan: mulai dari "program ini sebenarnya buat apa", lalu cara menyalakannya
di laptop, sampai cara mengubah atau menambah fitur sendiri.

Tidak perlu dibaca sekaligus. Baca bagian 1 sampai 4 dulu, nyalakan programnya, lalu sisanya
dibaca sambil jalan saja.

> Dokumen ini ditulis 16 Oktober 2026. Kalau ada yang tidak cocok dengan kode,
> **percayai kodenya**, lalu perbaiki dokumen ini.

---

## Daftar isi

1. [Program ini buat apa?](#1-program-ini-buat-apa)
2. [Kamus kecil: istilah yang bakal sering kamu temui](#2-kamus-kecil)
3. [Isi lemari: peta folder](#3-isi-lemari-peta-folder)
4. [Menyalakan program di laptop kamu](#4-menyalakan-program-di-laptop-kamu)
5. [Dua jenis lemari arsip (database)](#5-dua-jenis-lemari-arsip-database)
6. [Siapa boleh apa (peran user)](#6-siapa-boleh-apa-peran-user)
7. [Perjalanan sebuah angka: dari trafo sampai layar](#7-perjalanan-sebuah-angka)
8. [Alarm dan notifikasi](#8-alarm-dan-notifikasi)
9. [Backend lebih dekat](#9-backend-lebih-dekat)
10. [Frontend lebih dekat](#10-frontend-lebih-dekat)
11. [Resep: cara mengubah dan menambah fitur](#11-resep-cara-mengubah-dan-menambah-fitur)
12. [Cek dulu sebelum commit](#12-cek-dulu-sebelum-commit)
13. [Jebakan yang sering bikin bingung](#13-jebakan-yang-sering-bikin-bingung)
14. [Pekerjaan rumah yang belum beres](#14-pekerjaan-rumah-yang-belum-beres)
15. [Mau baca lebih dalam?](#15-mau-baca-lebih-dalam)

---

## 1. Program ini buat apa?

### Ceritanya dulu

Pernah lihat kotak besar abu-abu di tiang listrik atau di pojok pabrik? Itu namanya **trafo**
(transformator). Gampangnya, trafo itu seperti **charger HP raksasa**: listrik dari PLN tegangannya
sangat tinggi, lalu trafo menurunkannya supaya bisa dipakai mesin-mesin di pabrik.

Trafo itu mahal dan penting. Kalau rusak, satu pabrik bisa berhenti kerja. Trafo juga bisa "sakit",
misalnya kepanasan, minyaknya berkurang, atau listriknya tidak seimbang. Makanya trafo perlu dijaga
terus, 24 jam.

Nah, program ini namanya **TMU (Transformer Monitoring Unit)**. Tugasnya **menjaga trafo dari jauh**:
mencatat kondisi trafo setiap saat, menampilkannya di layar, dan **berteriak** (kirim notifikasi)
kalau ada yang tidak beres.

### Para pemainnya

| Bagian | Ibaratnya | Tugasnya |
|---|---|---|
| **Trafo** | Charger HP raksasa | Yang dijaga |
| **Raspberry Pi** (sering disebut "Raspi") | Satpam yang duduk di samping trafo sambil bawa buku catatan | Membaca sensor trafo (suhu, tegangan, arus, dll.) lalu melapor ke kantor pusat |
| **Backend** (folder `backend/`) | Kantor pusat | Menerima laporan dari semua satpam, menyimpannya, dan menjawab pertanyaan dari layar |
| **Database** (MySQL) | Lemari arsip | Tempat semua catatan disimpan |
| **Frontend** (folder `frontend/`) | Layar TV di ruang kontrol | Menampilkan semuanya ke manusia dalam bentuk grafik, angka, dan tabel |
| **Notifikasi** (Telegram, WhatsApp, Email) | Kentongan atau telepon darurat | Memberi tahu orang kalau trafo dalam bahaya |

### Gambarnya

```
   DI LAPANGAN (pabrik)                 DI SERVER                         DI LAYAR

 ┌───────┐    ┌──────────────┐        ┌──────────────┐               ┌──────────────┐
 │ Trafo │───▶│ Raspberry Pi │◀──────▶│   BACKEND    │◀─────────────▶│   FRONTEND   │
 └───────┘    │  (satpam)    │  kabel │ (kantor      │  internet     │ (layar TV di │
   sensor     └──────────────┘ khusus │  pusat)      │               │  browser)    │
                               "Web-  └──────┬───────┘               └──────────────┘
                               Socket"       │                              ▲
                                             ▼                              │
                                      ┌──────────────┐                  manusia
                                      │   DATABASE   │                  melihat
                                      │ (lemari      │
                                      │  arsip)      │
                                      └──────────────┘
                                             │ kalau ada bahaya
                                             ▼
                                   Telegram / WhatsApp / Email
```

Satu perusahaan bisa punya banyak trafo, dan setiap trafo punya satu Raspi. Program ini juga
dipakai banyak perusahaan sekaligus, dan data setiap perusahaan disimpan terpisah (dijelaskan di
[bagian 5](#5-dua-jenis-lemari-arsip-database)).

---

## 2. Kamus kecil

Kamu tidak perlu menghafal ini. Kembali saja ke sini kalau ketemu kata yang aneh.

### Istilah listrik dan trafo

| Istilah | Artinya (versi gampang) |
|---|---|
| **kVA** (Rated Power) | Seberapa "kuat" trafo itu. Mirip watt di charger HP: makin besar, makin kuat. |
| **Vector Group** (misal `Dyn5`) | "Cara kabel di dalam trafo disambung". Cukup tahu ini salah satu data identitas trafo. |
| **Nameplate** | Pelat identitas di badan trafo: kapasitas, tegangan, nomor seri, dll. Di database ada di tabel `transformer_data`. |
| **Tegangan (V)** | "Dorongan" listrik. `Van`, `Vbn`, `Vcn` = tegangan tiap fase ke netral. `Vab`, `Vbc`, `Vca` = antar fase. |
| **Arus (A)** | "Banyaknya" listrik yang mengalir. `Ia`, `Ib`, `Ic` = arus tiap fase. |
| **Fase (A/B/C atau 1/2/3)** | Listrik pabrik punya 3 "jalur" yang jalan bersamaan. Itulah kenapa banyak data muncul tiga kali. |
| **P, Q, S** | Daya aktif (kW), daya reaktif (kVAR), dan daya semu (kVA). |
| **PF (Power Factor)** | Seberapa efisien listrik dipakai. Angkanya 0 sampai 1; makin dekat 1 makin bagus. |
| **Harmonik / THD** | "Noise" atau kotoran di gelombang listrik. Makin kecil makin bagus. |
| **Oil Temp / WTI** | Suhu minyak trafo dan suhu gulungan kawat di dalamnya. Trafo diisi minyak untuk mendinginkannya. |
| **Tap / OCTC** | Tuas pengatur tegangan di trafo. |
| **De-rating / K-Factor** | Seberapa banyak kemampuan trafo "hilang" karena listriknya kotor. |
| **Threshold** | Batas aman. Contoh: "suhu minyak tidak boleh lewat 90°C". |
| **Alarm** | Peringatan kuning: "Hati-hati, sudah mulai tidak normal." |
| **Trip** | Peringatan merah: pengaman **memutus listrik**, persis seperti MCB di rumah yang "jeglek" kalau korsleting. |

### Istilah pemrograman

| Istilah | Artinya (versi gampang) |
|---|---|
| **API / endpoint** | "Loket" di kantor pusat. Frontend tidak boleh membuka lemari arsip sendiri; dia harus minta ke loket. Contoh: `GET /api/trafo` artinya "tolong berikan daftar trafo". |
| **GET / POST / PUT / DELETE** | Jenis permintaan di loket: GET = minta lihat, POST = buat baru, PUT = ubah, DELETE = hapus. |
| **Token (JWT)** | Gelang tiket konser. Setelah login kamu dapat gelang yang berlaku 24 jam, dan gelang itu ditunjukkan setiap datang ke loket. |
| **WebSocket** | Sambungan telepon yang dibiarkan terus menyala, jadi kedua pihak bisa saling bicara kapan saja tanpa menelepon ulang. |
| **Socket.IO** | WebSocket versi "lebih nyaman". Dipakai antara backend dan browser. (Raspi memakai WebSocket biasa.) |
| **Room** | Grup chat di Socket.IO. Semua browser yang membuka trafo yang sama masuk ke room yang sama. |
| **Polling** | Bertanya berulang-ulang: "Sudah ada data baru belum?" setiap beberapa detik. |
| **sessionStorage / localStorage** | Laci kecil di browser. sessionStorage hilang saat tab ditutup; localStorage tetap ada. |
| **Seed** | Mengisi database dengan data contoh supaya ada yang bisa dilihat. |
| **Migration / schema patch** | Menambah kolom atau tabel yang kurang di database. |

---

## 3. Isi lemari: peta folder

```
BambangDjaja/
├── backend/                  ← KANTOR PUSAT (Node.js + Express)
│   ├── index.js              ← Pintu masuk. Semua dinyalakan dari sini.
│   ├── routes/               ← Daftar "loket" (endpoint API). Satu file = satu kelompok loket.
│   ├── utils/                ← Para "pegawai" yang mengerjakan tugas sebenarnya.
│   ├── config/               ← Template dashboard bawaan.
│   ├── scripts/              ← Alat bantu: import database, isi data contoh, simulasi Raspi.
│   ├── tests/                ← Test otomatis (tidak butuh MySQL).
│   ├── .env                  ← Rahasia dan pengaturan (TIDAK di-commit, buat sendiri).
│   └── .env.example          ← Contoh isi .env.
│
├── frontend/                 ← LAYAR TV (React + Vite + Tailwind)
│   ├── src/
│   │   ├── main.jsx          ← Titik awal React + "penempel otomatis" header di setiap request.
│   │   ├── App.jsx           ← Daftar halaman (URL mana membuka halaman apa).
│   │   ├── pages/            ← Halaman-halaman (Login, Dashboard, Settings, ...).
│   │   ├── components/       ← Potongan tampilan yang dipakai ulang.
│   │   │   └── visualizations/  ← Panel-panel dashboard (grafik, gauge, status, ...).
│   │   ├── layouts/          ← Kerangka halaman (sidebar, topbar).
│   │   ├── contexts/         ← "Papan pengumuman" data yang bisa dibaca semua halaman.
│   │   ├── hooks/            ← Fungsi React yang dipakai ulang.
│   │   ├── config/           ← Daftar metrik, preset dashboard, rentang gauge.
│   │   └── utils/            ← Fungsi bantu (export PDF/Excel, format tanggal).
│   ├── scripts/              ← Test kecil dan pengecekan render panel.
│   └── .env.local            ← Alamat backend untuk frontend (TIDAK di-commit).
│
├── base_tmu.sql              ← Cetakan database PER PERUSAHAAN.
├── master_tmu_app.sql        ← Cetakan database PUSAT (master).
├── dashboard-documentation.md← Dokumen dashboard versi lama (acuan rumus dan panel).
└── docs/
    ├── PANDUAN-DEVELOPER.md  ← Dokumen yang sedang kamu baca.
    └── superpowers/          ← Spec desain dan rencana kerja (detail teknis).
```

---

## 4. Menyalakan program di laptop kamu

Ikuti urutannya pelan-pelan, seperti resep masakan.

### 4.1 Siapkan bahan

| Bahan | Versi | Catatan |
|---|---|---|
| **Node.js** | 22 (dipakai v22.14.0) | Cek dengan `node -v` |
| **MySQL** | **5.7** (dipakai 5.7.44 dari Laragon) | Hindari sintaks khusus MySQL 8 atau MariaDB |
| **Git** | bebas | |

> **Penting:** MySQL di Laragon **tidak menyala sendiri**. Buka Laragon lalu klik *Start All* setiap
> kali mau kerja. Kalau lupa, backend akan diam saja atau error `AggregateError` tanpa pesan jelas.

### 4.2 Pasang dependency

Buka terminal di folder project:

```powershell
cd backend
npm install
cd ../frontend
npm install
```

### 4.3 Buat file `backend/.env`

Salin `backend/.env.example` menjadi `backend/.env`, lalu isi minimal seperti ini:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
MASTER_DB=master_tmu_app
JWT_SECRET=tulis_kalimat_acak_yang_panjang_di_sini
```

Penjelasan singkat:

- `DB_*` adalah alamat dan akun MySQL. Di `.env.example` namanya `HOST`, `PORT`, `USER`, `PASSWORD`;
  itu juga jalan, tapi `DB_*` lebih jelas dan tidak bentrok dengan variabel lain di komputer.
  (Contoh: di Mac/Linux, `USER` sudah dipakai sistem untuk nama akun komputermu.)
- `JWT_SECRET` adalah "tinta rahasia" untuk membuat gelang tiket (token). **Wajib diisi**, karena
  tanpa ini login gagal.
- Backend jalan di **port 5000**. Kalau mau port lain, tambahkan `SERVER_PORT=xxxx`.
- Fitur tambahan butuh kunci sendiri dan **boleh dikosongkan** dulu:
  `CLOUDINARY_*` untuk upload foto trafo, `GEMINI_API_KEY` untuk saran layout dashboard dengan AI,
  `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` untuk kirim email alert.

### 4.4 Buat file `frontend/.env.local`

Isinya satu baris saja:

```env
VITE_PUBLIC_API_URL=http://localhost:5000
```

Ini memberi tahu layar TV di mana kantor pusatnya. **Tanpa file ini, frontend akan menghubungi
alamat server lama di internet dan tidak akan jalan di laptopmu.**

### 4.5 Buat database dan isi data contoh

Jalankan dari folder `backend/`:

```powershell
node scripts/import_sql.js ../master_tmu_app.sql master_tmu_app   # buat lemari pusat
node scripts/import_sql.js ../base_tmu.sql db_demo               # buat lemari perusahaan demo
node scripts/seed_demo.js                                         # isi data contoh
```

Setelah ini kamu punya:

- Perusahaan **PT Demo** (database `db_demo`, company key `demo-company-key-0001`)
- Satu trafo contoh beserta data pengukurannya
- Akun login **`demo` / `demo123`** dengan peran *superuser* (pengelola perusahaan)

### 4.6 Nyalakan!

Butuh dua terminal:

```powershell
# Terminal 1: kantor pusat
cd backend
npm run dev        # pakai nodemon: otomatis restart kalau file disimpan
                   # (atau "npm start" kalau tidak mau auto-restart)

# Terminal 2: layar TV
cd frontend
npm run dev
```

Tunggu 5 sampai 10 detik. Saat menyala, backend menambal kolom dan tabel yang kurang di database
(namanya `runSchemaPatch`), jadi tidak langsung siap.

Lalu buka **http://localhost:5173** di browser dan login dengan `demo` / `demo123`. 🎉

### 4.7 Bonus: pura-pura punya Raspberry Pi

Di laptop kamu tidak ada trafo sungguhan, tapi ada **simulator Raspi**. Buka terminal ketiga:

```powershell
cd backend
node scripts/fake_raspi.js demo-company-key-0001
```

Simulator ini akan:

- mendaftar sebagai trafo baru (serial `FAKE-RASPI-001`) di PT Demo;
- mengirim angka-angka acak, seolah-olah dari sensor;
- sesekali pura-pura **suhu minyak naik ke level alarm**, supaya jalur notifikasi ikut teruji
  (alert pertama muncul sekitar 1 menit setelah tersambung).

Buka dashboard trafo itu, dan grafiknya akan bergerak sendiri.

> Selalu tulis company key-nya. Kalau dijalankan tanpa argumen, script akan mengambil key
> perusahaan lain dari database, bukan PT Demo.

### 4.8 Kalau ada yang macet

| Gejala | Kemungkinan penyebab | Solusi |
|---|---|---|
| Backend diam atau muncul `AggregateError` | MySQL belum menyala | Buka Laragon, klik *Start All* |
| Login gagal terus | `JWT_SECRET` kosong, atau seed belum dijalankan | Isi `.env`, jalankan `seed_demo.js` |
| Frontend "tidak bisa terhubung ke server" | `frontend/.env.local` tidak ada | Buat file itu (langkah 4.4), lalu restart `npm run dev` |
| Halaman langsung balik ke login | Token kedaluwarsa (24 jam) atau salah | Login ulang |
| Data trafo kosong atau "No Data Found For Today" | Belum ada data hari ini | Jalankan simulator (langkah 4.7) |
| Ubah kode backend tapi tidak ada efek | Server belum restart | Pakai `npm run dev`, atau matikan dan nyalakan lagi |

---

## 5. Dua jenis lemari arsip (database)

Bayangkan sebuah **gedung perkantoran**:

- Di lobi ada **buku tamu besar**: siapa saja yang boleh masuk, dan mereka dari kantor mana.
  Ini **database master** (`master_tmu_app`).
- Setiap perusahaan punya **ruang arsip sendiri** yang terkunci. Isinya data trafo milik
  perusahaan itu saja. Ini **database perusahaan**, satu database per perusahaan. Semuanya dibuat
  dari cetakan yang sama, yaitu `base_tmu.sql`.

Dengan cara ini, data PT A tidak akan pernah tercampur dengan data PT B.

### 5.1 Lemari pusat (`master_tmu_app`)

| Tabel | Isinya |
|---|---|
| `company` | Daftar perusahaan: nama, **nama database-nya** (`database_name`), **company key** (kata sandi Raspi), dan setting grup Telegram. |
| `user` | Semua akun login. Kolom `status` menentukan peran (lihat [bagian 6](#6-siapa-boleh-apa-peran-user)). |
| `parameter_failure_recommendation` | 91 saran perbaikan, misalnya "kalau suhu minyak tinggi, cek kipas pendingin". **Jangan dihapus.** |
| `trafo_last_connection` | Kapan terakhir kali setiap Raspi "absen". Dipakai untuk menentukan Online/Offline. |
| `user_activity_log` | Buku catatan siapa melakukan apa: login, ubah setting, tambah user, dll. |
| `user_layouts` | Susunan dashboard yang disimpan setiap user. Tabel ini dibuat otomatis oleh backend. |

### 5.2 Lemari perusahaan (cetakan `base_tmu.sql`)

Tabel yang **benar-benar dipakai** program:

| Tabel | Isinya | Ibaratnya |
|---|---|---|
| `transformer_data` | Identitas setiap trafo (nameplate): kapasitas, tegangan, vector group, foto, dll. | KTP trafo |
| `temp_reading_data_realtime` | Angka-angka **terbaru** dari sensor | Papan tulis yang terus dihapus dan ditulis ulang |
| `reading_data` | **Riwayat** angka sensor dari waktu ke waktu | Buku harian |
| `transformer_settings` | Batas aman setiap parameter (threshold) | Aturan main |
| `trip_settings` | Kalau trip, apa yang dilakukan: 0 = alarm saja, 1 = putus sisi tegangan tinggi (HV), 2 = putus sisi tegangan rendah (LV) | |
| `transformer_status` | Status **saat ini** untuk 29 parameter | Rapor kesehatan |
| `trip_status` | Parameter mana yang sedang trip | |
| `temp_voltage_harmonic`, `temp_current_harmonic` | Data harmonik terbaru | |
| `failure_log` | Daftar kejadian gangguan (alarm, trip, gas fault, ...) | Catatan kejadian |

Tabel lain di cetakan (`report_data_shrink`, `constanta_value`, `users`, dll.) **saat ini tidak dipakai**.

> **Perhatikan penulisan nama kolom!** Kolom di database memakai gaya **camelCase**
> (`ratedPower`, `vectorGroup`, `trafoSerialNo`), sedangkan yang dikirim ke frontend sering
> memakai **snake_case** (`rated_power`, `vector_group`). Ini sumber bug yang sangat umum.
> Contohnya ada di [Resep A](#resep-a-menampilkan-kolom-database-di-layar).
>
> Satu lagi: kolom batas di `transformer_settings` memang ditulis **`Treshold`** (salah ketik dari
> skema lama). Jangan "dibetulkan" jadi `Threshold`, nanti malah tidak ketemu.

### 5.3 Rapor kesehatan: arti angka status 1 sampai 5

Setiap parameter di `transformer_status` diberi angka. Bayangkan termometer dengan lima zona:

```
  1 ─── LOW TRIP     🔴 terlalu rendah, bahaya (listrik diputus)
  2 ─── LOW ALARM    🟡 agak rendah, hati-hati
  3 ─── NORMAL       🟢 aman
  4 ─── HIGH ALARM   🟡 agak tinggi, hati-hati
  5 ─── HIGH TRIP    🔴 terlalu tinggi, bahaya (listrik diputus)
```

Yang menghitung angka status ini adalah **Raspi**, bukan backend. Backend hanya menerima,
menyimpan, dan menampilkannya. Kodenya ada di `backend/utils/statusModel.js`.

### 5.4 Bagaimana backend tahu harus membuka lemari yang mana?

Setiap request dari frontend membawa header **`X-DB-Name`** (misalnya `db_demo`). Backend lalu
membuka database dengan nama itu (`getDbConnection` di `backend/utils/db.js`).

Supaya tidak ada yang iseng mengintip lemari perusahaan lain, backend **mengganti** header itu
dengan nama database yang tertulis di token user (`backend/utils/authMiddleware.js`). Hanya peran
`admin` (admin platform) yang boleh memilih database lain.

---

## 6. Siapa boleh apa (peran user)

Peran disimpan sebagai angka di kolom `user.status` (database master).

> ⚠️ **Hati-hati, namanya terbalik dari intuisi!** `admin` di sini adalah **bos paling atas**,
> sedangkan `superuser` hanya pengelola satu perusahaan.

| Angka `status` | Nama peran | Siapa dia | Boleh apa |
|---|---|---|---|
| **1** | `admin` | Admin platform (pengelola seluruh sistem) | Masuk ke halaman `/admin`: kelola semua perusahaan, database, admin lain, WhatsApp server |
| **9** | `superuser` | Pengelola satu perusahaan | Lihat semua data perusahaannya, ubah setting dan nameplate trafo, kelola user di perusahaannya |
| **2** | `user` | Pengguna biasa | Hanya melihat data, mengubah profil, dan menyimpan susunan dashboard sendiri |

Akun demo (`demo`) adalah **superuser**.

### Cara membuat akun admin platform untuk mencoba halaman `/admin`

Seed tidak membuatkan akun admin. Jalankan SQL ini di database `master_tmu_app` (misalnya lewat
HeidiSQL di Laragon):

```sql
INSERT INTO user (username, password, role, salt, company_id, status)
VALUES ('admin', SHA2(CONCAT('admin123', 'abc12'), 256), 1, 'abc12', 0, 1);
```

Sekarang kamu bisa login dengan `admin` / `admin123`. Password disimpan sebagai
`sha256(password + salt)`; kode pengeceknya ada di `backend/utils/userAuth.js`.

### Alur login, singkatnya

1. User mengisi username (boleh juga email atau nomor HP) dan password di halaman Login.
2. Frontend mengirim `POST /api/login`.
3. Backend mengecek password, lalu membuat **token** yang berlaku **24 jam**. Isi token: id user,
   peran, nama database perusahaannya, dll.
4. Frontend menyimpan token dan data lain di **sessionStorage**.
5. `admin` diarahkan ke `/admin`; peran lain ke `/home` (daftar trafo).
6. Setiap request selanjutnya otomatis membawa token (diatur di `frontend/src/main.jsx`).
   Kalau backend menjawab 401 atau 403, frontend menghapus sesi dan kembali ke halaman login.

Batas percobaan login: 10 kali per 15 menit.

---

## 7. Perjalanan sebuah angka

Ayo ikuti satu angka, misalnya **suhu minyak 65°C**, dari trafo sampai muncul di layarmu.

```
 [1] Raspi tersambung        [3] Backend minta data       [5] Backend cek papan tulis
     dan "absen"                 tiap 5 detik                 tiap 1 detik
        │                            │                            │
        ▼                            ▼                            ▼
 ┌────────────┐  WebSocket   ┌──────────────┐   simpan    ┌──────────────────────────┐
 │ Raspberry  │─────────────▶│   BACKEND    │────────────▶│ temp_reading_data_       │
 │ Pi         │◀─────────────│              │             │ realtime (papan tulis)   │
 └────────────┘ [4] kirim    └──────┬───────┘             └──────────────────────────┘
                    angka           │ [6] kirim lewat Socket.IO
                                    ▼     (event "meter" dan "oil_sensor")
                             ┌──────────────┐
 [2] Kamu buka dashboard ───▶│   BROWSER    │ [7] angka 65°C muncul di layar
                             └──────────────┘
```

Versi ceritanya:

1. **Raspi tersambung.** Raspi membuka sambungan WebSocket ke backend di alamat `/bd-iot-socket`
   (atau port 2083), lalu mengirim pesan `createConnection` berisi **company key** (sebagai kata
   sandi) dan **nomor serialnya**.
   - Backend mengecek key itu di tabel `company`. Kalau salah, sambungan diputus.
   - Kalau serialnya belum dikenal, backend otomatis membuat trafo baru di `transformer_data`.
     Jadi trafo baru **muncul sendiri** di daftar begitu Raspi-nya pertama kali tersambung.
   - File: `backend/utils/raspiWebSocket.js` dan `backend/utils/raspiSync.js`.
2. **Kamu membuka dashboard trafo.** Browser bergabung ke "room" trafo itu lewat Socket.IO
   (`subscribe_transformer`). Backend jadi tahu ada yang sedang menonton.
3. **Backend meminta data.** Karena ada penonton, backend meminta angka terbaru ke Raspi setiap
   **5 detik**. (Kalau tidak ada yang menonton, backend tidak meminta, supaya hemat.)
4. **Raspi menjawab.** Angka terbaru ditulis ke tabel `temp_reading_data_realtime`.
5. **Backend mengecek papan tulis setiap 1 detik** (`backend/utils/realtimePoller.js`). Kalau ada
   angka baru, backend menerjemahkan nama kolom database ke nama yang dimengerti frontend
   (`OilTemp` jadi `oil_temperature`). Penerjemahnya ada di `backend/utils/readingModel.js`.
6. **Backend mengirim ke browser** lewat dua event Socket.IO: `meter` (data listrik) dan
   `oil_sensor` (data minyak).
7. **Frontend menampilkannya.** `TrendDataContext` dan `TemperatureDataContext` menerima data itu,
   lalu panel-panel dashboard menggambarnya. Angka 65°C pun muncul. 🎉

### Pekerjaan rutin di belakang layar

Selain data real-time tadi, backend juga rutin "bertanya" ke setiap Raspi:

| Apa yang diminta | Seberapa sering | Disimpan di |
|---|---|---|
| Angka terbaru | 5 detik (hanya kalau ada yang menonton) | `temp_reading_data_realtime` |
| Data harmonik | 60 detik (hanya kalau ada yang menonton) | `temp_voltage_harmonic`, `temp_current_harmonic` |
| Status kesehatan dan posisi tap | 60 detik | `transformer_status`, `trip_status`, `transformer_data` |
| Riwayat dan catatan gangguan | 10 menit | `reading_data`, `failure_log` |
| Cek "masih hidup?" (ping) | 30 detik | Kalau tidak menjawab, sambungan diputus |

Raspi juga mengirim "absen" (`ping_ws`), yang dicatat di `trafo_last_connection`. Trafo dianggap
**Online** kalau Raspi-nya sedang tersambung, atau terakhir absen kurang dari 2 menit lalu.

### Arah sebaliknya: dari web ke Raspi

Kalau superuser mengubah setting dari web, misalnya batas suhu, backend menyimpannya ke database
**dan** mengirimkannya ke Raspi (`sendToRaspi`). Begitu juga sebaliknya: perubahan yang dibuat di
layar lokal Raspi ikut disimpan ke database server.

---

## 8. Alarm dan notifikasi

### Kapan "kentongan" dipukul?

1. Setiap 60 detik Raspi mengirim rapor kesehatan (`transformer_status`).
2. Backend membandingkan rapor baru dengan rapor sebelumnya (`backend/utils/alertEngine.js`).
3. Notifikasi hanya dikirim kalau kondisinya **memburuk**: dari normal ke alarm, normal ke trip,
   atau alarm ke trip. Kalau membaik, tidak ada notifikasi.
4. Supaya tidak spam, parameter yang sama di trafo yang sama **hanya diberitahukan sekali setiap
   15 menit**. Catatan ini disimpan di memori, jadi kalau server restart, hitungannya mulai lagi
   dari nol.

### Lewat mana saja?

Pengirimnya `backend/utils/alertSender.js`:

| Saluran | Dikirim ke | Cara menyetel |
|---|---|---|
| **Telegram** | Satu grup Telegram per perusahaan | Diisi admin di halaman `/admin` → Companies → Edit (Bot Token + Chat ID) |
| **WhatsApp** | Setiap user perusahaan yang punya nomor HP | Satu akun WhatsApp untuk seluruh server. Scan QR di halaman `/admin` tab WhatsApp. |
| **Email** | Setiap user perusahaan yang punya email | Isi `SMTP_*` di `backend/.env` |

Kalau satu saluran gagal, saluran lain tetap jalan.

### Cara menghubungkan grup Telegram perusahaan

1. Di Telegram, chat **@BotFather**, kirim `/newbot`, ikuti langkahnya, lalu salin **token**-nya
   (bentuknya seperti `123456789:AAH...`).
2. Buat grup untuk perusahaan itu, lalu undang bot-nya ke grup.
3. Kirim satu pesan di grup, lalu buka `https://api.telegram.org/bot<TOKEN>/getUpdates` di browser.
   Cari angka `message.chat.id`. Angkanya negatif, misalnya `-12345...` atau `-100...`.
4. Login sebagai admin → **Companies** → Edit perusahaan → isi **Bot Token** dan **Chat ID** →
   klik **Send test message**. Kalau pesan uji masuk ke grup, klik **Save**.

> Kalau grup di-upgrade jadi supergroup, Chat ID-nya ikut berubah. Ulangi langkah 3.

---

## 9. Backend lebih dekat

### 9.1 Apa yang terjadi saat backend dinyalakan (`backend/index.js`)

1. Memasang "satpam" HTTP: `helmet` (keamanan), batas 1000 request per 15 menit, `cors`, dan
   pembaca JSON.
2. Menyiapkan Socket.IO untuk browser.
3. Memasang semua loket (route), lihat tabel di bawah.
4. Menyiapkan WebSocket untuk Raspi (`/bd-iot-socket` dan port 2083).
5. Mulai mendengarkan di port 5000, lalu:
   - `runSchemaPatch()`: menambah kolom atau tabel yang kurang di database;
   - `startRealtimePoller()`: mulai mengecek data real-time setiap detik;
   - `initWhatsApp()`: menyalakan WhatsApp 2 detik kemudian.

### 9.2 Daftar loket (route)

Semua loket butuh token, kecuali `GET /api/health` dan `POST /api/login`.

| Awalan URL | File | Isinya | Siapa boleh |
|---|---|---|---|
| `/api/login` | `routes/auth.js` | Login | Semua orang |
| `/api/trafo` | `routes/trafo.js` | Daftar trafo, nameplate, status, physical, harmonik, laporan instan, foto | Lihat: semua. Ubah: admin/superuser |
| `/api/settings` | `routes/settings.js` | Batas aman (threshold), setting trip, batas untuk gauge (`/limits`) | Lihat: semua. Ubah: admin/superuser |
| `/api/trends` | `routes/trends.js` | Riwayat data, export Excel, laporan, health index, kejadian | Semua |
| `/api/analytics` | `routes/analytics.js` | Query data historis yang fleksibel | Semua |
| `/api/layouts` | `routes/layouts.js` | Simpan dan ambil susunan dashboard; saran layout dengan AI | Semua (punya sendiri) |
| `/api/profile` | `routes/profile.js` | Lihat dan ubah profil sendiri | Semua |
| `/api/users` | `routes/users.js` | Kelola user perusahaan | admin/superuser |
| `/api/superuser-users` | `routes/superuser_users.js` | Kelola user perusahaan (versi superuser) | superuser |
| `/api/admin` | `routes/admin.js` | Kelola database, admin, semua user, statistik | admin + header `X-Super-Admin: true` |
| `/api/admin/companies` | `routes/companies.js` | Tambah, ubah, hapus perusahaan; tes Telegram | admin + header `X-Super-Admin: true` |
| `/api/whatsapp` | `routes/whatsappRoutes.js` | Status/QR WhatsApp, logout, kirim tes | Kirim tes: admin/superuser |

### 9.3 Para pegawai (`backend/utils/`)

| File | Tugasnya |
|---|---|
| `db.js` | Membuka koneksi ke database master dan database perusahaan. Semua waktu memakai UTC. |
| `authMiddleware.js` | `verifyToken` (cek gelang tiket) dan `requireRole` (cek peran). |
| `userAuth.js` | Ubah angka status jadi nama peran; buat dan cek password. |
| `readingModel.js` | **Satu-satunya** tempat yang tahu nama kolom data sensor. Menerjemahkan `Van` jadi `phaseA`, `OilTemp` jadi `oil_temperature`, dan menghitung efisiensi, de-rating, leading/lagging. |
| `trafoModel.js` | Ambil data trafo (nameplate, status) dan daftar trafo beserta Online/Offline. |
| `statusModel.js` | Arti angka status 1 sampai 5 dan daftar 29 parameter status. |
| `limitsModel.js` | Mengubah `transformer_settings` jadi batas min/max untuk grafik dan gauge. |
| `raspiWebSocket.js` | Menerima sambungan Raspi, menjadwalkan permintaan data, ping. |
| `raspiSync.js` | Menulis data kiriman Raspi ke database. |
| `realtimePoller.js` | Setiap detik mengecek data baru, lalu mengirimnya ke browser. |
| `alertEngine.js` | Menentukan apakah perlu kirim notifikasi (memburuk? sudah 15 menit?). |
| `alertSender.js` | Mengirim notifikasi ke Telegram, WhatsApp, dan email. |
| `telegramClient.js`, `whatsappClient.js`, `emailClient.js` | "Kurir" untuk setiap saluran. |
| `schemaPatch.js` | Menambah kolom atau tabel yang kurang saat server menyala. Aman dijalankan berkali-kali. |
| `activityLog.js` | Menulis ke buku catatan aktivitas (`user_activity_log`). |
| `trendsHelpers.js` | Fungsi bantu untuk laporan dan tren. |
| `validate.js` | Mengecek angka dari input user. |
| `sqlTemplate.js` | Membuat database perusahaan baru dari `base_tmu.sql`. |
| `cloudinaryClient.js` | Upload foto trafo ke Cloudinary. |
| `phoneFormatter.js` | Merapikan format nomor HP. |

### 9.4 Alat bantu (`backend/scripts/`)

Jalankan semuanya dari folder `backend/`.

| Perintah | Fungsinya |
|---|---|
| `node scripts/import_sql.js <file.sql> <namaDB>` | Membuat database dari file `.sql` |
| `node scripts/seed_demo.js` | Mengisi data contoh PT Demo dan akun `demo`/`demo123` |
| `node scripts/add_company.js "<Nama>" <namaDB>` | Menambah baris perusahaan di master. Database-nya harus dibuat dulu dengan `import_sql.js`. |
| `node scripts/check_schema.js` | Mengecek apakah kolom tambahan sudah ada |
| `node scripts/fake_raspi.js <companyKey>` | Simulator Raspberry Pi |
| `node scripts/ws_probe.js` | Mengecek apakah data real-time sampai ke "browser" (trafo 1 di `db_demo`) |
| `node scripts/smoke_api.js` | Login sebagai demo, lalu memanggil 24 endpoint untuk memastikan semua menjawab OK. Server harus menyala. |
| `node scripts/seed_history_1year.js` | Membuat data riwayat per jam dalam jumlah banyak (sekitar 2 tahun). ⚠️ Menghapus riwayat lama trafo itu dulu. |
| `node scripts/seed_login.js` | ⚠️ **BERBAHAYA**: menghapus **semua** user di master. Jangan dijalankan kecuali kamu benar-benar paham. |

### 9.5 Tiga aturan emas backend

1. **Nilai dari user selalu lewat tanda `?`** di query SQL, jangan ditempel langsung ke string.
   Ini mencegah SQL injection.
   ```js
   // ✅ benar
   db.execute("SELECT * FROM transformer_data WHERE trafoId = ?", [trafoId]);
   // ❌ salah
   db.execute(`SELECT * FROM transformer_data WHERE trafoId = ${trafoId}`);
   ```
2. **Nama kolom yang datang dari user harus dicek dengan daftar putih (allowlist).** Contohnya
   `EDITABLE_TD` di `routes/trafo.js`: hanya kolom di daftar itu yang boleh diubah dari web.
3. **Nama kolom data sensor hanya boleh muncul di `readingModel.js`.** Kalau butuh kolom baru,
   tambahkan pemetaannya di sana.

---

## 10. Frontend lebih dekat

### 10.1 Bahan-bahannya

React 19, React Router 7, Tailwind CSS 4, Vite (port **5173**), Recharts (grafik),
react-grid-layout (dashboard yang bisa digeser-geser), Socket.IO client, axios, dan lucide-react
(ikon).

### 10.2 Penempel otomatis (`frontend/src/main.jsx`)

Kamu **tidak perlu** menulis header token di setiap request. `main.jsx` memasang "penempel
otomatis" di `axios` dan `fetch`, sehingga setiap request ke backend otomatis membawa:

| Header | Diambil dari sessionStorage | Gunanya |
|---|---|---|
| `Authorization: Bearer ...` | `token` | Gelang tiket |
| `X-DB-Name` | `db_name` | Lemari perusahaan mana |
| `X-Trafo-Id` | `selectedTrafoId` | Trafo mana yang sedang dibuka |
| `X-Username` | `username` | |

Kalau backend menjawab 401 atau 403, sesi dihapus dan user dikembalikan ke `/login`.

### 10.3 Daftar halaman (`frontend/src/App.jsx`)

| URL | Halaman (`src/pages/`) | Isinya |
|---|---|---|
| `/login` | `Login.jsx` | Halaman masuk |
| `/admin` | `AdminDashboard.jsx` | Ruang admin platform: perusahaan, database, admin, user, WhatsApp |
| `/home` | `TransformerSelection.jsx` | Kartu-kartu trafo (online/offline, kapasitas, vector group) |
| `/dashboard` | `Dashboard.jsx` | Dashboard utama yang bisa disusun sendiri seperti Grafana |
| `/transformer-data` | `TransformerData.jsx` | Peta lokasi, nameplate, foto trafo |
| `/settings` | `Settings.jsx` | Batas aman dan setting trip |
| `/performance-report` | `PerformanceReport.jsx` | Laporan min/max/rata-rata |
| `/instantaneous-report` | `InstantaneousReport.jsx` | Foto sesaat semua parameter |
| `/failure-report` | `FailureReport.jsx` | Daftar gangguan |
| `/analysis` | `AnalysisReport.jsx` | 12 grafik analisis |
| `/users` | `AddUser.jsx` | Kelola user (admin) |
| `/manage-users` | `ManageUsersSuperuser.jsx` | Kelola user (superuser) |
| `/profile` | `Profile.jsx` | Profil sendiri |

Semua halaman selain `/login` dan `/admin` dibungkus `ProtectedRoute` (harus sudah login) dan
`MainLayout` (topbar + sidebar). Pengecekan peran dilakukan **di dalam halaman masing-masing**,
bukan di router.

### 10.4 Papan pengumuman (`src/contexts/`)

Context itu seperti papan pengumuman di kantor: dipasang sekali, lalu bisa dibaca semua halaman.

| Context | Isinya |
|---|---|
| `ApiContext` | Alamat backend (`apiUrl`). Pakai `const { apiUrl } = useApi();` |
| `ThemeContext` | Mode gelap atau terang |
| `DialogContext` | Pop-up `alert`/`confirm`/`prompt` yang cantik |
| `ThresholdContext` | Batas aman setiap metrik (dari `/api/settings/limits`) |
| `TrendDataContext` | Data listrik real-time dan riwayat (lewat Socket.IO `meter`) |
| `TemperatureDataContext` | Data minyak real-time (lewat Socket.IO `oil_sensor`) |

### 10.5 Panel dashboard (`src/components/visualizations/`)

Ada 25 jenis panel:

- **Grafik:** TimeSeries, BarChart, Histogram, Candlestick, PieChart, Stat
- **Gambar khusus:** Gauge, Phasor, TransformerSLD (diagram garis tunggal), Heatmap,
  StateTimeline, StatusHistory, BarGauge, Table
- **Status:** Status, OilStatus, TransformerStatus, ElectricalStatus, PhysicalStatus
- **Analisis:** HealthIndex, Derating, Harmonic, OilQuality
- **Kabar:** EventStream, News

Ada juga 4 preset dashboard bawaan di `src/config/presets.js`: Electrical (default), Physical,
Status, dan Oil Quality.

### 10.6 Hal kecil yang berguna

- **Ganti trafo:** saat user memilih trafo, `selectedTrafoId` disimpan di sessionStorage dan event
  `window` bernama **`trafoChanged`** dipancarkan. Semua context dan panel mendengarkan event ini,
  lalu mengambil data ulang.
- **Ambil data trafo dengan cepat:** pakai hook `useTrafoApi('status')`. Hook ini otomatis memanggil
  `GET /api/trafo/<trafo terpilih>/status`, mengulang setiap 60 detik, dan memuat ulang saat
  `trafoChanged`.
- **Mode gelap:** pakai class `dark:` dari Tailwind, misalnya
  `className="bg-white dark:bg-[#151521]"`. Defaultnya gelap.
- **Bahasa:** teks di layar ditulis langsung (campuran Inggris dan Indonesia), tanpa sistem
  terjemahan. Waktu memakai zona `Asia/Jakarta` (WIB).

---

## 11. Resep: cara mengubah dan menambah fitur

### Resep A: Menampilkan kolom database di layar

**Studi kasus nyata:** menampilkan *rated power* dan *vector group* di kartu trafo halaman `/home`.

Alurnya selalu sama: **database → backend (query) → backend (respons JSON) → frontend**.

**Langkah 1: cek nama kolom di database.** Buka `base_tmu.sql` dan cari tabelnya:

```sql
CREATE TABLE `transformer_data` (
  ...
  `ratedPower` int(5) DEFAULT NULL,
  `vectorGroup` varchar(20) DEFAULT NULL,
```

**Langkah 2: cari endpoint mana yang dipakai halaman itu.** `TransformerSelection.jsx` memanggil
`GET /api/trafo`. Endpoint ini memanggil `listTrafos()` di `backend/utils/trafoModel.js`.

**Langkah 3: tambahkan kolom ke query SELECT.**

```js
`SELECT td.trafoId AS id, td.raspiSerialNo, td.trafoSerialNo, td.ratedPower, ...,
        td.vectorGroup, td.imageFileName, td.lastSyncTimestamp
 FROM transformer_data td ORDER BY td.trafoId ASC`
```

**Langkah 4: masukkan ke objek yang dikirim ke frontend.**

```js
rated_power: r.ratedPower,
vector_group: r.vectorGroup,   // ← namanya r.vectorGroup (camelCase, sesuai database)!
```

> 🐛 **Bug yang pernah terjadi:** awalnya ditulis `vector_group: r.vector_group`. Hasilnya
> `undefined`, dan `undefined` **dibuang diam-diam** saat diubah ke JSON, sehingga frontend selalu
> menampilkan `-`. Tidak ada error sama sekali!
> **Pelajaran:** nama di sebelah kanan (`r.xxx`) harus **persis sama** dengan nama kolom di SQL.

**Langkah 5: tampilkan di frontend.**

```jsx
{trafo.rated_power != null ? `${trafo.rated_power} kVA` : '-'}
{trafo.vector_group || '-'}
```

**Langkah 6: cek.** Restart backend (otomatis kalau pakai `npm run dev`), lalu refresh browser.
Kalau masih `-`:

- Buka DevTools browser (F12) → tab **Network** → klik request `trafo` → lihat **Response**.
  Apakah field-nya ada?
- Kalau field-nya tidak ada, masalahnya di backend (langkah 3 atau 4).
- Kalau ada tapi `null`, berarti datanya memang kosong di database. Cek dengan
  `SELECT trafoId, vectorGroup FROM transformer_data;`.

### Resep B: Menambah endpoint API baru

Contoh: `GET /api/trafo/:id/cooling` untuk mengambil mode pendingin trafo.

Buka `backend/routes/trafo.js` dan tambahkan:

```js
router.get("/:id/cooling", async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      "SELECT coolingMode FROM transformer_data WHERE trafoId = ?",
      [trafoIdParam(req)],
    );
    if (rows.length === 0) return res.status(404).json({ error: "Trafo tidak ditemukan" });
    res.json({ success: true, coolingMode: rows[0].coolingMode });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});
```

Yang perlu kamu tahu:

- `req.db` sudah disiapkan otomatis (koneksi ke database perusahaan yang benar) oleh
  `router.use(...)` di bagian atas file.
- Kalau endpoint-nya **mengubah** data, tambahkan penjaga peran:
  `router.put("/:id/xxx", requireRole("admin", "superuser"), async (req, res) => { ... })`.
- Kalau mengubah data penting, catat juga di buku aktivitas dengan `logActivity(...)`. Contohnya
  ada di `PUT /:id/name`.
- Kalau butuh **file route baru**, daftarkan di `backend/index.js`:
  `app.use("/api/namabaru", verifyToken, require("./routes/namabaru"));`

### Resep C: Menambah halaman baru di frontend

1. Buat file `frontend/src/pages/HalamanBaru.jsx`:
   ```jsx
   import React, { useEffect, useState } from 'react';
   import axios from 'axios';
   import { useApi } from '../contexts/ApiContext';

   const HalamanBaru = () => {
     const { apiUrl } = useApi();
     const [data, setData] = useState(null);

     useEffect(() => {
       const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
       axios.get(`${apiUrl}/api/trafo/${trafoId}/cooling`)   // header token otomatis ditempel
         .then((res) => setData(res.data));
     }, [apiUrl]);

     return (
       <div className="p-6 text-[#172b4d] dark:text-white">
         Mode pendingin: {data?.coolingMode ?? '-'}
       </div>
     );
   };

   export default HalamanBaru;
   ```
2. Daftarkan di `frontend/src/App.jsx`, di dalam `<Route path="/" ...>`:
   ```jsx
   import HalamanBaru from './pages/HalamanBaru';
   // ...
   <Route path="halaman-baru" element={<HalamanBaru />} />
   ```
3. Tambahkan link di sidebar: `frontend/src/layouts/MainLayout.jsx`.

### Resep D: Menambah jenis panel dashboard baru

1. Buat komponennya di `frontend/src/components/visualizations/NamaPanel.jsx`, dengan **named
   export**: `export const NamaPanel = memo(({ panel, latestData, isEditing }) => { ... });`
2. Daftarkan di `frontend/src/components/visualizations/index.js`:
   `export * from './NamaPanel';`
3. Di `frontend/src/pages/Dashboard.jsx`:
   - impor panel barunya di bagian atas;
   - tambahkan `case 'namapanel': return <NamaPanel ... />;` di komponen `PanelRenderer`;
   - tambahkan `{ v: 'namapanel', l: 'Nama Panel', d: 'Deskripsi singkat', i: IkonLucide }` di
     daftar jenis panel (dekat entri `electricalstatus`), supaya panelnya muncul di editor;
   - kalau panel ini tidak butuh pilihan metrik, tambahkan `'namapanel'` ke `NO_METRIC_PANELS`.
4. (Opsional) Masukkan ke salah satu preset di `frontend/src/config/presets.js`.

### Resep E: Menambah perusahaan baru

- **Lewat web (paling mudah):** login sebagai admin → `/admin` → Companies → Tambah. Backend
  otomatis membuat database dari `base_tmu.sql` dan memberikan **company key** baru.
- **Lewat terminal:**
  ```powershell
  node scripts/import_sql.js ../base_tmu.sql db_perusahaan_baru
  node scripts/add_company.js "PT Perusahaan Baru" db_perusahaan_baru
  ```
  Lalu restart backend supaya database baru ikut ditambal oleh `schemaPatch`.

### Resep F: Menghubungkan Raspberry Pi sungguhan

Di Raspi, isi `COMPANY_KEY` dengan `company_key` perusahaannya (terlihat di halaman admin
perusahaan) dan `SERVER_DOMAIN` dengan alamat server ini. Saat Raspi pertama kali tersambung,
trafonya otomatis muncul di daftar.

---

## 12. Cek dulu sebelum commit

Seperti mengecek kompor sebelum keluar rumah:

```powershell
# Backend: test otomatis (tidak butuh MySQL)
cd backend
npm test

# Frontend: pastikan bisa di-build dan tidak ada peringatan lint baru
cd ../frontend
npm run build
npm run lint
npm run check:render       # cek panel-panel bisa digambar
```

Kalau server menyala, kamu juga bisa menjalankan `node scripts/smoke_api.js` dari `backend/`.

Tips:

- Unit test backend **tidak boleh** menyentuh MySQL. Pakai database palsu dari
  `backend/tests/helpers/fakeDb.js`.
- Selalu cek `git status` sebelum commit, supaya tidak ada file yang ketinggalan atau
  ikut ter-commit tanpa sengaja.
- Jangan pernah commit `backend/.env` atau `frontend/.env.local` (isinya rahasia).

---

## 13. Jebakan yang sering bikin bingung

| Jebakan | Penjelasan |
|---|---|
| **camelCase vs snake_case** | Database: `vectorGroup`. JSON ke frontend: `vector_group`. Salah satu huruf saja, datanya hilang tanpa error. |
| **`Treshold`** | Nama kolom di `transformer_settings` memang salah ketik begitu. Biarkan. |
| **`admin` lebih tinggi dari `superuser`** | Namanya terbalik dari intuisi. Lihat [bagian 6](#6-siapa-boleh-apa-peran-user). |
| **Zona waktu** | Database dan backend memakai **UTC**; layar menampilkan **WIB** (UTC+7). Timestamp polos dari Raspi dianggap WIB (`RASPI_TZ_OFFSET`). |
| **`PORT` di `.env`** | Kalau isinya 3306, dianggap port MySQL, bukan port backend. Pakai `DB_PORT` dan `SERVER_PORT` supaya tidak bingung. |
| **Backend lambat siap** | Butuh 5 sampai 10 detik karena `runSchemaPatch`. |
| **MySQL Laragon** | Tidak menyala otomatis. |
| **Tegangan fasa** | Batas di database adalah tegangan antar fase (misal 400 V). Untuk tegangan fasa, backend membaginya dengan √3 (jadi sekitar 230 V). |
| **Notifikasi tidak terkirim lagi** | Wajar kalau parameter yang sama baru diberitahukan kurang dari 15 menit lalu. |
| **Ubah setting saat Raspi offline** | Tetap tersimpan di database, dan backend menjawab `pushed: false`. Itu memang disengaja. |
| **Simulator tanpa argumen** | `fake_raspi.js` tanpa company key memakai perusahaan lain. Selalu tulis `demo-company-key-0001`. |
| **Server mati, sesi WhatsApp** | Sesi tersimpan di `backend/wa_session/`. Jalankan backend dari folder `backend/` supaya sesi ketemu. |
| **`master_tmu_app.sql` berisi data penting** | Ada 91 baris rekomendasi perbaikan. Jangan ditimpa atau dihapus. |

---

## 14. Pekerjaan rumah yang belum beres

Ini hal-hal yang **sudah diketahui bermasalah** atau belum selesai (dicek 16 Oktober 2026). Bagus
untuk latihan pertama!

| # | Masalah | Di mana |
|---|---|---|
| 1 | Status keseluruhan di **Instantaneous Report** keliru. Kode menghitung semua kolom baris status, **termasuk kolom `trafoId`**, jadi trafo 1 selalu tampil TRIP dan trafo 2 selalu ALARM. Aturan kodenya juga tidak cocok dengan arti angka 1 sampai 5. | `backend/routes/trafo.js`, endpoint `/:id/instantaneous` |
| 2 | Tombol WhatsApp di halaman `/home` memanggil `/api/whatsapp/send` dan `/api/whatsapp/qr`, padahal kedua endpoint itu **tidak ada** di backend. | `frontend/src/pages/TransformerSelection.jsx` |
| 3 | Socket.IO **tidak mengecek token**, jadi siapa pun yang tahu nama database bisa ikut menonton data real-time. | `backend/index.js`, handler `subscribe_transformer` |
| 4 | `POST /api/whatsapp/logout` dan `GET /api/whatsapp/status` tidak dijaga peran, jadi user biasa pun bisa me-logout WhatsApp server. | `backend/routes/whatsappRoutes.js` |
| 5 | `GET /api/layouts/export/:id` tidak mengecek pemilik layout. | `backend/routes/layouts.js` |
| 6 | Sidebar admin punya link ke `/provisioning` dan `/manage-transformers`, tapi halamannya tidak terdaftar di router. `ManageTransformers.jsx` tidak dipakai. | `frontend/src/layouts/MainLayout.jsx`, `frontend/src/App.jsx` |
| 7 | `.env.example` berisi kunci yang tidak dipakai (`FONNTE_TOKEN`, `DATABASE_URL`, `IRIV_*`, `CLOUD_URL`) dan belum mencantumkan `SMTP_*`, `SERVER_PORT`, `DB_*`. | `backend/.env.example` |
| 8 | Paket `ws` dipakai langsung, tapi tidak tercantum di `backend/package.json` (saat ini hanya ikut terpasang lewat paket lain). | `backend/utils/raspiWebSocket.js` |
| 9 | Setting yang diubah saat Raspi offline belum ditemukan kode yang mengirimkannya ulang begitu Raspi online lagi. Perlu dicek. | `backend/routes/settings.js`, `backend/utils/raspiWebSocket.js` |
| 10 | Uji manual di browser untuk fitur-fitur frontend terbaru belum pernah dilakukan secara lengkap. | Lihat plan D di `docs/superpowers/plans/` |

---

## 15. Mau baca lebih dalam?

| Dokumen | Isinya |
|---|---|
| `docs/superpowers/specs/2026-10-13-tmu-legacy-schema-design.md` | Spec desain: kenapa program dibuat seperti sekarang |
| `docs/superpowers/plans/` | Rencana kerja A sampai D, langkah demi langkah, lengkap dengan kode |
| `dashboard-documentation.md` | Dokumentasi dashboard versi lama: acuan rumus dan arti setiap panel |
| `base_tmu.sql`, `master_tmu_app.sql` | Bentuk asli database. **Kalau dokumen dan file .sql berbeda, percayai file .sql.** |

Selamat ngoding! Kalau kamu menemukan sesuatu yang membingungkan di dokumen ini, berarti
dokumennya yang perlu diperbaiki, bukan kamu. Silakan diperbaiki. 🙂
