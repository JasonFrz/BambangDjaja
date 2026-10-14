# Rencana D: Frontend ke Skema Baru

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontend React memakai respons backend baru (key frontend langsung, `/api/settings/limits`, nameplate, status, harmonik), selalu mengirim trafo yang dipilih, punya lima panel baru dan empat preset layout, serta halaman Settings dan TransformerData yang menulis ke `transformer_settings`/`trip_settings`/`transformer_data`.

**Architecture:** Satu interceptor di `main.jsx` menambahkan header `X-Trafo-Id` dari `sessionStorage.selectedTrafoId` ke setiap axios/fetch, sehingga context dan panel tidak perlu mengulang parameter trafo. Context dirampingkan: `TrendDataContext` tidak lagi memetakan nama kolom; `ThresholdContext` membaca `/api/settings/limits` dan mengembalikan `{ min, max, tripMin, tripMax, is_active }`. Panel baru adalah komponen mandiri di `components/visualizations/` yang mengambil datanya sendiri (atau dari `latestData.derating`) dan didaftarkan di `PanelRenderer`, daftar tipe, dan `NO_METRIC_PANELS`. Preset ada di `config/presets.js` dan dimasukkan ke peta profil Dashboard sebagai profil tidak-bisa-diedit.

**Tech Stack:** React 19, Vite 8, Tailwind 4, recharts 2, lucide-react, axios, socket.io-client, oxlint. Tidak ada test runner frontend: verifikasi = `npm run build` + `npx oxlint` + uji browser terhadap backend lokal + `db_demo`.

**Spec:** `docs/superpowers/specs/2026-10-13-tmu-legacy-schema-design.md` bagian 8 dan 10 (urutan 10–12).

## Global Constraints

- Key metric frontend lama (`phaseA`, `oil_temperature`, dst.) tidak berubah nama; key baru sesuai spec 8.1.
- Tidak ada nama kolom DB (`Van`, `OilTemp`, `phase_a_v`) di frontend.
- Peran dibaca dari `sessionStorage.role` (`superuser` / `admin` / `user`); tombol ubah (threshold, trip, nameplate) hanya untuk `admin`/`superuser`; backend tetap memverifikasi.
- Header `X-DB-Name`, `Authorization`, dan `X-Trafo-Id` ditambahkan interceptor; komponen tidak menyusun header sendiri kecuali `fetch` di tempat yang sudah ada (interceptor `window.fetch` juga menambahkannya).
- Semua pemanggilan `/api/trends*`, `/api/settings*`, `/api/trafo/:id/*` memakai trafo yang dipilih; tidak ada lagi angka `1` yang di-hardcode selain fallback saat belum memilih trafo.
- Gaya visual mengikuti panel yang ada (kelas Tailwind `text-[#172b4d] dark:text-white`, kartu `bg-white dark:bg-[#151521]`, header panel dengan `drag-handle` saat `isEditing`).
- Tidak menambah dependency.
- `npm run build` harus sukses dan `npx oxlint` tidak boleh menambah peringatan selain 3 peringatan `exhaustive-deps` yang sudah ada di `Dashboard.jsx`.

## Review Focus

1. Pengguna berganti trafo di halaman pemilihan lalu kembali ke Dashboard: grafik, gauge, batas, panel status harus menampilkan trafo baru, bukan trafo lama (event `trafoChanged` + header). Diuji di Task 6 lewat browser dengan trafo 1 (seed) dan trafo 2 (fake_raspi).
2. Trafo tanpa `transformer_settings`: `getThreshold` mengembalikan `is_active: false` untuk semua metric dan gauge memakai rentang bawaan, tanpa error di konsol. Diuji di Task 1 dengan mematikan sementara respons (`limits: {}` dari trafo tanpa settings).
3. Panel harmonik dan status saat Raspi belum pernah mengirim (tabel kosong): tampil "Belum ada data", bukan grafik kosong yang crash. Diuji di Task 2 dengan trafo seed (harmonik ada) dan trafo baru tanpa harmonik.
4. Preset tidak boleh tersimpan ke DB atau menimpa layout pengguna: memilih preset tidak memanggil `PUT /api/layouts/active` dengan id preset dan tombol hapus/rename tidak muncul. Diuji di Task 3.
5. Settings: nilai kosong (hapus angka) mengirim `null`, bukan `0`; nilai bukan angka ditolak sebelum kirim; setelah simpan, gauge memakai batas baru tanpa reload (event `thresholdsUpdated`). Diuji di Task 4.

## File Structure

| File | Status | Tanggung jawab |
|---|---|---|
| `frontend/src/main.jsx` | ubah | header `X-Trafo-Id` di interceptor axios dan fetch |
| `frontend/src/config/metrics.js` | ubah | grup dan key baru |
| `frontend/src/contexts/TrendDataContext.jsx` | ubah | tanpa `mapReadingToPoint`, refetch saat `trafoChanged` |
| `frontend/src/contexts/TemperatureDataContext.jsx` | ubah | refetch saat `trafoChanged` |
| `frontend/src/contexts/ThresholdContext.jsx` | tulis ulang | `/api/settings/limits` |
| `frontend/src/components/visualizations/HarmonicPanel.jsx`, `DeratingPanel.jsx`, `TransformerStatusPanel.jsx`, `PhysicalStatusPanel.jsx`, `OilQualityPanel.jsx` | baru | lima panel |
| `frontend/src/components/visualizations/index.js` | ubah | ekspor panel baru |
| `frontend/src/config/presets.js` | baru | empat preset |
| `frontend/src/pages/Dashboard.jsx` | ubah | registrasi panel, preset sebagai profil, ukuran bawaan |
| `frontend/src/pages/Settings.jsx` | tulis ulang | threshold per grup + trip enable |
| `frontend/src/pages/TransformerData.jsx` | ubah | nameplate dari API + edit |
| `frontend/src/pages/Login.jsx` | ubah kecil | simpan `tmu_version` |

---

### Task 1: Header trafo, metrics, dan context

**Files:**
- Modify: `frontend/src/main.jsx`, `frontend/src/config/metrics.js`, `frontend/src/contexts/TrendDataContext.jsx`, `frontend/src/contexts/TemperatureDataContext.jsx`
- Rewrite: `frontend/src/contexts/ThresholdContext.jsx`

**Interfaces:**
- Produces: `METRICS` dengan key baru (dipakai Task 2–3), `useThresholds().getThreshold(key) -> { min, max, tripMin, tripMax, is_active }`, `useTrendData().liveData[]` berisi objek respons backend apa adanya plus `time`.

- [ ] **Step 1: `main.jsx`**: di interceptor axios dan di patch `window.fetch`, setelah baris `X-Username`, tambahkan header trafo.

```js
// axios
const trafoId = sessionStorage.getItem('selectedTrafoId');
if (trafoId) config.headers['X-Trafo-Id'] = trafoId;
// fetch (dua cabang: Headers instance dan object)
if (trafoId) config.headers.set('X-Trafo-Id', trafoId);      // cabang Headers
if (trafoId) config.headers['X-Trafo-Id'] = trafoId;         // cabang object
```

- [ ] **Step 2: `config/metrics.js`**: tambahkan key berikut ke `METRICS` (setelah `efficiency`, sebelum `oil_temperature`) dan ikon grup baru.

