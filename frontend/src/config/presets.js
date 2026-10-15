// Empat profil bawaan (tidak bisa diedit). Layout hanya lg; breakpoint lain diturunkan ensureResponsiveLayouts.
const P = (id, type, title, metrics = [], extra = {}) => ({ id, type, title, metrics, chartType: 'line', ...extra });
const L = (i, x, y, w, h, minW = 2, minH = 3) => ({ i, x, y, w, h, minW, minH, isDraggable: true, isResizable: true });

// Panel urut seperti dashboard-documentation bagian 3 sampai 6; panel tambahan proyek ini di bawahnya.
export const PRESETS = {
  electrical: {
    id: 'preset_electrical', name: 'Electrical (Default)',
    panels: [
      P('pe_vphase', 'linechart', 'Voltage Phase-Neutral', ['phaseA', 'phaseB', 'phaseC']),
      P('pe_vline', 'linechart', 'Voltage Phase-Phase', ['lineAB', 'lineBC', 'lineCA']),
      P('pe_current', 'linechart', 'Current', ['currentA', 'currentB', 'currentC', 'avgCurrent', 'currentN']),
      P('pe_thdv', 'linechart', 'THD Voltage', ['thdVA', 'thdVB', 'thdVC']),
      P('pe_thdi', 'linechart', 'THD Current', ['thdIA', 'thdIB', 'thdIC']),
      P('pe_pactive', 'linechart', 'Active Power', ['powerActiveA', 'powerActiveB', 'powerActiveC', 'powerActiveTotal']),
      P('pe_preactive', 'linechart', 'Reactive Power', ['powerReactiveA', 'powerReactiveB', 'powerReactiveC', 'powerReactiveTotal']),
      P('pe_papparent', 'linechart', 'Apparent Power', ['powerApparentA', 'powerApparentB', 'powerApparentC', 'powerApparentTotal']),
      P('pe_pf', 'linechart', 'Power Factor', ['pfA', 'pfB', 'pfC', 'pfTotal']),
      P('pe_freq', 'linechart', 'Frequency', ['frequency'], { extendToLines: true }),
      P('pe_eff', 'linechart', 'Efficiency', ['efficiency']),
      P('pe_harm_v', 'harmonic', 'Harmonic Distortion Voltage', [], { source: 'voltage' }),
      P('pe_harm_i', 'harmonic', 'Harmonic Distortion Current', [], { source: 'current' }),
      P('pe_derating', 'derating', 'De-rating per Phase'),
      P('pe_energy', 'stat', 'kWh & kVARh Total', ['energyActiveTotal', 'energyReactiveTotal']),
      P('pe_status', 'electricalstatus', 'Status & Leading/Lagging'),
      P('pe_unbal', 'bargauge', 'Voltage Unbalance UV', ['unbalanceUV']),
      P('pe_health', 'healthindex', 'Transformer Health Index', ['phaseA', 'phaseB', 'phaseC', 'currentA', 'currentB', 'currentC']),
      P('pe_events', 'eventstream', 'Event Stream'),
    ],
    layouts: { lg: [
      L('pe_vphase', 0, 0, 4, 4), L('pe_vline', 4, 0, 4, 4), L('pe_current', 8, 0, 4, 4),
      L('pe_thdv', 0, 4, 6, 4), L('pe_thdi', 6, 4, 6, 4),
      L('pe_pactive', 0, 8, 6, 4), L('pe_preactive', 6, 8, 6, 4),
      L('pe_papparent', 0, 12, 6, 4), L('pe_pf', 6, 12, 6, 4),
      L('pe_freq', 0, 16, 4, 4), L('pe_eff', 4, 16, 4, 4), L('pe_energy', 8, 16, 4, 4),
      L('pe_harm_v', 0, 20, 6, 5), L('pe_harm_i', 6, 20, 6, 5),
      L('pe_derating', 0, 25, 7, 5), L('pe_status', 7, 25, 5, 5),
      L('pe_unbal', 0, 30, 4, 6), L('pe_health', 4, 30, 4, 6), L('pe_events', 8, 30, 4, 6),
    ] },
  },
  physical: {
    id: 'preset_physical', name: 'Physical',
    panels: [
      P('pp_temp', 'linechart', 'Temperature Monitoring', ['oil_temperature', 'busTempA', 'busTempB', 'busTempC'], { suggestedMin: 30 }),
      P('pp_wti', 'linechart', 'WTI (Winding Temperature)', ['wtiA', 'wtiB', 'wtiC']),
      P('pp_press', 'linechart', 'Pressure', ['oil_pressure'], { suggestedMin: 0.3, suggestedMax: 0.52, referenceLines: [{ y: 0.5, label: 'Max' }] }),
      P('pp_phys', 'physicalstatus', 'Physical Status'),
      P('pp_oilstatus', 'oilstatus', 'Oil Level Status'),
      P('pp_sld', 'sld', 'Transformer SLD', ['phaseA', 'phaseB', 'phaseC']),
      P('pp_news', 'news', 'Operational News'),
    ],
    layouts: { lg: [
      L('pp_temp', 0, 0, 6, 4), L('pp_wti', 6, 0, 6, 4),
      L('pp_press', 0, 4, 6, 4), L('pp_oilstatus', 6, 4, 6, 4),
      L('pp_phys', 0, 8, 12, 5),
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
      L('ps_status', 0, 0, 12, 7),
      L('ps_health', 0, 7, 4, 6), L('ps_events', 4, 7, 4, 6), L('ps_phasor', 8, 7, 4, 6),
      L('ps_oilstatus', 0, 13, 6, 3), L('ps_stat', 6, 13, 6, 3),
    ] },
  },
  oilquality: {
    id: 'preset_oilquality', name: 'Oil Quality',
    panels: [
      P('po_moist', 'linechart', 'Moisture Oil', ['moisturePpm']),
      P('po_h2', 'linechart', 'Dissolved H2', ['h2ppm']),
      P('po_quality', 'oilquality', 'Oil Quality'),
      P('po_h2g', 'gauge', 'H2 Gauge', ['h2ppm']),
      P('po_moistg', 'gauge', 'Moisture Gauge', ['moisturePpm']),
      P('po_oiltemp', 'linechart', 'Oil Temperature', ['oil_temperature']),
      P('po_press', 'linechart', 'Tank Pressure', ['oil_pressure']),
    ],
    layouts: { lg: [
      L('po_moist', 0, 0, 5, 5), L('po_h2', 5, 0, 4, 5), L('po_quality', 9, 0, 3, 5),
      L('po_h2g', 0, 5, 2, 4), L('po_moistg', 2, 5, 2, 4), L('po_oiltemp', 4, 5, 4, 4), L('po_press', 8, 5, 4, 4),
    ] },
  },
};

export const PRESET_IDS = Object.values(PRESETS).map((p) => p.id);
export const isPresetId = (id) => typeof id === 'string' && id.startsWith('preset_');

// Semua profil terkonfigurasi dengan user_layouts di DB dan dapat disimpan
export const canPersist = (profile) => !!profile && profile.isEditable !== false;
// Nama baris default di tabel user_layouts (backend mencocokkan nama ini).
export const DB_DEFAULT_LAYOUT_NAME = 'Main Dashboard';
