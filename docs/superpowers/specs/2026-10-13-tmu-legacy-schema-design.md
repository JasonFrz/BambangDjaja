# Desain: Migrasi Web TMU ke Skema `base_tmu` / `master_tmu_app` + Ingest Raspberry Pi

Tanggal: 13 Oktober 2026
Status: disetujui secara lisan, menunggu review tertulis

## 1. Tujuan

Website ini (React + Express + Socket.IO) harus bekerja di atas skema database web TMU lama
sebagaimana dijelaskan di `dashboard-documentation.md` dan didefinisikan di `base_tmu.sql`
(database per perusahaan) serta `master_tmu_app.sql` (database master), lalu dilengkapi semua
logika dan data yang ada di web lama (WTI, BusTemp, THD, daya per fase, harmonik, de-rating,
kode status 1 sampai 5, rekomendasi kegagalan, oil quality). Server juga mengambil alih peran
server cloud lama dalam berbicara dengan Raspberry Pi.

Tabel `electrical_readings`, `oil_readings`, `threshold_settings`, dan tabel `trafo` yang dibuat
otomatis tidak dipakai lagi. Tidak ada mode fallback.

Cara kerja: user mengetik semua perubahan kode sendiri untuk belajar. Claude memberi instruksi
per langkah, membaca hasilnya, dan membantu verifikasi. Claude tidak mengedit file kode proyek.

## 2. Keputusan yang sudah diambil

| Topik | Keputusan |
|---|---|
| Lapisan data | Adapter di backend (`readingModel.js`) memetakan kolom `base_tmu` ke key frontend yang sudah ada. Frontend tidak tahu nama kolom DB. |
| Tampilan | Tetap satu Dashboard panel bebas. Metric diperluas, lima panel baru, empat preset layout. |
| Ingest Raspi | Dikerjakan di server, meniru protokol dari `../tmu/tmu-app-client-deploy/websocket.js` (sisi client). Source server cloud lama tidak ada. |
| Database master | Mengikuti `master_tmu_app.sql` (`company`, `user`, `parameter_failure_recommendation`, `trafo_last_connection`, `user_activity_log`) ditambah `user_layouts` milik proyek ini. Nama DB master diatur lewat `MASTER_DB` di `.env`. |
| Kolom tambahan di `user` | `email VARCHAR(150)`, `phone VARCHAR(20)` untuk alert. |
| Role | `user.status`: `9` = superuser, `1` = admin, `2` = user. Kolom `role` dibiarkan. |
| Password | Web lama: `sha256(password + salt)`. Login menerima ini dan bcrypt (hash berawalan `$2`). User baru dibuat dengan sha256+salt. |
| Versi TMU | Hanya jalur v2 yang diimplementasikan (`kWh`, `kVARh`). `tmu_version` tetap disimpan dan ditampilkan. |
| Efisiensi | Rumus kuadrat dengan konstanta dari `transformer_data`, lihat bagian 4.4. Rumus di dokumen dianggap salah ketik. |
| `trafoId` di tabel temp | Ditambahkan `trafoId INT DEFAULT 1` ke `temp_reading_data_realtime`, `temp_voltage_harmonic`, `temp_current_harmonic` saat startup agar satu DB bisa menampung beberapa trafo. |
| Interval 1/5/10/15 menit | Tidak ditiru. Pemilih rentang waktu yang ada sudah mencakupnya. |
| Report | Dihitung dari `reading_data`. Pesan `requestPerformanceReportDataDaily`, `requestSyncDataReport`, dan `requestReportInstantaneousDataRealTime` tidak ditangani dulu. |

## 3. Perbedaan skema asli vs dokumen

Yang berlaku adalah `base_tmu.sql` dan `master_tmu_app.sql`, bukan dokumen:

- Tabel `temp_*` tidak punya `trafoId` (ditambah oleh patch startup).
- Kolom harmonik: `1st, 3rd, 5th, 7th, 9th, 11th, 13th, 15th, 17th, 19th, 21th, 23th, 25th, 27th, 29th, 31th`.
- `transformer_data` di dump tidak punya `oilCondition`, `waterActivity`, `oilBDV`. Kode memperlakukannya opsional.
- `parameter_failure_recommendation` memakai kolom `parameter`, bukan `key`.
- `reading_data` punya `trafoId`; `temp_instantaneous_report_data` tidak dipakai.
- Daya disimpan dalam Watt/VAR/VA; frontend memakai kW/kVAR/kVA.

## 4. Backend: lapisan data

### 4.1 Peran tabel