```js
  powerActiveA: { label: 'Active Power A', unit: 'kW', color: '#ef4444', group: 'Power per Phase', icon: TrendingUp, source: 'electrical' },
  powerActiveB: { label: 'Active Power B', unit: 'kW', color: '#eab308', group: 'Power per Phase', icon: TrendingUp, source: 'electrical' },
  powerActiveC: { label: 'Active Power C', unit: 'kW', color: '#3b82f6', group: 'Power per Phase', icon: TrendingUp, source: 'electrical' },
  powerReactiveA: { label: 'Reactive Power A', unit: 'kVAR', color: '#f87171', group: 'Power per Phase', icon: TrendingUp, source: 'electrical' },
  powerReactiveB: { label: 'Reactive Power B', unit: 'kVAR', color: '#facc15', group: 'Power per Phase', icon: TrendingUp, source: 'electrical' },
  powerReactiveC: { label: 'Reactive Power C', unit: 'kVAR', color: '#60a5fa', group: 'Power per Phase', icon: TrendingUp, source: 'electrical' },
  powerApparentA: { label: 'Apparent Power A', unit: 'kVA', color: '#fca5a5', group: 'Power per Phase', icon: TrendingUp, source: 'electrical' },
  powerApparentB: { label: 'Apparent Power B', unit: 'kVA', color: '#fde047', group: 'Power per Phase', icon: TrendingUp, source: 'electrical' },
  powerApparentC: { label: 'Apparent Power C', unit: 'kVA', color: '#93c5fd', group: 'Power per Phase', icon: TrendingUp, source: 'electrical' },
  pfA: { label: 'Power Factor A', unit: '', color: '#ef4444', group: 'Power per Phase', icon: Gauge, source: 'electrical' },
  pfB: { label: 'Power Factor B', unit: '', color: '#eab308', group: 'Power per Phase', icon: Gauge, source: 'electrical' },
  pfC: { label: 'Power Factor C', unit: '', color: '#3b82f6', group: 'Power per Phase', icon: Gauge, source: 'electrical' },
  avgCurrent: { label: 'Average Current', unit: 'A', color: '#f97316', group: 'Current', icon: Waves, source: 'electrical' },
  thdVA: { label: 'THD Voltage A', unit: '%', color: '#ef4444', group: 'THD', icon: Activity, source: 'electrical' },
  thdVB: { label: 'THD Voltage B', unit: '%', color: '#eab308', group: 'THD', icon: Activity, source: 'electrical' },
  thdVC: { label: 'THD Voltage C', unit: '%', color: '#3b82f6', group: 'THD', icon: Activity, source: 'electrical' },
  thdIA: { label: 'THD Current A', unit: '%', color: '#f87171', group: 'THD', icon: Activity, source: 'electrical' },
  thdIB: { label: 'THD Current B', unit: '%', color: '#facc15', group: 'THD', icon: Activity, source: 'electrical' },
  thdIC: { label: 'THD Current C', unit: '%', color: '#60a5fa', group: 'THD', icon: Activity, source: 'electrical' },
  unbalanceUV: { label: 'Voltage Unbalance UV', unit: '%', color: '#ef4444', group: 'Voltage Unbalance', icon: Activity, source: 'electrical' },
  unbalanceVW: { label: 'Voltage Unbalance VW', unit: '%', color: '#eab308', group: 'Voltage Unbalance', icon: Activity, source: 'electrical' },
  unbalanceUW: { label: 'Voltage Unbalance UW', unit: '%', color: '#3b82f6', group: 'Voltage Unbalance', icon: Activity, source: 'electrical' },
  wtiA: { label: 'Winding Temp A', unit: '°C', color: '#ef4444', group: 'Temperature', icon: Thermometer, source: 'oil' },
  wtiB: { label: 'Winding Temp B', unit: '°C', color: '#eab308', group: 'Temperature', icon: Thermometer, source: 'oil' },
  wtiC: { label: 'Winding Temp C', unit: '°C', color: '#3b82f6', group: 'Temperature', icon: Thermometer, source: 'oil' },
  busTempA: { label: 'Busbar Temp A', unit: '°C', color: '#f87171', group: 'Temperature', icon: Thermometer, source: 'oil' },
  busTempB: { label: 'Busbar Temp B', unit: '°C', color: '#facc15', group: 'Temperature', icon: Thermometer, source: 'oil' },
  busTempC: { label: 'Busbar Temp C', unit: '°C', color: '#60a5fa', group: 'Temperature', icon: Thermometer, source: 'oil' },
  h2ppm: { label: 'Hydrogen (H2)', unit: 'ppm', color: '#a855f7', group: 'Oil Quality', icon: Thermometer, source: 'oil' },
  moisturePpm: { label: 'Moisture', unit: 'ppm', color: '#0ea5e9', group: 'Oil Quality', icon: Thermometer, source: 'oil' },
  deRatingA: { label: 'De-rating A', unit: '%', color: '#ef4444', group: 'De-rating', icon: Gauge, source: 'electrical' },
  deRatingB: { label: 'De-rating B', unit: '%', color: '#eab308', group: 'De-rating', icon: Gauge, source: 'electrical' },
  deRatingC: { label: 'De-rating C', unit: '%', color: '#3b82f6', group: 'De-rating', icon: Gauge, source: 'electrical' },
  kRatedA: { label: 'K-Rated A', unit: '', color: '#f87171', group: 'De-rating', icon: Gauge, source: 'electrical' },
  kRatedB: { label: 'K-Rated B', unit: '', color: '#facc15', group: 'De-rating', icon: Gauge, source: 'electrical' },
  kRatedC: { label: 'K-Rated C', unit: '', color: '#60a5fa', group: 'De-rating', icon: Gauge, source: 'electrical' },
```

`GROUP_ICON_MAP` tambah: `'Power per Phase': TrendingUp, 'THD': Activity, 'Voltage Unbalance': Activity, 'Temperature': Thermometer, 'Oil Quality': Thermometer, 'De-rating': Gauge`.

- [ ] **Step 3: `TrendDataContext.jsx`**: hapus `mapReadingToPoint`; ganti dengan `toPoint` yang hanya menjamin `time` dan `timestamp`; `fetchLiveInitial` dan `fetchRangeData` memakai `toPoint`; tambah listener `trafoChanged` yang memanggil `fetchLiveInitial()` (atau `fetchRangeData` ulang kalau mode historis).

```js
const toPoint = (r) => {
  const date = new Date(r.timestamp);
  return {
    ...r,
    time: r.time || date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }),
    timestamp: date.toISOString(),
  };
};
```

```js
  useEffect(() => {
    const onTrafoChange = () => { lastDataRef.current = null; fetchLiveInitial(); };
    window.addEventListener('trafoChanged', onTrafoChange);
    return () => window.removeEventListener('trafoChanged', onTrafoChange);
  }, [fetchLiveInitial]);
```

- [ ] **Step 4: `TemperatureDataContext.jsx`**: bungkus pemanggilan `/api/trends/oil` ke fungsi `loadHistory` (useCallback) yang dipanggil saat mount dan saat `trafoChanged` (reset `lastDataRef` dan `liveData`).

- [ ] **Step 5: Tulis ulang `ThresholdContext.jsx`**

```jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useApi } from './ApiContext';

// Batas per metric dari /api/settings/limits: { key: { min, max, tripMin, tripMax } }.
const EMPTY = { min: null, max: null, tripMin: null, tripMax: null, is_active: false };

const ThresholdContext = createContext({
  limits: {},
  isLoading: false,
  getThreshold: () => EMPTY,
  refreshThresholds: async () => {},
});

export const ThresholdProvider = ({ children }) => {
  const { apiUrl } = useApi();
  const [limits, setLimits] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchLimits = useCallback(async () => {
    const dbName = sessionStorage.getItem('db_name');
    const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
    if (!dbName) { setIsLoading(false); return; }
    try {
      const res = await axios.get(`${apiUrl}/api/settings/limits`, { params: { trafo_id: trafoId } });
      setLimits(res.data && res.data.limits ? res.data.limits : {});
    } catch (err) {
      console.warn('Gagal memuat limits:', err.message);
      setLimits({});
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchLimits();
    window.addEventListener('thresholdsUpdated', fetchLimits);
    window.addEventListener('trafoChanged', fetchLimits);
    return () => {
      window.removeEventListener('thresholdsUpdated', fetchLimits);
      window.removeEventListener('trafoChanged', fetchLimits);
    };
  }, [fetchLimits]);

  const getThreshold = useCallback((metricKey) => {
    const L = metricKey ? limits[metricKey] : null;
    if (!L) return EMPTY;
    const has = (v) => v !== null && v !== undefined;
    return { min: has(L.min) ? L.min : null, max: has(L.max) ? L.max : null, tripMin: has(L.tripMin) ? L.tripMin : null, tripMax: has(L.tripMax) ? L.tripMax : null, is_active: has(L.min) || has(L.max) };
  }, [limits]);

  return (
    <ThresholdContext.Provider value={{ limits, isLoading, getThreshold, refreshThresholds: fetchLimits }}>
      {children}
    </ThresholdContext.Provider>
  );
};

export const useThresholds = () => useContext(ThresholdContext);
export default ThresholdContext;
```

- [ ] **Step 6: Verifikasi**: `grep -rn "FRONTEND_TO_DB_METRIC\|thresholdsMap\|mapReadingToPoint" frontend/src` kosong; `npm run build` sukses; `npx oxlint` tidak bertambah. Commit.

