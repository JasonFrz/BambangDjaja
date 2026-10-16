import React from 'react';
import { renderToString } from 'react-dom/server';
import { HarmonicPanel } from 'SRC/components/visualizations/HarmonicPanel.jsx';
import { DeratingPanel } from 'SRC/components/visualizations/DeratingPanel.jsx';
import { TransformerStatusPanel } from 'SRC/components/visualizations/TransformerStatusPanel.jsx';
import { PhysicalStatusPanel } from 'SRC/components/visualizations/PhysicalStatusPanel.jsx';
import { OilQualityPanel } from 'SRC/components/visualizations/OilQualityPanel.jsx';
import { ElectricalStatusPanel } from 'SRC/components/visualizations/ElectricalStatusPanel.jsx';
import { DeviceStateNotice } from 'SRC/components/DeviceStateBanner.jsx';
import FailureReport from 'SRC/pages/FailureReport.jsx';
import { PRESETS } from 'SRC/config/presets.js';
import { METRICS } from 'SRC/config/metrics.js';
import { canPersist } from 'SRC/config/presets.js';
import { defaultRange } from 'SRC/config/gaugeRanges.js';
import { harmonicRows, harmonicPhaseLabel, chartYDomain, chartReferenceLines, deviceState, oilConditionClass } from 'SRC/config/panelHelpers.js';
import { FIX } from './stubs.js';

const latest = { h2ppm: 17, moisturePpm: 9, leadLag: { a: 'leading', b: 'lagging', c: 'unity' }, derating: { a: { kRated: 4, full: 33.33, available: 30.78, lost: 2.55, used: 16.39 }, b: { kRated: 4, full: 33.33, available: 31.84, lost: 1.49, used: 17.83 }, c: { kRated: 4, full: 33.33, available: 29.8, lost: 3.54, used: 14.21 } } };
const ALL_SAFE = { status: { success: true, hasStatus: true, allSafe: true, counts: { alarm: 0, trip: 0 }, tripActive: [],
  items: ['Vab', 'OilTemp'].map((p) => ({ parameter: p, code: 3, label: 'Normal', level: 'normal', recommendations: [] })) } };
const OLTC = { physical: { ...FIX.physical, tap: { type: 'OLTC', display: 5, plus: 8, minus: 8 } } };
const OIL_POOR = { 'oil-quality': { success: true, available: true, waterActivity: 0.2, oilBDV: 55, oilCondition: 'Poor' } };
const NO_STATUS = { status: { success: true, hasStatus: false, allSafe: true, counts: { alarm: 0, trip: 0 }, items: [], tripActive: [] } };

// Halaman report membaca sessionStorage saat render; di Node belum ada.
if (!globalThis.sessionStorage) globalThis.sessionStorage = { getItem: () => null };

