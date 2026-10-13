# Dokumentasi Dashboard TMU v2
### Transformer Monitoring Unit

---

---

## Daftar Isi

1. [Gambaran Umum Sistem](#1-gambaran-umum-sistem)
2. [Alur Data Secara Umum](#2-alur-data-secara-umum)
3. [Dashboard Physical](#3-dashboard-physical)
4. [Dashboard Electrical](#4-dashboard-electrical)
5. [Dashboard Status](#5-dashboard-status)
6. [Dashboard Oil Quality](#6-dashboard-oil-quality)
7. [Struktur Database](#7-struktur-database)
8. [Konsep Penting yang Perlu Dipahami](#8-konsep-penting-yang-perlu-dipahami)

---

## 1. Gambaran Umum Sistem

Aplikasi TMU v2 adalah sistem pemantauan transformator listrik secara real-time berbasis IoT. Data dikirim dari perangkat keras (Raspberry Pi yang terpasang pada transformator) ke server, kemudian ditampilkan melalui 4 halaman dashboard.

### Stack Teknologi

| Komponen | Teknologi |
|---|---|
| Backend (server) | Node.js + Express.js |
| Template Engine | EJS (HTML yang bisa disisipkan variabel dari server) |
| Database | MySQL |
| Komunikasi Real-time | WebSocket (ws library) |
| Chart / Grafik | Chart.js |
| Frontend Helper | jQuery, Moment.js, Bootstrap 5 |

### Istilah Penting

- **trafoId** — ID unik setiap transformator di database
- **raspiSerialNo** — Nomor seri Raspberry Pi yang terpasang di transformator
- **companyTMUVersion** — Versi TMU yang dipakai oleh perusahaan (v1 atau v2). Mempengaruhi kolom database dan endpoint API yang digunakan
- **deviceConnectedStatus** — Status koneksi device: `1` = online, selain `1` = offline
- **dbName** — Nama database yang dipakai (berbeda per perusahaan/pelanggan)

---

## 2. Alur Data Secara Umum

Berikut alur data dari perangkat keras sampai ditampilkan di browser:

```
[Transformator + Sensor]
        │
        │ (sensor membaca tegangan, arus, suhu, dll.)
        ▼
[Raspberry Pi — IoT Edge Device]
        │
        │ WebSocket (koneksi permanen ke server)
        ▼
[Server Node.js — websocket.js]
        │
        │ Menyimpan data ke MySQL
        ▼
[Tabel: temp_reading_data_realtime]
[Tabel: transformer_status]
[Tabel: temp_voltage_harmonic]
[Tabel: temp_current_harmonic]
        │
        │ Saat user buka halaman dashboard:
        │ 1. Server render HTML awal (SSR via EJS)
        │ 2. Server kirim perintah ke device via WebSocket (minta data terbaru)
        │ 3. Browser lakukan AJAX ke API setelah 3 detik
        ▼
[Browser — Chart.js merender grafik dari data JSON]
```

### Mengapa Ada Delay 3 Detik?

Ketika halaman dibuka, server mengirim perintah ke Raspberry Pi lewat WebSocket untuk meminta data terbaru. Raspberry Pi butuh waktu untuk merespon dan data masuk ke database. Makanya ada `setTimeout(initiatePage, 3000)` di semua dashboard — browser menunggu 3 detik dulu sebelum mengambil data via AJAX, supaya data yang ditampilkan sudah yang terbaru.

---

## 3. Dashboard Physical

**URL**: `/dashboard-physical`

**Fungsi**: Memantau kondisi **fisik** transformator — suhu, tekanan, level oli, tap changer, dan proteksi mekanis.

---

### 3.1 File-file Terkait

| Tipe File | Path |
|---|---|
| Route (handler server) | `routes/pageRouter.js` → `GET /dashboard-physical` |
| View (HTML template) | `views/dashboard-physical.ejs` |
| JavaScript Frontend | `assets/js/pages/dashboard-physical.js` |
| Model (query DB) | `model/transformer-model.js` |

---

### 3.2 Apa Saja yang Ditampilkan

#### A. Grafik Suhu (Temperature Monitoring)

Tipe chart: **Line Chart** | Canvas ID: `temperature-chart`

Menampilkan tren suhu selama beberapa waktu terakhir.

| Label di Chart | Kolom Database | Tabel | Satuan |
|---|---|---|---|
| Oil Temp | `OilTemp` | `temp_reading_data_realtime` | °C |
| Bus Temp Phase A | `BusTemp1` | `temp_reading_data_realtime` | °C |
| Bus Temp Phase B | `BusTemp2` | `temp_reading_data_realtime` | °C |
| Bus Temp Phase C | `BusTemp3` | `temp_reading_data_realtime` | °C |

**API yang dipanggil:**
```
GET /api/transformer/getPhysicalReadingDataRealTime?interval={N}
```

**Query (ringkasan):**
```sql
SELECT
  ROUND(AVG(OilTemp), 2)  AS OilTemp,
  ROUND(AVG(BusTemp1), 2) AS BusTemp1,
  ROUND(AVG(BusTemp2), 2) AS BusTemp2,
  ROUND(AVG(BusTemp3), 2) AS BusTemp3
FROM {dbName}.temp_reading_data_realtime
GROUP BY UNIX_TIMESTAMP(TIMESTAMP) DIV ({interval} * 60)
ORDER BY TIMESTAMP ASC LIMIT 10
```

> Sumbu Y: `°C`, dengan `suggestedMin: 30`. Sumbu X: Timestamp format `HH:mm`.

---

#### B. Grafik WTI (Winding Temperature Indicator)

Tipe chart: **Line Chart** | Canvas ID: `wti-chart`

Menampilkan suhu belitan (winding) transformator per fase.

| Label di Chart | Kolom Database | Tabel | Satuan |
|---|---|---|---|
| WTI Phase A | `WTITemp1` | `temp_reading_data_realtime` | °C |
| WTI Phase B | `WTITemp2` | `temp_reading_data_realtime` | °C |
| WTI Phase C | `WTITemp3` | `temp_reading_data_realtime` | °C |

**API yang dipanggil:** sama dengan grafik suhu di atas.

```
GET /api/transformer/getPhysicalReadingDataRealTime?interval={N}
```

**Query (ringkasan):**
```sql
SELECT
  ROUND(AVG(WTITemp1), 2) AS WTITemp1,
  ROUND(AVG(WTITemp2), 2) AS WTITemp2,
  ROUND(AVG(WTITemp3), 2) AS WTITemp3
FROM {dbName}.temp_reading_data_realtime
GROUP BY UNIX_TIMESTAMP(TIMESTAMP) DIV ({interval} * 60)
ORDER BY TIMESTAMP ASC LIMIT 10
```

> Sumbu Y: `°C`. Catatan: data WTI dan Temperature diambil dari **satu API call yang sama**, lalu dipisah menjadi dua chart berbeda di frontend.

---

#### C. Grafik Tekanan (Pressure)

Tipe chart: **Line Chart** | Canvas ID: `pressure-chart`

Menampilkan tren tekanan tangki minyak transformator.

| Label di Chart | Kolom Database | Tabel | Satuan |
|---|---|---|---|
| Pressure | `Press` | `temp_reading_data_realtime` | Bar |

**API yang dipanggil:** sama dengan grafik suhu.

```
GET /api/transformer/getPhysicalReadingDataRealTime?interval={N}
```

**Query (ringkasan):**
```sql
SELECT ROUND(AVG(Press), 2) AS Press
FROM {dbName}.temp_reading_data_realtime
GROUP BY UNIX_TIMESTAMP(TIMESTAMP) DIV ({interval} * 60)
ORDER BY TIMESTAMP ASC LIMIT 10
```

> Sumbu Y: `Bar`, range `suggestedMin: 0.3` s/d `suggestedMax: 0.52`.
> Terdapat **garis merah horizontal di y = 0.5 Bar** (threshold hardcoded, diberi label "Max").

---

#### D. Status Card

| Widget | Tabel Sumber | Kolom | Penjelasan |
|---|---|---|---|
| Tap Position | `transformer_data` | `tapType`, `impedance` | Jika `tapType == 'OCTC'` → tampilkan "OCTC". Selain itu → tampilkan nilai `impedance` |
| Oil Level Status | `transformer_status` | `OilLevel` | Kode status: 3=Safe🟢, 2=Warning🟡, 1=Danger🔴 |
| Pressure Badge | `transformer_status` | `Pressure` | Kode status: 3=Safe, 2/4=Alarm, 1/5=Trip |
| Gas Fault Log | `failure_log` | `time_start` | Timestamp kejadian gas fault terakhir (dari SSR saat halaman dibuka) |
| Sudden Pressure Relay | `transformer_data` | `SuddenPressure` | `0`=Inactive, `1`=Active. Jika aktif, tampilkan log dari `failure_log` |

---

### 3.3 Cara Kerja Teknis

**Langkah 1 — Server menerima request:**
```
GET /dashboard-physical
```
Server langsung menjalankan beberapa query MySQL:
- `getTransformerData(trafoId)` → data konfigurasi transformator
- `getTransformerSettings(trafoId)` → threshold alarm/trip
- `getTransformerStatus(trafoId)` → status terkini tiap parameter
- `getRecentGasFaultLog(trafoId)` → log gas fault terakhir
- `getRecentSuddenPressureLog(trafoId)` → log sudden pressure terakhir

**Langkah 2 — Server kirim perintah ke device:**
```javascript
websocket.sendMessage(raspiSerialNo, { type: "requestReadingDataRealTime" });
websocket.sendMessage(raspiSerialNo, { type: "requestTapPositionRealTime" });
```

**Langkah 3 — Browser minta data chart (setelah 3 detik):**
```
GET /api/transformer/getPhysicalReadingDataRealTime?interval=1
```
Parameter `interval` bisa dipilih user: 1, 5, 10, atau 15 menit. Artinya data dirata-rata per interval tersebut. Selalu mengambil 10 data point terakhir.

**Query yang dijalankan:**
```sql
SELECT
  ROUND(AVG(OilTemp), 2) AS OilTemp,
  ROUND(AVG(BusTemp1), 2) AS BusTemp1,
  -- ... dst
FROM temp_reading_data_realtime
GROUP BY UNIX_TIMESTAMP(TIMESTAMP) DIV (interval * 60)
ORDER BY TIMESTAMP ASC LIMIT 10
```

---

### 3.4 Sistem Status (Kode Angka)

Kolom-kolom di tabel `transformer_status` tidak menyimpan nilai asli sensor, tapi menyimpan **kode status** berupa angka:

| Nilai | Arti | Badge yang Muncul |
|---|---|---|
| `1` | Low Trip — nilai terlalu rendah, berbahaya | 🔴 Trip |
| `2` | Low Alarm — nilai agak rendah, perlu perhatian | 🟡 Alarm |
| `3` | Normal / Safe | Tidak ditampilkan (aman) |
| `4` | High Alarm — nilai agak tinggi, perlu perhatian | 🟡 Alarm |
| `5` | High Trip — nilai terlalu tinggi, berbahaya | 🔴 Trip |

---

### 3.5 State Halaman

| State | Kondisi | Yang Ditampilkan |
|---|---|---|
| Loading | Halaman baru dibuka | Animasi loading orbital |
| Offline | `deviceConnectedStatus != 1` | Card "Device is Offline" dengan tombol Refresh |
| No Data | Device online tapi tidak ada data hari ini | Card "No Data Found For Today" |
| Normal | Ada data | Semua chart dan status card |

---

## 4. Dashboard Electrical

**URL**: `/dashboard-electrical`

**Fungsi**: Memantau **kondisi kelistrikan** transformator — tegangan, arus, daya, power factor, harmonik, efisiensi, dan de-rating.

---

### 4.1 File-file Terkait

| Tipe File | Path |
|---|---|
| Route | `routes/pageRouter.js` → `GET /dashboard-electrical` |
| View | `views/dashboard-electrical.ejs` |
| JavaScript Frontend | `assets/js/pages/dashboard-electrical.js` |
| Model | `model/transformer-model.js` |

---

### 4.2 Apa Saja yang Ditampilkan

Dashboard ini adalah yang paling kompleks. Ada **14 panel** yang bisa ditampilkan/disembunyikan lewat checkbox "Show Options".

Semua chart time-series (kecuali Harmonik dan De-rating) menggunakan **satu API call yang sama**, yaitu:
```
GET /api/transformer/getElectricalReadingDataRealTime_v2?interval={N}   (TMU v2)
GET /api/transformer/getElectricalReadingDataRealTime?interval={N}      (TMU v1)
```
Sumber tabel: **`{dbName}.temp_reading_data_realtime`**

---

#### A. Grafik Tegangan Phase-to-Neutral

Tipe chart: **Line Chart** | Canvas ID: `voltage-phase-neutral-chart`

| Label di Chart | Kolom | Tabel | Satuan |
|---|---|---|---|
| Van | `Van` | `temp_reading_data_realtime` | Volt |
| Vbn | `Vbn` | `temp_reading_data_realtime` | Volt |
| Vcn | `Vcn` | `temp_reading_data_realtime` | Volt |

> Sumbu Y: `Volt`

---

#### B. Grafik Tegangan Phase-to-Phase

Tipe chart: **Line Chart** | Canvas ID: `voltage-phase-chart`

| Label di Chart | Kolom | Tabel | Satuan |
|---|---|---|---|
| Vab | `Vab` | `temp_reading_data_realtime` | Volt |
| Vbc | `Vbc` | `temp_reading_data_realtime` | Volt |
| Vca | `Vca` | `temp_reading_data_realtime` | Volt |

> Sumbu Y: `Volt`

---

#### C. Grafik Arus (Current)

Tipe chart: **Line Chart** | Canvas ID: `current-chart`

| Label di Chart | Kolom | Tabel | Satuan |
|---|---|---|---|
| Ia | `Ia` | `temp_reading_data_realtime` | Ampere |
| Ib | `Ib` | `temp_reading_data_realtime` | Ampere |
| Ic | `Ic` | `temp_reading_data_realtime` | Ampere |
| Itotal | `Iavg` | `temp_reading_data_realtime` | Ampere |
| Ineutral | `Ineutral` | `temp_reading_data_realtime` | Ampere |

> Sumbu Y: `Ampere`. `Iavg` ditampilkan dengan label "Itotal" di chart.

---

#### D. Grafik THD Voltage

Tipe chart: **Line Chart** | Canvas ID: `thdv-chart`

| Label di Chart | Kolom | Tabel | Satuan |
|---|---|---|---|
| THDV A | `THDV1` | `temp_reading_data_realtime` | % |
| THDV B | `THDV2` | `temp_reading_data_realtime` | % |
| THDV C | `THDV3` | `temp_reading_data_realtime` | % |

> Sumbu Y: `% (Percentage)`

---

#### E. Grafik THD Current

Tipe chart: **Line Chart** | Canvas ID: `thdi-chart`

| Label di Chart | Kolom | Tabel | Satuan |
|---|---|---|---|
| THDI A | `THDI1` | `temp_reading_data_realtime` | % |
| THDI B | `THDI2` | `temp_reading_data_realtime` | % |
| THDI C | `THDI3` | `temp_reading_data_realtime` | % |

> Sumbu Y: `% (Percentage)`

---

#### F. Grafik Active Power (Daya Aktif)

Tipe chart: **Line Chart** | Canvas ID: `active-power-chart`

| Label di Chart | Kolom | Tabel | Satuan |
|---|---|---|---|
| Pa | `Pa` | `temp_reading_data_realtime` | Watt |
| Pb | `Pb` | `temp_reading_data_realtime` | Watt |
| Pc | `Pc` | `temp_reading_data_realtime` | Watt |
| PΣ | `Psig` | `temp_reading_data_realtime` | Watt |

> Sumbu Y: `Watt`. `Psig` adalah daya aktif total ketiga fase.

---

#### G. Grafik Reactive Power (Daya Reaktif)

Tipe chart: **Line Chart** | Canvas ID: `reactive-power-chart`

| Label di Chart | Kolom | Tabel | Satuan |
|---|---|---|---|
| Qa | `Qa` | `temp_reading_data_realtime` | VAR |
| Qb | `Qb` | `temp_reading_data_realtime` | VAR |
| Qc | `Qc` | `temp_reading_data_realtime` | VAR |
| QΣ | `Qsig` | `temp_reading_data_realtime` | VAR |

> Sumbu Y: `VAR`. Nilai positif = Leading (kapasitif), nilai negatif = Lagging (induktif).

---

#### H. Grafik Apparent Power (Daya Semu)

Tipe chart: **Line Chart** | Canvas ID: `apparent-power-chart`

| Label di Chart | Kolom | Tabel | Satuan |
|---|---|---|---|
| Sa | `Sa` | `temp_reading_data_realtime` | VA |
| Sb | `Sb` | `temp_reading_data_realtime` | VA |
| Sc | `Sc` | `temp_reading_data_realtime` | VA |
| SΣ | `Ssig` | `temp_reading_data_realtime` | VA |

> Sumbu Y: `VA`. Juga digunakan untuk menghitung de-rating (Sa/1000/ratedPower).

---

#### I. Grafik Power Factor

Tipe chart: **Line Chart** | Canvas ID: `power-factor-chart`

| Label di Chart | Kolom | Tabel | Satuan |
|---|---|---|---|
| PFa | `PFa` | `temp_reading_data_realtime` | — (0–1) |
| PFb | `PFb` | `temp_reading_data_realtime` | — (0–1) |
| PFc | `PFc` | `temp_reading_data_realtime` | — (0–1) |
| PFΣ | `PFsig` | `temp_reading_data_realtime` | — (0–1) |

> Sumbu Y tanpa label satuan. Rentang ideal mendekati 1.

---

#### J. Grafik Frequency

Tipe chart: **Line Chart** | Canvas ID: `frequency-chart`

| Label di Chart | Kolom | Tabel | Satuan |
|---|---|---|---|
| Frequency | `Freq` | `temp_reading_data_realtime` | Hz |

> Sumbu Y: `Hz`. Terdapat **garis merah horizontal** sebagai batas alarm atas, nilainya dihitung dari:
> ```
> threshold = frequency + (frequencyHighAlarmTreshold / 100) × frequency
> ```
> dimana `frequency` dari `transformer_data` dan `frequencyHighAlarmTreshold` dari `transformer_settings`.

---

#### K. Grafik Efisiensi (Efficiency)

Tipe chart: **Line Chart** | Canvas ID: `efficiency-chart`

Efisiensi **tidak diambil dari database**, melainkan **dihitung di frontend** menggunakan data time-series `Iavg` dari API dan konstanta konfigurasi transformator dari SSR.

| Data yang Digunakan | Sumber | Keterangan |
|---|---|---|
| `Iavg` | `temp_reading_data_realtime` (via API) | Arus rata-rata saat ini |
| `ratedCurrentLowVoltage` | `transformer_data` (via SSR) | Arus nominal sisi rendah |
| `fullLoadLoss` | `transformer_data` (via SSR) | Rugi beban penuh (Watt) |
| `noLoadLoss` | `transformer_data` (via SSR) | Rugi tanpa beban (Watt) |
| `ratedPower` | `transformer_data` (via SSR) | Daya nominal (kVA) |

**Rumus perhitungan:**
```
loadLoss  = Iavg / ratedCurrentLowVoltage / fullLoadLoss
efficiency = (1 - (noLoadLoss + loadLoss) / (ratedPower × 1000 + noLoadLoss + loadLoss)) × 100%
```

> Sumbu Y: `% (Percentage)`.

---

#### L. Grafik Harmonic Distortion Voltage (Bar Chart)

Tipe chart: **Bar Chart**

Menampilkan kandungan harmonik tegangan **per orde** (1st hingga 31st) untuk ketiga fase sekaligus.

| Label di Chart | Filter Data | Tabel | Kolom |
|---|---|---|---|
| Va | `Phase = 1` | `temp_voltage_harmonic` | `1st`, `3rd`, `5th`, ..., `31st` |
| Vb | `Phase = 2` | `temp_voltage_harmonic` | `1st`, `3rd`, `5th`, ..., `31st` |
| Vc | `Phase = 3` | `temp_voltage_harmonic` | `1st`, `3rd`, `5th`, ..., `31st` |

**API yang dipanggil (terpisah dari chart lain):**
```
GET /api/transformer/getTempVoltageHarmonic
```

> Diisi saat WebSocket menerima perintah `requestVoltageHarmonicRealTime` dari server.

---

#### M. Grafik Harmonic Distortion Current (Bar Chart)

Tipe chart: **Bar Chart**

Sama dengan harmonik tegangan, tapi untuk arus.

| Label di Chart | Filter Data | Tabel | Kolom |
|---|---|---|---|
| Ia | `Phase = 1` | `temp_current_harmonic` | `1st`, `3rd`, `5th`, ..., `31st` |
| Ib | `Phase = 2` | `temp_current_harmonic` | `1st`, `3rd`, `5th`, ..., `31st` |
| Ic | `Phase = 3` | `temp_current_harmonic` | `1st`, `3rd`, `5th`, ..., `31st` |

**API yang dipanggil:**
```
GET /api/transformer/getTempCurrentHarmonic
```

> Diisi saat WebSocket menerima perintah `requestCurrentHarmonicRealTime`.

---

#### N. De-rating Chart (Pie Chart per Fase A, B, C)

Tipe chart: **Pie Chart berlapis (doughnut)** | Canvas ID: `de-rating-a-chart`, `de-rating-b-chart`, `de-rating-c-chart`

De-rating menunjukkan **penurunan kapasitas transformator** akibat harmonik (K-Factor). Ditampilkan sebagai pie chart untuk fase A, B, dan C secara terpisah.

**Sumber data:** API `getLastRowReadingDataRealTime` (baris terbaru dari `temp_reading_data_realtime`)

| Data yang Digunakan | Kolom/Sumber | Keterangan |
|---|---|---|
| `deRatinga` / `deRatingb` / `deRatingc` | `temp_reading_data_realtime` (via API) | Persentase de-rating per fase (0–100%) |
| `Sa` / `Sb` / `Sc` | `temp_reading_data_realtime` (via API) | Apparent power per fase (VA) — untuk menghitung "Used" |
| `KRateda` / `KRatedb` / `KRatedc` | `temp_reading_data_realtime` (via API) | Nilai K-Factor per fase — ditampilkan sebagai judul chart |
| `ratedPower` | `transformer_data` (via SSR) | Daya nominal (kVA) |

**Rumus perhitungan segmen chart:**
```
fullCircleValue = ratedPower / 3                              (kapasitas per fase dalam kVA)
available       = (deRating% / 100) × fullCircleValue         (kapasitas setelah de-rating)
deRatingValue   = fullCircleValue - available                 (kapasitas yang hilang)
used            = (Sa / 1000 / ratedPower) × ratedPower       (kapasitas terpakai beban)
remaining       = fullCircleValue - used                      (sisa kapasitas dari beban)
```

| Segmen | Warna | Keterangan |
|---|---|---|
| Used | 🟡 Kuning | Kapasitas terpakai beban nyata |
| Available | 🟢 Hijau | Sisa kapasitas yang masih bisa digunakan |
| De-rating | 🔴 Merah | Kapasitas yang hilang akibat harmonik |

**API yang dipanggil:**
```
GET /api/transformer/getLastRowReadingDataRealTime
```
Tabel sumber: `{dbName}.temp_reading_data_realtime` (SELECT * ORDER BY TIMESTAMP DESC LIMIT 1)

---

#### O. Info Card — kWh & kVARh Total

Bukan chart grafis, melainkan **angka total** yang ditampilkan sebagai kartu.

| Widget | Kolom (TMU v1) | Kolom (TMU v2) | Tabel | API |
|---|---|---|---|---|
| kWh Total | `kWhInp + kWhOut` | `kWh` | `temp_reading_data_realtime` | `getLastRowReadingDataRealTime` |
| kVARh Total | `kVARhInp + kVARhOut` | `kVARh` | `temp_reading_data_realtime` | `getLastRowReadingDataRealTime` |

---

#### P. Status Badge Instantaneous

Badge kecil di samping nama parameter (Van, Vbn, Current, PF, dll.), bukan chart, datanya dari SSR.

| Badge | Tabel Sumber | Kolom |
|---|---|---|
| Status Arus | `transformer_status` | `Current1` (dipetakan ke `Current`) |
| Status Van, Vbn, Vcn | `transformer_status` | `Vab`, `Vbc`, `Vca` |
| Status Vab, Vbc, Vca | `transformer_status` | `Vab`, `Vbc`, `Vca` |
| Status Power Factor | `transformer_status` | `PF` |
| Status Frequency | `transformer_status` | `Freq` |
| Leading/Lagging Qa/Qb/Qc | `temp_reading_data_realtime` | `Qa`, `Qb`, `Qc` (via `getLastRowReadingDataRealTime`) |

---

#### O. Info Card — kWh & kVARh Total

Bukan chart grafis, melainkan **angka total** yang ditampilkan sebagai kartu.

| Widget | Kolom (TMU v1) | Kolom (TMU v2) | Tabel | API |
|---|---|---|---|---|
| kWh Total | `kWhInp + kWhOut` | `kWh` | `temp_reading_data_realtime` | `getLastRowReadingDataRealTime` |
| kVARh Total | `kVARhInp + kVARhOut` | `kVARh` | `temp_reading_data_realtime` | `getLastRowReadingDataRealTime` |

---

#### P. Status Badge Instantaneous

Badge kecil di samping nama parameter, datanya dari **SSR** (bukan AJAX).

| Badge | Tabel | Kolom |
|---|---|---|
| Status Arus | `transformer_status` | `Current1` |
| Status Van, Vbn, Vcn | `transformer_status` | `Vab`, `Vbc`, `Vca` |
| Status Vab, Vbc, Vca | `transformer_status` | `Vab`, `Vbc`, `Vca` |
| Status Power Factor | `transformer_status` | `PF` |
| Status Frequency | `transformer_status` | `Freq` |
| Leading/Lagging Qa/Qb/Qc | `temp_reading_data_realtime` | `Qa`, `Qb`, `Qc` (via `getLastRowReadingDataRealTime`) |

---

#### Ringkasan: Chart → API → Tabel → Kolom

| Chart | API | Tabel | Kolom |
|---|---|---|---|
| A. Tegangan Phase-Neutral | `getElectricalReadingDataRealTime_v2` | `temp_reading_data_realtime` | `Van`, `Vbn`, `Vcn` |
| B. Tegangan Phase-Phase | `getElectricalReadingDataRealTime_v2` | `temp_reading_data_realtime` | `Vab`, `Vbc`, `Vca` |
| C. Arus | `getElectricalReadingDataRealTime_v2` | `temp_reading_data_realtime` | `Ia`, `Ib`, `Ic`, `Iavg`, `Ineutral` |
| D. THD Voltage | `getElectricalReadingDataRealTime_v2` | `temp_reading_data_realtime` | `THDV1`, `THDV2`, `THDV3` |
| E. THD Current | `getElectricalReadingDataRealTime_v2` | `temp_reading_data_realtime` | `THDI1`, `THDI2`, `THDI3` |
| F. Active Power | `getElectricalReadingDataRealTime_v2` | `temp_reading_data_realtime` | `Pa`, `Pb`, `Pc`, `Psig` |
| G. Reactive Power | `getElectricalReadingDataRealTime_v2` | `temp_reading_data_realtime` | `Qa`, `Qb`, `Qc`, `Qsig` |
| H. Apparent Power | `getElectricalReadingDataRealTime_v2` | `temp_reading_data_realtime` | `Sa`, `Sb`, `Sc`, `Ssig` |
| I. Power Factor | `getElectricalReadingDataRealTime_v2` | `temp_reading_data_realtime` | `PFa`, `PFb`, `PFc`, `PFsig` |
| J. Frequency | `getElectricalReadingDataRealTime_v2` | `temp_reading_data_realtime` | `Freq` |
| K. Efisiensi | `getElectricalReadingDataRealTime_v2` | `temp_reading_data_realtime` + `transformer_data` | `Iavg` + `ratedCurrentLowVoltage`, `fullLoadLoss`, `noLoadLoss`, `ratedPower` |
| L. Harmonic Voltage | `getTempVoltageHarmonic` | `temp_voltage_harmonic` | `Phase`, `1st`–`31st` |
| M. Harmonic Current | `getTempCurrentHarmonic` | `temp_current_harmonic` | `Phase`, `1st`–`31st` |
| N. De-rating A/B/C | `getLastRowReadingDataRealTime` | `temp_reading_data_realtime` | `deRatinga/b/c`, `Sa/Sb/Sc`, `KRateda/b/c` |
| kWh/kVARh Card | `getLastRowReadingDataRealTime` | `temp_reading_data_realtime` | `kWh`/`kWhInp+kWhOut`, `kVARh`/`kVARhInp+kVARhOut` |

---

### 4.3 Cara Kerja Teknis

**Langkah 1 — Server kirim 3 perintah ke device via WebSocket:**
```javascript
{ type: "requestReadingDataRealTime" }       // data sensor utama
{ type: "requestCurrentHarmonicRealTime" }   // data harmonik arus
{ type: "requestVoltageHarmonicRealTime" }   // data harmonik tegangan
```
Server menunggu 3 detik (`setTimeout`) sebelum merender halaman supaya data sempat masuk.

**Langkah 2 — Browser memanggil 4 API:**

| API | Digunakan untuk Chart |
|---|---|
| `getElectricalReadingDataRealTime_v2?interval=N` | Tegangan, Arus, THD, Daya, PF, Frequency, Efisiensi |
| `getTempVoltageHarmonic` | Harmonic Distortion Voltage (bar chart) |
| `getTempCurrentHarmonic` | Harmonic Distortion Current (bar chart) |
| `getLastRowReadingDataRealTime` | De-rating chart, kWh/kVARh total, badge Leading/Lagging |

**Perbedaan v1 vs v2:**

| Aspek | TMU v1 | TMU v2 |
|---|---|---|
| Endpoint | `getElectricalReadingDataRealTime` | `getElectricalReadingDataRealTime_v2` |
| Kolom kWh | `kWhInp + kWhOut` | `kWh` |
| Kolom kVARh | `kVARhInp + kVARhOut` | `kVARh` |

---

### 4.4 Status Leading / Lagging

Power Factor bisa bersifat leading (kapasitif) atau lagging (induktif). Dashboard menentukan ini dari **tanda (sign) nilai Reactive Power**:
- `Qa > 0` → **Leading** (kapasitif)
- `Qa < 0` → **Lagging** (induktif)

---

## 5. Dashboard Status

**URL**: `/dashboard-status`

**Fungsi**: Menampilkan **ringkasan kondisi keseluruhan** transformator — apakah semua parameter aman, atau ada yang dalam kondisi alarm/trip. Juga menyediakan **rekomendasi perbaikan** untuk setiap masalah yang terdeteksi.

---

### 5.1 File-file Terkait

| Tipe File | Path |
|---|---|
| Route | `routes/pageRouter.js` → `GET /dashboard-status` |
| View | `views/dashboard-status.ejs` |
| JavaScript Frontend | `assets/js/pages/dashboard-status.js` |
| Model | `model/transformer-model.js` |

---

### 5.2 Cara Kerja

Dashboard Status berbeda dari dashboard lain — **tidak ada chart time-series**. Fokusnya adalah menampilkan "snapshot" status semua parameter transformator saat ini.

**Langkah 1 — Browser memanggil API status:**
```
GET /api/transformer/getTransformerStatus_v2/{trafoId}   (untuk TMU v2)
GET /api/transformer/getTransformerStatus/{trafoId}      (untuk TMU v1)
```

Respon API adalah objek berisi semua parameter dengan nilai status numerik (1-5).

**Langkah 2 — JS memfilter parameter yang bermasalah:**

```javascript
Object.keys(resultArray[0]).forEach(key => {
    if (resultArray[0][key] != 3) {  // 3 = Normal, tampilkan yang bukan 3
        // buat baris tabel untuk parameter ini
    }
});
```

**Langkah 3 — Untuk setiap masalah, ambil rekomendasi:**
```
GET /api/transformer/getFailureRecommendation?key=OilTemp
```
Rekomendasi diambil dari tabel master `parameter_failure_recommendation`.

---

### 5.3 Dua Kondisi Tampilan

#### Kondisi 1: Semua Aman (Safe State)
Jika semua parameter bernilai `3` (normal), tampil halaman hijau dengan animasi pulse:
> ✅ **"All Systems Optimal"** — Semua parameter transformator dalam kondisi normal.

#### Kondisi 2: Ada Masalah (Problem State)
Menampilkan tabel berisi daftar semua parameter yang bermasalah:

| Kolom Tabel | Isi |
|---|---|
| Parameter | Nama parameter (contoh: `OilTemp`, `Vab`, `Current1`) |
| Status | Badge merah Trip atau kuning Alarm |
| Keterangan | Low Trip / Low Alarm / High Alarm / High Trip |
| Rekomendasi | (bisa di-expand) Langkah perbaikan dari database master |

---

### 5.4 Parameter yang Dipantau

**Untuk TMU v2:**

| Kategori | Parameter |
|---|---|
| Tegangan | `Vab`, `Vbc`, `Vca`, `Uab`, `Ubc`, `Uca` |
| Arus | `Current1`, `Current2`, `Current3`, `Ineutral` |
| Suhu | `OilTemp`, `WTITemp1-3`, `BusTemp1-3` |
| Power | `PF`, `Freq` |
| THD | `THDVoltage1-3`, `THDCurrent1-3` |
| Fisik | `Pressure`, `OilLevel` |
| Kualitas Oli | `H2ppm`, `Moistureppm` |

---

### 5.5 Pengelompokan Key untuk Rekomendasi

Beberapa parameter dikelompokkan saat mencari rekomendasi, karena rekomendasinya sama:

| Parameter Asli | Key Pencarian |
|---|---|
| `WTITemp1`, `WTITemp2`, `WTITemp3` | `WTITemp` |
| `BusTemp1`, `BusTemp2`, `BusTemp3` | `BusTemp` |
| `THDCurrent1`, `THDCurrent2`, `THDCurrent3` | `THDCurrent` |
| `Current1`, `Current2`, `Current3` | `Current` |

---

## 6. Dashboard Oil Quality

**URL**: `/dashboard-oil-quality`

**Fungsi**: Memantau **kualitas minyak isolasi** transformator — kelembaban minyak, kandungan gas hidrogen terlarut, dan kondisi umum minyak.

---

### 6.1 File-file Terkait

| Tipe File | Path |
|---|---|
| Route | `routes/pageRouter.js` → `GET /dashboard-oil-quality` |
| View | `views/dashboard-oil-quality.ejs` |
| JavaScript Frontend | `assets/js/pages/dashboard-oil-quality.js` |
| Model | `model/transformer-model.js` |

---

### 6.2 Mengapa Kualitas Oli Penting?

Minyak transformator berfungsi ganda: sebagai **pendingin** dan **isolator listrik**. Minyak yang kualitasnya buruk bisa menyebabkan:
- Panas berlebih → kerusakan lilitan
- Kegagalan isolasi → hubung singkat
- Ledakan akibat gas terlarut yang terlalu tinggi

---

### 6.3 Apa Saja yang Ditampilkan

Semua chart di dashboard ini menggunakan **satu API call** yang sama:
```
GET /api/transformer/getOilQualityReadingDataRealTime?interval={N}
```
Tabel sumber: **`{dbName}.temp_reading_data_realtime`**

---

#### A. Grafik Moisture Oil (Kelembaban Minyak)

Tipe chart: **Line Chart** | Canvas ID: `moisture-oil-chart`

| Label di Chart | Kolom | Tabel | Satuan |
|---|---|---|---|
| MoistureOil | `Moistureppm` | `temp_reading_data_realtime` | ppm (parts per million) |

**Query (ringkasan):**
```sql
SELECT ROUND(AVG(Moistureppm), 2) AS Moistureppm
FROM {dbName}.temp_reading_data_realtime
GROUP BY UNIX_TIMESTAMP(TIMESTAMP) DIV ({interval} * 60)
ORDER BY TIMESTAMP ASC LIMIT 10
```

> Sumbu Y: `% (Percentage)`. Semakin rendah nilai `Moistureppm`, semakin baik kondisi minyak.

---

#### B. Grafik Dissolved H₂ (Hidrogen Terlarut)

Tipe chart: **Line Chart** | Canvas ID: `dissolved-h2-chart`

| Label di Chart | Kolom | Tabel | Satuan |
|---|---|---|---|
| Dissolved H2 | `H2ppm` | `temp_reading_data_realtime` | ppm |

**Query (ringkasan):**
```sql
SELECT ROUND(AVG(H2ppm), 2) AS H2ppm
FROM {dbName}.temp_reading_data_realtime
GROUP BY UNIX_TIMESTAMP(TIMESTAMP) DIV ({interval} * 60)
ORDER BY TIMESTAMP ASC LIMIT 10
```

> Sumbu Y: `% (Percentage)`. Peningkatan mendadak pada `H2ppm` bisa mengindikasikan masalah internal pada transformator (partial discharge atau overheating).

> **Catatan:** Kedua chart diambil dari **satu API call yang sama**. Response-nya berisi kedua kolom `Moistureppm` dan `H2ppm` sekaligus, lalu dirender sebagai dua chart terpisah.

---

#### C. Status Card — Hanya Tersedia di TMU v2+ (`version > 2`)

Bukan chart, melainkan **kartu info** statis yang datanya dari tabel `transformer_data`.

| Widget | Tabel | Kolom | Satuan | API yang Dipanggil |
|---|---|---|---|---|
| Water Activity | `transformer_data` | `waterActivity` | aw (0–1) | `getOilQualityStatusCardData?trafoId=N` |
| Oil BDV | `transformer_data` | `oilBDV` | kV | `getOilQualityStatusCardData?trafoId=N` |
| Oil Condition | `transformer_data` | `oilCondition` | — (Good/Poor/Severe) | `getOilQualityStatusCardData?trafoId=N` |

**Query yang dijalankan:**
```sql
SELECT waterActivity, oilBDV, oilCondition
FROM {dbName}.transformer_data
WHERE trafoId = {trafoId}
```

---

### 6.4 Indikator Oil Condition

| Kondisi | Warna Indikator | Arti |
|---|---|---|
| **Good** | 🟢 Hijau | Minyak dalam kondisi baik, tidak perlu tindakan |
| **Poor** | 🟡 Kuning | Minyak mulai menurun kualitasnya, perlu monitoring lebih ketat |
| **Severe** | 🔴 Merah | Minyak sudah buruk, perlu tindakan segera (penggantian/penyaringan) |

---

### 6.5 Cara Kerja Teknis

**Langkah 1 — Server render halaman:**
Mengambil data dari `transformer_data`, `transformer_settings`, dan `transformer_status`.

**Langkah 2 — Browser memanggil API chart:**
```
GET /api/transformer/getOilQualityReadingDataRealTime?interval=1
```

**Langkah 3 — Jika versi > 2, load status card:**
```
GET /api/transformer/getOilQualityStatusCardData?trafoId=N
```

**Query yang dijalankan:**
```sql
SELECT
  ROUND(AVG(Moistureppm), 2) AS Moistureppm,
  ROUND(AVG(H2ppm), 2) AS H2ppm
FROM temp_reading_data_realtime
GROUP BY UNIX_TIMESTAMP(TIMESTAMP) DIV (interval * 60)
ORDER BY TIMESTAMP ASC LIMIT 10
```

**Perubahan Layout saat Ada Status Card:**
Secara default chart menggunakan lebar penuh (`col-lg-12`). Jika `version > 2`, layout berubah menjadi `col-lg-9` untuk chart dan `col-lg-3` untuk status card.

---

## 7. Struktur Database

Berikut tabel-tabel MySQL yang paling sering diakses oleh keempat dashboard:

### `transformer_data`
Menyimpan **konfigurasi dan informasi tetap** setiap transformator.

| Kolom Penting | Keterangan |
|---|---|
| `trafoId` | ID unik transformator |
| `raspiSerialNo` | Nomor seri Raspberry Pi |
| `trafoSerialNo` | Nomor seri transformator |
| `ratedPower` | Daya nominal transformator (kVA) |
| `ratedHighVoltage` / `ratedLowVoltage` | Tegangan nominal sisi tinggi/rendah |
| `ratedCurrentHighVoltage` / `ratedCurrentLowVoltage` | Arus nominal sisi tinggi/rendah |
| `noLoadLoss` / `fullLoadLoss` | Rugi-rugi tanpa beban / penuh beban |
| `tapType` | Tipe tap changer: `OCTC` atau `DETC` |
| `SuddenPressure` | `0`=Inactive, `1`=Active (relay sudden pressure terpasang) |
| `waterActivity` | Aktivitas air minyak (aw) |
| `oilBDV` | Breakdown voltage minyak (kV) |
| `oilCondition` | Kondisi minyak: Good / Poor / Severe |
| `lastSyncTimestamp` | Waktu terakhir data disinkronisasi dari device |
| `version` | Versi firmware device |

---

### `transformer_status`
Menyimpan **status terkini** setiap parameter sensor (diupdate real-time dari WebSocket).

> Nilai bukan angka sensor sebenarnya, tapi **kode status**: 1=Low Trip, 2=Low Alarm, 3=Normal, 4=High Alarm, 5=High Trip.

| Kolom | Keterangan |
|---|---|
| `Vab`, `Vbc`, `Vca` | Status tegangan phase-to-phase |
| `Van`, `Vbn`, `Vcn` | Status tegangan phase-to-neutral (v1) |
| `Current1`, `Current2`, `Current3` | Status arus per fase |
| `Ineutral` | Status arus netral |
| `OilTemp` | Status suhu minyak |
| `BusTemp1-3` | Status suhu busbar per fase |
| `WTITemp1-3` | Status suhu belitan per fase |
| `Pressure` | Status tekanan tangki |
| `OilLevel` | Status level minyak |
| `PF` | Status power factor |
| `Freq` | Status frekuensi |
| `THDVoltage1-3` | Status THD tegangan |
| `THDCurrent1-3` | Status THD arus |
| `H2ppm` | Status hidrogen terlarut (v2) |
| `Moistureppm` | Status kelembaban minyak (v2) |

---

### `transformer_settings`
Menyimpan **nilai threshold** alarm dan trip untuk setiap parameter.

Contoh kolom:
- `topOilHighAlarmTreshold` — batas alarm suhu minyak
- `topOilHighTripTreshold` — batas trip suhu minyak
- `tankPressureHighAlarmTreshold` — batas alarm tekanan tangki
- `H2ppmHighAlarmTreshold` — batas alarm H2 terlarut
- `MoistureppmHighAlarmTreshold` — batas alarm kelembaban minyak

---

### `temp_reading_data_realtime`
Tabel **buffer data real-time** dari device. Berisi data pembacaan sensor terbaru, di-overwrite secara periodik.

Kolom utama: `timestamp`, `OilTemp`, `BusTemp1-3`, `WTITemp1-3`, `Press`, `Van/Vbn/Vcn`, `Vab/Vbc/Vca`, `Ia/Ib/Ic`, `Iavg`, `Ineutral`, `THDV1-3`, `THDI1-3`, `Pa/Pb/Pc/Psig`, `Qa/Qb/Qc/Qsig`, `Sa/Sb/Sc/Ssig`, `PFa/PFb/PFc/PFsig`, `Freq`, `kWh` (v2) / `kWhInp`+`kWhOut` (v1), `Moistureppm`, `H2ppm`, `deRatinga/b/c`, `KRateda/b/c`

---

### `temp_voltage_harmonic` dan `temp_current_harmonic`
Tabel **data harmonik sementara** yang diisi saat WebSocket menerima perintah harmonik.

| Kolom | Keterangan |
|---|---|
| `Phase` | Nomor fase (1, 2, atau 3) |
| `1st`, `3rd`, `5th`, ... `31st` | Persentase harmonik per orde |

---

### `failure_log`
Menyimpan **log kejadian fault/trip**.

| Kolom | Keterangan |
|---|---|
| `trafoId` | ID transformator yang mengalami fault |
| `time_start` | Waktu mulai fault |
| `duration` | Durasi fault (detik) |
| `failure_type` | Jenis fault (contoh: "Gas Fault", "Sudden Pressure") |
| `parameter` | Parameter yang bermasalah |

---

### `reading_data`
Tabel **arsip historis** data sensor. Data dari `temp_reading_data_realtime` dipindahkan ke sini secara periodik sebagai penyimpanan jangka panjang. Digunakan untuk laporan dan analisis historis.

---

### `master_tmu_app.parameter_failure_recommendation`
Tabel **master rekomendasi perbaikan** (database terpisah). Berisi panduan penanganan untuk setiap jenis masalah parameter.

| Kolom | Keterangan |
|---|---|
| `key` | Nama parameter (contoh: `OilTemp`, `WTITemp`) |
| `recommendation` | Teks rekomendasi perbaikan |

---

## 8. Konsep Penting yang Perlu Dipahami

### 8.1 SSR (Server-Side Rendering) vs AJAX

Aplikasi ini menggunakan **dua cara** untuk mengirim data ke browser:

**SSR (Server-Side Rendering):**
Saat halaman pertama kali dibuka, server langsung menyisipkan data ke HTML melalui EJS template. Data ini langsung tersedia di browser sebagai variabel JavaScript global. Contoh di view EJS:
```html
<script>
    var transformerData = <%- JSON.stringify(transformerData) %>;
    var transformerStatus = <%- JSON.stringify(transformerStatus) %>;
    var settings = <%- JSON.stringify(settings) %>;
</script>
```

**AJAX (Asynchronous JavaScript):**
Setelah halaman tampil, browser memanggil API endpoint secara terpisah untuk mendapatkan data chart. Ini dilakukan setelah delay 3 detik untuk memastikan data dari device sudah masuk ke database.

---

### 8.2 Interval Chart

Semua chart mengambil **10 data point terakhir** yang dirata-rata per interval. User bisa memilih interval:
- 1 menit → data 10 menit terakhir
- 5 menit → data 50 menit terakhir
- 10 menit → data 100 menit terakhir
- 15 menit → data 150 menit terakhir

Teknik rata-rata per interval menggunakan SQL `GROUP BY UNIX_TIMESTAMP(TIMESTAMP) DIV (interval * 60)`.

---

### 8.3 Versioning (v1 vs v2)

Variabel `companyTMUVersion` menentukan perilaku dashboard:

| Aspek | TMU v1 | TMU v2 |
|---|---|---|
| Endpoint electrical | `getElectricalReadingDataRealTime` | `getElectricalReadingDataRealTime_v2` |
| Kolom kWh | `kWhInp + kWhOut` | `kWh` |
| Status card Oil Quality | Tidak ada | Ada (Water Activity, BDV, Oil Condition) |
| Query status | `getTransformerStatus` | `getTransformerStatus_v2` |
| Parameter tambahan | — | `H2ppm`, `Moistureppm`, `Ineutral` |

---

### 8.4 WebSocket Flow

```
Browser buka dashboard
    │
    ▼
Server (pageRouter.js):
    └─► websocket.sendMessage(raspiSerialNo, { type: "requestReadingDataRealTime" })
                │
                ▼
        [Raspberry Pi menerima perintah]
                │
                ▼
        [Raspberry Pi kirim balik data sensor]
                │
                ▼
        Server (websocket.js) menyimpan ke MySQL:
            └─► INSERT INTO temp_reading_data_realtime
            └─► UPDATE transformer_status
                │
                ▼
        (3 detik kemudian...)
                │
                ▼
Browser AJAX: GET /api/transformer/getPhysicalReadingDataRealTime?interval=1
    └─► Data tersedia di tabel, query berhasil, chart dirender
```

---

### 8.5 State Management di Frontend

Setiap dashboard memiliki 3 kemungkinan tampilan yang diatur lewat CSS `display: none/block`:

```
#loading              → Animasi loading (tampil saat halaman baru dibuka)
#offline-state-div    → Tampil jika device offline
#empty-state-div      → Tampil jika device online tapi tidak ada data
#container-dashboard-* → Konten utama dashboard (tampil jika ada data)
```

Logika di JS:
```javascript
if (deviceConnectedStatus == 1) {
    setTimeout(initiatePage, 3000);  // Device online, tunggu 3 detik
} else {
    $('#loading').hide();
    $('#offline-state-div').show();   // Device offline
}
```

---

*Dokumen ini dibuat untuk keperluan onboarding developer di proyek TMU v2.*
*Terakhir diperbarui: Oktober 2026*
