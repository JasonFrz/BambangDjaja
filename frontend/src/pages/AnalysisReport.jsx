import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useApi } from '../contexts/ApiContext';
import axios from 'axios';
import { saveAs } from 'file-saver';
import { Responsive as ResponsiveGridLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, Calendar, Search, GripVertical, Table as TableIcon,
  AlertCircle, Zap, Activity,
  Thermometer, Gauge, Download,
  Lock, Unlock, ChevronDown, FileText, FileSpreadsheet,
  RefreshCw, Database
} from 'lucide-react';
import EnergyLoader from '../components/EnergyLoader';
import {
  exportReadingDataExcel,
  exportReadingDataPDF,
  exportReadingDataText,
  exportReadingDataDocx,
  exportRawDataLogExcel,
  exportRawDataLogPDF,
  exportRawDataLogText,
  exportRawDataLogDocx
} from '../utils/analysisExportUtils';

// Helper: Dates (Default: last 7 days ending today)
const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDaysAgoStr = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayTime = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${hour}:${min}`;
};

const formatFullTime = (isoStr) => {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hour}:${min}`;
};

// 12 Analysis Charts Configurations (Matching old web specifications)
export const ANALYSIS_CHARTS = [
  {
    id: 'temperature',
    title: 'Temperature Chart',
    unit: '°C',
    icon: Thermometer,
    metrics: [
      { key: 'oil_temperature', label: 'Oil Temp', color: '#dc2626' },
      { key: 'busTempA', label: 'Bus Temp 1', color: '#eab308' },
      { key: 'busTempB', label: 'Bus Temp 2', color: '#22c55e' },
      { key: 'busTempC', label: 'Bus Temp 3', color: '#4f46e5' },
    ]
  },
  {
    id: 'current',
    title: 'Current Chart',
    unit: 'A',
    icon: Activity,
    metrics: [
      { key: 'currentA', label: 'Ia', color: '#dc2626' },
      { key: 'currentB', label: 'Ib', color: '#4f46e5' },
      { key: 'currentC', label: 'Ic', color: '#eab308' },
      { key: 'avgCurrent', label: 'IAvg', color: '#22c55e' },
    ]
  },
  {
    id: 'pressure',
    title: 'Pressure Chart',
    unit: 'Bar',
    icon: Gauge,
    metrics: [
      { key: 'oil_pressure', label: 'Pressure', color: '#f97316' },
    ]
  },
  {
    id: 'wti',
    title: 'Winding Temperature Indicator Chart',
    unit: '°C',
    icon: Thermometer,
    metrics: [
      { key: 'wtiA', label: 'WTI Phase A', color: '#dc2626' },
      { key: 'wtiB', label: 'WTI Phase B', color: '#4f46e5' },
      { key: 'wtiC', label: 'WTI Phase C', color: '#eab308' },
    ]
  },
  {
    id: 'voltage_pn',
    title: 'Voltage Chart (Phase to Neutral)',
    unit: 'V',
    icon: Zap,
    metrics: [
      { key: 'phaseA', label: 'Van', color: '#dc2626' },
      { key: 'phaseB', label: 'Vbn', color: '#4f46e5' },
      { key: 'phaseC', label: 'Vcn', color: '#eab308' },
    ]
  },
  {
    id: 'voltage_pp',
    title: 'Voltage Chart (Phase to Phase)',
    unit: 'V',
    icon: Zap,
    metrics: [
      { key: 'lineAB', label: 'Vab', color: '#dc2626' },
      { key: 'lineBC', label: 'Vbc', color: '#4f46e5' },
      { key: 'lineCA', label: 'Vca', color: '#eab308' },
    ]
  },
  {
    id: 'efficiency',
    title: 'Efficiency Chart',
    unit: '%',
    icon: TrendingUp,
    metrics: [
      { key: 'efficiency', label: 'Efficiency', color: '#dc2626' },
    ]
  },
  {
    id: 'power_factor',
    title: 'Power Factor Chart',
    unit: '-',
    icon: Zap,
    metrics: [
      { key: 'pfTotal', label: 'PF Total', color: '#dc2626' },
    ]
  },
  {
    id: 'active_power',
    title: 'Active Power Chart',
    unit: 'kW',
    icon: Zap,
    metrics: [
      { key: 'powerActiveA', label: 'Pa', color: '#dc2626' },
      { key: 'powerActiveB', label: 'Pb', color: '#4f46e5' },
      { key: 'powerActiveC', label: 'Pc', color: '#eab308' },
      { key: 'powerActiveTotal', label: 'P Total', color: '#10b981' },
    ]
  },
  {
    id: 'reactive_power',
    title: 'Reactive Power Chart',
    unit: 'kVAR',
    icon: Zap,
    metrics: [
      { key: 'powerReactiveA', label: 'Qa', color: '#dc2626' },
      { key: 'powerReactiveB', label: 'Qb', color: '#4f46e5' },
      { key: 'powerReactiveC', label: 'Qc', color: '#eab308' },
      { key: 'powerReactiveTotal', label: 'Q Total', color: '#10b981' },
    ]
  },
  {
    id: 'apparent_power',
    title: 'Apparent Power Chart',
    unit: 'kVA',
    icon: Zap,
    metrics: [
      { key: 'powerApparentA', label: 'Sa', color: '#dc2626' },
      { key: 'powerApparentB', label: 'Sb', color: '#4f46e5' },
      { key: 'powerApparentC', label: 'Sc', color: '#eab308' },
      { key: 'powerApparentTotal', label: 'S Total', color: '#10b981' },
    ]
  },
  {
    id: 'frequency',
    title: 'Frequency Chart',
    unit: 'Hz',
    icon: Activity,
    metrics: [
      { key: 'frequency', label: 'Frequency', color: '#06b6d4' },
    ]
  },
];