// [nama, elemen, teks yang harus ada, override fixture, teks yang tidak boleh ada]
const cases = [
  ['HarmonicPanel', <HarmonicPanel key="case-1" panel={{ id: 'x', title: 'Harmonics', source: 'voltage' }} isEditing={false} updatePanel={() => {}} />, ['Harmonics', 'recharts-responsive-container']],
  ['DeratingPanel', <DeratingPanel key="case-2" panel={{ id: 'x', title: 'De-rating' }} latestData={latest} isEditing={false} />, ['Fase A', 'Fase B', 'Fase C', '30.8 / 33.3 kVA', 'K-Factor 4', '#eab308']],
  ['DeratingPanel (tanpa data)', <DeratingPanel key="case-3" panel={{ id: 'x', title: 'De-rating' }} latestData={{}} isEditing={false} />, ['Menunggu data meter']],
  ['TransformerStatusPanel (hanya yang bermasalah)', <TransformerStatusPanel key="case-4" panel={{ id: 'x', title: 'Status' }} isEditing={false} />, ['1 alarm', 'OilTemp', 'High Alarm', 'Alarm', 'Rekomendasi', 'TRIP'], undefined, ['>Vab<', 'All Systems Optimal']],
  ['TransformerStatusPanel (semua aman)', <TransformerStatusPanel key="case-4b" panel={{ id: 'x', title: 'Status' }} isEditing={false} />, ['All Systems Optimal'], ALL_SAFE, ['>Vab<']],
  ['TransformerStatusPanel (tanpa data)', <TransformerStatusPanel key="case-8" panel={{ id: 'x', title: 'Status' }} isEditing={false} />, ['Belum ada data status'], NO_STATUS],
  ['PhysicalStatusPanel (OCTC)', <PhysicalStatusPanel key="case-5" panel={{ id: 'x', title: 'Physical' }} isEditing={false} />, ['Tap Position', '>OCTC</div>', '0.42 Bar', 'Gas Fault', 'Normal']],
  ['PhysicalStatusPanel (OLTC -> impedance)', <PhysicalStatusPanel key="case-5b" panel={{ id: 'x', title: 'Physical' }} isEditing={false} />, ['>5</div>'], OLTC],
  ['OilQualityPanel (kolom tidak ada)', <OilQualityPanel key="case-6" panel={{ id: 'x', title: 'Oil' }} latestData={latest} isEditing={true} />, ['17 ppm', '9 ppm', 'belum tersedia']],
  ['OilQualityPanel (Poor = kuning)', <OilQualityPanel key="case-6b" panel={{ id: 'x', title: 'Oil' }} latestData={latest} isEditing={false} />, ['Poor', 'bg-amber-400', '55 kV'], OIL_POOR],
  ['ElectricalStatusPanel', <ElectricalStatusPanel key="case-9" panel={{ id: 'x', title: 'Status Listrik' }} latestData={latest} isEditing={false} />, ['Vab', 'Current1', 'PF', 'Freq', 'Qa', 'Leading', 'Lagging', 'Unity']],
  ['DeviceStateNotice offline', <DeviceStateNotice key="case-10" state="offline" onRefresh={() => {}} />, ['Device is Offline', 'Refresh']],
  ['DeviceStateNotice nodata', <DeviceStateNotice key="case-11" state="nodata" onRefresh={() => {}} />, ['No Data Found For Today']],
  ['FailureReport (ada alarm aktif)', <FailureReport key="case-12" />, ['Failure Report - TRF-001', 'Export', 'Start Date', 'Sedang aktif sekarang', 'Top Oil Temperature', 'High Alarm', 'bg-amber-400', 'Jam mulai dan durasi', 'Tidak ada failure pada periode ini'], undefined, ['Voltage Phase-Phase A-B', 'Tidak ada alarm/trip aktif']],
  ['FailureReport (semua aman)', <FailureReport key="case-12b" />, ['Tidak ada alarm/trip aktif'], ALL_SAFE, ['Jam mulai dan durasi']],
  ['FailureReport (tanpa data status)', <FailureReport key="case-12c" />, ['Belum ada data status dari Raspi'], NO_STATUS],
];

const panelsOf = (k) => PRESETS[k].panels;
const has = (k, pred) => panelsOf(k).some(pred);
const usesAll = (p, keys) => keys.every((m) => (p.metrics || []).includes(m));
const NOW = new Date('2026-10-14T05:00:00Z');
const dom = chartYDomain({ suggestedMin: 30 });
const presDom = chartYDomain({ suggestedMin: 0.3, suggestedMax: 0.52 });
const thr = () => ({ is_active: true, min: 49.5, max: 50.5 });
const rows = harmonicRows(FIX.harmonics);