```bash
git add frontend/src/main.jsx frontend/src/config/metrics.js frontend/src/contexts
git commit -m "feat(frontend): header X-Trafo-Id, metrics baru, context memakai respons backend baru dan /api/settings/limits"
```

---

### Task 2: Lima panel baru dan registrasinya

**Files:**
- Create: `frontend/src/components/visualizations/HarmonicPanel.jsx`, `DeratingPanel.jsx`, `TransformerStatusPanel.jsx`, `PhysicalStatusPanel.jsx`, `OilQualityPanel.jsx`
- Modify: `frontend/src/components/visualizations/index.js`, `frontend/src/pages/Dashboard.jsx` (`PanelRenderer`, daftar tipe, `NO_METRIC_PANELS`, `getDefaultSize`)

**Interfaces:**
- Consumes: `/api/trafo/:id/harmonics?type=`, `/api/trafo/:id/status`, `/api/trafo/:id/physical`, `/api/trafo/:id/oil-quality`, `latestData.derating` (dari event `meter`).
- Produces: tipe panel `harmonic`, `derating`, `trafostatus`, `physicalstatus`, `oilquality` (dipakai preset Task 3). Semua panel menerima props `{ panel, latestData, isEditing, updatePanel }`.

Pola header panel yang dipakai semua komponen baru:

```jsx
const PanelHeader = ({ title, isEditing, right }) => (
  <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
    <h3 className="font-medium text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{title}</h3>
    {right}
    {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
  </div>
);
```

Hook kecil yang dipakai panel yang mengambil data sendiri (letakkan di `frontend/src/hooks/useTrafoApi.js`):

```js
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useApi } from '../contexts/ApiContext';

// Ambil GET /api/trafo/:id/<path> untuk trafo terpilih, ulangi tiap `intervalMs`, ulang saat trafoChanged.
export function useTrafoApi(path, intervalMs = 60000, params = undefined) {
  const { apiUrl } = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const paramsKey = JSON.stringify(params || {});

  const load = useCallback(async () => {
    const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
    if (!sessionStorage.getItem('db_name')) { setIsLoading(false); return; }
    try {
      const res = await axios.get(`${apiUrl}/api/trafo/${trafoId}/${path}`, { params: JSON.parse(paramsKey) });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, path, paramsKey]);

  useEffect(() => {
    load();
    const t = intervalMs > 0 ? setInterval(() => { if (!document.hidden) load(); }, intervalMs) : null;
    window.addEventListener('trafoChanged', load);
    return () => { if (t) clearInterval(t); window.removeEventListener('trafoChanged', load); };
  }, [load, intervalMs]);

  return { data, error, isLoading, reload: load };
}
```

- [ ] **Step 1: `HarmonicPanel.jsx`** (bar chart per orde, tiga fase, toggle voltage/current disimpan di `panel.source`)

```jsx
import React, { memo, useMemo } from 'react';
import { GripVertical } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { useTrafoApi } from '../../hooks/useTrafoApi';

const PHASE_COLORS = { 1: '#ef4444', 2: '#eab308', 3: '#3b82f6' };

export const HarmonicPanel = memo(({ panel, isEditing, updatePanel }) => {
  const source = panel.source === 'current' ? 'current' : 'voltage';
  const { data, isLoading, error } = useTrafoApi('harmonics', 60000, { type: source });

  const rows = useMemo(() => {
    if (!data || !Array.isArray(data.data) || data.data.length === 0) return [];
    return (data.orders || []).filter((o) => o !== '1st').map((o) => {
      const row = { order: o };
      for (const p of data.data) row[`phase${p.phase}`] = Number(p.orders[o] || 0);
      return row;
    });
  }, [data]);

  const setSource = (s) => updatePanel && updatePanel(panel.id, { source: s });

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="font-medium text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-white/10 text-[10px] font-bold">
          {['voltage', 'current'].map((s) => (
            <button key={s} onClick={(e) => { e.stopPropagation(); setSource(s); }} className={`px-2 py-0.5 ${source === s ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400'}`}>{s === 'voltage' ? 'V' : 'I'}</button>
          ))}
        </div>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 min-h-0">
        {isLoading ? <div className="h-full flex items-center justify-center text-xs text-gray-400">Memuat...</div>
        : error ? <div className="h-full flex items-center justify-center text-xs text-red-400">{error}</div>
        : rows.length === 0 ? <div className="h-full flex items-center justify-center text-xs text-gray-400">Belum ada data harmonik dari Raspi</div>
        : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="order" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v) => [`${Number(v).toFixed(2)} %`]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {[1, 2, 3].map((p) => <Bar key={p} dataKey={`phase${p}`} name={`Fase ${['', 'R', 'S', 'T'][p]}`} fill={PHASE_COLORS[p]} radius={[2, 2, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
```

- [ ] **Step 2: `DeratingPanel.jsx`** (tiga pie: used / available-sisa / lost per fase dari `latestData.derating`)

```jsx
import React, { memo } from 'react';
import { GripVertical } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = { used: '#3b82f6', free: '#10b981', lost: '#ef4444' };

const PhasePie = ({ label, d }) => {
  if (!d) return <div className="flex-1 flex items-center justify-center text-xs text-gray-400">-</div>;
  const used = Math.max(0, Number(d.used) || 0);
  const available = Math.max(0, Number(d.available) || 0);
  const lost = Math.max(0, Number(d.lost) || 0);
  const free = Math.max(0, available - used);
  const data = [{ name: 'Terpakai', key: 'used', value: used }, { name: 'Sisa', key: 'free', value: free }, { name: 'Hilang (de-rating)', key: 'lost', value: lost }];
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center">
      <ResponsiveContainer width="100%" height="80%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
            {data.map((e) => <Cell key={e.key} fill={COLORS[e.key]} />)}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v, n) => [`${Number(v).toFixed(2)} kVA`, n]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="text-[11px] font-bold text-[#172b4d] dark:text-white">{label}</div>
      <div className="text-[10px] text-gray-500">{available.toFixed(1)} / {Number(d.full || 0).toFixed(1)} kVA{d.kRated ? ` · K${d.kRated}` : ''}</div>
    </div>
  );
};

export const DeratingPanel = memo(({ panel, latestData, isEditing }) => {
  const dr = latestData && latestData.derating;
  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="font-medium text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        <div className="flex gap-2 text-[10px] text-gray-500">
          <span><i className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: COLORS.used }} />Terpakai</span>
          <span><i className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: COLORS.free }} />Sisa</span>
          <span><i className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: COLORS.lost }} />Hilang</span>
        </div>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      {!dr ? <div className="flex-1 flex items-center justify-center text-xs text-gray-400">Menunggu data meter (nameplate ratedPower diperlukan)</div>
        : <div className="flex-1 min-h-0 flex gap-2"><PhasePie label="Fase R" d={dr.a} /><PhasePie label="Fase S" d={dr.b} /><PhasePie label="Fase T" d={dr.c} /></div>}
    </div>
  );
});
```

- [ ] **Step 3: `TransformerStatusPanel.jsx`** (grid 29 parameter; warna per level; klik item menampilkan rekomendasi)

```jsx
import React, { memo, useState } from 'react';
import { GripVertical, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useTrafoApi } from '../../hooks/useTrafoApi';

const LEVEL_CLASS = {
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  alarm: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  trip: 'bg-red-50 text-red-700 border-red-300 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30',
};