| Tabel | Dipakai untuk |
|---|---|
| `temp_reading_data_realtime` | Live: Socket.IO, `/api/trends/meter`, `/api/trends/oil` |
| `reading_data` | Historis per `trafoId`: `/api/trends` dengan rentang, export, report, analytics, THI |
| `transformer_data` | Daftar trafo, nameplate, konstanta efisiensi dan de-rating, `raspiSerialNo`, `version`, tap |
| `transformer_settings`, `trip_settings` | Threshold dan trip enable |
| `transformer_status`, `trip_status` | Kode status per parameter |
| `temp_voltage_harmonic`, `temp_current_harmonic` | Panel harmonik |
| `failure_log` | Event stream, gas fault, sudden pressure |
| master `parameter_failure_recommendation` | Rekomendasi di panel status |
| master `trafo_last_connection` | Status Online/Offline |
| master `user_activity_log` | Log login dan perubahan threshold |

### 4.2 Modul `backend/utils/readingModel.js`

Satu-satunya tempat yang tahu nama kolom `base_tmu`.

- `COLUMN_MAP`: kolom DB ke key frontend (bagian 4.3).
- `mapRow(row)`: baris DB menjadi objek key frontend dengan `timestamp` ISO dan `time` lokal. Daya dibagi 1000.
- `buildSelect(keys, { aggregate })`: daftar kolom SELECT, `ROUND(AVG(col),2) AS col` saat agregasi.
- `getLatest(db, trafoId)`: baris terbaru `temp_reading_data_realtime`.
- `getRealtimeSeries(db, trafoId, limit = 60)`: N baris terakhir urut naik.
- `getHistory(db, trafoId, start, end, intervalDetik)`: dari `reading_data`, agregasi `GROUP BY UNIX_TIMESTAMP(timestamp) DIV interval` bila interval > 0, maksimum 5000 baris.
- `computeDerived(row, transformerData)`: `efficiency`, `leadLag: { a, b, c }` dari tanda `Qa/Qb/Qc`, `derating: { a, b, c }` masing-masing `{ kRated, used, available, lost, full }`.

### 4.3 Peta kolom ke key frontend

| Kolom | Key | Catatan |
|---|---|---|
| `Van, Vbn, Vcn` | `phaseA, phaseB, phaseC` | |
| `Vab, Vbc, Vca` | `lineAB, lineBC, lineCA` | |
| `Ia, Ib, Ic, Ineutral, Iavg` | `currentA, currentB, currentC, currentN, avgCurrent` | |
| `Pa, Pb, Pc, Psig` | `powerActiveA, B, C, powerActiveTotal` | ÷1000 ke kW |
| `Qa, Qb, Qc, Qsig` | `powerReactiveA, B, C, powerReactiveTotal` | ÷1000 ke kVAR |
| `Sa, Sb, Sc, Ssig` | `powerApparentA, B, C, powerApparentTotal` | ÷1000 ke kVA |
| `PFa, PFb, PFc, PFsig` | `pfA, pfB, pfC, pfTotal` | |
| `Freq` | `frequency` | |
| `kWh, kVARh` | `energyActiveTotal, energyReactiveTotal` | |
| `OilTemp, Press` | `oil_temperature, oil_pressure` | key lama dipertahankan |
| `WTITemp1-3` | `wtiA, wtiB, wtiC` | |
| `BusTemp1-3` | `busTempA, busTempB, busTempC` | |
| `THDV1-3, THDI1-3` | `thdVA, thdVB, thdVC, thdIA, thdIB, thdIC` | |
| `H2ppm, Moistureppm` | `h2ppm, moisturePpm` | |
| `deRatinga/b/c, KRateda/b/c` | `deRatingA/B/C, kRatedA/B/C` | |
| `UnbalanceUV/VW/UW` | `unbalanceUV, unbalanceVW, unbalanceUW` | |
| `Level` | `oilLevelRaw` | |

### 4.4 Rumus turunan

```
rasioBeban = Iavg / ratedCurrentLowVoltage
loadLoss   = rasioBeban^2 * fullLoadLoss
efficiency = (1 - (noLoadLoss + loadLoss) / (ratedPower * 1000 + noLoadLoss + loadLoss)) * 100
```

De-rating per fase (x = a, b, c):

```
full      = ratedPower / 3                    (kVA)
available = deRatingx / 100 * full
lost      = full - available
used      = Sx / 1000                          (kVA)
```

Leading jika `Qx > 0`, lagging jika `Qx < 0`, unity jika 0.

