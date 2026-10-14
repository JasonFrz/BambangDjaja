// Logika murni panel, diuji oleh scripts/render-check. Dipisah dari file komponen
// supaya aturan react/only-export-components (Fast Refresh) tetap terpenuhi.

// Baris bar chart harmonik per orde, mulai orde dasar 1st (dashboard-documentation 4.2 L/M).
export function harmonicRows(data) {
  if (!data || !Array.isArray(data.data) || data.data.length === 0) return [];
  return (data.orders || []).map((o) => {
    const row = { order: o };
    for (const p of data.data) row[`phase${p.phase}`] = Number(p.orders[o] || 0);
    return row;
  });
}

// Va/Vb/Vc untuk harmonik tegangan, Ia/Ib/Ic untuk harmonik arus.
export const harmonicPhaseLabel = (source, phase) =>
  `${source === 'current' ? 'I' : 'V'}${['', 'a', 'b', 'c'][phase] || phase}`;

// Sumbu Y seperti suggestedMin/suggestedMax Chart.js: batas lunak yang tetap melebar mengikuti data.
export function chartYDomain(panel) {
  const lo = panel && panel.suggestedMin;
  const hi = panel && panel.suggestedMax;
  return [
    typeof lo === 'number' ? (dataMin) => Math.min(dataMin, lo) : 'auto',
    typeof hi === 'number' ? (dataMax) => Math.max(dataMax, hi) : 'auto',
  ];
}

// Garis referensi chart. panel.referenceLines (nilai tetap, mis. Pressure 0.5 Bar) menggantikan
// garis dari limits; tanpa itu dipakai batas max tiap metric, plus min kalau hanya satu metric.
// recharts membuang garis di luar rentang sumbu Y ('discard'); panel.extendToLines melebarkan
// sumbu supaya garis selalu terlihat (dipakai Frequency, nilainya dekat 50 Hz, alarm di luarnya).
export function chartReferenceLines(panel, metrics, getThreshold, labelOf = (m) => m) {
  const ifOverflow = panel && panel.extendToLines ? 'extendDomain' : 'discard';
  if (panel && Array.isArray(panel.referenceLines)) {
    return panel.referenceLines.map((rl, i) => ({ id: `ref-${i}`, y: rl.y, label: rl.label, ifOverflow }));
  }
  const lines = [];
  for (const m of metrics) {
    const t = getThreshold(m);
    if (!t || !t.is_active) continue;
    if (t.max !== null && t.max !== undefined) lines.push({ id: `${m}-max`, y: t.max, label: `${labelOf(m)} Max (${t.max})`, ifOverflow });
    if (t.min !== null && t.min !== undefined && metrics.length === 1) lines.push({ id: `${m}-min`, y: t.min, label: `${labelOf(m)} Min (${t.min})`, ifOverflow });
  }
  return lines;
}

// Status perangkat (dashboard-documentation 3.5 dan 8.5): 'offline', 'nodata' (online tapi belum
// ada data hari ini, zona Asia/Jakarta), atau null. Hanya di mode live dan setelah semuanya dimuat.
export function deviceState({ online, isLiveMode, isLoading, lastTimestamp, now = new Date() }) {
  if (!isLiveMode || isLoading || online === null || online === undefined) return null;
  if (!online) return 'offline';
  if (!lastTimestamp) return 'nodata';
  const day = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  return day(lastTimestamp) === day(now) ? null : 'nodata';
}

// Warna indikator Oil Condition (dashboard-documentation 6.4): Good hijau, Poor kuning, Severe merah.
export function oilConditionClass(condition) {
  const c = String(condition || '').toLowerCase();
  if (c === 'good') return 'bg-emerald-500 text-white';
  if (c === 'poor') return 'bg-amber-400 text-black';
  if (c === 'severe') return 'bg-red-500 text-white';
  return 'bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-300';
}
