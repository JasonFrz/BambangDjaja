import { METRICS } from './metrics';

// Rentang bawaan gauge / bar gauge per metric, sebelum dilebarkan oleh threshold atau nilai aktual.
// Dikunci ke grup/kunci yang jelas, bukan pencocokan substring grup (lihat review Rencana D).
export function defaultRange(key) {
  const meta = METRICS[key] || {};
  const group = meta.group || '';
  if (key === 'frequency') return { min: 45, max: 55 };
  if (key.startsWith('pf')) return { min: 0, max: 1 };
  if (group === 'Voltage Unbalance' || group === 'THD') return { min: 0, max: 10 };
  if (group === 'De-rating') return key.startsWith('kRated') ? { min: 0, max: 20 } : { min: 0, max: 100 };
  if (group === 'Phase Voltage' || group === 'Line Voltage') return { min: 0, max: 500 };
  if (group === 'Current') return { min: 0, max: 100 };
  if (group.startsWith('Power')) return { min: 0, max: 1000 };
  if (group === 'Temperature' || key === 'oil_temperature') return { min: 0, max: 150 };
  if (key === 'oil_pressure') return { min: 0, max: 10 };
  if (group === 'Oil Quality') return { min: 0, max: key === 'h2ppm' ? 200 : 50 };
  if (group === 'Energy') return { min: 0, max: 100000 };
  return { min: 0, max: 100 };
}
