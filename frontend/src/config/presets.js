const P = (id, type, title, metrics = [], extra = {}) => ({ id, type, title, metrics, chartType: 'line', ...extra });
const L = (i, x, y, w, h, minW = 2, minH = 3) => ({ i, x, y, w, h, minW, minH, isDraggable: true, isResizable: true });

export const PRESETS = {
  electrical: {
    id: 'preset_electrical', name: 'Electrical',
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
};

export const PRESET_IDS = Object.values(PRESETS).map((p) => p.id);
export const isPresetId = (id) => typeof id === 'string' && id.startsWith('preset_');

export const canPersist = (profile) => !!profile && profile.isEditable !== false;
export const DB_DEFAULT_LAYOUT_NAME = 'Main Dashboard';