export const TransformerStatusPanel = memo(({ panel, isEditing }) => {
  const { data, isLoading, error } = useTrafoApi('status', 60000);
  const [open, setOpen] = useState(null);
  const items = (data && data.items) || [];
  const abnormal = items.filter((i) => i.level !== 'normal');
  const selected = items.find((i) => i.parameter === open);

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="font-medium text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        {data && (data.allSafe
          ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><ShieldCheck size={12} /> Semua Normal</span>
          : <span className="flex items-center gap-1 text-[10px] font-bold text-red-500"><AlertTriangle size={12} /> {data.counts.alarm} alarm · {data.counts.trip} trip</span>)}
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      {isLoading ? <div className="flex-1 flex items-center justify-center text-xs text-gray-400">Memuat...</div>
      : error ? <div className="flex-1 flex items-center justify-center text-xs text-red-400">{error}</div>
      : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
            {items.map((it) => (
              <button key={it.parameter} onClick={() => setOpen(open === it.parameter ? null : it.parameter)}
                className={`rounded-lg border px-2 py-1.5 text-left transition-colors ${LEVEL_CLASS[it.level]} ${open === it.parameter ? 'ring-2 ring-blue-400' : ''}`}>
                <div className="text-[10px] font-bold truncate">{it.parameter}</div>
                <div className="text-[10px] opacity-80 truncate">{it.label}{data.tripActive && data.tripActive.includes(it.parameter) ? ' · TRIP' : ''}</div>
              </button>
            ))}
          </div>
          {selected && (
            <div className="mt-2 rounded-lg border border-gray-200 dark:border-white/10 p-2 text-[11px] text-[#172b4d] dark:text-gray-200">
              <div className="font-bold mb-1">{selected.parameter}: {selected.label}</div>
              {selected.recommendations.length === 0 ? <div className="text-gray-400">Tidak ada rekomendasi (status normal).</div>
                : <ol className="list-decimal pl-4 space-y-0.5">{selected.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ol>}
            </div>
          )}
          {abnormal.length === 0 && !selected && <div className="mt-2 text-[10px] text-gray-400">Klik parameter untuk melihat rekomendasi.</div>}
        </div>
      )}
    </div>
  );
});
```

- [ ] **Step 4: `PhysicalStatusPanel.jsx`** (tap, oil level, pressure dengan referensi 0.5, gas fault, sudden pressure)

```jsx
import React, { memo } from 'react';
import { GripVertical } from 'lucide-react';
import { useTrafoApi } from '../../hooks/useTrafoApi';

const badge = (level) => level === 'trip' ? 'bg-red-500 text-white' : level === 'alarm' ? 'bg-amber-400 text-black' : 'bg-emerald-500 text-white';
const fmtTime = (t) => (t ? new Date(t).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-');

const Card = ({ title, children }) => (
  <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3 flex flex-col gap-1 min-w-0">
    <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500">{title}</div>
    {children}
  </div>
);

export const PhysicalStatusPanel = memo(({ panel, isEditing }) => {
  const { data, isLoading, error } = useTrafoApi('physical', 30000);
  const p = data || {};
  const pressure = p.pressure || {};
  const pct = pressure.value !== null && pressure.value !== undefined ? Math.max(0, Math.min(100, (pressure.value / 1) * 100)) : 0;
  const refPct = ((pressure.reference || 0.5) / 1) * 100;
  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="font-medium text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      {isLoading ? <div className="flex-1 flex items-center justify-center text-xs text-gray-400">Memuat...</div>
      : error ? <div className="flex-1 flex items-center justify-center text-xs text-red-400">{error}</div>
      : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar grid grid-cols-2 lg:grid-cols-3 gap-2 text-[#172b4d] dark:text-white">
          <Card title="Tap Position">
            <div className="text-xl font-bold">{p.tap && p.tap.type === 'OCTC' ? (p.tap.position ?? '-') : (p.tap && p.tap.type ? p.tap.type : '-')}</div>
            <div className="text-[10px] text-gray-500">{p.tap && p.tap.type ? `${p.tap.type}${p.tap.plus !== null ? ` · +${p.tap.plus}/-${p.tap.minus}` : ''}` : 'Belum ada nameplate'}</div>
          </Card>
          <Card title="Oil Level">
            <span className={`self-start px-2 py-0.5 rounded-md text-xs font-bold ${badge(p.oilLevel ? p.oilLevel.level : 'normal')}`}>{p.oilLevel ? p.oilLevel.label : '-'}</span>
            <div className="text-[10px] text-gray-500">sensor: {p.oilLevel && p.oilLevel.raw === 1 ? 'normal' : p.oilLevel && p.oilLevel.raw === 0 ? 'rendah' : '-'}</div>
          </Card>
          <Card title="Tank Pressure">
            <div className="text-xl font-bold">{pressure.value !== null && pressure.value !== undefined ? `${Number(pressure.value).toFixed(2)} Bar` : '-'}</div>
            <div className="relative h-2 rounded-full bg-gray-200 dark:bg-white/10 overflow-visible">
              <div className={`h-2 rounded-full ${pressure.level === 'trip' ? 'bg-red-500' : pressure.level === 'alarm' ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
              <div className="absolute -top-1 h-4 w-0.5 bg-red-500" style={{ left: `${refPct}%` }} title={`Referensi ${pressure.reference || 0.5} Bar`} />
            </div>
            <div className="text-[10px] text-gray-500">referensi {pressure.reference || 0.5} Bar · {pressure.level || '-'}</div>
          </Card>
          <Card title="Gas Fault Terakhir">
            <div className="text-xs font-bold">{p.gasFault ? `${p.gasFault.failure_type} (${p.gasFault.parameterValue ?? '-'})` : 'Tidak ada'}</div>
            <div className="text-[10px] text-gray-500">{p.gasFault ? fmtTime(p.gasFault.time_start) : '-'}</div>
          </Card>
          <Card title="Sudden Pressure">
            <span className={`self-start px-2 py-0.5 rounded-md text-xs font-bold ${p.suddenPressure && Number(p.suddenPressure.flag) === 1 ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>{p.suddenPressure && Number(p.suddenPressure.flag) === 1 ? 'AKTIF' : 'Normal'}</span>
            <div className="text-[10px] text-gray-500">{p.suddenPressure && p.suddenPressure.lastLog ? fmtTime(p.suddenPressure.lastLog.time_start) : 'tidak ada log'}</div>
          </Card>
          <Card title="Pembaruan">
            <div className="text-xs font-bold">{fmtTime(p.timestamp)}</div>
            <div className="text-[10px] text-gray-500">data realtime terakhir</div>
          </Card>
        </div>
      )}
    </div>
  );
});
```

- [ ] **Step 5: `OilQualityPanel.jsx`**

```jsx
import React, { memo } from 'react';
import { GripVertical, Droplets } from 'lucide-react';
import { useTrafoApi } from '../../hooks/useTrafoApi';

const Item = ({ label, value, unit }) => (
  <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3 flex flex-col">
    <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500">{label}</div>
    <div className="text-xl font-bold text-[#172b4d] dark:text-white">{value === null || value === undefined ? '-' : `${value}${unit ? ` ${unit}` : ''}`}</div>
  </div>
);

export const OilQualityPanel = memo(({ panel, latestData, isEditing }) => {
  const { data, isLoading } = useTrafoApi('oil-quality', 300000);
  const available = data && data.available;
  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="font-medium text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      {isLoading ? <div className="flex-1 flex items-center justify-center text-xs text-gray-400">Memuat...</div> : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-2">
          <Item label="Hydrogen (H2)" value={latestData && latestData.h2ppm} unit="ppm" />
          <Item label="Moisture" value={latestData && latestData.moisturePpm} unit="ppm" />
          {available ? (<>
            <Item label="Water Activity" value={data.waterActivity} unit="" />
            <Item label="Oil BDV" value={data.oilBDV} unit="kV" />
            <Item label="Oil Condition" value={data.oilCondition} unit="" />
          </>) : (
            <div className="col-span-2 rounded-xl border border-dashed border-gray-300 dark:border-white/10 p-3 text-[11px] text-gray-500 flex items-center gap-2">
              <Droplets size={14} /> Water activity, BDV, dan kondisi oli belum tersedia di database ini (kolom tidak ada di skema `transformer_data`).
            </div>
          )}
        </div>
      )}
    </div>
  );
});
```

- [ ] **Step 6: Registrasi di `index.js`** (5 baris `export * from`), dan di `Dashboard.jsx`:
  - import lima panel dari `../components/visualizations` (sudah lewat `import { ... } from "../components/visualizations"` baris 16–22; tambahkan nama).
  - `PanelRenderer`: tambah
    ```jsx
    case 'harmonic': return <HarmonicPanel panel={panel} isEditing={isEditing} updatePanel={updatePanel} />;
    case 'derating': return <DeratingPanel panel={panel} latestData={combinedLatestData} isEditing={isEditing} />;
    case 'trafostatus': return <TransformerStatusPanel panel={panel} isEditing={isEditing} />;
    case 'physicalstatus': return <PhysicalStatusPanel panel={panel} isEditing={isEditing} />;
    case 'oilquality': return <OilQualityPanel panel={panel} latestData={combinedLatestData} isEditing={isEditing} />;
    ```
  - `NO_METRIC_PANELS = ['oilstatus', 'eventstream', 'news', 'harmonic', 'derating', 'trafostatus', 'physicalstatus', 'oilquality']`.
  - Daftar tipe (array `{ v, l, d, i }`): tambah
    ```js
    { v: 'harmonic', l: 'Harmonics', d: 'THD per orde, tegangan/arus', i: BarChart3 },
    { v: 'derating', l: 'De-rating', d: 'Kapasitas terpakai vs hilang per fase', i: PieChartIcon },
    { v: 'trafostatus', l: 'Transformer Status', d: '29 status alarm/trip + rekomendasi', i: AlertTriangle },
    { v: 'physicalstatus', l: 'Physical Status', d: 'Tap, oil level, pressure, gas fault', i: Thermometer },
    { v: 'oilquality', l: 'Oil Quality', d: 'H2, moisture, BDV, water activity', i: Database },
    ```
  - `getDefaultSize`: `isSmall` juga untuk `'oilquality'`; `trafostatus` dan `physicalstatus` memakai `w: 6, h: 6`.

- [ ] **Step 7: `npm run build`, `npx oxlint`; commit**

```bash
git add frontend/src/hooks/useTrafoApi.js frontend/src/components/visualizations frontend/src/pages/Dashboard.jsx
git commit -m "feat(frontend): panel harmonik, de-rating, status trafo, status fisik, kualitas oli"
```

---

### Task 3: Empat preset layout

**Files:**
- Create: `frontend/src/config/presets.js`
- Modify: `frontend/src/pages/Dashboard.jsx` (`DEFAULT_PANELS`/`DEFAULT_GRID_LAYOUTS` dari preset Electrical; preset lain sebagai profil tidak-bisa-diedit; pemilihan preset tidak memanggil API)

**Interfaces:**
- Produces: `PRESETS = { electrical, physical, status, oilquality }` masing-masing `{ id, name, panels, layouts: { lg } }`; `PRESET_IDS`.

- [ ] **Step 1: `config/presets.js`**

```js
// Empat profil bawaan (tidak bisa diedit). Layout hanya lg; breakpoint lain diturunkan ensureResponsiveLayouts.
const P = (id, type, title, metrics = [], extra = {}) => ({ id, type, title, metrics, chartType: 'line', ...extra });
const L = (i, x, y, w, h, minW = 2, minH = 3) => ({ i, x, y, w, h, minW, minH, isDraggable: true, isResizable: true });