Kode status: `1` Low Trip, `2` Low Alarm, `3` Normal, `4` High Alarm, `5` High Trip.
Oil level dari `transformer_status.OilLevel`: `3` aman, `2` alarm, `1` trip.
Pressure badge: `3` aman, `2/4` alarm, `1/5` trip.

## 5. Backend: ingest Raspberry Pi

File: `backend/utils/raspiWebSocket.js` (koneksi, routing pesan) dan `backend/utils/raspiSync.js`
(penulisan DB, penjadwalan). Path `/bd-iot-socket` di server utama dan port 2083 tetap.

### 5.1 `createConnection`

Payload: `companyKey, raspiSerialNo, version, transformerData, transformerSettings,
transformerStatus, tripSettings, tripStatus`.

1. `company WHERE company_key = ?` di master. Tidak ada: log, tutup koneksi.
2. `transformer_data WHERE raspiSerialNo = ?` di DB perusahaan. Belum ada: INSERT `transformer_data`,
   `transformer_settings`, `trip_settings`, `transformer_status`, `trip_status` dari payload.
   Sudah ada: timpa hanya `transformer_status`, `trip_status`, `lastSyncTimestamp`, `version`.
3. Simpan `raspiSerialNo -> { ws, dbName, trafoId, tmuVersion }`.
4. Upsert `trafo_last_connection`. `ping_ws` juga memperbarui tabel ini dan dibalas `pong_server`.

### 5.2 Permintaan berkala

| Permintaan | Kapan | Balasan dan tindakan |
|---|---|---|
| `requestReadingDataRealTime` | Ada penonton room `trafo_{db}_{id}`: segera saat subscribe, lalu tiap 5 s | `getReadingDataRealTimeReceived.readingData` (100 baris). DELETE baris trafo di `temp_reading_data_realtime`, INSERT ulang |
| `requestCurrentHarmonicRealTime`, `requestVoltageHarmonicRealTime` | Ada penonton, tiap 60 s | `receivedRequest...HarmonicRealTime.data` 3 baris, kolom berawalan `Row` dipetakan ke `1st`.. `31th`. DELETE + INSERT untuk trafo itu |
| `requestSyncUpdateStatusTransformer` | Selalu, tiap 60 s | `receivedSyncUpdateStatusTransformer.transformerStatus/tripStatus`. UPDATE, lalu diff untuk alert |
| `requestTapPositionRealTime` | Bersama status | `getTapPositionRealTimeReceived.transformerData`: update `tapType`, `impedance` |
| `requestSyncDataReading` `{ timestampRange: [{timestamp}] }` | Selalu, tiap 10 menit, kirim timestamp 1 hari terakhir yang sudah ada | `receivedSyncDataReading.data`: `INSERT IGNORE reading_data` dengan `trafoId`, lalu kirim `successSyncDataReading` |
| `requestSyncDataFailureLog` `{ failureLogRange: [{failure_id}] }` | Selalu, tiap 10 menit | `receivedSyncDataFailureLog.data`: `INSERT IGNORE failure_log` |

### 5.3 Dorongan dari web ke Raspi

Perubahan dari halaman Settings/TransformerData mengirim `updateSyncTransformerSettingsFromServer`,
`updateSyncTransformerDataFromServer`, `updateSyncTripSettingsFromServer` dengan `data` = objek kolom.

### 5.4 Online/Offline

Online jika ada koneksi WebSocket aktif untuk `raspiSerialNo` trafo, atau `trafo_last_connection`
kurang dari 2 menit lalu.

### 5.5 Poller realtime

`realtimePoller.js` tetap polling tiap detik per room aktif, tetapi membaca `temp_reading_data_realtime`
lewat `readingModel`. Emit `meter` (semua key + `efficiency`, `leadLag`, `derating`) dan `oil_sensor`
(`oil_temperature`, `oil_pressure`, `oil_level`, `oil_level_alarm`, `oil_level_trip` dari kode `OilLevel`).
`METRIC_MAPPING` dan `checkAndAlert` dihapus.

## 6. Backend: status, threshold, alert

### 6.1 Threshold

- `GET /api/settings/thresholds?trafo_id=N` → `{ settings: <baris transformer_settings>, trip: <baris trip_settings> }`.
- `PUT /api/settings/thresholds/:trafoId` → kolom yang diubah. Untuk tegangan, server menghitung
  `voltage{Low,High}{Alarm,Trip}Value = ratedLowVoltage ± Treshold/100 * ratedLowVoltage`.
  Setelah UPDATE: dorong ke Raspi, tulis `user_activity_log`.
