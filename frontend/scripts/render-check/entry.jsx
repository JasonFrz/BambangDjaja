import React from 'react';
import { renderToString } from 'react-dom/server';
import { HarmonicPanel } from 'SRC/components/visualizations/HarmonicPanel.jsx';
import { DeratingPanel } from 'SRC/components/visualizations/DeratingPanel.jsx';
import { TransformerStatusPanel } from 'SRC/components/visualizations/TransformerStatusPanel.jsx';
import { PhysicalStatusPanel } from 'SRC/components/visualizations/PhysicalStatusPanel.jsx';
import { OilQualityPanel } from 'SRC/components/visualizations/OilQualityPanel.jsx';
import { PRESETS } from 'SRC/config/presets.js';
import { METRICS } from 'SRC/config/metrics.js';

const latest = { h2ppm: 17, moisturePpm: 9, derating: { a: { kRated: 4, full: 33.33, available: 30.78, lost: 2.55, used: 16.39 }, b: { kRated: 4, full: 33.33, available: 31.84, lost: 1.49, used: 17.83 }, c: { kRated: 4, full: 33.33, available: 29.8, lost: 3.54, used: 14.21 } } };
const cases = [
  ['HarmonicPanel', <HarmonicPanel panel={{ id: 'x', title: 'Harmonics', source: 'voltage' }} isEditing={false} updatePanel={() => {}} />, ['Harmonics', 'recharts-responsive-container']],
  ['DeratingPanel', <DeratingPanel panel={{ id: 'x', title: 'De-rating' }} latestData={latest} isEditing={false} />, ['Fase R', 'Fase S', 'Fase T', '30.8 / 33.3 kVA']],
  ['DeratingPanel (tanpa data)', <DeratingPanel panel={{ id: 'x', title: 'De-rating' }} latestData={{}} isEditing={false} />, ['Menunggu data meter']],
  ['TransformerStatusPanel', <TransformerStatusPanel panel={{ id: 'x', title: 'Status' }} isEditing={false} />, ['1 alarm', 'OilTemp', 'High Alarm', 'TRIP']],
  ['PhysicalStatusPanel', <PhysicalStatusPanel panel={{ id: 'x', title: 'Physical' }} isEditing={false} />, ['Tap Position', 'OCTC', '0.42 Bar', 'Gas Fault', 'Normal']],
  ['OilQualityPanel', <OilQualityPanel panel={{ id: 'x', title: 'Oil' }} latestData={latest} isEditing={true} />, ['17 ppm', '9 ppm', 'belum tersedia']],
];
let fail = 0;
for (const [name, el, expects] of cases) {
  try {
    const html = renderToString(el).replace(/<!-- -->/g, "");
    const missing = expects.filter((t) => !html.includes(t));
    if (missing.length) { fail++; console.log(`FAIL ${name}: tidak ditemukan ${JSON.stringify(missing)} (len ${html.length})`); }
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