export const PRESETS = {
  electrical: {
    id: 'preset_electrical', name: 'Electrical (Default)',
    panels: [
      P('pe_vphase', 'linechart', 'Phase Voltage', ['phaseA', 'phaseB', 'phaseC']),
      P('pe_vline', 'linechart', 'Line Voltage', ['lineAB', 'lineBC', 'lineCA']),
      P('pe_current', 'areachart', 'Current', ['currentA', 'currentB', 'currentC', 'currentN']),
      P('pe_freq', 'gauge', 'Frequency', ['frequency']),
      P('pe_pf', 'gauge', 'Power Factor', ['pfTotal']),
      P('pe_power', 'stat', 'Power', ['powerActiveTotal', 'powerReactiveTotal', 'powerApparentTotal']),
      P('pe_energy', 'stat', 'Energy', ['energyActiveTotal', 'energyReactiveTotal']),
      P('pe_thdv', 'barchart', 'THD Voltage', ['thdVA', 'thdVB', 'thdVC']),
      P('pe_thdi', 'barchart', 'THD Current', ['thdIA', 'thdIB', 'thdIC']),
      P('pe_unbal', 'bargauge', 'Voltage Unbalance UV', ['unbalanceUV']),
      P('pe_harmonic', 'harmonic', 'Harmonics', [], { source: 'voltage' }),
      P('pe_derating', 'derating', 'De-rating per Phase'),
      P('pe_health', 'healthindex', 'Transformer Health Index', ['phaseA', 'phaseB', 'phaseC', 'currentA', 'currentB', 'currentC']),
      P('pe_events', 'eventstream', 'Event Stream'),
    ],
    layouts: { lg: [
      L('pe_vphase', 0, 0, 4, 4), L('pe_vline', 4, 0, 4, 4), L('pe_current', 8, 0, 4, 4),
      L('pe_freq', 0, 4, 2, 4), L('pe_pf', 2, 4, 2, 4), L('pe_power', 4, 4, 4, 4), L('pe_energy', 8, 4, 4, 4),
      L('pe_thdv', 0, 8, 4, 4), L('pe_thdi', 4, 8, 4, 4), L('pe_unbal', 8, 8, 4, 4),
      L('pe_harmonic', 0, 12, 7, 5), L('pe_derating', 7, 12, 5, 5),
      L('pe_health', 0, 17, 6, 6), L('pe_events', 6, 17, 6, 6),
    ] },
  },
  physical: {
    id: 'preset_physical', name: 'Physical',
    panels: [
      P('pp_phys', 'physicalstatus', 'Physical Status'),
      P('pp_oilstatus', 'oilstatus', 'Oil Level Status'),
      P('pp_oiltemp', 'areachart', 'Top Oil Temperature', ['oil_temperature']),
      P('pp_wti', 'linechart', 'Winding Temperature', ['wtiA', 'wtiB', 'wtiC']),
      P('pp_bus', 'linechart', 'Busbar Temperature', ['busTempA', 'busTempB', 'busTempC']),
      P('pp_press', 'linechart', 'Tank Pressure (ref 0.5 Bar)', ['oil_pressure']),
      P('pp_sld', 'sld', 'Transformer SLD', ['phaseA', 'phaseB', 'phaseC']),
      P('pp_news', 'news', 'Operational News'),
    ],
    layouts: { lg: [
      L('pp_phys', 0, 0, 8, 5), L('pp_oilstatus', 8, 0, 4, 5),
      L('pp_oiltemp', 0, 5, 6, 4), L('pp_wti', 6, 5, 6, 4),
      L('pp_bus', 0, 9, 6, 4), L('pp_press', 6, 9, 6, 4),
      L('pp_sld', 0, 13, 6, 6), L('pp_news', 6, 13, 6, 6),
    ] },
  },
  status: {
    id: 'preset_status', name: 'Status',
    panels: [
      P('ps_status', 'trafostatus', 'Transformer Status'),
      P('ps_health', 'healthindex', 'Health Index', ['phaseA', 'phaseB', 'phaseC', 'frequency', 'pfTotal']),
      P('ps_events', 'eventstream', 'Event Stream'),
      P('ps_oilstatus', 'oilstatus', 'Oil Level Status'),
      P('ps_phasor', 'phasor', 'Phasor', ['phaseA', 'phaseB', 'phaseC']),
      P('ps_stat', 'stat', 'Key Values', ['lineAB', 'currentA', 'frequency', 'pfTotal', 'oil_temperature']),
    ],
    layouts: { lg: [
      L('ps_status', 0, 0, 8, 7), L('ps_health', 8, 0, 4, 7),
      L('ps_events', 0, 7, 6, 6), L('ps_oilstatus', 6, 7, 2, 3), L('ps_phasor', 8, 7, 4, 6), L('ps_stat', 6, 10, 2, 3),
    ] },
  },
  oilquality: {
    id: 'preset_oilquality', name: 'Oil Quality',
    panels: [
      P('po_quality', 'oilquality', 'Oil Quality'),
      P('po_h2', 'areachart', 'Hydrogen (H2)', ['h2ppm']),
      P('po_moist', 'areachart', 'Moisture', ['moisturePpm']),
      P('po_h2g', 'gauge', 'H2 Gauge', ['h2ppm']),
      P('po_moistg', 'gauge', 'Moisture Gauge', ['moisturePpm']),
      P('po_oiltemp', 'linechart', 'Oil Temperature', ['oil_temperature']),
      P('po_press', 'linechart', 'Tank Pressure', ['oil_pressure']),
    ],
    layouts: { lg: [
      L('po_quality', 0, 0, 4, 5), L('po_h2', 4, 0, 4, 5), L('po_moist', 8, 0, 4, 5),
      L('po_h2g', 0, 5, 2, 4), L('po_moistg', 2, 5, 2, 4), L('po_oiltemp', 4, 5, 4, 4), L('po_press', 8, 5, 4, 4),
    ] },
  },
};