- `PUT /api/settings/trip/:trafoId` → `trip_settings`, dorong ke Raspi.

Satuan di `transformer_settings`: tegangan, frekuensi, voltage unbalance, arus, Ineutral dalam persen;
suhu (°C), THD (%), PF (0..1), tekanan (Bar), H2 dan moisture (ppm) absolut.

### 6.2 Limits untuk chart dan gauge

`GET /api/settings/limits?trafo_id=N` → `{ [metricKey]: { min, max, tripMin, tripMax } }`:

| Metric | min / tripMin | max / tripMax |
|---|---|---|
| phaseA/B/C, lineAB/BC/CA | `voltageLowAlarmValue` / `voltageLowTripValue` | `voltageHighAlarmValue` / `voltageHighTripValue` |
| frequency | `frequency * (1 - LowTreshold/100)` | `frequency * (1 + HighTreshold/100)` |
| currentA/B/C | tidak ada | `ratedCurrentLowVoltage * currentHigh.../100` |
| currentN | tidak ada | `ratedCurrentLowVoltage * IneutralHigh.../100` |
| pfTotal, pfA/B/C | `powerFactorLow...` | tidak ada |
| oil_temperature | tidak ada | `topOilHigh...` |
| wtiA/B/C | tidak ada | `windTempHigh...` |
| busTempA/B/C | tidak ada | `busTempHigh...` |
| thdVA/B/C, thdIA/B/C | tidak ada | `thdVoltage...`, `thdCurrent...` |
| oil_pressure | tidak ada | `tankPressureHigh...` |
| h2ppm, moisturePpm | tidak ada | `H2ppmHigh...`, `MoistureppmHigh...` |

### 6.3 Status dan rekomendasi

`GET /api/trafo/:id/status` → `{ allSafe, items: [{ parameter, code, label, recommendations: [] }] }`.
Pengelompokan key rekomendasi: `WTITemp1-3 → WTITemp`, `BusTemp1-3 → BusTemp`,
`THDCurrent1-3 → THDCurrent`, `Current1-3 → Current`, lainnya apa adanya.

### 6.4 Alert

Dipicu di handler `receivedSyncUpdateStatusTransformer` saat kode memburuk: 3→alarm, 3→trip,
alarm→trip. Pesan berisi parameter, status baru, nilai terakhir, batas dari limits. Cooldown 15 menit
per `(dbName, trafoId, parameter)`. Penerima: `user WHERE company_id = ?` yang punya `phone` atau
`email`. `sendAlertMessage` yang ada dipakai ulang.

### 6.5 Event dan health index

- `GET /api/trends/events?trafo_id=N` membaca `failure_log`.
- `GET /api/trafo/:id/physical` → tap position (`OCTC` atau `impedance`), oil level, pressure badge,
  gas fault terakhir, sudden pressure (`SuddenPressure` + log terakhir).
- `GET /api/trafo/:id/oil-quality` → `waterActivity`, `oilBDV`, `oilCondition` atau `{ available: false }`.
- `GET /api/trafo/:id/harmonics?type=voltage|current` → `[{ phase, orders: { "1st": .. } }]`.
- `GET /api/trends/thi` → health = max(0, 100 − 10 × jumlah alarm − 25 × jumlah trip).

## 7. Backend: auth dan master

- `auth.js`: `SELECT u.*, c.* FROM user u JOIN company c ON u.company_id = c.company_id WHERE username = ?`.
  Verifikasi bcrypt atau sha256+salt. JWT berisi `id, username, role (string), dbName = database_name, companyName, tmuVersion`.
- `users.js`, `superuser_users.js`, `profile.js`, `admin.js`, `companies.js`: ganti `users/companies`
  ke `user/company`, `nama_db → database_name`, `nama_perusahaan → company_name`, `nomor_telpon → phone`.
  Buat user: salt 5 karakter acak, `sha256(password + salt)`.
- `companies.js` POST: generate `company_key` acak 32 hex; tampilkan di admin untuk dipasang di Raspi.
- `layouts.js`: tetap, `user_id` merujuk `user.user_id`.
- `trafo.js`: daftar dari `transformer_data` LEFT JOIN `trafo` (nama custom, foto). Response tetap
  `{ id, nama, image_url, device_serial, status }`. Tambah `GET/PUT /api/trafo/:id/data` untuk nameplate.

## 8. Frontend

### 8.1 `config/metrics.js`

