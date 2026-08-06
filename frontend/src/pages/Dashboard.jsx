import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Zap, Activity, Waves, Gauge, Wifi, WifiOff, Plus, X, Settings2, Trash2, RefreshCw, GripVertical, Edit3, Send, LogOut, Download, Loader2, ChevronDown, Check, Search, Layers, RotateCcw, Thermometer, TrendingUp, BarChart3, Eye, AlertTriangle, Maximize2, Minimize2, MousePointer2, BellRing, Power, FileDown, Monitor, Crosshair, LayoutGrid, PlusSquare, Database, PieChart as PieChartIcon, FileText, Table, AlignLeft, CalendarClock, List, Rss, MessageSquareWarning, CandlestickChart, ActivitySquare, LayoutPanelLeft, BoxSelect } from 'lucide-react';
import { useTrendData } from "../contexts/TrendDataContext";
import { useTemperatureData } from "../contexts/TemperatureDataContext";
import { useDialog } from "../contexts/DialogContext";
import EnergyLoader from "../components/EnergyLoader";
import { saveAs } from 'file-saver';
import { useApi } from '../contexts/ApiContext';
import { Responsive as ResponsiveGridLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { METRICS, METRIC_GROUPS } from "../config/metrics";
import {
  TimeSeriesPanel, StatPanel, GaugePanel, StatusPanel,
  BarChartPanel, BarGaugePanel, TablePanel, PieChartPanel,
  StateTimelinePanel, HeatmapPanel, StatusHistoryPanel,
  HistogramPanel, NewsPanel, AnnotationsListPanel, CandlestickPanel, OilStatusPanel
} from "../components/visualizations";


// ─── Panel Presets (mimics old dashboard) ────────────────────────────────────
const DEFAULT_PANELS = [
  { id: 'p_status', title: 'System Status', type: 'status', metrics: [], chartType: 'line' },
  { id: 'p_uphase_stat', title: 'Phase Voltage', type: 'stat', metrics: ['phaseA', 'phaseB', 'phaseC'], chartType: 'line' },
  { id: 'p_uline_stat', title: 'Line Voltage', type: 'stat', metrics: ['lineAB', 'lineBC', 'lineCA'], chartType: 'line' },
  { id: 'p_current_stat', title: 'Current', type: 'stat', metrics: ['currentA', 'currentB', 'currentC', 'currentN'], chartType: 'line' },
  { id: 'p_power_stat', title: 'Power', type: 'stat', metrics: ['powerActiveTotal', 'powerReactiveTotal', 'powerApparentTotal', 'pfTotal'], chartType: 'line' },
  { id: 'p_freq_stat', title: 'Frequency', type: 'stat', metrics: ['frequency'], chartType: 'line' },
  { id: 'p_energy_stat', title: 'Energy', type: 'stat', metrics: ['energyActiveTotal', 'energyReactiveTotal'], chartType: 'line' },
  { id: 'p_uphase_chart', title: 'Phase Voltage Trend', type: 'areachart', metrics: ['phaseA', 'phaseB', 'phaseC'], chartType: 'area' },
  { id: 'p_uline_chart', title: 'Line Voltage Trend', type: 'areachart', metrics: ['lineAB', 'lineBC', 'lineCA'], chartType: 'area' },
  { id: 'p_current_chart', title: 'Current Trend', type: 'areachart', metrics: ['currentA', 'currentB', 'currentC'], chartType: 'area' },
  { id: 'p_power_chart', title: 'Power Trend', type: 'areachart', metrics: ['powerActiveTotal', 'powerReactiveTotal', 'powerApparentTotal'], chartType: 'area' },
  { id: 'p_freq_chart', title: 'Frequency Trend', type: 'areachart', metrics: ['frequency'], chartType: 'area' },
  { id: 'p_eff_chart', title: 'Efficiency Trend', type: 'areachart', metrics: ['efficiency'], chartType: 'area' },
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
const PROFILES_KEY = 'grafana_profiles_v3';
const uid = () => 'p_' + Math.random().toString(36).substr(2, 9);


const PanelRenderer = memo(({ panel, latestData, chartData, tempData, isLive, isEditing, isSyncHoverActive }) => {
  const combinedLatestData = { ...(latestData || {}), ...(tempData || {}) };

  switch (panel.type) {
    case 'status': return <StatusPanel tempData={tempData || {}} isLive={isLive} isEditing={isEditing} />;
    case 'areachart': return <TimeSeriesPanel panel={{...panel, chartType: 'area'}} chartData={chartData} isEditing={isEditing} isSyncHoverActive={isSyncHoverActive} />;
    case 'linechart': return <TimeSeriesPanel panel={{...panel, chartType: 'line'}} chartData={chartData} isEditing={isEditing} isSyncHoverActive={isSyncHoverActive} />;
    case 'stat': return <StatPanel panel={panel} latestData={combinedLatestData} chartData={chartData} isEditing={isEditing} />;
    case 'gauge': return <GaugePanel panel={panel} latestData={combinedLatestData} isEditing={isEditing} />;
    case 'barchart': return <BarChartPanel panel={panel} chartData={chartData} isEditing={isEditing} isSyncHoverActive={isSyncHoverActive} />;
    case 'bargauge': return <BarGaugePanel panel={panel} latestData={combinedLatestData} isEditing={isEditing} />;
    case 'table': return <TablePanel panel={panel} latestData={combinedLatestData} isEditing={isEditing} />;
    case 'piechart': return <PieChartPanel panel={panel} latestData={combinedLatestData} isEditing={isEditing} />;
    case 'statetimeline': return <StateTimelinePanel panel={panel} chartData={chartData} isEditing={isEditing} isSyncHoverActive={isSyncHoverActive} />;
    case 'heatmap': return <HeatmapPanel panel={panel} chartData={chartData} isEditing={isEditing} isSyncHoverActive={isSyncHoverActive} />;
    case 'statushistory': return <StatusHistoryPanel panel={panel} chartData={chartData} isEditing={isEditing} isSyncHoverActive={isSyncHoverActive} />;
    case 'histogram': return <HistogramPanel panel={panel} chartData={chartData} isEditing={isEditing} isSyncHoverActive={isSyncHoverActive} />;

    case 'news': return <NewsPanel panel={panel} latestData={combinedLatestData} isEditing={isEditing} />;
    case 'annotations': return <AnnotationsListPanel panel={panel} chartData={chartData} isEditing={isEditing} />;
    case 'candlestick': return <CandlestickPanel panel={panel} chartData={chartData} isEditing={isEditing} isSyncHoverActive={isSyncHoverActive} />;
    case 'oilstatus': return <OilStatusPanel panel={panel} tempData={tempData || {}} isEditing={isEditing} />;
    default:
      return (
        <div className="h-full w-full flex items-center justify-center bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-300 dark:border-white/20">
          <span className="text-sm font-semibold text-gray-500">Unknown Panel Type: {panel.type}</span>
        </div>
      );
  }
});

// ─── Panel Editor Modal ──────────────────────────────────────────────────────
const PanelEditorModal = ({ isOpen, onClose, onSave, editingPanel, latestData, getChartDataForPanel, tempData, isLive }) => {
  const [title, setTitle] = useState('');
  const [panelType, setPanelType] = useState('areachart');
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [chartType, setChartType] = useState('area');
  const [colorScheme, setColorScheme] = useState('spectral');
  const [searchQuery, setSearchQuery] = useState('');
  const [visSearchQuery, setVisSearchQuery] = useState('');

  const DRAFT_KEY = 'grafana_panel_editor_draft';

  const handleResetDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setTitle(''); setPanelType('areachart'); setSelectedMetrics([]); setChartType('area'); setColorScheme('spectral');
  };

  useEffect(() => {
    if (editingPanel) {
      setTitle(editingPanel.title);
      setPanelType(editingPanel.type || 'chart');
      setSelectedMetrics([...(editingPanel.metrics || [])]);
      setChartType(editingPanel.chartType || 'area');
      setColorScheme(editingPanel.colorScheme || 'spectral');
    } else {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          setTitle(parsed.title || '');
          setPanelType(parsed.panelType || 'areachart');
          setSelectedMetrics(parsed.selectedMetrics || []);
          setChartType(parsed.chartType || 'area');
          setColorScheme(parsed.colorScheme || 'spectral');
        } catch (e) {
          setTitle(''); setPanelType('areachart'); setSelectedMetrics([]); setChartType('area'); setColorScheme('spectral');
        }
      } else {
        setTitle(''); setPanelType('areachart'); setSelectedMetrics([]); setChartType('area'); setColorScheme('spectral');
      }
    }
    setSearchQuery('');
    setVisSearchQuery('');
  }, [editingPanel, isOpen]);

  useEffect(() => {
    if (!editingPanel && isOpen) {
      const draft = { title, panelType, selectedMetrics, chartType, colorScheme };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  }, [title, panelType, selectedMetrics, chartType, colorScheme, editingPanel, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const SINGLE_METRIC_PANELS = ['gauge', 'bargauge', 'candlestick', 'histogram'];
  const NO_METRIC_PANELS = ['oilstatus'];

  const toggleMetric = (key) => {
    setSelectedMetrics(prev => {
      if (prev.includes(key)) return prev.filter(m => m !== key);
      if (SINGLE_METRIC_PANELS.includes(panelType)) return [key]; // Only allow 1 metric, replace if new selected
      return [...prev, key];
    });
  };

  // Enforce single metric if user switches type to a restricted panel after selecting multiple
  useEffect(() => {
    if (SINGLE_METRIC_PANELS.includes(panelType) && selectedMetrics.length > 1) {
      setSelectedMetrics([selectedMetrics[0]]);
    }
  }, [panelType, selectedMetrics]);

  const derivedTitle = useMemo(() => {
    if (panelType === 'oilstatus') return 'Oil Status';
    if (selectedMetrics.length === 0) return 'Custom Panel';
    if (selectedMetrics.length === 1) return METRICS[selectedMetrics[0]]?.label || selectedMetrics[0];

    const groups = new Set(selectedMetrics.map(m => METRICS[m]?.group).filter(Boolean));
    if (groups.size === 1) return `${Array.from(groups)[0]} Overview`;

    // Check if it's all some kind of voltage
    const allVoltages = selectedMetrics.every(m => METRICS[m]?.group?.includes('Voltage'));
    if (allVoltages) return 'Voltage Overview';

    return 'Mixed Metrics Overview';
  }, [selectedMetrics, panelType]);

  const handleSave = () => {
    if (selectedMetrics.length === 0 && !NO_METRIC_PANELS.includes(panelType)) return;

    if (!editingPanel) {
      localStorage.removeItem(DRAFT_KEY);
    }

    onSave({
      id: editingPanel?.id || uid(),
      title: title.trim() || derivedTitle,
      type: panelType,
      metrics: selectedMetrics,
      chartType,
      colorScheme,
    });
    onClose();
  };

  if (!isOpen) return null;

  const previewPanel = {
    id: editingPanel?.id || 'preview_panel',
    title: title.trim() || derivedTitle,
    type: panelType,
    metrics: selectedMetrics,
    chartType,
    colorScheme,
  };
  
  const previewChartData = (selectedMetrics.length > 0 && getChartDataForPanel) ? getChartDataForPanel(previewPanel) : [];

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#f4f7fe] dark:bg-[#0b1120] animate-[fadeIn_0.2s_ease-out]">
      {/* Top Header */}
      <div className="h-14 px-6 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#1a1a2e] shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white flex items-center gap-2 text-sm font-semibold transition-colors">
            <X size={18} /> Cancel
          </button>
          <div className="w-px h-6 bg-gray-200 dark:bg-white/10" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{editingPanel ? 'Edit Panel' : 'New Panel'}</h3>
        </div>
        <div className="flex items-center gap-3">
           {!editingPanel && (
             <button onClick={handleResetDraft} className="px-4 py-1.5 rounded-lg font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm transition-colors border border-transparent">Reset</button>
           )}
           <button onClick={onClose} className="px-4 py-1.5 rounded-lg font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 text-sm transition-colors border border-transparent hover:border-gray-200 dark:hover:border-white/10">Discard</button>
           <button onClick={handleSave} disabled={selectedMetrics.length === 0 && !NO_METRIC_PANELS.includes(panelType)} className="px-5 py-1.5 rounded-lg font-bold bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors flex items-center gap-1.5">
             <Check size={16} /> Apply
           </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-y-auto lg:overflow-hidden flex-col lg:flex-row">
        {/* Main Left Content (Preview Top + Metrics Bottom) */}
        <div className="contents lg:flex lg:flex-1 flex-col lg:overflow-hidden lg:border-r border-gray-200 dark:border-white/10">
          
          {/* Top: Preview Area */}
          <div className="order-2 lg:order-none flex-1 p-4 lg:p-6 flex flex-col min-h-[300px] bg-gray-50/50 dark:bg-black/20">
             <div className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Preview</div>
             <div className="flex-1 bg-white dark:bg-[#151521] border border-gray-200 dark:border-white/5 shadow-sm rounded-xl p-4 overflow-hidden relative group">
                {(selectedMetrics.length === 0 && !NO_METRIC_PANELS.includes(panelType)) ? (
                  <div className="h-full w-full flex flex-col items-center justify-center text-gray-400">
                    <BarChart3 size={48} className="mb-3 opacity-20" />
                    <span className="text-sm font-medium">Select metrics below to see preview</span>
                  </div>
                ) : (
                  <PanelRenderer panel={previewPanel} latestData={latestData || {}} chartData={previewChartData} tempData={tempData || {}} isLive={isLive} isEditing={false} isSyncHoverActive={false} />
                )}
             </div>
          </div>

          {/* Bottom: Metrics Selection Area */}
          {!NO_METRIC_PANELS.includes(panelType) && (
            <div className="order-4 lg:order-none lg:h-[45%] min-h-[250px] p-4 lg:p-6 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a2e] flex flex-col">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Database size={16} className="text-blue-500" /> Metrics Selection 
                  <span className="text-xs bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">{selectedMetrics.length} selected</span>
                </h4>
                <div className="relative w-full md:w-64">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                   <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search metrics..." className="w-full pl-8 pr-4 py-1.5 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white" />
                </div>
             </div>

             <div className="max-h-[350px] lg:max-h-none flex-1 overflow-y-auto custom-scrollbar pr-2">
                {Object.entries(METRIC_GROUPS).map(([gName, gMetrics]) => {
                  const filtered = gMetrics.filter(m => m.label.toLowerCase().includes(searchQuery.toLowerCase()) || m.key.toLowerCase().includes(searchQuery.toLowerCase()));
                  if (filtered.length === 0) return null;
                  
                  return (
                    <div key={gName} className="mb-6 last:mb-0">
                      <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        {gName}
                        <div className="flex-1 h-px bg-gray-200 dark:bg-white/5" />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {filtered.map(m => {
                          const sel = selectedMetrics.includes(m.key);
                          return (
                            <label key={m.key} className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${sel ? 'bg-blue-50 border-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30 shadow-sm' : 'bg-white border-gray-200 dark:bg-[#151521] dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/50'}`}>
                              <div className="relative flex items-center justify-center mt-0.5">
                                <input type="checkbox" checked={sel} onChange={() => toggleMetric(m.key)} className="peer appearance-none w-4 h-4 border-2 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/20 checked:bg-blue-500 checked:border-blue-500 transition-all cursor-pointer" />
                                <Check size={12} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                              </div>
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className={`text-xs font-semibold truncate ${sel ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>{m.label}</span>
                                {m.unit && <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{m.unit}</span>}
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
          )}
        </div>

        {/* Right Sidebar: Settings */}
        <div className="contents lg:flex lg:w-80 bg-white dark:bg-[#1a1a2e] flex-col lg:overflow-hidden lg:p-6 lg:gap-8 shrink-0">
           <div className="order-1 lg:order-none p-5 lg:p-0 bg-white dark:bg-[#1a1a2e] lg:bg-transparent border-b border-gray-200 dark:border-white/10 lg:border-b-0 shrink-0">
             <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Panel Options</label>
             <div className="bg-gray-50 dark:bg-[#151521] p-3 rounded-xl border border-gray-200 dark:border-white/5 flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Title</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={`Auto: ${derivedTitle}`} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                </div>
                {panelType === 'heatmap' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Color Scheme</label>
                    <select value={colorScheme} onChange={e => setColorScheme(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow cursor-pointer">
                      <option value="spectral" className="bg-white dark:bg-[#151521] text-gray-900 dark:text-white">Spectral</option>
                      <option value="inferno" className="bg-white dark:bg-[#151521] text-gray-900 dark:text-white">Inferno</option>
                      <option value="matrix" className="bg-white dark:bg-[#151521] text-gray-900 dark:text-white">Matrix</option>
                      <option value="classic" className="bg-white dark:bg-[#151521] text-gray-900 dark:text-white">Classic Red</option>
                      <option value="soft" className="bg-white dark:bg-[#151521] text-gray-900 dark:text-white">Soft Pastel</option>
                    </select>
                  </div>
                )}
             </div>
           </div>

           <div className="order-3 lg:order-none p-5 lg:p-0 bg-white dark:bg-[#1a1a2e] lg:bg-transparent lg:flex lg:flex-col lg:min-h-0 lg:flex-1">
             <div className="flex items-center justify-between mb-3 shrink-0">
               <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Visualizations</label>
               <div className="relative w-32 sm:w-40">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                  <input type="text" value={visSearchQuery} onChange={e => setVisSearchQuery(e.target.value)} placeholder="Search..." className="w-full pl-7 pr-2 py-1.5 rounded-md bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white" />
               </div>
             </div>
             <div className="max-h-[300px] lg:max-h-none lg:flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
               <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2.5 pb-2">
                  {[
    { v: 'areachart', l: 'Area Chart', d: 'Filled area over time', i: Activity },
    { v: 'linechart', l: 'Line Chart', d: 'Simple line over time', i: Activity },
    { v: 'stat', l: 'Stat + Trend', d: 'Big number & sparkline', i: TrendingUp },
    { v: 'gauge', l: 'Gauge', d: 'Dial for current value', i: Gauge },
    { v: 'barchart', l: 'Bar Chart', d: 'Categorical comparison', i: BarChart3 },
    { v: 'bargauge', l: 'Bar Gauge', d: 'Horizontal progress bar', i: LayoutPanelLeft },
    { v: 'table', l: 'Table', d: 'Raw data in rows', i: Table },
    { v: 'piechart', l: 'Pie Chart', d: 'Proportions & percentages', i: PieChartIcon },
    { v: 'statetimeline', l: 'State Timeline', d: 'State changes over time', i: CalendarClock },
    { v: 'heatmap', l: 'Heatmap', d: '2D data distribution', i: BoxSelect },
    { v: 'statushistory', l: 'Status History', d: 'Periodic health status', i: Activity },
    { v: 'histogram', l: 'Histogram', d: 'Value distributions', i: BarChart3 },
    { v: 'news', l: 'News', d: 'RSS feeds & updates', i: Rss },
    { v: 'annotations', l: 'Annotations List', d: 'Events & logs', i: MessageSquareWarning },
    { v: 'candlestick', l: 'Candlestick', d: 'OHLC financial data', i: CandlestickChart },
    { v: 'oilstatus', l: 'Oil Status', d: 'Oil Trip & Alarm Status', i: AlertTriangle }
  ].filter(t => t.l.toLowerCase().includes(visSearchQuery.toLowerCase()) || t.d.toLowerCase().includes(visSearchQuery.toLowerCase())).map(t => (
                    <div key={t.v} className={`rounded-xl border transition-all flex flex-col overflow-hidden ${panelType === t.v ? 'bg-blue-50 border-blue-500 dark:bg-blue-500/10 dark:border-blue-500 shadow-sm' : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#151521] hover:border-blue-300 dark:hover:border-blue-500/50'}`}>
                      <button onClick={() => setPanelType(t.v)} className={`flex items-start gap-3 p-3 w-full text-left ${panelType === t.v ? 'text-blue-800 dark:text-blue-200' : 'text-gray-700 dark:text-gray-300'}`}>
                        <div className={`mt-0.5 p-1.5 rounded-lg ${panelType === t.v ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-500'}`}>
                          <t.i size={16} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm leading-none mb-1.5">{t.l}</span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400">{t.d}</span>
                        </div>
                      </button>
                    </div>
                  ))}
               </div>
             </div>
           </div>
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
  const { confirm, prompt, alert } = useDialog();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSyncHoverActive, setIsSyncHoverActive] = useState(() => {
    const stored = localStorage.getItem('grafana_sync_hover');
    return stored !== null ? JSON.parse(stored) : true;
  });

  useEffect(() => {
    localStorage.setItem('grafana_sync_hover', JSON.stringify(isSyncHoverActive));
  }, [isSyncHoverActive]);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current) {
        containerRef.current.requestFullscreen().catch(err => console.error(err));
      } else {
        document.documentElement.requestFullscreen().catch(err => console.error(err));
      }
    } else {
      document.exitFullscreen();
    }
  };

  // ─── Workspace / Profiles State ──────────────────────────────────────────────
  const [profilesState, setProfilesState] = useState(() => {
    try {
      const stored = localStorage.getItem(PROFILES_KEY);
      if (stored) return JSON.parse(stored);

      // Migration from v2
      let defaultPanels = null;
      let defaultLayouts = DEFAULT_GRID_LAYOUTS;
      try {
        const sP = localStorage.getItem(PANELS_KEY);
        if (sP) defaultPanels = JSON.parse(sP);
      } catch { }
      try {
        const sL = localStorage.getItem(LAYOUTS_KEY);
        if (sL) {
          const parsed = JSON.parse(sL);
          Object.keys(parsed).forEach(bp => {
            if (parsed[bp]) parsed[bp] = parsed[bp].map(({ static: _s, ...rest }) => rest);
          });
          defaultLayouts = parsed;
        }
      } catch { }

      const initialProfiles = {
        activeProfileId: 'default',
        profiles: {
          default: {
            id: 'default',
            name: 'Main Dashboard',
            panels: defaultPanels,
            layouts: defaultLayouts
          }
        }
      };

      localStorage.setItem(PROFILES_KEY, JSON.stringify(initialProfiles));
      return initialProfiles;
    } catch {
      return {
        activeProfileId: 'default',
        profiles: {
          default: { id: 'default', name: 'Main Dashboard', panels: null, layouts: DEFAULT_GRID_LAYOUTS }
        }
      };
    }
  });

  const activeProfile = profilesState.profiles[profilesState.activeProfileId] || profilesState.profiles['default'];
  const [panels, setPanels] = useState(activeProfile.panels);
  const [gridLayouts, setGridLayouts] = useState(activeProfile.layouts);

  // Sync state when profile is switched
  useEffect(() => {
    const prof = profilesState.profiles[profilesState.activeProfileId];
    if (prof) {
      setPanels(prof.panels);
      setGridLayouts(prof.layouts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilesState.activeProfileId]);

  const [isEditing, setIsEditing] = useState(false);
  const isEditingRef = useRef(false);
  useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);

  const [searchParams, setSearchParams] = useSearchParams();
  const editorOpen = searchParams.get('add-panel') === 'true';
  const setEditorOpen = useCallback((isOpen) => {
    setSearchParams(prev => {
      if (isOpen) {
        prev.set('add-panel', 'true');
      } else {
        prev.delete('add-panel');
      }
      return prev;
    }, { replace: true });
  }, [setSearchParams]);
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

  // ─── Persist to Active Profile ───────────────────────────────────────
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setProfilesState(prev => {
      const activeId = prev.activeProfileId;
      const currentProf = prev.profiles[activeId];
      if (!currentProf) return prev;

      // Prevent redundant saves if identical
      if (currentProf.panels === panels && currentProf.layouts === gridLayouts) return prev;

      const nextState = {
        ...prev,
        profiles: {
          ...prev.profiles,
          [activeId]: {
            ...currentProf,
            panels: panels,
            layouts: gridLayouts
          }
        }
      };
      localStorage.setItem(PROFILES_KEY, JSON.stringify(nextState));
      return nextState;
    });
  }, [panels, gridLayouts]);

  // Profile Management Functions
  const handleCreateProfile = async () => {
    const name = await prompt('Enter new dashboard profile name:', { title: 'Save As New Profile', placeholder: 'e.g. My Custom View' });
    if (!name || name.trim() === '') return;

    const newId = 'p_' + Math.random().toString(36).substr(2, 9);
    setProfilesState(prev => {
      const newState = {
        ...prev,
        activeProfileId: newId,
        profiles: {
          ...prev.profiles,
          [newId]: {
            id: newId,
            name: name.trim(),
            panels: panels ? [...panels] : null,
            layouts: JSON.parse(JSON.stringify(gridLayouts))
          }
        }
      };
      localStorage.setItem(PROFILES_KEY, JSON.stringify(newState));
      return newState;
    });
  };

  const handleDeleteProfile = async () => {
    if (profilesState.activeProfileId === 'default') {
      await alert("Cannot delete the default Main Dashboard.", { title: 'Delete Failed' });
      return;
    }

    const isConfirmed = await confirm(`Are you sure you want to delete profile "${profilesState.profiles[profilesState.activeProfileId]?.name}"?`, { title: 'Delete Profile' });
    if (isConfirmed) {
      setProfilesState(prev => {
        const newProfiles = { ...prev.profiles };
        delete newProfiles[prev.activeProfileId];
        const newState = {
          ...prev,
          activeProfileId: 'default',
          profiles: newProfiles
        };
        localStorage.setItem(PROFILES_KEY, JSON.stringify(newState));
        return newState;
      });
    }
  };

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
    const hasElec = panel.metrics.some(m => METRICS[m]?.source !== 'oil');
    
    if (hasOil && hasElec) {
      // Align arrays by the end (latest data) to prevent time mismatches when lengths differ
      const maxLen = Math.max(chartData.length, oilChartData.length);
      const merged = [];
      for (let i = 1; i <= maxLen; i++) {
        const dElec = chartData[chartData.length - i] || {};
        const dOil = oilChartData[oilChartData.length - i] || {};
        merged.unshift({
          ...dElec,
          ...dOil,
          time: dElec.time || dOil.time
        });
      }
      return merged;
    }
    
    if (hasOil && !hasElec) return oilChartData;
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
  const findEmptyPosition = (layout, w, h, cols) => {
    if (!layout || layout.length === 0) return { x: 0, y: 0 };
    
    let maxY = 0;
    layout.forEach(item => {
      if (item.y + item.h > maxY) maxY = item.y + item.h;
    });

    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x <= cols - w; x++) {
        const hasCollision = layout.some(item => {
          return !(
            item.x + item.w <= x || 
            x + w <= item.x ||      
            item.y + item.h <= y || 
            y + h <= item.y         
          );
        });
        if (!hasCollision) return { x, y };
      }
    }
    return { x: 0, y: maxY };
  };

  const generateLayoutForPanel = useCallback((panelId, type, currentLayouts = {}) => {
    const isSmallPanel = type === 'stat' || type === 'gauge' || type === 'oilstatus';
    
    const layouts = {};
    
    const bps = [
      { bp: 'lg', cols: 12, w: isSmallPanel ? 3 : 6, h: isSmallPanel ? 4 : 5, minW: 2, minH: isSmallPanel ? 2 : 4 },
      { bp: 'md', cols: 10, w: isSmallPanel ? 3 : 5, h: isSmallPanel ? 4 : 5, minW: 2, minH: isSmallPanel ? 2 : 4 },
      { bp: 'sm', cols: 6, w: isSmallPanel ? 3 : 6, h: isSmallPanel ? 4 : 5, minW: 2, minH: isSmallPanel ? 2 : 4 }
    ];

    bps.forEach(({ bp, cols, w, h, minW, minH }) => {
      const { x, y } = findEmptyPosition(currentLayouts[bp] || [], w, h, cols);
      layouts[bp] = { i: panelId, x, y, w, h, minW, minH };
    });

    return layouts;
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
      const newL = generateLayoutForPanel(panelConfig.id, panelConfig.type, prev);
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
    <div ref={containerRef} className={`flex flex-col gap-4 animate-[fadeIn_0.3s_ease-out] w-full ${isFullscreen ? 'p-2 bg-[#f4f7fe] dark:bg-[#111217] min-h-screen' : ''}`}>
      {/* ─── Header ─── */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between w-full gap-4">

        {/* Left Side: Title & Badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl md:text-3xl font-bold text-[#172b4d] dark:text-white font-heading tracking-tight">Dashboard</h2>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isLive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 animate-glow-pulse' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
              {isLive ? <Wifi strokeWidth={2.5} size={12} /> : <WifiOff strokeWidth={2.5} size={12} />}
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

        {/* Center: Clock (Only in Fullscreen & Desktop) */}
        {isFullscreen && (
          <div className="hidden xl:flex flex-col items-center justify-center shrink-0 px-4">
            <span className="text-[#172b4d] dark:text-white font-bold tracking-widest text-lg leading-none">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-xs text-[#5e6c84] dark:text-[#94a3b8] font-medium mt-1">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        )}

        {/* Right Side: Toolbar */}
        <div className="flex flex-1 items-center gap-2 flex-wrap xl:justify-end">
          {/* --- Text/Dropdown Buttons (Top Group) --- */}
          {/* Profile Selector (Custom Dropdown) */}
          <div className="relative" ref={profileDropdownRef}>
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="flex items-center justify-between min-w-[150px] px-3 py-2 rounded-xl bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold cursor-pointer hover:bg-gray-50 dark:hover:bg-[#374151] transition-colors shadow-sm"
            >
              <span className="truncate pr-4">{profilesState.profiles[profilesState.activeProfileId]?.name || 'Main Dashboard'}</span>
              <ChevronDown size={14} className={`text-indigo-500 shrink-0 transition-transform ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isProfileDropdownOpen && (
              <div className="absolute top-full mt-1.5 left-0 w-56 bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-[100] overflow-hidden flex flex-col animate-[slideDownFade_0.15s_ease-out] origin-top">
                <div className="px-3 py-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-50/50 dark:bg-black/10 border-b border-gray-100 dark:border-white/5">
                  Saved Dashboards
                </div>

                {/* Scrollable list area (limit to ~3 items) */}
                <div className="max-h-[105px] overflow-y-auto custom-scrollbar">
                  {Object.values(profilesState.profiles).map(p => {
                    const isActive = p.id === profilesState.activeProfileId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setProfilesState(prev => {
                            const newState = { ...prev, activeProfileId: p.id };
                            localStorage.setItem(PROFILES_KEY, JSON.stringify(newState));
                            return newState;
                          });
                          setIsProfileDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between group transition-colors ${isActive ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' : 'text-[#172b4d] dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                      >
                        <span className="truncate">{p.name}</span>
                        {isActive && <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                {!isFullscreen && (
                  <div className="border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/10">
                    <button
                      onClick={() => { setIsProfileDropdownOpen(false); handleCreateProfile(); }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 flex items-center gap-2 transition-colors"
                    >
                      <PlusSquare size={14} /> Save As New Profile...
                    </button>
                    <button
                      disabled={profilesState.activeProfileId === 'default'}
                      onClick={() => { setIsProfileDropdownOpen(false); handleDeleteProfile(); }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40 disabled:hover:bg-transparent flex items-center gap-2 transition-colors"
                    >
                      <Trash2 size={14} /> Delete Current Profile
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Interval Selector */}
          <select
            value={updateInterval}
            onChange={(e) => setUpdateInterval(Number(e.target.value))}
            className="px-3 py-2 rounded-xl bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-white/10 text-[#172b4d] dark:text-white text-xs font-semibold cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-[#374151] transition-colors shadow-sm"
            style={{ colorScheme: 'dark light' }}
          >
            <option value={0} className="bg-white dark:bg-[#1f2937] text-[#172b4d] dark:text-white">Real time</option>
            <option value={2000} className="bg-white dark:bg-[#1f2937] text-[#172b4d] dark:text-white">2 Sec</option>
            <option value={5000} className="bg-white dark:bg-[#1f2937] text-[#172b4d] dark:text-white">5 Sec</option>
            <option value={30000} className="bg-white dark:bg-[#1f2937] text-[#172b4d] dark:text-white">30 Sec</option>
            <option value={60000} className="bg-white dark:bg-[#1f2937] text-[#172b4d] dark:text-white">1 Min</option>
          </select>

          {!isFullscreen && (
            <>
              {/* Export */}
              <button onClick={() => setShowExportModal(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 border border-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                <FileDown strokeWidth={2.5} size={14} /> Export
              </button>

              {/* Add Panel */}
              <button onClick={() => { setEditingPanel(null); setEditorOpen(true); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all">
                <PlusSquare strokeWidth={2.5} size={14} /><span className="hidden sm:inline">Add Panel</span>
              </button>

              {/* --- Icon-only Buttons (Bottom Group) --- */}
              {/* WA Buttons */}
              <button onClick={handleTestWA} title="Test WA Notification" className="p-2 rounded-xl bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-white/10 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 transition-colors shadow-sm">
                <BellRing strokeWidth={2.5} size={16} />
              </button>
              <button onClick={() => setShowLogoutModal(true)} title="Logout WA" className="p-2 rounded-xl bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-white/10 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors shadow-sm">
                <Power strokeWidth={2.5} size={16} />
              </button>
            </>
          )}

          {/* TV Mode */}
          <button onClick={toggleFullscreen} className={`p-2 rounded-xl border transition-colors shadow-sm ${isFullscreen ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-[#1f2937] border-gray-200 dark:border-white/10 text-gray-500 hover:text-[#172b4d] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#374151]'}`} title={isFullscreen ? "Exit TV Mode" : "TV Mode"}>
            {isFullscreen ? <Minimize2 strokeWidth={2.5} size={16} /> : <Monitor strokeWidth={2.5} size={16} />}
          </button>

          {!isFullscreen && (
            <>
              {/* Sync Hover Toggle */}
              <button onClick={() => setIsSyncHoverActive(!isSyncHoverActive)} className={`p-2 rounded-xl border transition-colors shadow-sm ${isSyncHoverActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-[#1f2937] border-gray-200 dark:border-white/10 text-gray-500 hover:text-[#172b4d] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#374151]'}`} title={isSyncHoverActive ? "Sync Hover: On" : "Sync Hover: Off"}>
                <Crosshair strokeWidth={2.5} size={16} />
              </button>

              {/* Reset */}
              <button onClick={handleResetDashboard} className="p-2 rounded-xl bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-white/10 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors shadow-sm" title="Reset Dashboard">
                <RotateCcw strokeWidth={2.5} size={16} />
              </button>

              {/* Edit Layout */}
              <button onClick={() => setIsEditing(!isEditing)} className={`p-2 rounded-xl border transition-colors shadow-sm ${isEditing ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-[#1f2937] border-gray-200 dark:border-white/10 text-gray-500 hover:text-[#172b4d] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#374151]'}`} title={isEditing ? 'Done Editing' : 'Edit Layout'}>
                <LayoutGrid strokeWidth={2.5} size={16} />
              </button>
            </>
          )}
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
            width={containerWidth}
            className="layout"
            layouts={lockedLayouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={50}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".drag-handle"
            margin={[8, 8]}
            isDraggable={isEditing}
            isResizable={isEditing}
            compactType="vertical"
          >
            {panels.map(panel => (
              <div key={panel.id} className="flex">
                <div className={`bg-white dark:bg-[#181b1f] rounded-none p-3 shadow-sm border transition-all h-full w-full flex flex-col relative group overflow-hidden ${isEditing ? 'border-blue-200 dark:border-blue-500/20 ring-1 ring-blue-100 dark:ring-blue-500/10' : 'border-[#e5e7eb] dark:border-[#22252b] hover:border-[#d1d5db] dark:hover:border-[#32363e]'}`}>
                  {/* Panel action buttons (visible on hover) */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
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
                  <PanelRenderer panel={panel} latestData={latestData} chartData={getChartDataForPanel(panel)} tempData={tempData} isLive={isLive} isEditing={isEditing} isSyncHoverActive={isSyncHoverActive} />
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
        latestData={latestData}
        getChartDataForPanel={getChartDataForPanel}
        tempData={tempData}
        isLive={isLive}
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
                  <select value={exportIntervalUnit} onChange={e => setExportIntervalUnit(e.target.value)} className="w-1/3 px-3 py-2.5 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-[#151521] text-[#172b4d] dark:text-white outline-none cursor-pointer" style={{ colorScheme: 'dark light' }}>
                    <option value="second" className="bg-white dark:bg-[#1a1a2e] text-[#172b4d] dark:text-white">Seconds</option>
                    <option value="minute" className="bg-white dark:bg-[#1a1a2e] text-[#172b4d] dark:text-white">Minutes</option>
                    <option value="hour" className="bg-white dark:bg-[#1a1a2e] text-[#172b4d] dark:text-white">Hours</option>
                    <option value="day" className="bg-white dark:bg-[#1a1a2e] text-[#172b4d] dark:text-white">Days</option>
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
