import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import axios from 'axios';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell, Label
} from 'recharts';
import {
  Zap, Activity, Waves, Gauge, Wifi, WifiOff, Plus, X, Settings2, Trash2,
  RefreshCw, GripVertical, Edit3, Send, LogOut, Download, Loader2,
  ChevronDown, Check, Search, Layers, RotateCcw, Thermometer,
  TrendingUp, BarChart3, Eye, AlertTriangle, Maximize2, Minimize2, MousePointer2
} from "lucide-react";
import { useTrendData } from "../contexts/TrendDataContext";
import { useTemperatureData } from "../contexts/TemperatureDataContext";
import { useDialog } from "../contexts/DialogContext";
import EnergyLoader from "../components/EnergyLoader";
import { saveAs } from 'file-saver';
import { useApi } from '../contexts/ApiContext';

import { Responsive as ResponsiveGridLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// ─── Metrics Catalog ─────────────────────────────────────────────────────────
// Maps WebSocket data keys to display metadata
const METRICS = {
  // Electrical — from TrendDataContext wsData/liveData
  phaseA:             { label: 'Phase A Voltage', unit: 'V', color: '#ef4444', group: 'Phase Voltage', icon: Zap, source: 'electrical', thresholds: { min: 200, max: 240 } },
  phaseB:             { label: 'Phase B Voltage', unit: 'V', color: '#eab308', group: 'Phase Voltage', icon: Zap, source: 'electrical', thresholds: { min: 200, max: 240 } },
  phaseC:             { label: 'Phase C Voltage', unit: 'V', color: '#1f2937', group: 'Phase Voltage', icon: Zap, source: 'electrical', thresholds: { min: 200, max: 240 } },
  lineAB:             { label: 'Line AB Voltage', unit: 'V', color: '#ec4899', group: 'Line Voltage', icon: Activity, source: 'electrical' },
  lineBC:             { label: 'Line BC Voltage', unit: 'V', color: '#8b5cf6', group: 'Line Voltage', icon: Activity, source: 'electrical' },
  lineCA:             { label: 'Line CA Voltage', unit: 'V', color: '#06b6d4', group: 'Line Voltage', icon: Activity, source: 'electrical' },
  currentA:           { label: 'Current A', unit: 'A', color: '#ef4444', group: 'Current', icon: Waves, source: 'electrical' },
  currentB:           { label: 'Current B', unit: 'A', color: '#eab308', group: 'Current', icon: Waves, source: 'electrical' },
  currentC:           { label: 'Current C', unit: 'A', color: '#1f2937', group: 'Current', icon: Waves, source: 'electrical' },
  currentN:           { label: 'Current N', unit: 'A', color: '#3b82f6', group: 'Current', icon: Waves, source: 'electrical' },
  powerActiveTotal:   { label: 'Active Power', unit: 'kW', color: '#10b981', group: 'Power', icon: TrendingUp, source: 'electrical' },
  powerReactiveTotal: { label: 'Reactive Power', unit: 'kVAR', color: '#f59e0b', group: 'Power', icon: TrendingUp, source: 'electrical' },
  powerApparentTotal: { label: 'Apparent Power', unit: 'kVA', color: '#8b5cf6', group: 'Power', icon: TrendingUp, source: 'electrical' },
  pfTotal:            { label: 'Power Factor', unit: '', color: '#14b8a6', group: 'Power Quality', icon: Gauge, source: 'electrical', thresholds: { min: 0.85 } },
  frequency:          { label: 'Frequency', unit: 'Hz', color: '#6366f1', group: 'Power Quality', icon: Gauge, source: 'electrical', thresholds: { min: 49.5, max: 50.5 } },
  energyActiveTotal:  { label: 'Active Energy', unit: 'kWh', color: '#22c55e', group: 'Energy', icon: BarChart3, source: 'electrical' },
  energyReactiveTotal:{ label: 'Reactive Energy', unit: 'kVARh', color: '#eab308', group: 'Energy', icon: BarChart3, source: 'electrical' },
  efficiency:         { label: 'Efficiency', unit: '%', color: '#e83e8c', group: 'Performance', icon: TrendingUp, source: 'electrical' },
  // Oil — from TemperatureDataContext
  oil_temperature:    { label: 'Oil Temperature', unit: '°C', color: '#ef4444', group: 'Oil', icon: Thermometer, source: 'oil' },
  oil_pressure:       { label: 'Oil Pressure', unit: 'Bar', color: '#3b82f6', group: 'Oil', icon: Gauge, source: 'oil' },
};

// Group metrics
const METRIC_GROUPS = {};
for (const [key, val] of Object.entries(METRICS)) {
  if (!METRIC_GROUPS[val.group]) METRIC_GROUPS[val.group] = [];
  METRIC_GROUPS[val.group].push({ key, ...val });
}

const GROUP_ICON_MAP = {
  'Phase Voltage': Zap, 'Line Voltage': Activity, 'Current': Waves,
  'Power': TrendingUp, 'Power Quality': Gauge, 'Energy': BarChart3,
  'Performance': TrendingUp, 'Oil': Thermometer,
};

// ─── Panel Presets (mimics old dashboard) ────────────────────────────────────
const DEFAULT_PANELS = [
  { id: 'p_status', title: 'System Status', type: 'status', metrics: [], chartType: 'line' },
  { id: 'p_uphase_stat', title: 'Phase Voltage', type: 'stat', metrics: ['phaseA', 'phaseB', 'phaseC'], chartType: 'line' },
  { id: 'p_uline_stat', title: 'Line Voltage', type: 'stat', metrics: ['lineAB', 'lineBC', 'lineCA'], chartType: 'line' },
  { id: 'p_current_stat', title: 'Current', type: 'stat', metrics: ['currentA', 'currentB', 'currentC', 'currentN'], chartType: 'line' },
  { id: 'p_power_stat', title: 'Power', type: 'stat', metrics: ['powerActiveTotal', 'powerReactiveTotal', 'powerApparentTotal', 'pfTotal'], chartType: 'line' },
  { id: 'p_freq_stat', title: 'Frequency', type: 'stat', metrics: ['frequency'], chartType: 'line' },
  { id: 'p_energy_stat', title: 'Energy', type: 'stat', metrics: ['energyActiveTotal', 'energyReactiveTotal'], chartType: 'line' },
  { id: 'p_uphase_chart', title: 'Phase Voltage Trend', type: 'chart', metrics: ['phaseA', 'phaseB', 'phaseC'], chartType: 'area' },
  { id: 'p_uline_chart', title: 'Line Voltage Trend', type: 'chart', metrics: ['lineAB', 'lineBC', 'lineCA'], chartType: 'area' },
  { id: 'p_current_chart', title: 'Current Trend', type: 'chart', metrics: ['currentA', 'currentB', 'currentC'], chartType: 'area' },
  { id: 'p_power_chart', title: 'Power Trend', type: 'chart', metrics: ['powerActiveTotal', 'powerReactiveTotal', 'powerApparentTotal'], chartType: 'area' },
  { id: 'p_freq_chart', title: 'Frequency Trend', type: 'chart', metrics: ['frequency'], chartType: 'area' },
  { id: 'p_eff_chart', title: 'Efficiency Trend', type: 'chart', metrics: ['efficiency'], chartType: 'area' },
];

const DEFAULT_GRID_LAYOUTS = {
  lg: [
    { i: 'p_status', x: 0, y: 0, w: 12, h: 2, minW: 4, minH: 2 },
    { i: 'p_uphase_stat', x: 0, y: 2, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'p_uline_stat', x: 3, y: 2, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'p_current_stat', x: 6, y: 2, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'p_power_stat', x: 9, y: 2, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'p_freq_stat', x: 0, y: 6, w: 6, h: 3, minW: 2, minH: 2 },
    { i: 'p_energy_stat', x: 6, y: 6, w: 6, h: 3, minW: 2, minH: 2 },
    { i: 'p_uphase_chart', x: 0, y: 9, w: 6, h: 5, minW: 3, minH: 4 },
    { i: 'p_uline_chart', x: 6, y: 9, w: 6, h: 5, minW: 3, minH: 4 },
    { i: 'p_current_chart', x: 0, y: 14, w: 6, h: 5, minW: 3, minH: 4 },
    { i: 'p_power_chart', x: 6, y: 14, w: 6, h: 5, minW: 3, minH: 4 },
    { i: 'p_freq_chart', x: 0, y: 19, w: 12, h: 5, minW: 3, minH: 4 },
    { i: 'p_eff_chart', x: 0, y: 24, w: 12, h: 5, minW: 3, minH: 4 },
  ],
  md: [
    { i: 'p_status', x: 0, y: 0, w: 10, h: 2, minW: 4, minH: 2 },
    { i: 'p_uphase_stat', x: 0, y: 2, w: 5, h: 4, minW: 2, minH: 3 },
    { i: 'p_uline_stat', x: 5, y: 2, w: 5, h: 4, minW: 2, minH: 3 },
    { i: 'p_current_stat', x: 0, y: 6, w: 5, h: 4, minW: 2, minH: 3 },
    { i: 'p_power_stat', x: 5, y: 6, w: 5, h: 4, minW: 2, minH: 3 },
    { i: 'p_freq_stat', x: 0, y: 10, w: 5, h: 3, minW: 2, minH: 2 },
    { i: 'p_energy_stat', x: 5, y: 10, w: 5, h: 3, minW: 2, minH: 2 },
    { i: 'p_uphase_chart', x: 0, y: 13, w: 10, h: 5, minW: 3, minH: 4 },
    { i: 'p_uline_chart', x: 0, y: 18, w: 10, h: 5, minW: 3, minH: 4 },
    { i: 'p_current_chart', x: 0, y: 23, w: 10, h: 5, minW: 3, minH: 4 },
    { i: 'p_power_chart', x: 0, y: 28, w: 10, h: 5, minW: 3, minH: 4 },
    { i: 'p_freq_chart', x: 0, y: 33, w: 10, h: 5, minW: 3, minH: 4 },
    { i: 'p_eff_chart', x: 0, y: 38, w: 10, h: 5, minW: 3, minH: 4 },
  ],
  sm: [
    { i: 'p_status', x: 0, y: 0, w: 6, h: 2, minW: 2, minH: 2 },
    { i: 'p_uphase_stat', x: 0, y: 2, w: 6, h: 4, minW: 2, minH: 3 },
    { i: 'p_uline_stat', x: 0, y: 6, w: 6, h: 4, minW: 2, minH: 3 },
    { i: 'p_current_stat', x: 0, y: 10, w: 6, h: 4, minW: 2, minH: 3 },
    { i: 'p_power_stat', x: 0, y: 14, w: 6, h: 4, minW: 2, minH: 3 },
    { i: 'p_freq_stat', x: 0, y: 18, w: 6, h: 3, minW: 2, minH: 2 },
    { i: 'p_energy_stat', x: 0, y: 21, w: 6, h: 3, minW: 2, minH: 2 },
    { i: 'p_uphase_chart', x: 0, y: 24, w: 6, h: 5, minW: 2, minH: 4 },
    { i: 'p_uline_chart', x: 0, y: 29, w: 6, h: 5, minW: 2, minH: 4 },
    { i: 'p_current_chart', x: 0, y: 34, w: 6, h: 5, minW: 2, minH: 4 },
    { i: 'p_power_chart', x: 0, y: 39, w: 6, h: 5, minW: 2, minH: 4 },
    { i: 'p_freq_chart', x: 0, y: 44, w: 6, h: 5, minW: 2, minH: 4 },
    { i: 'p_eff_chart', x: 0, y: 49, w: 6, h: 5, minW: 2, minH: 4 },
  ],
};

// ─── Storage Keys ────────────────────────────────────────────────────────────
const PANELS_KEY = 'grafana_panels_v2';
const LAYOUTS_KEY = 'grafana_layouts_v2';
const uid = () => 'p_' + Math.random().toString(36).substr(2, 9);

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white/95 dark:bg-[#151521]/95 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
        {typeof label === 'number' ? new Date(label).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : label}
      </p>
      {payload.map((entry, i) => {
        const meta = METRICS[entry.dataKey];
        return (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">{meta?.label || entry.name}</span>
            <span className="text-xs font-bold text-gray-900 dark:text-white ml-auto pl-3">
              {entry.value != null ? Number(entry.value).toFixed(2) : '—'} {meta?.unit || ''}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Stat Panel Renderer ─────────────────────────────────────────────────────
const SvgGauge = ({ percent, value, unit, isDanger, color }) => {
  const radius = 80;
  const strokeWidth = 24;
  const cx = 100;
  const cy = 90;
  const circumference = Math.PI * radius;
  const dashoffset = circumference - (percent * circumference);

  return (
    <svg viewBox="0 0 200 100" className="w-full h-full overflow-visible drop-shadow-sm">
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke="rgba(150,150,150,0.15)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashoffset}
        className="transition-all duration-700 ease-out"
      />
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        dominantBaseline="baseline"
        fontSize="34"
        fontWeight="bold"
        className={`font-mono tracking-tighter ${isDanger ? 'fill-red-500' : 'fill-[#172b4d] dark:fill-white'}`}
      >
        {value.toFixed(2)}
      </text>
      <text
        x={cx}
        y={cy + 8}
        textAnchor="middle"
        dominantBaseline="hanging"
        fontSize="12"
        fontWeight="600"
        className="fill-[#8993a4] dark:fill-[#64748b]"
      >
        {unit}
      </text>
    </svg>
  );
};

const StatPanel = memo(({ panel, latestData, chartData, isEditing }) => {
  const metrics = panel.metrics || [];
  const firstMetric = METRICS[metrics[0]];
  const IconComponent = firstMetric?.icon || Activity;
  const gradients = {
    'Phase Voltage': 'from-[#0052cc] to-[#4c9aff]',
    'Line Voltage': 'from-[#00b8d9] to-[#36c9e5]',
    'Current': 'from-[#ffab00] to-[#ffc400]',
    'Power': 'from-[#8777d9] to-[#6554c0]',
    'Power Quality': 'from-[#6554c0] to-[#8777d9]',
    'Energy': 'from-[#36b37e] to-[#57d9a3]',
    'Performance': 'from-[#e83e8c] to-[#f06292]',
    'Oil': 'from-[#ef4444] to-[#f97316]',
  };
  const gradient = gradients[firstMetric?.group] || 'from-blue-500 to-indigo-600';
  const bgTints = {
    'Phase Voltage': 'bg-blue-500/5', 'Line Voltage': 'bg-cyan-500/5', 'Current': 'bg-amber-500/5',
    'Power': 'bg-purple-500/5', 'Power Quality': 'bg-indigo-500/5', 'Energy': 'bg-emerald-500/5',
    'Performance': 'bg-pink-500/5', 'Oil': 'bg-red-500/5',
  };

  if (panel.type === 'gauge') {
    const meta = METRICS[metrics[0]];
    const val = latestData[metrics[0]] ?? 0;
    
    // Dynamic min/max defaults for the gauge bounds
    let min = meta?.thresholds?.min ?? 0;
    let max = meta?.thresholds?.max ?? (min + 100);
    if (metrics[0] === 'frequency') { min = 45; max = 55; }
    else if (metrics[0] === 'pfTotal') { min = 0; max = 1; }
    else if (firstMetric?.group?.includes('Voltage')) { min = 0; max = 500; }
    else if (firstMetric?.group === 'Current') { min = 0; max = 100; }
    else if (firstMetric?.group === 'Power') { min = 0; max = 1000; }
    if (val > max) max = Math.ceil(val * 1.2); // Ensure value is never strictly > max

    const percent = Math.max(0, Math.min(1, (val - min) / (max - min)));
    const tMin = meta?.thresholds?.min;
    const tMax = meta?.thresholds?.max;
    const isDanger = (tMin !== undefined && val < tMin) || (tMax !== undefined && val > tMax);
    const color = isDanger ? '#ef4444' : (meta?.color || '#3b82f6');

    return (
      <div className="h-full w-full flex flex-col relative">
        <div className={`flex items-center gap-3 mb-2 select-none z-10 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg shrink-0 ${isDanger ? 'animate-pulse' : ''}`}>
            <IconComponent size={18} />
          </div>
          <h3 className="font-semibold text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
          {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
        </div>
        <div className="flex-1 relative overflow-hidden flex flex-col justify-end w-full pb-4">
          <SvgGauge percent={percent} value={val} unit={meta?.unit} isDanger={isDanger} color={color} />
        </div>
      </div>
    );
  }

  // panel.type === 'stat'
  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-3 select-none ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg shadow-black/10 shrink-0`}>
          <IconComponent size={18} />
        </div>
        <h3 className="font-semibold text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      
      {metrics.length === 1 ? (
        <div className="flex-1 flex flex-col min-h-0 relative group" style={{ containerType: 'inline-size' }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center pb-8 z-10 pointer-events-none">
            <span className="font-bold text-[#172b4d] dark:text-white font-mono tracking-tighter drop-shadow-md leading-none" style={{ fontSize: 'clamp(24px, 20cqi, 72px)' }}>
              {(latestData[metrics[0]] ?? 0).toFixed(2)}
            </span>
            <span className="font-semibold text-[#8993a4] dark:text-[#64748b] mt-1" style={{ fontSize: 'clamp(10px, 5cqi, 16px)' }}>{METRICS[metrics[0]]?.unit}</span>
          </div>
          {chartData && chartData.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-2/5 opacity-40 group-hover:opacity-80 transition-opacity">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`spark-${panel.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={METRICS[metrics[0]]?.color || '#3b82f6'} stopOpacity={0.5} />
                      <stop offset="95%" stopColor={METRICS[metrics[0]]?.color || '#3b82f6'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey={metrics[0]} stroke={METRICS[metrics[0]]?.color || '#3b82f6'} fill={`url(#spark-${panel.id})`} strokeWidth={2} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center gap-2 overflow-y-auto custom-scrollbar">
          {metrics.map(m => {
            const meta = METRICS[m];
            if (!meta) return null;
            return (
              <div key={m} className="flex justify-between items-center px-3 py-2 rounded-xl bg-gray-50/50 dark:bg-white/[0.03] border border-gray-100/50 dark:border-white/[0.04] transition-colors hover:bg-gray-100/70 dark:hover:bg-white/[0.06]">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                  <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-xs truncate">{meta.label}</span>
                </div>
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className="text-base font-bold text-[#172b4d] dark:text-white font-mono">{(latestData[m] ?? 0).toFixed(2)}</span>
                  {meta.unit && <span className="text-[10px] font-semibold text-[#8993a4] dark:text-[#64748b]">{meta.unit}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ─── Status Panel Renderer ───────────────────────────────────────────────────
const StatusPanel = memo(({ tempData, isLive, isEditing }) => (
  <div className="h-full w-full flex flex-col">
    <div className={`flex items-center gap-3 mb-3 select-none ${isEditing ? 'cursor-move drag-handle' : ''}`}>
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/10 shrink-0">
        <AlertTriangle size={18} />
      </div>
      <h3 className="font-semibold text-[#172b4d] dark:text-white text-sm font-heading tracking-tight flex-1">System Status</h3>
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isLive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
        {isLive ? <Wifi size={12} /> : <WifiOff size={12} />}
        {isLive ? 'Live' : 'Offline'}
      </div>
      {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
    </div>
    <div className="flex-1 flex items-center justify-center">
      <div className="grid grid-cols-2 gap-3 w-full">
        {[
          { label: 'Oil Level Alarm', value: tempData.oil_level_alarm, safe: tempData.oil_level_alarm !== 0 },
          { label: 'Oil Level Trip', value: tempData.oil_level_trip, safe: tempData.oil_level_trip !== 0 },
        ].map(item => (
          <div key={item.label} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-[#5e6c84] dark:text-[#94a3b8] font-semibold uppercase tracking-wider text-center">{item.label}</span>
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${item.safe ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${item.safe ? 'bg-emerald-500' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse'}`} />
              {item.safe ? 'CLEAR' : 'TRIGGERED'}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
));

// ─── Chart Panel Renderer ────────────────────────────────────────────────────
const ChartPanel = memo(({ panel, chartData, isEditing, isSyncHoverActive }) => {
  const metrics = panel.metrics || [];
  const firstMetric = METRICS[metrics[0]];
  const IconComponent = firstMetric?.icon || Activity;
  const gradients = {
    'Phase Voltage': 'from-[#0052cc] to-[#4c9aff]', 'Line Voltage': 'from-[#00b8d9] to-[#79f2ff]',
    'Current': 'from-[#ff5630] to-[#ff9873]', 'Power': 'from-[#8777d9] to-[#6554c0]',
    'Power Quality': 'from-[#8950fc] to-[#a274fd]', 'Energy': 'from-[#36b37e] to-[#57d9a3]',
    'Performance': 'from-[#e83e8c] to-[#f06292]', 'Oil': 'from-[#ef4444] to-[#f97316]',
  };
  const gradient = gradients[firstMetric?.group] || 'from-blue-500 to-indigo-600';

  const commonXAxis = {
    dataKey: "time", tick: { fontSize: 10, fill: '#94a3b8' }, tickLine: false,
    axisLine: { stroke: '#e2e8f033' }, interval: 'preserveStartEnd', minTickGap: 50,
  };
  const commonYAxis = {
    tick: { fontSize: 10, fill: '#94a3b8' }, tickLine: false, axisLine: false, width: 50,
    domain: ['auto', 'auto'],
  };
  const gridProps = { strokeDasharray: "3 3", stroke: '#e2e8f020', vertical: false };

  // Check for threshold violations
  const latestPoint = chartData && chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const hasViolation = latestPoint && metrics.some(m => {
    const t = METRICS[m]?.thresholds;
    if (!t) return false;
    const val = latestPoint[m];
    return (t.min !== undefined && val < t.min) || (t.max !== undefined && val > t.max);
  });

  const renderChart = () => {
    if (!chartData || chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
          <div className="flex flex-col items-center gap-2">
            <BarChart3 size={28} />
            <span className="text-xs font-medium">Waiting for data...</span>
          </div>
        </div>
      );
    }

    if (panel.type === 'stat') {
      const latestPoint = chartData[chartData.length - 1];
      return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-2 gap-3">
          {metrics.map(m => (
            <div key={m} className="flex flex-col items-center justify-center bg-gray-50 dark:bg-[#1a1a2e] rounded-xl p-3 border border-gray-100 dark:border-white/5 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wider">{METRICS[m]?.label}</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: METRICS[m]?.color || '#8884d8' }}>
                  {latestPoint[m] !== undefined ? latestPoint[m].toFixed(2) : '--'}
                </span>
                <span className="text-sm font-semibold text-gray-400">{METRICS[m]?.unit}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (panel.chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} syncId={isSyncHoverActive ? "dashboardSync" : undefined}>
            <CartesianGrid {...gridProps} />
            <XAxis {...commonXAxis} />
            <YAxis {...commonYAxis} />
            <RechartsTooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {metrics.map(m => (
              <Bar key={m} dataKey={m} name={METRICS[m]?.label || m} fill={METRICS[m]?.color || '#8884d8'} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (panel.chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} syncId={isSyncHoverActive ? "dashboardSync" : undefined}>
            <CartesianGrid {...gridProps} />
            <XAxis {...commonXAxis} />
            <YAxis {...commonYAxis} />
            <RechartsTooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {metrics.map(m => (
              <Line key={m} type="monotone" dataKey={m} name={METRICS[m]?.label || m} stroke={METRICS[m]?.color || '#8884d8'} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} connectNulls isAnimationActive={false} />
            ))}
            {metrics.includes('frequency') && <ReferenceLine y={52.5} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Limit', fill: '#ef4444', fontSize: 10 }} />}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Default: area
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} syncId={isSyncHoverActive ? "dashboardSync" : undefined}>
          <defs>
            {metrics.map(m => (
              <linearGradient key={`g-${m}`} id={`areaGrad-${m}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={METRICS[m]?.color || '#8884d8'} stopOpacity={0.25} />
                <stop offset="95%" stopColor={METRICS[m]?.color || '#8884d8'} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis {...commonXAxis} />
          <YAxis {...commonYAxis} />
          <RechartsTooltip content={<ChartTooltip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          {metrics.map(m => (
            <Area key={m} type="monotone" dataKey={m} name={METRICS[m]?.label || m} stroke={METRICS[m]?.color || '#8884d8'} fill={`url(#areaGrad-${m})`} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} connectNulls isAnimationActive={false} />
          ))}
          {metrics.includes('frequency') && <ReferenceLine y={52.5} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Limit', fill: '#ef4444', fontSize: 10 }} />}
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className={`h-full w-full flex flex-col transition-colors duration-500 ${hasViolation ? 'ring-2 ring-red-500/50 bg-red-500/5 dark:bg-red-500/10 rounded-xl' : ''}`}>
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-md shrink-0 ${hasViolation ? 'animate-pulse' : ''}`}>
          <IconComponent size={16} />
        </div>
        <h3 className="text-sm font-semibold text-[#172b4d] dark:text-white font-heading truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 min-h-0">
        {renderChart()}
      </div>
    </div>
  );
});

// ─── Panel Editor Modal ──────────────────────────────────────────────────────
const PanelEditorModal = ({ isOpen, onClose, onSave, editingPanel }) => {
  const [title, setTitle] = useState('');
  const [panelType, setPanelType] = useState('chart');
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [chartType, setChartType] = useState('area');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (editingPanel) {
      setTitle(editingPanel.title);
      setPanelType(editingPanel.type || 'chart');
      setSelectedMetrics([...(editingPanel.metrics || [])]);
      setChartType(editingPanel.chartType || 'area');
    } else {
      setTitle(''); setPanelType('chart'); setSelectedMetrics([]); setChartType('area');
    }
    setSearchQuery('');
  }, [editingPanel, isOpen]);

  const toggleMetric = (key) => {
    setSelectedMetrics(prev => prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]);
  };

  const handleSave = () => {
    if (selectedMetrics.length === 0) return;
    const autoTitle = title || selectedMetrics.map(m => METRICS[m]?.label || m).join(', ');
    onSave({
      id: editingPanel?.id || uid(),
      title: autoTitle,
      type: panelType,
      metrics: selectedMetrics,
      chartType,
    });
    onClose();
  };

  if (!isOpen) return null;

  const filteredGroups = {};
  for (const [gName, gMetrics] of Object.entries(METRIC_GROUPS)) {
    const f = gMetrics.filter(m => m.label.toLowerCase().includes(searchQuery.toLowerCase()) || m.key.toLowerCase().includes(searchQuery.toLowerCase()) || gName.toLowerCase().includes(searchQuery.toLowerCase()));
    if (f.length > 0) filteredGroups[gName] = f;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-white/10 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <Settings2 size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{editingPanel ? 'Edit Panel' : 'Add New Panel'}</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Select data to display</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400"><X size={18} /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Panel Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Auto from metrics..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          {/* Panel Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Panel Type</label>
            <div className="flex gap-2 flex-wrap">
              {[{ v: 'stat', l: '📊 Stat + Trend', d: 'Big Number & Sparkline' }, { v: 'chart', l: '📈 Trend Chart', d: 'Full data charts' }, { v: 'gauge', l: '⏱️ Gauge', d: 'Speedometer (PF & Hz)' }].map(t => (
                <button key={t.v} onClick={() => setPanelType(t.v)} className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all text-left ${panelType === t.v ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'}`}>
                  <div className="font-bold">{t.l}</div>
                  <div className={`text-[10px] mt-0.5 ${panelType === t.v ? 'text-blue-100' : 'text-gray-400'}`}>{t.d}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Chart Type (only for chart panels) */}
          {panelType === 'chart' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Chart Type</label>
              <div className="flex gap-2">
                {[{ v: 'area', l: 'Area' }, { v: 'line', l: 'Line' }, { v: 'bar', l: 'Bar' }].map(ct => (
                  <button key={ct.v} onClick={() => setChartType(ct.v)} className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${chartType === ct.v ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400'}`}>
                    {ct.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Metric Search */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Select Metrics ({selectedMetrics.length} selected)</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search metric..." className="w-full pl-8 pr-4 py-2 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          {/* Metric Groups */}
          <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar">
            {Object.entries(filteredGroups).map(([gName, gMetrics]) => {
              const GIcon = GROUP_ICON_MAP[gName] || Activity;
              return (
                <div key={gName}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <GIcon size={12} className="text-gray-400" />
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{gName}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {gMetrics.map(m => {
                      const sel = selectedMetrics.includes(m.key);
                      return (
                        <button key={m.key} onClick={() => toggleMetric(m.key)} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-all ${sel ? 'bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400' : 'bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                          <div className="w-2.5 h-2.5 rounded-sm border-2 flex items-center justify-center shrink-0" style={{ borderColor: m.color, backgroundColor: sel ? m.color : 'transparent' }}>
                            {sel && <Check size={7} className="text-white" />}
                          </div>
                          <span className="font-medium truncate">{m.label}</span>
                          {m.unit && <span className="text-[9px] text-gray-400 ml-auto">{m.unit}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected chips */}
          {selectedMetrics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedMetrics.map(m => (
                <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: METRICS[m]?.color }} />
                  {METRICS[m]?.label || m}
                  <button onClick={() => toggleMetric(m)} className="ml-0.5 text-blue-400 hover:text-red-500"><X size={9} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-white/10 flex justify-end gap-3 shrink-0 bg-gray-50/50 dark:bg-black/10">
          <button onClick={onClose} className="px-4 py-2 rounded-xl font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={selectedMetrics.length === 0} className="px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 disabled:opacity-50 text-sm flex items-center gap-2">
            <Check size={16} />{editingPanel ? 'Save' : 'Add Panel'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ═══ MAIN DASHBOARD COMPONENT ═══════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════
const Dashboard = () => {
  const { liveData, wsData, isConnected, isLive, isLoading: isLoadingTrend, updateInterval, setUpdateInterval } = useTrendData();
  const { apiUrl } = useApi();
  const { data: tempData, liveData: oilLiveData } = useTemperatureData();
  const { confirm } = useDialog();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSyncHoverActive, setIsSyncHoverActive] = useState(true);

  useEffect(() => {
    const handleFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  // ─── Panels & Layouts from localStorage ──────────────────────────────
  const [panels, setPanels] = useState(() => {
    try {
      const s = localStorage.getItem(PANELS_KEY);
      return s ? JSON.parse(s) : null; // null = first time
    } catch { return null; }
  });

  const [gridLayouts, setGridLayouts] = useState(() => {
    try {
      const s = localStorage.getItem(LAYOUTS_KEY);
      if (s) {
        const parsed = JSON.parse(s);
        // Strip 'static' property that react-grid-layout injects
        Object.keys(parsed).forEach(bp => {
          if (parsed[bp]) parsed[bp] = parsed[bp].map(({ static: _s, ...rest }) => rest);
        });
        return parsed;
      }
    } catch {}
    return DEFAULT_GRID_LAYOUTS;
  });

  const [isEditing, setIsEditing] = useState(false);
  const isEditingRef = useRef(false);
  useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState(null);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [exportInterval, setExportInterval] = useState('');
  const [exportIntervalUnit, setExportIntervalUnit] = useState('second');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStep, setExportStep] = useState(0);
  const [exportCount, setExportCount] = useState(0);
  const [downloadMB, setDownloadMB] = useState("0.0");
  const [exportError, setExportError] = useState(null);

  // WA modals
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Container ref for accurate RGL width
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  
  useEffect(() => {
    if (isLoadingTrend || panels === null || !containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) setContainerWidth(width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isLoadingTrend, panels]);
  
  // ─── Persist panels ──────────────────────────────────────────────────
  useEffect(() => {
    if (panels !== null) localStorage.setItem(PANELS_KEY, JSON.stringify(panels));
  }, [panels]);

  useEffect(() => {
    localStorage.setItem(LAYOUTS_KEY, JSON.stringify(gridLayouts));
  }, [gridLayouts]);

  // ─── Latest data from WebSocket ──────────────────────────────────────
  const latestData = useMemo(() => {
    const d = {};
    if (wsData && wsData.phaseA !== undefined) {
      Object.assign(d, wsData);
    } else if (liveData && liveData.length > 0) {
      Object.assign(d, liveData[liveData.length - 1]);
    }
    // Add oil data
    if (tempData) {
      d.oil_temperature = tempData.oil_temperature || 0;
      d.oil_pressure = tempData.oil_pressure || 0;
      d.oil_level_alarm = tempData.oil_level_alarm;
      d.oil_level_trip = tempData.oil_level_trip;
    }
    return d;
  }, [wsData, liveData, tempData]);

  // ─── Chart data (live from WebSocket) ────────────────────────────────
  const chartData = useMemo(() => {
    const maxPoints = 60;
    const data = liveData && liveData.length > 0
      ? liveData.slice(-maxPoints)
      : [];
    return data;
  }, [liveData]);

  // Oil chart data
  const oilChartData = useMemo(() => {
    return oilLiveData ? oilLiveData.slice(-60) : [];
  }, [oilLiveData]);

  // ─── Get chart data for a panel ──────────────────────────────────────
  const getChartDataForPanel = useCallback((panel) => {
    const hasOil = panel.metrics.some(m => METRICS[m]?.source === 'oil');
    if (hasOil) return oilChartData;
    return chartData;
  }, [chartData, oilChartData]);

  // ─── Grid layout change handler ──────────────────────────────────────
  const handleLayoutChange = useCallback((currentLayout, allLayouts) => {
    setGridLayouts(prev => {
      const cleaned = { ...prev };
      Object.keys(allLayouts).forEach(bp => {
        cleaned[bp] = (allLayouts[bp] || []).map(({ static: _s, ...rest }) => rest);
      });
      return cleaned;
    });
  }, []);

  // ─── Generate layout for a new panel ─────────────────────────────────
  const generateLayoutForPanel = useCallback((panelId, type) => {
    const isChart = type === 'chart';
    return {
      lg: { i: panelId, x: 0, y: Infinity, w: isChart ? 6 : 3, h: isChart ? 5 : 4, minW: 2, minH: isChart ? 4 : 2 },
      md: { i: panelId, x: 0, y: Infinity, w: isChart ? 10 : 5, h: isChart ? 5 : 4, minW: 2, minH: isChart ? 4 : 2 },
      sm: { i: panelId, x: 0, y: Infinity, w: 6, h: isChart ? 5 : 4, minW: 2, minH: isChart ? 4 : 2 },
    };
  }, []);

  // ─── Panel CRUD ──────────────────────────────────────────────────────
  const handleSavePanel = (panelConfig) => {
    setPanels(prev => {
      const existing = (prev || []).find(p => p.id === panelConfig.id);
      if (existing) {
        return prev.map(p => p.id === panelConfig.id ? panelConfig : p);
      }
      return [...(prev || []), panelConfig];
    });

    // Add layout for new panel
    setGridLayouts(prev => {
      const hasLayout = Object.values(prev).some(bp => bp.some(l => l.i === panelConfig.id));
      if (hasLayout) return prev;
      const newL = generateLayoutForPanel(panelConfig.id, panelConfig.type);
      const updated = {};
      Object.keys(prev).forEach(bp => {
        updated[bp] = [...(prev[bp] || []), newL[bp] || newL.lg];
      });
      return updated;
    });
  };

  const handleDeletePanel = (panelId) => {
    setPanels(prev => (prev || []).filter(p => p.id !== panelId));
    setGridLayouts(prev => {
      const updated = {};
      Object.keys(prev).forEach(bp => {
        updated[bp] = (prev[bp] || []).filter(l => l.i !== panelId);
      });
      return updated;
    });
  };

  const handleEditPanel = (panel) => {
    setEditingPanel(panel);
    setEditorOpen(true);
  };

  // ─── Load default dashboard preset ──────────────────────────────────
  const loadDefaults = () => {
    setPanels([...DEFAULT_PANELS]);
    setGridLayouts(JSON.parse(JSON.stringify(DEFAULT_GRID_LAYOUTS)));
  };

  const handleResetDashboard = async () => {
    const isConfirmed = await confirm('Reset the entire dashboard to defaults? All custom panels will be deleted.');
    if (isConfirmed) {
      loadDefaults();
    }
  };

  // ─── Export Excel (preserved from old dashboard) ─────────────────────
  const handleDownloadExcel = async () => {
    setExportError(null);
    if (!exportStart || !exportEnd) { setExportError("Please specify a time range."); return; }
    if (new Date(exportStart) >= new Date(exportEnd)) { setExportError("Start time must be before end time."); return; }
    try {
      setIsExporting(true); setExportStep(1); setDownloadMB("0.0");
      const timer = setInterval(() => setExportStep(p => p < 3 ? p + 1 : p), 5000);
      const sp = exportStart.replace('T', ' ') + ':00';
      const ep = exportEnd.replace('T', ' ') + ':00';
      let url = `${apiUrl}/api/trends/export?start=${encodeURIComponent(sp)}&end=${encodeURIComponent(ep)}`;
      let countUrl = `${apiUrl}/api/trends/export-count?start=${encodeURIComponent(sp)}&end=${encodeURIComponent(ep)}`;
      if (exportInterval && !isNaN(exportInterval)) {
        let mul = 1;
        if (exportIntervalUnit === 'minute') mul = 60;
        else if (exportIntervalUnit === 'hour') mul = 3600;
        else if (exportIntervalUnit === 'day') mul = 86400;
        const final = parseInt(exportInterval) * mul;
        url += `&interval=${final}`; countUrl += `&interval=${final}`;
      }
      try { const cr = await axios.get(countUrl); setExportCount(cr.data.total || 0); } catch { setExportCount(0); }
      const response = await axios.get(url, {
        responseType: 'blob',
        onDownloadProgress: (p) => { if (p.loaded) setDownloadMB((p.loaded / (1024 * 1024)).toFixed(1)); }
      });
      clearInterval(timer); setExportStep(4);
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Export_${exportStart}_to_${exportEnd}.xlsx`);
      setTimeout(() => { setShowExportModal(false); setIsExporting(false); setExportStep(0); }, 1000);
    } catch (err) {
      setIsExporting(false); setExportStep(0);
      if (err.response?.status === 404) {
        try { const t = await err.response.data.text(); setExportError(JSON.parse(t).error || "Tidak ada data."); } catch { setExportError("No data found in this time range."); }
      } else { setExportError("Failed to download Excel file."); }
    }
  };

  // ─── WA notification (preserved) ─────────────────────────────────────
  const handleTestWA = async () => {
    try {
      const dbName = sessionStorage.getItem('company_name');
      const username = sessionStorage.getItem('username');
      if (!dbName || !username) return;
      await axios.post(`${apiUrl}/api/whatsapp/test`, { frequency: latestData.frequency || 0, dbName, username });
    } catch (e) { console.error("WA test failed:", e); }
  };

  const handleLogoutWA = async () => {
    setIsLoggingOut(true);
    try { await axios.post(`${apiUrl}/api/whatsapp/logout`); setShowLogoutModal(false); }
    catch (e) { console.error("WA logout failed:", e); }
    finally { setIsLoggingOut(false); }
  };

  const isFreqSafe = (latestData.frequency || 0) <= 52.5;

  // Lock all items if not editing
  const lockedLayouts = useMemo(() => {
    const locked = {};
    for (const [bp, layout] of Object.entries(gridLayouts)) {
      locked[bp] = layout.map(l => ({
        ...l,
        static: !isEditing,
        isDraggable: isEditing,
        isResizable: isEditing
      }));
    }
    return locked;
  }, [gridLayouts, isEditing]);

  // ─── Onboarding screen (first visit — panels is null) ───────────────
  if (panels === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12 md:py-20 animate-[slideUpFade_0.3s_ease-out]">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/5 dark:to-indigo-500/5 flex items-center justify-center mb-6">
          <BarChart3 size={40} className="text-blue-500/50" />
        </div>
        <h2 className="text-2xl font-bold text-[#172b4d] dark:text-white mb-2 font-heading text-center">Welcome to the Dashboard</h2>
        <p className="text-sm text-[#5e6c84] dark:text-[#94a3b8] max-w-md text-center mb-8 leading-relaxed">
          This dashboard is highly flexible — you can customize which panels to display, chart types, and layout positions.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={loadDefaults}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all text-sm"
          >
            <Layers size={18} />
            ⚡ Load Default Dashboard
          </button>
          <button
            onClick={() => { setPanels([]); setEditorOpen(true); }}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[#172b4d] dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm text-sm"
          >
            <Plus size={18} />
            🎨 Create Custom Panel
          </button>
        </div>
      </div>
    );
  }

  // ─── Render Dashboard ────────────────────────────────────────────────
  if (isLoadingTrend) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-[fadeIn_0.3s_ease-out]">
        <EnergyLoader text="Loading Dashboard Data..." />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-4 animate-[fadeIn_0.3s_ease-out] w-full">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl md:text-3xl font-bold text-[#172b4d] dark:text-white font-heading tracking-tight">Dashboard</h2>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isLive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 animate-glow-pulse' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
              {isLive ? <Wifi size={12} /> : <WifiOff size={12} />}
              {isLive ? 'Live' : 'Offline'}
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isFreqSafe ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${isFreqSafe ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
              {isFreqSafe ? 'Safe' : 'Danger'}
            </div>
          </div>
          <p className="text-[#5e6c84] dark:text-[#94a3b8] text-xs">
            Real-time Monitoring • {panels.length} active panels
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Interval Selector */}
          <select 
            value={updateInterval} 
            onChange={(e) => setUpdateInterval(Number(e.target.value))}
            className="px-3 py-2 rounded-xl bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-white/10 text-[#172b4d] dark:text-white text-xs font-semibold cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-[#374151] transition-colors shadow-sm"
          >
            <option value={0}>Live (Real-time)</option>
            <option value={5000}>Update 5 Detik</option>
            <option value={30000}>Update 30 Detik</option>
            <option value={60000}>Update 1 Menit</option>
          </select>

          {/* WA Buttons */}
          <button onClick={handleTestWA} title="Test WA Notification" className="p-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors shadow-sm">
            <Send size={16} />
          </button>
          <button onClick={() => setShowLogoutModal(true)} title="Logout WA" className="p-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shadow-sm">
            <LogOut size={16} />
          </button>
          {/* Export */}
          <button onClick={() => setShowExportModal(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors shadow-sm">
            <Download size={14} /> Export
          </button>
          
          {/* TV Mode */}
          <button onClick={toggleFullscreen} className={`p-2 rounded-xl text-white transition-colors shadow-sm ${isFullscreen ? 'bg-orange-500 hover:bg-orange-600' : 'bg-slate-800 hover:bg-slate-900'}`} title={isFullscreen ? "Exit TV Mode" : "TV Mode"}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          
          {/* Sync Hover Toggle */}
          <button onClick={() => setIsSyncHoverActive(!isSyncHoverActive)} className={`p-2 rounded-xl transition-all shadow-sm ${isSyncHoverActive ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20'}`} title={isSyncHoverActive ? "Sync Hover: On" : "Sync Hover: Off"}>
            <MousePointer2 size={16} />
          </button>

          {/* Reset */}
          <button onClick={handleResetDashboard} className="p-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shadow-sm" title="Reset Dashboard">
            <RotateCcw size={16} />
          </button>

          {/* Edit Layout */}
          <button onClick={() => setIsEditing(!isEditing)} className={`p-2 rounded-xl transition-all shadow-sm ${isEditing ? 'bg-[#0052cc] text-white' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10'}`} title={isEditing ? 'Done Editing' : 'Edit Layout'}>
            <Edit3 size={16} />
          </button>
          
          {/* Add Panel */}
          <button onClick={() => { setEditingPanel(null); setEditorOpen(true); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all">
            <Plus size={14} /><span className="hidden sm:inline">Add Panel</span>
          </button>
        </div>
      </div>

      {/* ─── Grid ─── */}
      <div className={`transition-all ${isEditing ? 'ring-2 ring-blue-500/30 rounded-xl p-1 bg-blue-500/5 dark:bg-blue-500/10' : ''}`}>
        {panels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 size={48} className="text-gray-300 dark:text-gray-700 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium mb-4">Dashboard is empty. Add your first panel!</p>
            <button onClick={() => { setEditingPanel(null); setEditorOpen(true); }} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/20">
              <Plus size={16} className="inline mr-1" /> Add Panel
            </button>
          </div>
        ) : (
          <ResponsiveGridLayout
            className="layout"
            width={containerWidth}
            layouts={lockedLayouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={50}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".drag-handle"
            margin={[12, 12]}
            isDraggable={isEditing}
            isResizable={isEditing}
            compactType="vertical"
          >
            {panels.map(panel => (
              <div key={panel.id} className="flex">
                <div className={`bg-white dark:bg-[#151521] rounded-2xl p-4 shadow-sm border transition-all h-full w-full flex flex-col relative group overflow-hidden ${isEditing ? 'border-blue-200 dark:border-blue-500/20 ring-1 ring-blue-100 dark:ring-blue-500/10' : 'border-transparent dark:border-white/5 hover:shadow-md'}`}>
                  {/* Panel action buttons (visible on hover) */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {panel.type !== 'status' && (
                      <button onClick={() => handleEditPanel(panel)} className="p-1.5 rounded-lg bg-white/80 dark:bg-black/40 backdrop-blur-sm hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-blue-500 transition-colors shadow-sm" title="Edit Panel">
                        <Settings2 size={13} />
                      </button>
                    )}
                    <button onClick={() => handleDeletePanel(panel.id)} className="p-1.5 rounded-lg bg-white/80 dark:bg-black/40 backdrop-blur-sm hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors shadow-sm" title="Delete Panel">
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Panel content */}
                  {panel.type === 'status' ? (
                    <StatusPanel tempData={tempData} isLive={isLive} isEditing={isEditing} />
                  ) : panel.type === 'chart' ? (
                    <ChartPanel panel={panel} chartData={getChartDataForPanel(panel)} isEditing={isEditing} isSyncHoverActive={isSyncHoverActive} />
                  ) : (
                    <StatPanel panel={panel} latestData={latestData} chartData={getChartDataForPanel(panel)} isEditing={isEditing} />
                  )}
                </div>
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>

      {/* ─── Panel Editor Modal ─── */}
      <PanelEditorModal
        isOpen={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingPanel(null); }}
        onSave={handleSavePanel}
        editingPanel={editingPanel}
      />

      {/* ─── Export Excel Modal (preserved) ─── */}
      {showExportModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-[#151521] rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#172b4d] dark:text-white flex items-center gap-2"><Download size={20} className="text-green-500" />Export Excel</h3>
              <button onClick={() => { setShowExportModal(false); setExportError(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">✕</button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 -mt-1 mb-1">Select a time range to download historical data as Excel (.xlsx).</p>
              {exportError && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg border border-red-200 dark:border-red-800/30 text-sm font-semibold">{exportError}</div>}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Start Time</label>
                <input type="datetime-local" value={exportStart} onChange={e => setExportStart(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none focus:border-green-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">End Time</label>
                <input type="datetime-local" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none focus:border-green-500" />
              </div>
              <div className="flex flex-col gap-1.5 mt-1">
                <label className="text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Interval (Optional)</label>
                <div className="flex gap-2">
                  <input type="number" placeholder="e.g. 5" value={exportInterval} onChange={e => setExportInterval(e.target.value)} min="1" className="w-full px-4 py-2.5 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none focus:border-green-500" />
                  <select value={exportIntervalUnit} onChange={e => setExportIntervalUnit(e.target.value)} className="w-1/3 px-3 py-2.5 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none cursor-pointer">
                    <option value="second">Seconds</option><option value="minute">Minutes</option><option value="hour">Hours</option><option value="day">Days</option>
                  </select>
                </div>
                <span className="text-[10px] text-gray-500 mt-0.5">Leave blank to export all raw data.</span>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5">
              {isExporting ? (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <div className="relative flex items-center justify-center w-4 h-4"><span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" /><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" /></div>
                      {exportStep === 1 && "Preparing Connection..."}{exportStep === 2 && `Extracting ${exportCount.toLocaleString('en-US')} rows...`}{exportStep === 3 && "Building Excel File..."}{exportStep === 4 && "Success! Saving..."}
                    </span>
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md text-[10px] font-bold">{downloadMB} MB</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-200 dark:bg-[#151521] rounded-full overflow-hidden relative"><div className="absolute top-0 left-0 h-full w-[40%] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full animate-[progress_1.5s_ease-in-out_infinite]" /></div>
                </div>
              ) : (
                <div className="flex justify-end gap-3">
                  <button onClick={() => { setShowExportModal(false); setExportError(null); }} className="px-4 py-2 rounded-lg font-semibold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10">Cancel</button>
                  <button onClick={handleDownloadExcel} className="px-5 py-2 rounded-lg font-semibold text-sm bg-green-600 text-white hover:bg-green-700 flex items-center gap-2">Download Excel</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── WA Logout Modal (preserved) ─── */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-[#151521] rounded-2xl max-w-sm w-full shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-white/10 flex items-center gap-3 bg-red-50/50 dark:bg-red-900/10">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400"><LogOut size={20} /></div>
              <h3 className="text-lg font-bold text-[#172b4d] dark:text-white">WhatsApp Logout</h3>
            </div>
            <div className="p-5 text-sm text-[#5e6c84] dark:text-[#94a3b8]">Are you sure? You will need to scan the QR code again to reactivate the WhatsApp bot.</div>
            <div className="p-4 border-t border-gray-100 dark:border-white/10 flex justify-end gap-3 bg-gray-50/50 dark:bg-white/5">
              <button onClick={() => setShowLogoutModal(false)} disabled={isLoggingOut} className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl disabled:opacity-50">Cancel</button>
              <button onClick={handleLogoutWA} disabled={isLoggingOut} className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-red-500/20">
                {isLoggingOut ? <><Loader2 size={16} className="animate-spin" /> Logout...</> : 'Yes, Logout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