Key lama tetap. Grup dan key baru: Power per Phase (`powerActiveA/B/C`, `powerReactiveA/B/C`,
`powerApparentA/B/C`, `pfA/B/C`), THD (`thdVA/B/C`, `thdIA/B/C`), Temperature (`wtiA/B/C`,
`busTempA/B/C`), Oil Quality (`h2ppm`, `moisturePpm`), De-rating (`deRatingA/B/C`, `kRatedA/B/C`),
Voltage Unbalance (`unbalanceUV/VW/UW`).

### 8.2 Context

- `TrendDataContext`: hapus `mapReadingToPoint`; respons API sudah key frontend.
- `TemperatureDataContext`: tetap, hanya sumber `oil_sensor` berubah di backend.
- `ThresholdContext`: URL `/api/settings/limits`; `getThreshold` mengembalikan `{ min, max, is_active: true, tripMin, tripMax }`.

### 8.3 Panel baru (`components/visualizations/`)

| Tipe | Komponen | Data |
|---|---|---|
| `harmonic` | `HarmonicPanel` | `/api/trafo/:id/harmonics`, opsi `source` voltage/current, refresh 60 s |
| `derating` | `DeratingPanel` | `latestData.derating` dari event `meter` |
| `trafostatus` | `TransformerStatusPanel` | `/api/trafo/:id/status`, refresh 60 s |
| `physicalstatus` | `PhysicalStatusPanel` | `/api/trafo/:id/physical` |
| `oilquality` | `OilQualityPanel` | `/api/trafo/:id/oil-quality` |

Didaftarkan di `PanelRenderer`, daftar tipe modal, `NO_METRIC_PANELS`, dan `index.js`.

### 8.4 Preset

Empat profil bawaan tidak bisa diedit: Physical, Electrical (aktif bawaan), Status, Oil Quality.
Isinya mengikuti dokumen bagian 3 sampai 6. Pressure chart punya garis referensi 0.5 Bar.

### 8.5 Halaman

- `TransformerSelection`: tidak berubah.
- `TransformerData`: tambah nameplate (baca semua, edit untuk admin/superuser) → `PUT /api/trafo/:id/data`.
- `Settings`: tulis ulang, grup seperti web lama, input angka dengan satuan, centang trip enable.
- `PerformanceReport`: tidak berubah; backend menambah baris THD, Ineutral, H2, Moisture, suhu.
- `Login`, `Profile`, `AddUser`, `ManageUsersSuperuser`, `AdminDashboard`: hanya nama field respons.

## 9. Migrasi, data uji, pengujian

- Import `master_tmu_app.sql` → `master_tmu_app`, `base_tmu.sql` → `db_demo`. `.env`: `MASTER_DB=master_tmu_app`.
- `backend/scripts/migrate_master.js`: salin `tmu_master` lama → `master_tmu_app` (company_key acak, password bcrypt dibiarkan).
- `backend/utils/schemaPatch.js` (pengganti `autoIndex.js`), idempoten saat startup: kolom `email`, `phone`
  di `user`; `user_layouts`; `trafoId` di tiga tabel temp; index unik `(trafoId, timestamp)` di `reading_data`,
  `(trafoId, failure_id)` di `failure_log`; index `(trafoId, timestamp)`.
- `backend/scripts/seed_demo.js`: satu trafo lengkap, settings, status 3, rekomendasi contoh.
- `backend/scripts/fake_raspi.js`: simulator protokol client; sesekali ubah satu status ke alarm.
- Test: `node:test` untuk `readingModel` (peta, satuan, efisiensi, de-rating), limits, label status,
  diff status → alert, handler `raspiSync` dengan db palsu. Frontend: `npm run lint` + cek manual.

## 10. Urutan kerja

1. Database lokal, `MASTER_DB`, `schemaPatch.js`.
2. `readingModel.js` + test.
3. Auth dan route master.
4. Route trafo (daftar, status, physical, harmonics, oil-quality, nameplate).
5. Route settings (thresholds, trip, limits, dorong ke Raspi).
6. Route trends, analytics, report, export, thi, events, news.
7. Poller dan payload Socket.IO.
8. `raspiSync.js`, handler, scheduler, `fake_raspi.js`.
9. Alert.
10. Frontend: `metrics.js`, context.
11. Frontend: panel baru dan preset.
12. Settings dan nameplate.
13. Bersih-bersih kode lama.

## 11. Di luar cakupan

Dukungan kolom v1 (`kWhInp/kWhOut`), report instantaneous dan performance dari Raspi, Telegram,
migrasi password bcrypt ke sha256, pilihan interval 1/5/10/15 menit.
