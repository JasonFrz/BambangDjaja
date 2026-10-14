import {
  Zap, Activity, Waves, Gauge, Thermometer,
  TrendingUp, BarChart3
} from "lucide-react";

export const METRICS = {
  phaseA: { label: 'Phase A Voltage', unit: 'V', color: '#ef4444', group: 'Phase Voltage', icon: Zap, source: 'electrical' },
  phaseB: { label: 'Phase B Voltage', unit: 'V', color: '#eab308', group: 'Phase Voltage', icon: Zap, source: 'electrical' },
  phaseC: { label: 'Phase C Voltage', unit: 'V', color: '#3b82f6', group: 'Phase Voltage', icon: Zap, source: 'electrical' },
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
  pfTotal: { label: 'Power Factor', unit: '', color: '#14b8a6', group: 'Power Quality', icon: Gauge, source: 'electrical' },
  frequency: { label: 'Frequency', unit: 'Hz', color: '#6366f1', group: 'Power Quality', icon: Gauge, source: 'electrical' },
  energyActiveTotal: { label: 'Active Energy', unit: 'kWh', color: '#22c55e', group: 'Energy', icon: BarChart3, source: 'electrical' },
  energyReactiveTotal: { label: 'Reactive Energy', unit: 'kVARh', color: '#eab308', group: 'Energy', icon: BarChart3, source: 'electrical' },
  efficiency: { label: 'Efficiency', unit: '%', color: '#e83e8c', group: 'Performance', icon: TrendingUp, source: 'electrical' },
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
 
  oil_temperature: { label: 'Oil Temperature', unit: '°C', color: '#f97316', group: 'Oil', icon: Thermometer, source: 'oil' },
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
  'Power per Phase': TrendingUp, 'THD': Activity, 'Voltage Unbalance': Activity,
  'Temperature': Thermometer, 'Oil Quality': Thermometer, 'De-rating': Gauge,
};
