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
