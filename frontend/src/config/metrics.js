import {
  Zap, Activity, Waves, Gauge, Thermometer,
  TrendingUp, BarChart3
} from "lucide-react";

export const METRICS = {
  // Electrical — from TrendDataContext wsData/liveData
  phaseA: { label: 'Phase A Voltage', unit: 'V', color: '#ef4444', group: 'Phase Voltage', icon: Zap, source: 'electrical', thresholds: { min: 200, max: 240 } },
  phaseB: { label: 'Phase B Voltage', unit: 'V', color: '#eab308', group: 'Phase Voltage', icon: Zap, source: 'electrical', thresholds: { min: 200, max: 240 } },
  phaseC: { label: 'Phase C Voltage', unit: 'V', color: '#3b82f6', group: 'Phase Voltage', icon: Zap, source: 'electrical', thresholds: { min: 200, max: 240 } },
  lineAB: { label: 'Line AB Voltage', unit: 'V', color: '#ec4899', group: 'Line Voltage', icon: Activity, source: 'electrical' },
  lineBC: { label: 'Line BC Voltage', unit: 'V', color: '#8b5cf6', group: 'Line Voltage', icon: Activity, source: 'electrical' },
  lineCA: { label: 'Line CA Voltage', unit: 'V', color: '#06b6d4', group: 'Line Voltage', icon: Activity, source: 'electrical' },
  currentA: { label: 'Current A', unit: 'A', color: '#ef4444', group: 'Current', icon: Waves, source: 'electrical' },
  currentB: { label: 'Current B', unit: 'A', color: '#eab308', group: 'Current', icon: Waves, source: 'electrical' },
  currentC: { label: 'Current C', unit: 'A', color: '#3b82f6', group: 'Current', icon: Waves, source: 'electrical' },
  currentN: { label: 'Current N', unit: 'A', color: '#9ca3af', group: 'Current', icon: Waves, source: 'electrical' },
  powerActiveTotal: { label: 'Active Power', unit: 'kW', color: '#10b981', group: 'Power', icon: TrendingUp, source: 'electrical' },
  powerReactiveTotal: { label: 'Reactive Power', unit: 'kVAR', color: '#f59e0b', group: 'Power', icon: TrendingUp, source: 'electrical' },
  powerApparentTotal: { label: 'Apparent Power', unit: 'kVA', color: '#8b5cf6', group: 'Power', icon: TrendingUp, source: 'electrical' },
  pfTotal: { label: 'Power Factor', unit: '', color: '#14b8a6', group: 'Power Quality', icon: Gauge, source: 'electrical', thresholds: { min: 0.85 } },
  frequency: { label: 'Frequency', unit: 'Hz', color: '#6366f1', group: 'Power Quality', icon: Gauge, source: 'electrical', thresholds: { min: 49.5, max: 50.5 } },
  energyActiveTotal: { label: 'Active Energy', unit: 'kWh', color: '#22c55e', group: 'Energy', icon: BarChart3, source: 'electrical' },
  energyReactiveTotal: { label: 'Reactive Energy', unit: 'kVARh', color: '#eab308', group: 'Energy', icon: BarChart3, source: 'electrical' },
  efficiency: { label: 'Efficiency', unit: '%', color: '#e83e8c', group: 'Performance', icon: TrendingUp, source: 'electrical' },
  // Oil — from TemperatureDataContext
  oil_temperature: { label: 'Oil Temperature', unit: '°C', color: '#ef4444', group: 'Oil', icon: Thermometer, source: 'oil' },
  oil_pressure: { label: 'Oil Pressure', unit: 'Bar', color: '#3b82f6', group: 'Oil', icon: Gauge, source: 'oil' },
};

export const METRIC_GROUPS = {};
for (const [key, val] of Object.entries(METRICS)) {
  if (!METRIC_GROUPS[val.group]) METRIC_GROUPS[val.group] = [];
  METRIC_GROUPS[val.group].push({ key, ...val });
}

export const GROUP_ICON_MAP = {
  'Phase Voltage': Zap, 'Line Voltage': Activity, 'Current': Waves,
  'Power': TrendingUp, 'Power Quality': Gauge, 'Energy': BarChart3,
  'Performance': TrendingUp, 'Oil': Thermometer,
};