const DEFAULT_LAYOUTS = {
  lg: ANALYSIS_CHARTS.map((c, i) => ({
    i: c.id,
    x: (i % 2) * 6,
    y: Math.floor(i / 2) * 5,
    w: 6,
    h: 5,
    minW: 3,
    minH: 3
  })),
  md: ANALYSIS_CHARTS.map((c, i) => ({
    i: c.id,
    x: (i % 2) * 5,
    y: Math.floor(i / 2) * 5,
    w: 5,
    h: 5,
    minW: 3,
    minH: 3
  })),
  sm: ANALYSIS_CHARTS.map((c, i) => ({
    i: c.id,
    x: 0,
    y: i * 5,
    w: 6,
    h: 5,
    minW: 3,
    minH: 3
  })),
  xs: ANALYSIS_CHARTS.map((c, i) => ({
    i: c.id,
    x: 0,
    y: i * 5,
    w: 2,
    h: 5,
    minW: 1,
    minH: 3
  })),
  xxs: ANALYSIS_CHARTS.map((c, i) => ({
    i: c.id,
    x: 0,
    y: i * 5,
    w: 1,
    h: 5,
    minW: 1,
    minH: 3
  }))
};

// Custom Tooltip for Recharts
const CustomAnalysisTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload;
  const fullTimestamp = point?.timestamp ? formatFullTime(point.timestamp) : label;

  return (
    <div className="bg-white/95 dark:bg-[#181926]/95 backdrop-blur-md border border-[#dfe1e6] dark:border-white/10 rounded-xl px-3.5 py-2.5 shadow-xl text-xs z-50 min-w-[170px] pointer-events-none">
      <p className="font-bold text-[#172b4d] dark:text-white border-b border-gray-100 dark:border-white/10 pb-1.5 mb-2 font-mono text-[11px]">
        {fullTimestamp}
      </p>
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-[11px]">{entry.name}</span>
            </div>
            <span className="font-bold font-mono text-[#172b4d] dark:text-white">
              {entry.value !== null && entry.value !== undefined ? Number(entry.value).toFixed(2) : '-'}
              {unit && unit !== '-' && <span className="ml-1 text-[10px] font-normal text-gray-400">{unit}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AnalysisReport = () => {
  const { apiUrl } = useApi();
  const [startDate, setStartDate] = useState(getDaysAgoStr(6));
  const [endDate, setEndDate] = useState(getTodayStr());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warningMsg, setWarningMsg] = useState(null);
  const [seriesData, setSeriesData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Layout and view toggles (persisted in db master user_layouts)
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [cardViews, setCardViews] = useState({}); // { [chartId]: 'chart' | 'table' }
  const [gridLayouts, setGridLayouts] = useState(DEFAULT_LAYOUTS);

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  // ResizeObserver for container width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) setContainerWidth(width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
  const dbName = sessionStorage.getItem('db_name') || 'base_tmu_company_table_v2';
  const companyName = sessionStorage.getItem('company_name') || dbName;
  const sessionTrafoName = sessionStorage.getItem('selectedTrafoName');
  const trafoDisplayName = sessionTrafoName || `TRF-${String(trafoId).padStart(3, '0')}`;

  // Export dropdown states for Reading Data and Raw Data Log
  const [isReadingExportOpen, setIsReadingExportOpen] = useState(false);
  const [isRawExportOpen, setIsRawExportOpen] = useState(false);
  const [isExportingReading, setIsExportingReading] = useState(false);
  const [isExportingRaw, setIsExportingRaw] = useState(false);
  const readingExportDropdownRef = useRef(null);
  const rawExportDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (readingExportDropdownRef.current && !readingExportDropdownRef.current.contains(e.target)) {
        setIsReadingExportOpen(false);
      }
      if (rawExportDropdownRef.current && !rawExportDropdownRef.current.contains(e.target)) {
        setIsRawExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Validate and clamp max 7 days
  const handleDateChange = (newStart, newEnd) => {
    if (!newStart || !newEnd) {
      setStartDate(newStart);
      setEndDate(newEnd);
      return;
    }

    const d1 = new Date(newStart);
    const d2 = new Date(newEnd);
    if (d1 > d2) {
      setError('Start Date tidak boleh lebih besar dari End Date.');
      return;
    }

    const diffDays = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 730) {
      setWarningMsg('Rentang analisis dibatasi maksimal 2 tahun (730 hari).');
      // Automatically clamp to 730 days (2 years)
      const clampedEnd = new Date(d1);
      clampedEnd.setDate(clampedEnd.getDate() + 729);
      const clampedEndStr = `${clampedEnd.getFullYear()}-${String(clampedEnd.getMonth() + 1).padStart(2, '0')}-${String(clampedEnd.getDate()).padStart(2, '0')}`;
      setStartDate(newStart);
      setEndDate(clampedEndStr);
      return;
    }

    setWarningMsg(null);
    setError(null);
    setStartDate(newStart);
    setEndDate(newEnd);
  };

  // Optimized chart data sampling: if > 400 points, downsample evenly for SVG smoothness (full data remains for table and export)
  const chartDisplayData = useMemo(() => {
    if (seriesData.length <= 400) return seriesData;
    const step = Math.ceil(seriesData.length / 400);
    const sampled = [];
    for (let i = 0; i < seriesData.length; i += step) {
      sampled.push(seriesData[i]);
    }
    if (sampled[sampled.length - 1] !== seriesData[seriesData.length - 1]) {
      sampled.push(seriesData[seriesData.length - 1]);
    }
    return sampled;
  }, [seriesData]);

  // Fetch hourly aggregated data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!startDate || !endDate) return;

      const token = sessionStorage.getItem('token');
      const headers = {
        'x-db-name': dbName,
        'x-trafo-id': trafoId
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const start = `${startDate} 00:00:00`;
      const end = `${endDate} 23:59:59`;
      // Interval = 3600 seconds (1 hour per point)
      const url = `${apiUrl}/api/trends?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&interval=3600&trafo_id=${trafoId}`;

      const res = await axios.get(url, { headers });

      const raw = Array.isArray(res.data) ? res.data : [];
      // Augment each point with formatted display time
      const formatted = raw.map(p => ({
        ...p,
        displayTime: formatDisplayTime(p.timestamp)
      }));
      setSeriesData(formatted);
    } catch (err) {
      console.error('Fetch analysis trends error:', err);
      const msg = err.response?.data?.error || err.message || 'Gagal memuat data analisis';
      setError(msg);
      setSeriesData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [trafoId, startDate, endDate]);

  // Fetch saved layout from masterDb user_layouts (If not found, DEFAULT_LAYOUTS is used without writing to DB)
  const fetchSavedLayout = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('token');
      const username = sessionStorage.getItem('username');
      const headers = {
        'X-DB-Name': dbName,
        'X-Trafo-Id': trafoId || '',
        'X-Username': username || ''
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let data = null;
      try {
        const res = await axios.get(`${apiUrl}/api/layouts/analysis`, { headers });
        if (res.data?.found && res.data.layout_data) {
          data = res.data.layout_data;
        }
      } catch (err) {
        // Fallback to /api/layouts in case backend hasn't restarted yet
        try {
          const fallbackRes = await axios.get(`${apiUrl}/api/layouts`, { headers });
          const found = (fallbackRes.data || []).find(l => l.layout_name === 'Analysis Report');
          if (found && found.layout_data) {
            data = found.layout_data;
          }
        } catch {}
      }

      if (data) {
        if (data.layouts) {
          setGridLayouts(data.layouts);
          if (data.cardViews) setCardViews(data.cardViews);
        } else if (data.lg) {
          setGridLayouts(data);
        }
      } else {
        // Default: tidak ada di database, gunakan default layouts
        setGridLayouts(DEFAULT_LAYOUTS);
      }
    } catch (err) {
      console.error('Failed to load analysis layout from DB, using default:', err);
      setGridLayouts(DEFAULT_LAYOUTS);
    }
  }, [apiUrl, dbName, trafoId]);

  useEffect(() => {
    fetchSavedLayout();
  }, [fetchSavedLayout]);

  // Layout change in memory while editing
  const handleLayoutChange = useCallback((currentLayout, allLayouts) => {
    if (!allLayouts || Object.keys(allLayouts).length === 0) return;
    setGridLayouts(allLayouts);
  }, []);

  // Save layout to user_layouts in masterDb
  const handleToggleEdit = async () => {
    if (isEditing) {
      // User is saving layout changes to db master!
      setIsSavingLayout(true);
      try {
        const token = sessionStorage.getItem('token');
        const username = sessionStorage.getItem('username');
        const headers = {
          'Content-Type': 'application/json',
          'X-DB-Name': dbName,
          'X-Trafo-Id': trafoId || '',
          'X-Username': username || ''
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let saved = false;
        try {
          const res = await axios.post(
            `${apiUrl}/api/layouts/analysis`,
            {
              layout_data: {
                layouts: gridLayouts,
                cardViews
              }
            },
            { headers }
          );
          if (res.data?.success) saved = true;
        } catch (err) {
          // Fallback to standard POST /api/layouts
          try {
            const fallbackRes = await axios.post(
              `${apiUrl}/api/layouts`,
              {
                layout_name: 'Analysis Report',
                layout_data: {
                  layouts: gridLayouts,
                  cardViews
                },
                is_active: 1
              },
              { headers }
            );
            if (fallbackRes.data?.success) saved = true;
          } catch {}
        }

        if (saved) {
          console.log('Layout successfully saved to DB master');
        }
      } catch (err) {
        console.error('Failed to save layout to DB master:', err);
      } finally {
        setIsSavingLayout(false);
        setIsEditing(false);
      }
    } else {
      setIsEditing(true);
    }
  };

  // Card view toggler (chart vs table)
  const toggleCardView = (chartId, view) => {
    setCardViews(prev => ({
      ...prev,
      [chartId]: view
    }));
  };

  // Global toggle all to chart / all to table
  const setAllViews = (view) => {
    const updated = {};
    ANALYSIS_CHARTS.forEach(c => {
      updated[c.id] = view;
    });
    setCardViews(updated);
  };

  // Filtered charts according to search query
  const filteredCharts = useMemo(() => {
    if (!searchQuery.trim()) return ANALYSIS_CHARTS;
    const q = searchQuery.toLowerCase().trim();
    return ANALYSIS_CHARTS.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.unit.toLowerCase().includes(q) ||
      c.metrics.some(m => m.label.toLowerCase().includes(q) || m.key.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // Lock layout drag when not in edit mode
  const lockedLayouts = useMemo(() => {
    const locked = {};
    for (const [bp, layout] of Object.entries(gridLayouts)) {
      locked[bp] = (layout || []).map(l => ({
        ...l,
        static: !isEditing,
        isDraggable: isEditing,
        isResizable: isEditing
      }));
    }
    return locked;
  }, [gridLayouts, isEditing]);


  // =========================================================
  // EXPORT METHODS: READING DATA & RAW DATA LOG (EXCEL, PDF, TEXT, DOCX)
  // =========================================================

  // Fetch harmonics data (Phase R, S, T) on demand for Raw Data Log export
  const fetchHarmonicsData = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const headers = {
        'x-db-name': dbName,
        'x-trafo-id': trafoId
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [vRes, iRes] = await Promise.all([
        axios.get(`${apiUrl}/api/trafo/${trafoId}/harmonics?type=voltage`, { headers }),
        axios.get(`${apiUrl}/api/trafo/${trafoId}/harmonics?type=current`, { headers })
      ]);
      return {
        voltage: vRes.data?.data || [],
        current: iRes.data?.data || []
      };
    } catch (err) {
      console.warn('Could not fetch harmonics data, defaulting to empty:', err);
      return { voltage: [], current: [] };
    }
  };

  // 1. Reading Data Export Handler (54 Parameters in exact sequence)
  const handleExportReading = async (format) => {
    if (seriesData.length === 0) return;
    setIsExportingReading(true);
    try {
      const params = {
        seriesData,
        trafoDisplayName,
        companyName,
        startDate,
        endDate
      };
      if (format === 'excel') await exportReadingDataExcel(params);
      else if (format === 'pdf') exportReadingDataPDF(params);
      else if (format === 'text') exportReadingDataText(params);
      else if (format === 'docx') exportReadingDataDocx(params);
    } catch (err) {
      console.error('Reading data export error:', err);
    } finally {
      setIsExportingReading(false);
      setIsReadingExportOpen(false);
    }
  };

  // 2. Raw Data Log Export Handler (Sheet 1: Raw_data 55 cols, Sheets 2-4: Harmonics 33 cols each)
  const handleExportRaw = async (format) => {
    if (seriesData.length === 0) return;
    setIsExportingRaw(true);
    try {
      const harmonics = await fetchHarmonicsData();
      const params = {
        seriesData,
        harmonicsData: harmonics,
        trafoDisplayName,
        companyName,
        startDate,
        endDate
      };
      if (format === 'excel') await exportRawDataLogExcel(params);
      else if (format === 'pdf') exportRawDataLogPDF(params);
      else if (format === 'text') exportRawDataLogText(params);
      else if (format === 'docx') exportRawDataLogDocx(params);
    } catch (err) {
      console.error('Raw data log export error:', err);
    } finally {
      setIsExportingRaw(false);
      setIsRawExportOpen(false);
    }
  };

  // Card-level CSV Export
  const handleExportCardCSV = (chart) => {
    if (seriesData.length === 0) return;
    const headers = ['Timestamp', ...chart.metrics.map(m => `${m.label} (${chart.unit})`)];
    const rows = seriesData.map(p => [
      p.timestamp ? formatFullTime(p.timestamp) : p.displayTime || '-',
      ...chart.metrics.map(m => (p[m.key] !== null && p[m.key] !== undefined ? p[m.key] : ''))
    ]);

    let csvContent = '\uFEFF';
    csvContent += headers.join(',') + '\n';
    rows.forEach(r => {
      csvContent += r.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${chart.id}_analysis_${startDate}_${endDate}.csv`);
  };

  return (
    <div className="flex flex-col w-full max-w-[1600px] mx-auto gap-3 sm:gap-4 pb-12 animate-[fadeIn_0.3s_ease-out]" ref={containerRef}>
      
      {/* ========================================================= */}
      {/* 1. HERO HEADER BANNER (Consistent with Reports)           */}
      {/* ========================================================= */}
      <div className="relative rounded-xl sm:rounded-2xl md:rounded-3xl bg-gradient-to-br from-white via-white to-indigo-50/40 dark:from-[#151521] dark:via-[#151521] dark:to-[#1a1b2e] border border-[#dfe1e6]/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.2)] p-3 sm:p-4 md:p-5 shrink-0 z-20">
        
        {/* Glow ambient background accents */}
        <div className="absolute inset-0 overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl pointer-events-none">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 sm:w-64 h-48 sm:h-64 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 -mb-20 w-60 sm:w-80 h-32 sm:h-40 bg-blue-500/10 dark:blue-500/15 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          
          {/* Judul: Analysis - <Nama Trafo> */}
          <div className="flex flex-col min-w-0">
            <h1 className="text-base sm:text-lg md:text-2xl font-black text-[#172b4d] dark:text-white font-heading tracking-tight truncate">
              Analysis - {trafoDisplayName}
            </h1>
            <p className="text-[11px] sm:text-xs md:text-sm text-[#5e6c84] dark:text-[#94a3b8] mt-0.5">
              Multi-Metric Historical Analysis
            </p>
          </div>

          {/* Controls: Edit Layout & View All Toggles */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
            
            {/* Toggle All to Charts or Tables */}
            <div className="flex items-center p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200/80 dark:border-white/10">
              <button
                onClick={() => setAllViews('chart')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-[#172b4d] dark:text-white hover:bg-white/80 dark:hover:bg-white/10 transition-colors"
                title="Tampilkan semua dalam bentuk Area Chart"
              >
                <TrendingUp size={13} className="text-indigo-500" />
                <span className="hidden sm:inline">All Charts</span>
              </button>
              <button
                onClick={() => setAllViews('table')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-[#172b4d] dark:text-white hover:bg-white/80 dark:hover:bg-white/10 transition-colors"
                title="Tampilkan semua dalam bentuk Tabel"
              >
                <TableIcon size={13} className="text-indigo-500" />
                <span className="hidden sm:inline">All Tables</span>
              </button>
            </div>

            {/* Edit / Lock Layout Button with DB master persistence */}
            <button
              onClick={handleToggleEdit}
              disabled={isSavingLayout}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 ${
                isEditing
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-amber-500/25 ring-2 ring-amber-400/50'
                  : 'bg-white dark:bg-[#1e1e2d] border border-[#dfe1e6] dark:border-white/10 text-[#172b4d] dark:text-white hover:bg-gray-50 dark:hover:bg-white/10'
              }`}
            >
              {isSavingLayout ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-amber-500 dark:text-amber-400" />
                  <span>Saving...</span>
                </>
              ) : isEditing ? (
                <>
                  <Unlock size={14} />
                  <span>Save Layout</span>
                </>
              ) : (
                <>
                  <Lock size={14} />
                  <span>Edit Layout</span>
                </>
              )}
            </button>

            {/* Action Button 1: Export Reading Data Dropdown */}
            <div className="relative shrink-0 z-30" ref={readingExportDropdownRef}>
              <button
                onClick={() => {
                  setIsReadingExportOpen(!isReadingExportOpen);
                  setIsRawExportOpen(false);
                }}
                disabled={seriesData.length === 0 || isExportingReading}
                className="min-w-[125px] sm:min-w-[135px] flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-white dark:bg-[#1e1e2d] text-[#172b4d] dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 select-none whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export Reading Data"
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  {isExportingReading ? (
                    <RefreshCw size={14} className="animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                  ) : (
                    <Download size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                  )}
                  <span>Reading Data</span>
                </div>
                <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 shrink-0 ${isReadingExportOpen ? 'rotate-180' : ''}`} />
              </button>

              {isReadingExportOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-36 bg-white dark:bg-[#1e1e2d] border border-[#dfe1e6] dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 py-1 animate-fadeIn">
                  <button
                    onClick={() => handleExportReading('pdf')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-indigo-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <FileText size={14} className="text-rose-500 shrink-0" />
                    <span>PDF</span>
                  </button>
                  <button
                    onClick={() => handleExportReading('excel')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-indigo-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <FileSpreadsheet size={14} className="text-emerald-500 shrink-0" />
                    <span>Excel</span>
                  </button>
                  <button
                    onClick={() => handleExportReading('text')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-indigo-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <FileText size={14} className="text-amber-500 shrink-0" />
                    <span>Text</span>
                  </button>
                  <button
                    onClick={() => handleExportReading('docx')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-indigo-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <FileText size={14} className="text-indigo-500 shrink-0" />
                    <span>Docx</span>
                  </button>
                </div>
              )}
            </div>

            {/* Action Button 2: Export Raw Data Log Dropdown */}
            <div className="relative shrink-0 z-30" ref={rawExportDropdownRef}>
              <button
                onClick={() => {
                  setIsRawExportOpen(!isRawExportOpen);
                  setIsReadingExportOpen(false);
                }}
                disabled={seriesData.length === 0 || isExportingRaw}
                className="min-w-[125px] sm:min-w-[135px] flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-white dark:bg-[#1e1e2d] text-[#172b4d] dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 select-none whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export Raw Data Log"
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  {isExportingRaw ? (
                    <RefreshCw size={14} className="animate-spin text-purple-600 dark:text-purple-400 shrink-0" />
                  ) : (
                    <Download size={14} className="text-purple-600 dark:text-purple-400 shrink-0" />
                  )}
                  <span>Raw Data Log</span>
                </div>
                <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 shrink-0 ${isRawExportOpen ? 'rotate-180' : ''}`} />
              </button>

              {isRawExportOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-36 bg-white dark:bg-[#1e1e2d] border border-[#dfe1e6] dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 py-1 animate-fadeIn">
                  <button
                    onClick={() => handleExportRaw('pdf')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-purple-50 dark:hover:bg-white/5 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >
                    <FileText size={14} className="text-rose-500 shrink-0" />
                    <span>PDF</span>
                  </button>
                  <button
                    onClick={() => handleExportRaw('excel')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-purple-50 dark:hover:bg-white/5 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >
                    <FileSpreadsheet size={14} className="text-emerald-500 shrink-0" />
                    <span>Excel</span>
                  </button>
                  <button
                    onClick={() => handleExportRaw('text')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-purple-50 dark:hover:bg-white/5 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >
                    <FileText size={14} className="text-amber-500 shrink-0" />
                    <span>Text</span>
                  </button>
                  <button
                    onClick={() => handleExportRaw('docx')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-purple-50 dark:hover:bg-white/5 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >
                    <FileText size={14} className="text-indigo-500 shrink-0" />
                    <span>Docx</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>


      {/* ========================================================= */}
      {/* 2. TOOLBAR: SEARCH & DATE FILTER                          */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-2.5 sm:gap-3 bg-white dark:bg-[#151521] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-sm shrink-0">
        
        {/* Search Charts (Full Width expanding up to Start Date) */}
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 pl-1">
            Search Charts
          </label>
          <div className="relative w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search charts (e.g. Temperature, Voltage, Current, Pressure...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs sm:text-sm pl-9 pr-8 py-2 rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-gray-50/70 dark:bg-white/5 text-[#172b4d] dark:text-white placeholder-gray-400 outline-none focus:border-indigo-500 transition-colors h-[38px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Date Range: Start Date & End Date */}
        <div className="flex flex-col gap-0.5 w-full sm:w-auto shrink-0">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">
            <span className="flex items-center gap-1">
              <Calendar size={11} /> Start Date
            </span>
            <span>End Date</span>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-1 w-full">
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleDateChange(e.target.value, endDate)}
              className="min-w-0 w-full sm:w-auto text-xs py-1.5 px-2 sm:px-2.5 rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none cursor-pointer focus:border-indigo-500 font-medium h-[38px] text-center sm:text-left"
              title="Start Date"
            />
            <span className="hidden sm:inline text-gray-400 text-xs">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleDateChange(startDate, e.target.value)}
              className="min-w-0 w-full sm:w-auto text-xs py-1.5 px-2 sm:px-2.5 rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none cursor-pointer focus:border-indigo-500 font-medium h-[38px] text-center sm:text-left"
              title="End Date"
            />
          </div>
        </div>

      </div>

      {warningMsg && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl text-amber-700 dark:text-amber-400 text-xs sm:text-sm flex items-center gap-2 shrink-0 animate-fadeIn">
          <AlertCircle size={16} className="shrink-0" />
          <span>{warningMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-xl text-rose-600 dark:text-rose-400 text-xs sm:text-sm flex items-center gap-2 shrink-0 animate-fadeIn">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. RESPONSIVE GRID LAYOUT WITH CHARTS & TABLES            */}
      {/* ========================================================= */}
      {loading && seriesData.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <EnergyLoader text="Mengambil data agregasi per jam..." />
        </div>
      ) : filteredCharts.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#151521] rounded-2xl border border-[#dfe1e6] dark:border-white/10 text-gray-400">
          Tidak ada chart yang sesuai dengan pencarian "{searchQuery}"
        </div>
      ) : (
        <div className={`transition-all ${isEditing ? 'ring-2 ring-indigo-500/30 rounded-2xl p-1 bg-indigo-500/5' : ''}`}>
          <ResponsiveGridLayout
            width={containerWidth}
            className="layout"
            layouts={lockedLayouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 2, xxs: 1 }}
            rowHeight={70}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".drag-handle"
            margin={[12, 12]}
            isDraggable={isEditing}
            isResizable={isEditing}
            compactType="vertical"
          >
            {filteredCharts.map(chart => {
              const currentView = cardViews[chart.id] || 'chart';
              const Icon = chart.icon || Activity;

              return (
                <div key={chart.id} className="h-full w-full flex flex-col">
                  <div className={`bg-white dark:bg-[#151521] border rounded-2xl shadow-sm hover:shadow-md transition-all h-full w-full flex flex-col overflow-hidden ${
                    isEditing 
                      ? 'border-indigo-300 dark:border-indigo-500/40 ring-1 ring-indigo-400/20' 
                      : 'border-[#dfe1e6]/80 dark:border-white/10'
                  }`}>
                    
                    {/* Card Header (Drag Handle, Title, Chart/Table Toggle, CSV Export) */}
                    <div className="p-2.5 sm:p-3 border-b border-[#dfe1e6]/80 dark:border-white/10 flex items-center justify-between gap-2 bg-gray-50/60 dark:bg-white/[0.02] shrink-0 select-none">
                      
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        {/* Drag Handle */}
                        <div 
                          className={`drag-handle p-1 rounded-md transition-colors ${
                            isEditing 
                              ? 'cursor-grab active:cursor-grabbing text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50' 
                              : 'text-gray-300 dark:text-gray-600 cursor-default'
                          }`} 
                          title={isEditing ? 'Drag to reorder' : 'Kunci mode edit untuk memindahkan'}
                        >
                          <GripVertical size={16} />
                        </div>

                        <div className="flex items-center gap-1.5 truncate">
                          <Icon size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <h3 className="font-bold text-xs sm:text-sm text-[#172b4d] dark:text-white truncate">
                            {chart.title}
                          </h3>
                        </div>

                        {chart.unit && chart.unit !== '-' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 shrink-0">
                            {chart.unit}
                          </span>
                        )}
                      </div>

                      {/* Card Controls: Toggle Chart/Table & Export CSV */}
                      <div className="flex items-center gap-1 shrink-0">
                        
                        {/* Toggle Chart / Table */}
                        <div className="flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200/80 dark:border-white/10">
                          <button
                            onClick={() => toggleCardView(chart.id, 'chart')}
                            className={`p-1.5 rounded-md text-xs font-semibold transition-all ${
                              currentView === 'chart'
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                            }`}
                            title="Tampilkan Area Chart"
                          >
                            <TrendingUp size={13} />
                          </button>
                          <button
                            onClick={() => toggleCardView(chart.id, 'table')}
                            className={`p-1.5 rounded-md text-xs font-semibold transition-all ${
                              currentView === 'table'
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                            }`}
                            title="Tampilkan Tabel"
                          >
                            <TableIcon size={13} />
                          </button>
                        </div>

                        {/* Export CSV button */}
                        <button
                          onClick={() => handleExportCardCSV(chart)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                          title="Export CSV data chart ini"
                        >
                          <Download size={13} />
                        </button>
                      </div>

                    </div>

                    {/* Card Content Body: Area Chart or Table View */}
                    <div className="flex-1 min-h-0 p-2 sm:p-3 relative overflow-hidden flex flex-col">
                      
                      {seriesData.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-gray-400">
                          <Icon size={24} className="mb-1.5 opacity-40" />
                          <span className="text-xs font-medium">Belum ada data pada rentang waktu ini</span>
                        </div>
                      ) : currentView === 'chart' ? (
                        
                        /* 1. AREA CHART VIEW */
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={chartDisplayData}
                            margin={{ top: 8, right: 12, bottom: 0, left: -10 }}
                          >
                            <defs>
                              {chart.metrics.map(m => (
                                <linearGradient key={m.key} id={`grad_${chart.id}_${m.key}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={m.color} stopOpacity={0.35} />
                                  <stop offset="95%" stopColor={m.color} stopOpacity={0.02} />
                                </linearGradient>
                              ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
                            <XAxis
                              dataKey="displayTime"
                              tick={{ fontSize: 9.5, fill: '#94a3b8' }}
                              tickLine={false}
                              axisLine={{ stroke: '#e2e8f033' }}
                              interval="preserveStartEnd"
                              minTickGap={45}
                            />
                            <YAxis
                              tick={{ fontSize: 9.5, fill: '#94a3b8' }}
                              tickLine={false}
                              axisLine={false}
                              width={48}
                              domain={['auto', 'auto']}
                            />
                            <RechartsTooltip content={<CustomAnalysisTooltip unit={chart.unit} />} />
                            <Legend
                              iconType="circle"
                              iconSize={7}
                              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                            />
                            {chart.metrics.map(m => (
                              <Area
                                key={m.key}
                                type="monotone"
                                dataKey={m.key}
                                name={m.label}
                                stroke={m.color}
                                strokeWidth={2}
                                fill={`url(#grad_${chart.id}_${m.key})`}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 1.5, fill: m.color }}
                                connectNulls
                                isAnimationActive={true}
                                animationDuration={400}
                              />
                            ))}
                          </AreaChart>
                        </ResponsiveContainer>

                      ) : (

                        /* 2. TABLE VIEW */
                        <div className="flex-1 overflow-auto min-h-0 border border-[#dfe1e6]/80 dark:border-white/10 rounded-xl">
                          <table className="w-full text-left text-xs text-[#172b4d] dark:text-gray-200 border-collapse">
                            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#1e1e2d] border-b border-[#dfe1e6] dark:border-white/10 text-[10px] font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider whitespace-nowrap shadow-xs">
                              <tr>
                                <th className="py-2 px-3">Waktu (Timestamp)</th>
                                {chart.metrics.map(m => (
                                  <th key={m.key} className="py-2 px-3 text-right">
                                    {m.label} {chart.unit && chart.unit !== '-' ? `(${chart.unit})` : ''}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5 whitespace-nowrap font-medium text-[11px]">
                              {seriesData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-indigo-50/30 dark:hover:bg-white/[0.02] transition-colors">
                                  <td className="py-1.5 px-3 font-mono text-gray-500 dark:text-gray-400">
                                    {row.timestamp ? formatFullTime(row.timestamp) : row.time}
                                  </td>
                                  {chart.metrics.map(m => (
                                    <td key={m.key} className="py-1.5 px-3 text-right font-mono font-semibold">
                                      {row[m.key] !== null && row[m.key] !== undefined ? Number(row[m.key]).toFixed(2) : '-'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                      )}

                    </div>

                  </div>
                </div>
              );
            })}
          </ResponsiveGridLayout>
        </div>
      )}

    </div>
  );
};

export default AnalysisReport;