export const PRESET_IDS = Object.values(PRESETS).map((p) => p.id);
export const isPresetId = (id) => typeof id === 'string' && id.startsWith('preset_');
```

- [ ] **Step 2: `Dashboard.jsx`**
  - `import { PRESETS, isPresetId } from '../config/presets';`
  - `DEFAULT_PANELS = PRESETS.electrical.panels; DEFAULT_GRID_LAYOUTS = ensureResponsiveLayouts(PRESETS.electrical.layouts)` (pindahkan definisi `ensureResponsiveLayouts` ke atas sebelum dipakai, atau hitung lazily lewat fungsi `getDefaultGridLayouts()`); hapus array `DEFAULT_PANELS`/`DEFAULT_GRID_LAYOUTS` lama.
  - Di `fetchLayouts`, setelah loop API: tambahkan preset lain
    ```js
    for (const key of ['physical', 'status', 'oilquality']) {
      const pr = PRESETS[key];
      newProfiles[pr.id] = { id: pr.id, name: pr.name, panels: [...pr.panels], layouts: ensureResponsiveLayouts(pr.layouts), isEditable: false };
    }
    const savedPreset = localStorage.getItem('tmu_active_preset');
    if (activeId === 'default' && savedPreset && newProfiles[savedPreset]) activeId = savedPreset;
    ```
    dan `newProfiles['default'].name = 'Electrical (Default)'`.
  - Handler klik profil: `if (isPresetId(p.id) || p.id === 'default') localStorage.setItem('tmu_active_preset', p.id); else { localStorage.removeItem('tmu_active_preset'); setActiveLayoutInApi(p.id); }`.
  - Tombol hapus/rename: tampilkan hanya bila `activeProfile.isEditable` atau `activeProfileId === 'default'` (reset).
  - Blok "Saved Dashboards" di dropdown: beri judul kecil "Presets" untuk id preset dan "Saved" untuk sisanya (urutkan preset dulu).

- [ ] **Step 3: `npm run build`, `npx oxlint`; commit**

```bash
git add frontend/src/config/presets.js frontend/src/pages/Dashboard.jsx
git commit -m "feat(frontend): empat preset dashboard (Electrical, Physical, Status, Oil Quality)"
```

---

### Task 4: Halaman Settings tulis ulang

**Files:**
- Rewrite: `frontend/src/pages/Settings.jsx`

**Interfaces:**
- Consumes: `GET /api/settings/thresholds?trafo_id=` → `{ settings, trip, editable, tripColumns }`; `PUT /api/settings/thresholds/:trafoId` body `{ kolom: angka|null }`; `PUT /api/settings/trip/:trafoId` body `{ kolom: bool }`.

- [ ] **Step 1: Tulis `Settings.jsx`**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useApi } from '../contexts/ApiContext';
import { useThresholds } from '../contexts/ThresholdContext';
import { Edit, Check, X, ShieldAlert } from 'lucide-react';
import EnergyLoader from '../components/EnergyLoader';

// Kolom transformer_settings per grup (nama kolom persis seperti DB; satuan persen = % dari rated).
const GROUPS = [
  { key: 'voltage', title: 'Line Voltage', unit: '% dari rated LV', trip: 'voltage',
    fields: [['voltageLowAlarmTreshold', 'Low Alarm'], ['voltageLowTripTreshold', 'Low Trip'], ['voltageHighAlarmTreshold', 'High Alarm'], ['voltageHighTripTreshold', 'High Trip']],
    computed: [['voltageLowAlarmValue', 'Low Alarm'], ['voltageLowTripValue', 'Low Trip'], ['voltageHighAlarmValue', 'High Alarm'], ['voltageHighTripValue', 'High Trip']] },
  { key: 'unbalance', title: 'Voltage Unbalance', unit: '%', trip: 'voltageUnbalance', fields: [['voltageUnbalanceHighAlarmTreshold', 'Alarm'], ['voltageUnbalanceHighTripTreshold', 'Trip']] },
  { key: 'frequency', title: 'Frequency', unit: '% dari nominal', trip: 'frequency', fields: [['frequencyLowAlarmTreshold', 'Low Alarm'], ['frequencyLowTripTreshold', 'Low Trip'], ['frequencyHighAlarmTreshold', 'High Alarm'], ['frequencyHighTripTreshold', 'High Trip']] },
  { key: 'current', title: 'Current', unit: '% dari rated In', trip: 'current', fields: [['currentHighAlarmTreshold', 'High Alarm'], ['currentHighTripTreshold', 'High Trip']] },
  { key: 'ineutral', title: 'Neutral Current', unit: '% dari rated In', trip: 'Ineutral', fields: [['IneutralHighAlarmTreshold', 'High Alarm'], ['IneutralHighTripTreshold', 'High Trip']] },
  { key: 'pf', title: 'Power Factor', unit: '', trip: 'powerFactor', fields: [['powerFactorLowAlarmTreshold', 'Low Alarm'], ['powerFactorLowTripTreshold', 'Low Trip']] },
  { key: 'topoil', title: 'Top Oil Temperature', unit: '°C', trip: 'topOilTemp', fields: [['topOilHighAlarmTreshold', 'High Alarm'], ['topOilHighTripTreshold', 'High Trip']] },
  { key: 'wti', title: 'Winding Temperature', unit: '°C', trip: 'WTITemp', fields: [['windTempHighAlarmTreshold', 'High Alarm'], ['windTempHighTripTreshold', 'High Trip']] },
  { key: 'bus', title: 'Busbar Temperature', unit: '°C', trip: 'busTemp', fields: [['busTempHighAlarmTreshold', 'High Alarm'], ['busTempHighTripTreshold', 'High Trip']] },
  { key: 'thdv', title: 'THD Voltage', unit: '%', trip: 'THDVoltage', fields: [['thdVoltageAlarmTreshold', 'Alarm'], ['thdVoltageTripTreshold', 'Trip']] },
  { key: 'thdi', title: 'THD Current', unit: '%', trip: 'THDCurrent', fields: [['thdCurrentAlarmTreshold', 'Alarm'], ['thdCurrentTripTreshold', 'Trip']] },
  { key: 'pressure', title: 'Tank Pressure', unit: 'Bar', trip: 'pressure', fields: [['tankPressureHighAlarmTreshold', 'High Alarm'], ['tankPressureHighTripTreshold', 'High Trip']] },
  { key: 'oillevel', title: 'Oil Level', unit: '', trip: 'oilLevel', fields: [] },
  { key: 'h2', title: 'Hydrogen (H2)', unit: 'ppm', trip: 'H2ppm', fields: [['H2ppmHighAlarmTreshold', 'High Alarm'], ['H2ppmHighTripTreshold', 'High Trip']] },
  { key: 'moisture', title: 'Moisture', unit: 'ppm', trip: 'Moistureppm', fields: [['MoistureppmHighAlarmTreshold', 'High Alarm'], ['MoistureppmHighTripTreshold', 'High Trip']] },
];

const show = (v, unit) => (v === null || v === undefined ? '-' : `${v}${unit ? ` ${unit.split(' ')[0]}` : ''}`);

const Settings = () => {
  const { apiUrl } = useApi();
  const { refreshThresholds } = useThresholds();
  const role = (sessionStorage.getItem('role') || '').toLowerCase();
  const canEdit = role === 'admin' || role === 'superuser';
  const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';

  const [settings, setSettings] = useState(null);
  const [trip, setTrip] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);      // key grup
  const [draft, setDraft] = useState({});            // { kolom: string }
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${apiUrl}/api/settings/thresholds`, { params: { trafo_id: trafoId } });
      setSettings(res.data.settings);
      setTrip(res.data.trip);
      setError(res.data.settings ? '' : 'Trafo ini belum punya transformer_settings (menunggu Raspi mendaftar).');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, trafoId]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (g) => {
    const d = {};
    for (const [col] of g.fields) d[col] = settings[col] === null || settings[col] === undefined ? '' : String(settings[col]);
    setDraft(d); setEditing(g.key); setNotice('');
  };

  const save = async (g) => {
    const body = {};
    for (const [col] of g.fields) {
      const raw = String(draft[col] ?? '').trim();
      const before = settings[col] === null || settings[col] === undefined ? '' : String(settings[col]);
      if (raw === before) continue;
      if (raw === '') { body[col] = null; continue; }
      const n = Number(raw);
      if (!Number.isFinite(n)) { setNotice(`Nilai ${col} bukan angka`); return; }
      body[col] = n;
    }
    if (Object.keys(body).length === 0) { setEditing(null); return; }
    try {
      setSaving(true);
      const res = await axios.put(`${apiUrl}/api/settings/thresholds/${trafoId}`, body);
      setSettings(res.data.settings);
      setNotice(res.data.message || 'Tersimpan');
      setEditing(null);
      await refreshThresholds();
      window.dispatchEvent(new Event('thresholdsUpdated'));
    } catch (err) {
      setNotice(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const toggleTrip = async (col) => {
    if (!canEdit || !trip) return;
    const next = !(Number(trip[col]) === 1);
    try {
      const res = await axios.put(`${apiUrl}/api/settings/trip/${trafoId}`, { [col]: next });
      setTrip(res.data.trip);
      setNotice(res.data.pushed ? 'Trip enable tersimpan dan dikirim ke Raspi' : 'Trip enable tersimpan (Raspi offline, akan sinkron saat terhubung)');
    } catch (err) {
      setNotice(err.response?.data?.error || 'Gagal mengubah trip enable');
    }
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center min-h-[40vh]"><EnergyLoader text="Loading Settings..." /></div>;

  return (
    <div className="flex flex-col gap-5 animate-[fadeIn_0.5s_ease-out] w-full pb-10">
      <div>
        <h2 className="text-3xl font-bold text-[#172b4d] dark:text-white font-heading mb-1">Threshold settings</h2>
        <p className="text-[#5e6c84] dark:text-[#94a3b8] text-[0.95rem]">Batas alarm dan trip per parameter untuk trafo {trafoId}. Nilai tegangan absolut dihitung server dari rated LV.{!canEdit && ' Anda hanya dapat melihat.'}</p>
      </div>
      {error && <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 px-4 py-3 text-sm flex items-center gap-2"><ShieldAlert size={16} /> {error}</div>}
      {notice && <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 px-4 py-2 text-sm">{notice}</div>}
      {settings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {GROUPS.map((g) => {
            const isEditing = editing === g.key;
            const tripOn = trip ? Number(trip[g.trip]) === 1 : false;
            return (
              <div key={g.key} className={`rounded-2xl border p-4 bg-white dark:bg-[#151521] ${isEditing ? 'border-blue-400 ring-2 ring-blue-500/20' : 'border-[#dfe1e6] dark:border-white/10'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold text-[#172b4d] dark:text-white">{g.title}</div>
                    {g.unit && <div className="text-[11px] text-gray-500">satuan: {g.unit}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className={`flex items-center gap-2 text-xs font-bold ${canEdit ? 'cursor-pointer' : 'opacity-70'}`} title="Trip enable: Raspi boleh memutus saat trip">
                      <span className="text-gray-500">Trip</span>
                      <button type="button" disabled={!canEdit || !trip} onClick={() => toggleTrip(g.trip)} className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${tripOn ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${tripOn ? 'translate-x-4' : ''}`} />
                      </button>
                    </label>
                    {canEdit && g.fields.length > 0 && (isEditing
                      ? <div className="flex gap-1">
                          <button disabled={saving} onClick={() => save(g)} className="px-2.5 py-1.5 rounded-lg bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 font-bold text-xs flex items-center gap-1"><Check size={14} /> Save</button>
                          <button onClick={() => setEditing(null)} className="px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs"><X size={14} /></button>
                        </div>
                      : <button onClick={() => startEdit(g)} className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-bold text-xs flex items-center gap-1"><Edit size={14} /> Edit</button>)}
                  </div>
                </div>
                {g.fields.length === 0 ? <div className="text-xs text-gray-500">Tidak ada nilai ambang; hanya trip enable.</div> : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {g.fields.map(([col, label]) => (
                      <div key={col} className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase text-gray-500">{label}</span>
                        {isEditing
                          ? <input type="number" step="any" value={draft[col] ?? ''} onChange={(e) => setDraft({ ...draft, [col]: e.target.value })} placeholder="kosong = tidak ada" className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm font-bold text-[#172b4d] dark:text-white outline-none focus:border-blue-500" />
                          : <span className="font-bold text-sm text-[#172b4d] dark:text-white">{show(settings[col], g.unit)}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {g.computed && (
                  <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {g.computed.map(([col, label]) => (
                      <div key={col} className="flex flex-col"><span className="text-[10px] uppercase text-gray-400">{label} (V)</span><span className="text-sm font-mono text-[#172b4d] dark:text-gray-200">{show(settings[col], '')}</span></div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Settings;
```

- [ ] **Step 2: `npm run build`, `npx oxlint`; commit**

```bash
git add frontend/src/pages/Settings.jsx
git commit -m "feat(frontend): halaman Settings per grup transformer_settings + trip enable"
```

---

### Task 5: Nameplate di TransformerData dan field login

**Files:**
- Modify: `frontend/src/pages/TransformerData.jsx` (ganti tiga kartu spesifikasi statis dengan data `/api/trafo/:id/data` + modal edit), `frontend/src/pages/Login.jsx` (simpan `tmu_version`)

**Interfaces:**
- Consumes: `GET /api/trafo/:id/data` → `{ success, data: transformer_data }`; `PUT /api/trafo/:id/data` body kolom dari `EDITABLE_TD`.

- [ ] **Step 1: Komponen nameplate** (`frontend/src/components/NameplateCards.jsx`)

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Settings, Thermometer, Zap, Edit, Check, X, Cpu } from 'lucide-react';
import { useApi } from '../contexts/ApiContext';

const SECTIONS = [
  { title: 'General Specifications', icon: Settings, color: 'text-teal-500', fields: [
    ['trafoSerialNo', 'SERIAL NO', '', 'text'], ['ratedPower', 'RATED POWER', 'kVA'], ['frequency', 'FREQUENCY', 'Hz'], ['impedance', 'IMPEDANCE', '%'],
    ['vectorGroup', 'VECTOR GROUP', '', 'text'], ['phase', 'PHASE', ''], ['coolingMode', 'COOLING', '', 'text'], ['krated', 'K-RATED', ''],
  ] },
  { title: 'Energy Loss & Temperature', icon: Thermometer, color: 'text-indigo-500', fields: [
    ['noLoadLoss', 'NO LOAD LOSS', 'W'], ['fullLoadLoss', 'FULL LOAD LOSS', 'W'], ['topOilLv', 'TOP OIL RISE LV', '°C'], ['topOilHv', 'TOP OIL RISE HV', '°C'],
    ['windTempLv', 'WINDING RISE LV', '°C'], ['windTempHv', 'WINDING RISE HV', '°C'], ['gradientLv', 'GRADIENT LV', '°C'], ['gradientHv', 'GRADIENT HV', '°C'], ['hotspotFactor', 'HOTSPOT FACTOR', ''],
  ] },
  { title: 'Voltage, Current & Tap', icon: Zap, color: 'text-amber-500', wide: true, fields: [
    ['ratedLowVoltage', 'RATED VOLTAGE (LV)', 'V'], ['ratedHighVoltage', 'RATED VOLTAGE (HV)', 'kV'], ['ratedCurrentLowVoltage', 'RATED CURRENT (LV)', 'A'], ['ratedCurrentHighVoltage', 'RATED CURRENT (HV)', 'A'],
    ['tapType', 'TAP TYPE', '', 'text'], ['tapNumberPlus', 'TAP +', ''], ['tapNumberMinus', 'TAP -', ''], ['tapPercentagePlus', 'TAP STEP +', '%'], ['tapPercentageMinus', 'TAP STEP -', '%'], ['ctRatio', 'CT RATIO', ''],
  ] },
  { title: 'Device', icon: Cpu, color: 'text-slate-500', wide: true, readonly: true, fields: [
    ['raspiSerialNo', 'RASPI SERIAL', '', 'text'], ['version', 'TMU VERSION', '', 'text'], ['lastSyncTimestamp', 'LAST SYNC', '', 'time'], ['latitude', 'LATITUDE', ''], ['longitude', 'LONGITUDE', ''], ['intervalDelay', 'INTERVAL', 's'],
  ] },
];

const Field = ({ label, value, unit }) => (
  <div className="flex flex-col">
    <span className="text-[10px] font-bold text-gray-400 tracking-wider">{label}</span>
    <span className="font-bold text-[#172b4d] dark:text-white">{value === null || value === undefined || value === '' ? '-' : `${value}${unit ? ` ${unit}` : ''}`}</span>
  </div>
);

export default function NameplateCards({ trafoId }) {
  const { apiUrl } = useApi();
  const role = (sessionStorage.getItem('role') || '').toLowerCase();
  const canEdit = role === 'admin' || role === 'superuser';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!trafoId) return;
    try { const res = await axios.get(`${apiUrl}/api/trafo/${trafoId}/data`); setData(res.data.data || null); setError(res.data.data ? '' : 'Nameplate belum ada (menunggu Raspi mendaftar).'); }
    catch (err) { setError(err.response?.data?.error || err.message); }
  }, [apiUrl, trafoId]);
  useEffect(() => { load(); }, [load]);

  const fmt = (col, type) => {
    const v = data ? data[col] : null;
    if (type === 'time') return v ? new Date(v).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : null;
    return v;
  };

  const startEdit = () => {
    const d = {};
    for (const s of SECTIONS) if (!s.readonly) for (const [col] of s.fields) d[col] = data && data[col] !== null && data[col] !== undefined ? String(data[col]) : '';
    setDraft(d); setEditing(true); setNotice('');
  };

  const save = async () => {
    const body = {};
    for (const s of SECTIONS) if (!s.readonly) for (const [col, , , type] of s.fields) {
      const raw = String(draft[col] ?? '').trim();
      const before = data && data[col] !== null && data[col] !== undefined ? String(data[col]) : '';
      if (raw === before) continue;
      if (raw === '') { body[col] = null; continue; }
      if (type === 'text') { body[col] = raw; continue; }
      const n = Number(raw);
      if (!Number.isFinite(n)) { setNotice(`Nilai ${col} bukan angka`); return; }
      body[col] = n;
    }
    if (Object.keys(body).length === 0) { setEditing(false); return; }
    try {
      const res = await axios.put(`${apiUrl}/api/trafo/${trafoId}/data`, body);
      setData(res.data.data || res.data.transformerData || data);
      setNotice(res.data.pushed ? 'Nameplate tersimpan dan dikirim ke Raspi' : 'Nameplate tersimpan (Raspi offline, akan sinkron saat terhubung)');
      setEditing(false);
      await load();
      window.dispatchEvent(new Event('thresholdsUpdated')); // limits bergantung rated values
    } catch (err) { setNotice(err.response?.data?.error || 'Gagal menyimpan nameplate'); }
  };

  return (
    <>
      <div className="lg:col-span-2 flex items-center justify-between">
        <div className="text-sm text-gray-500">{error || notice}</div>
        {canEdit && data && (editing
          ? <div className="flex gap-2"><button onClick={save} className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 font-bold text-xs flex items-center gap-1"><Check size={14} /> Save</button><button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-xs"><X size={14} /></button></div>
          : <button onClick={startEdit} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-bold text-xs flex items-center gap-1"><Edit size={14} /> Edit Nameplate</button>)}
      </div>
      {SECTIONS.map((s) => (
        <div key={s.title} className={`bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 flex flex-col ${s.wide ? 'lg:col-span-2' : ''}`}>
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#dfe1e6] dark:border-white/10">
            <div className={s.color}><s.icon size={20} /></div>
            <h3 className="font-bold text-lg text-[#172b4d] dark:text-white">{s.title}</h3>
          </div>
          <div className={`grid grid-cols-2 ${s.wide ? 'lg:grid-cols-5' : 'sm:grid-cols-3'} gap-5`}>
            {s.fields.map(([col, label, unit, type]) => (editing && !s.readonly
              ? <div key={col} className="flex flex-col gap-1"><span className="text-[10px] font-bold text-gray-400 tracking-wider">{label}{unit ? ` (${unit})` : ''}</span>
                  <input type={type === 'text' ? 'text' : 'number'} step="any" value={draft[col] ?? ''} onChange={(e) => setDraft({ ...draft, [col]: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm font-bold text-[#172b4d] dark:text-white outline-none focus:border-blue-500" /></div>
              : <Field key={col} label={label} value={fmt(col, type)} unit={unit} />))}
          </div>
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 2: `TransformerData.jsx`**: import `NameplateCards`; ganti tiga `<div className="bg-white ...">` kartu "General Specifications", "Energy Loss & Temperature", "Voltage & Current" dengan `<NameplateCards trafoId={trafoId} />` (di dalam grid yang sama). Hapus `SpecField` jika tidak dipakai lagi dan ikon yang tidak terpakai dari import.

- [ ] **Step 3: `Login.jsx`**: setelah `sessionStorage.setItem('db_name', ...)` tambah `sessionStorage.setItem('tmu_version', String(data.tmu_version || 2));`.

- [ ] **Step 4: `npm run build`, `npx oxlint`; commit**

```bash
git add frontend/src/components/NameplateCards.jsx frontend/src/pages/TransformerData.jsx frontend/src/pages/Login.jsx
git commit -m "feat(frontend): nameplate dari transformer_data dengan edit admin; simpan tmu_version saat login"
```

---

### Task 6: Uji browser ujung ke ujung, bersih-bersih, dokumentasi

**Files:**
- Modify: `README.md`; file frontend yang masih merujuk field lama bila ditemukan.

- [ ] **Step 1: Bersih-bersih referensi lama**

```bash
grep -rn "phase_a_v\|threshold_settings\|metric_key\|min_value\|FRONTEND_TO_DB_METRIC\|/api/transformers" frontend/src --include=*.jsx --include=*.js
```

Expected: hanya `pages/ManageTransformers.jsx` (`/api/transformers`, halaman tidak dirutekan; biarkan dan catat) — selain itu kosong.

- [ ] **Step 2: Jalankan backend + fake_raspi + frontend dev, uji di browser** (`npm run dev` di `frontend`, `VITE_PUBLIC_API_URL=http://localhost:5000` di `frontend/.env.local`):

1. Login `demo/demo123` → halaman pemilihan trafo menampilkan 2 trafo (seed Offline, fake Online).
2. Pilih trafo 2 → Dashboard preset Electrical: grafik tegangan bergerak tiap detik, gauge frekuensi 49–51 (batas dari limits), panel Harmonics berisi 3 fase, De-rating 3 pie, Health Index 100, Event Stream berisi `fl-...`.
3. Ganti preset Physical → Physical Status menampilkan tap OCTC, oil level, pressure dengan garis 0.5; grafik pressure punya garis referensi Max 0.5.
4. Preset Status → grid 29 parameter, OilTemp bergantian Normal / High Alarm tiap menit; klik menampilkan rekomendasi.
5. Preset Oil Quality → H2/moisture tampil, kartu "belum tersedia" untuk BDV.
6. Settings → ubah `topOilHighAlarmTreshold` 70 → 65, Save → pesan "Raspi online: dikirim" (fake_raspi mencetak `settings dari server`); kembali ke Dashboard tanpa reload: gauge/limit oil_temperature memakai 65. Kembalikan ke 70.
7. Transformer Data → nameplate terisi (rated 100 kVA, 400 V, 144 A); Edit sebagai superuser → ubah `impedance` 4 → 5 → Save → tampil 5; kembalikan.
8. Kembali ke pemilihan trafo, pilih trafo 1 → Dashboard menampilkan data seed (statis), panel harmonik 3 fase seed, status semua Normal.
9. Konsol browser tanpa error merah (peringatan recharts boleh).

Kalau browser tidak tersedia bagi eksekutor, jalankan minimal: `npm run build`, `npx oxlint`, dan `node scripts/smoke_api.js` dengan server hidup, lalu catat di README bahwa uji browser belum dilakukan.

- [ ] **Step 3: README**: bagian 3.4 tambah `frontend/.env.local`; bagian 5 Rencana D selesai (daftar panel baru, preset, Settings, nameplate); bagian 6 "yang tersisa" (lihat Selesai Rencana D); bagian 7 tambah catatan `X-Trafo-Id`.

- [ ] **Step 4: Commit**

```bash
git add README.md frontend/src
git commit -m "feat(frontend): Rencana D selesai — uji browser, bersih-bersih referensi lama"
```

---

## Selesai Rencana D

Seluruh migrasi selesai: backend memakai `master_tmu_app` + `base_tmu`, Raspi terhubung lewat protokol lama, dan frontend menampilkan semuanya untuk trafo yang dipilih. Yang disengaja belum: halaman `ManageTransformers.jsx` (tidak dirutekan), interval 1/5/10/15 menit, laporan instantaneous/performance dari Raspi, Telegram, migrasi password bcrypt→sha256 (spec bagian 11).
