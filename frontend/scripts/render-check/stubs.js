const ORDERS = ['1st','3rd','5th','7th','9th','11th','13th','15th','17th','19th','21th','23th','25th','27th','29th','31th'];
const harm = (phase) => ({ phase, orders: Object.fromEntries(ORDERS.map((o, i) => [o, i === 0 ? 100 : 0.5 + i * 0.1 + phase])) });
export const FIX = {
  harmonics: { success: true, type: 'voltage', orders: ORDERS, data: [harm(1), harm(2), harm(3)] },
  status: { success: true, allSafe: false, counts: { alarm: 1, trip: 0 }, tripActive: ['OilTemp'],
    items: ['Vab','Vbc','Vca','Current1','OilTemp','OilLevel'].map((p) => ({ parameter: p, code: p === 'OilTemp' ? 4 : 3, label: p === 'OilTemp' ? 'High Alarm' : 'Normal', level: p === 'OilTemp' ? 'alarm' : 'normal', recommendations: p === 'OilTemp' ? ['Check Load R-S-T', 'Check Radiator'] : [] })) },
  physical: { success: true, tap: { type: 'OCTC', position: 4, plus: 2, minus: 2 }, oilLevel: { code: 3, label: 'Normal', level: 'normal', raw: 1 },
    pressure: { value: 0.42, code: 3, level: 'safe', reference: 0.5 }, gasFault: { failure_type: 'Gas Fault', parameterValue: '2', time_start: '2026-10-12T14:10:45.000Z' },
    suddenPressure: { flag: 0, lastLog: null }, timestamp: '2026-10-14T02:54:04.000Z' },
  'oil-quality': { success: true, available: false },
};
export function useTrafoApi(path) { return { data: FIX[path], error: null, isLoading: false, reload() {} }; }
export const useApi = () => ({ apiUrl: 'http://localhost:5000' });