let fail = 0;
const pure = [
  ['canPersist preset -> false', () => canPersist({ id: 'preset_physical', isEditable: false }) === false],
  ['canPersist default -> true', () => canPersist({ id: 'default', isEditable: false }) === true],
  ['canPersist kustom -> true', () => canPersist({ id: 7, isEditable: true }) === true],
  ['defaultRange unbalanceUV 0-10', () => JSON.stringify(defaultRange('unbalanceUV')) === '{"min":0,"max":10}'],
  ['defaultRange pfA 0-1', () => defaultRange('pfA').max === 1],
  ['defaultRange powerActiveA 0-1000', () => defaultRange('powerActiveA').max === 1000],
  ['defaultRange wtiA 0-150', () => defaultRange('wtiA').max === 150],
  ['defaultRange phaseA 0-500', () => defaultRange('phaseA').max === 500],
  // dashboard-documentation 4.2 L/M: orde 1st sampai 31st, label Va/Vb/Vc dan Ia/Ib/Ic
  ['harmonicRows mulai dari 1st, 16 orde', () => rows.length === 16 && rows[0].order === '1st' && rows[0].phase1 === 100],
  ['harmonicPhaseLabel Va / Ic', () => harmonicPhaseLabel('voltage', 1) === 'Va' && harmonicPhaseLabel('current', 3) === 'Ic'],
  // Chart.js suggestedMin/Max: batas lunak yang melebar mengikuti data
  ['chartYDomain suggestedMin 30', () => dom[0](40) === 30 && dom[0](20) === 20 && dom[1] === 'auto'],
  ['chartYDomain pressure 0.3-0.52', () => presDom[0](0.4) === 0.3 && presDom[1](0.45) === 0.52 && presDom[1](0.6) === 0.6],
  ['chartReferenceLines tetap menggantikan limits', () => JSON.stringify(chartReferenceLines({ referenceLines: [{ y: 0.5, label: 'Max' }] }, ['oil_pressure'], thr).map((l) => [l.y, l.label])) === '[[0.5,"Max"]]'],
  ['chartReferenceLines dari limits (max + min untuk 1 metric)', () => chartReferenceLines({}, ['frequency'], thr).length === 2],
  ['chartReferenceLines dari limits (hanya max untuk >1 metric)', () => chartReferenceLines({}, ['phaseA', 'phaseB'], thr).length === 2],
  // recharts membuang ReferenceLine di luar rentang Y (ifOverflow 'discard'); extendToLines melebarkan sumbu
  ['chartReferenceLines bawaan: discard', () => chartReferenceLines({}, ['frequency'], thr).every((l) => l.ifOverflow === 'discard')],
  ['chartReferenceLines extendToLines: extendDomain', () => chartReferenceLines({ extendToLines: true }, ['frequency'], thr).every((l) => l.ifOverflow === 'extendDomain')],
  ['electrical: garis alarm Frequency selalu terlihat', () => has('electrical', (p) => p.type === 'linechart' && usesAll(p, ['frequency']) && p.extendToLines === true)],
  // dashboard-documentation 3.5 / 8.5: Offline dan No Data Found For Today
  ['deviceState offline', () => deviceState({ online: false, isLiveMode: true, isLoading: false, lastTimestamp: NOW, now: NOW }) === 'offline'],
  ['deviceState online, data kemarin -> nodata', () => deviceState({ online: true, isLiveMode: true, isLoading: false, lastTimestamp: '2026-10-13T05:00:00Z', now: NOW }) === 'nodata'],
  ['deviceState online, tanpa data -> nodata', () => deviceState({ online: true, isLiveMode: true, isLoading: false, lastTimestamp: null, now: NOW }) === 'nodata'],
  ['deviceState online, data hari ini -> null', () => deviceState({ online: true, isLiveMode: true, isLoading: false, lastTimestamp: '2026-10-14T01:00:00Z', now: NOW }) === null],
  ['deviceState mode historis -> null', () => deviceState({ online: false, isLiveMode: false, isLoading: false, lastTimestamp: null, now: NOW }) === null],
  ['deviceState status belum dimuat -> null', () => deviceState({ online: null, isLiveMode: true, isLoading: false, lastTimestamp: null, now: NOW }) === null],
  ['deviceState data masih dimuat -> null', () => deviceState({ online: true, isLiveMode: true, isLoading: true, lastTimestamp: null, now: NOW }) === null],
  ['oilConditionClass Good/Poor/Severe', () => oilConditionClass('Good').includes('emerald') && oilConditionClass('poor').includes('amber') && oilConditionClass('Severe').includes('red')],
  // Isi preset mengikuti dashboard-documentation bagian 3 sampai 6
  ['electrical: arus Ia/Ib/Ic/Iavg/Ineutral', () => has('electrical', (p) => usesAll(p, ['currentA', 'currentB', 'currentC', 'avgCurrent', 'currentN']))],
  ['electrical: daya aktif per fase + total', () => has('electrical', (p) => p.type === 'linechart' && usesAll(p, ['powerActiveA', 'powerActiveB', 'powerActiveC', 'powerActiveTotal']))],
  ['electrical: daya reaktif per fase + total', () => has('electrical', (p) => p.type === 'linechart' && usesAll(p, ['powerReactiveA', 'powerReactiveB', 'powerReactiveC', 'powerReactiveTotal']))],
  ['electrical: daya semu per fase + total', () => has('electrical', (p) => p.type === 'linechart' && usesAll(p, ['powerApparentA', 'powerApparentB', 'powerApparentC', 'powerApparentTotal']))],
  ['electrical: PF per fase + total', () => has('electrical', (p) => p.type === 'linechart' && usesAll(p, ['pfA', 'pfB', 'pfC', 'pfTotal']))],
  ['electrical: grafik frekuensi', () => has('electrical', (p) => p.type === 'linechart' && usesAll(p, ['frequency']))],
  ['electrical: grafik efisiensi', () => has('electrical', (p) => p.type === 'linechart' && usesAll(p, ['efficiency']))],
  ['electrical: THD V dan THD I line chart', () => has('electrical', (p) => p.type === 'linechart' && usesAll(p, ['thdVA', 'thdVB', 'thdVC'])) && has('electrical', (p) => p.type === 'linechart' && usesAll(p, ['thdIA', 'thdIB', 'thdIC']))],
  ['electrical: harmonik tegangan dan arus', () => has('electrical', (p) => p.type === 'harmonic' && p.source === 'voltage') && has('electrical', (p) => p.type === 'harmonic' && p.source === 'current')],
  ['electrical: de-rating, kWh/kVARh, badge status + leading/lagging', () => has('electrical', (p) => p.type === 'derating') && has('electrical', (p) => usesAll(p, ['energyActiveTotal', 'energyReactiveTotal'])) && has('electrical', (p) => p.type === 'electricalstatus')],
  ['physical: suhu oli + busbar, suggestedMin 30', () => has('physical', (p) => p.type === 'linechart' && usesAll(p, ['oil_temperature', 'busTempA', 'busTempB', 'busTempC']) && p.suggestedMin === 30)],
  ['physical: WTI A/B/C', () => has('physical', (p) => p.type === 'linechart' && usesAll(p, ['wtiA', 'wtiB', 'wtiC']))],
  ['physical: tekanan, garis Max 0.5 Bar, 0.3-0.52', () => has('physical', (p) => usesAll(p, ['oil_pressure']) && p.suggestedMin === 0.3 && p.suggestedMax === 0.52 && (p.referenceLines || []).some((l) => l.y === 0.5 && l.label === 'Max'))],
  ['physical: status card', () => has('physical', (p) => p.type === 'physicalstatus')],
  ['status: panel status di posisi pertama', () => panelsOf('status')[0].type === 'trafostatus'],
  ['oilquality: line chart moisture dan H2 + status card', () => has('oilquality', (p) => p.type === 'linechart' && usesAll(p, ['moisturePpm'])) && has('oilquality', (p) => p.type === 'linechart' && usesAll(p, ['h2ppm'])) && has('oilquality', (p) => p.type === 'oilquality')],
];
for (const [name, check] of pure) {
  let ok = false;
  try { ok = check() === true; } catch (e) { console.log(`     ${name}: ${e.message}`); }
  if (!ok) { fail++; console.log(`FAIL ${name}`); } else console.log(`OK   ${name}`);
}
for (const [name, el, expects, override, forbidden = []] of cases) {
  globalThis.__FIX_OVERRIDE = override || {};
  try {
    const html = renderToString(el).replace(/<!-- -->/g, "");
    const missing = expects.filter((t) => !html.includes(t));
    const unwanted = forbidden.filter((t) => html.includes(t));
    if (missing.length || unwanted.length) { fail++; console.log(`FAIL ${name}: tidak ditemukan ${JSON.stringify(missing)}, tidak boleh ada ${JSON.stringify(unwanted)} (len ${html.length})`); }
    else console.log(`OK   ${name} (${html.length} chars)`);
  } catch (e) { fail++; console.log(`FAIL ${name}: ${e.message}`); }
}
for (const [k, pr] of Object.entries(PRESETS)) {
  const ids = new Set(pr.panels.map((p) => p.id));
  const lay = new Set(pr.layouts.lg.map((l) => l.i));
  const badMetrics = pr.panels.flatMap((p) => (p.metrics || []).filter((m) => !METRICS[m]));
  const noLayout = [...ids].filter((i) => !lay.has(i));
  const dupLayout = pr.layouts.lg.length !== lay.size;
  if (badMetrics.length || noLayout.length || dupLayout) { fail++; console.log(`FAIL preset ${k}: metric asing ${JSON.stringify(badMetrics)} tanpa layout ${JSON.stringify(noLayout)} dup=${dupLayout}`); }
  else console.log(`OK   preset ${k}: ${pr.panels.length} panel, semua metric dikenal, layout lengkap`);
}
console.log(fail === 0 ? 'SEMUA OK' : `${fail} GAGAL`);
process.exit(fail ? 1 : 0);
