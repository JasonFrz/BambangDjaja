import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from 'axios';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Link, useLocation } from "react-router-dom";
import { Zap, Activity, Waves, Gauge, Wifi, WifiOff, Filter, ChevronDown, RefreshCw, Settings, GripHorizontal, Edit3, Send, LogOut, Download } from "lucide-react";
import { useTrendData } from "../contexts/TrendDataContext";
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useApi } from '../contexts/ApiContext';

import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';



const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'statusCard', x: 0, y: 0, w: 12, h: 1, minW: 3, minH: 1 },
    { i: 'uPhaseCard', x: 0, y: 1, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'uLineCard', x: 3, y: 1, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'currentCard', x: 6, y: 1, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'powerCard', x: 9, y: 1, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'freqCard', x: 0, y: 3, w: 6, h: 1, minW: 2, minH: 1 },
    { i: 'energyCard', x: 6, y: 3, w: 6, h: 1, minW: 2, minH: 1 },
    { i: 'uPhaseChart', x: 0, y: 4, w: 6, h: 3, minW: 2, minH: 2 },
    { i: 'uLineChart', x: 6, y: 4, w: 6, h: 3, minW: 2, minH: 2 },
    { i: 'currentChart', x: 0, y: 7, w: 6, h: 3, minW: 2, minH: 2 },
    { i: 'powerChart', x: 6, y: 7, w: 6, h: 3, minW: 2, minH: 2 },
    { i: 'freqChart', x: 0, y: 10, w: 12, h: 3, minW: 2, minH: 2 },
    { i: 'efficiencyChart', x: 0, y: 13, w: 12, h: 3, minW: 2, minH: 2 }
  ],
  md: [
    { i: 'statusCard', x: 0, y: 0, w: 10, h: 1, minW: 2, minH: 1 },
    { i: 'uPhaseCard', x: 0, y: 1, w: 5, h: 2, minW: 2, minH: 2 },
    { i: 'uLineCard', x: 5, y: 1, w: 5, h: 2, minW: 2, minH: 2 },
    { i: 'currentCard', x: 0, y: 3, w: 5, h: 2, minW: 2, minH: 2 },
    { i: 'powerCard', x: 5, y: 3, w: 5, h: 2, minW: 2, minH: 2 },
    { i: 'freqCard', x: 0, y: 5, w: 5, h: 1, minW: 2, minH: 1 },
    { i: 'energyCard', x: 5, y: 5, w: 5, h: 1, minW: 2, minH: 1 },
    { i: 'uPhaseChart', x: 0, y: 6, w: 10, h: 3, minW: 2, minH: 2 },
    { i: 'uLineChart', x: 0, y: 9, w: 10, h: 3, minW: 2, minH: 2 },
    { i: 'currentChart', x: 0, y: 12, w: 10, h: 3, minW: 2, minH: 2 },
    { i: 'powerChart', x: 0, y: 15, w: 10, h: 3, minW: 2, minH: 2 },
    { i: 'freqChart', x: 0, y: 18, w: 10, h: 3, minW: 2, minH: 2 },
    { i: 'efficiencyChart', x: 0, y: 21, w: 10, h: 3, minW: 2, minH: 2 }
  ],
  sm: [
    { i: 'statusCard', x: 0, y: 0, w: 6, h: 1, minW: 1, minH: 1 },
    { i: 'uPhaseCard', x: 0, y: 1, w: 6, h: 2, minW: 1, minH: 2 },
    { i: 'uLineCard', x: 0, y: 3, w: 6, h: 2, minW: 1, minH: 2 },
    { i: 'currentCard', x: 0, y: 5, w: 6, h: 2, minW: 1, minH: 2 },
    { i: 'powerCard', x: 0, y: 7, w: 6, h: 2, minW: 1, minH: 2 },
    { i: 'freqCard', x: 0, y: 9, w: 6, h: 1, minW: 1, minH: 1 },
    { i: 'energyCard', x: 0, y: 10, w: 6, h: 1, minW: 1, minH: 1 },
    { i: 'uPhaseChart', x: 0, y: 11, w: 6, h: 3, minW: 1, minH: 2 },
    { i: 'uLineChart', x: 0, y: 14, w: 6, h: 3, minW: 1, minH: 2 },
    { i: 'currentChart', x: 0, y: 17, w: 6, h: 3, minW: 1, minH: 2 },
    { i: 'powerChart', x: 0, y: 20, w: 6, h: 3, minW: 1, minH: 2 },
    { i: 'freqChart', x: 0, y: 23, w: 6, h: 3, minW: 1, minH: 2 },
    { i: 'efficiencyChart', x: 0, y: 26, w: 6, h: 3, minW: 1, minH: 2 }
  ]
};

const Dashboard = () => {
  // Shared context
  const { liveData, wsData, isConnected, isLive } = useTrendData();
  const { apiUrl } = useApi();

  // Unified Filter State for both Monitoring and Charts
  const [filters, setFilters] = useState({
    status: true,
    uPhase: true,
    uLine: true,
    current: true,
    power: true,
    energy: true,
    frequency: true,
    efficiency: true
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [warning, setWarning] = useState("");
  const { width, containerRef } = useContainerWidth();

  const STORAGE_KEY = 'dashboardLayouts_v8';
  const ALL_KEYS = useMemo(() => [
    'statusCard', 'uPhaseCard', 'uLineCard', 'currentCard', 'powerCard', 'freqCard', 'energyCard',
    'uPhaseChart', 'uLineChart', 'currentChart', 'powerChart', 'freqChart', 'efficiencyChart'
  ], []);

  const [layouts, setLayouts] = useState(() => {
    const savedLayouts = localStorage.getItem('dashboardLayouts_v7');
    if (savedLayouts) {
      const parsed = JSON.parse(savedLayouts);
      // Strip any stale static property from saved layouts
      Object.keys(parsed).forEach(bp => {
        if (parsed[bp]) {
          parsed[bp] = parsed[bp].map(({ static: _s, ...rest }) => rest);
        }
      });
      return parsed;
    }
    return DEFAULT_LAYOUTS;
  });

  // Force RGL to fully remount when filters change, so it re-reads layouts prop
  const filterKey = useMemo(() => Object.values(filters).map(v => v ? '1' : '0').join(''), [filters]);

  const handleLayoutChange = useCallback((currentLayout, allLayouts) => {
    setLayouts(prev => {
      const merged = {};
      Object.keys(DEFAULT_LAYOUTS).forEach(bp => {
        const rglItems = allLayouts[bp] || [];
        const rglMap = new Map(rglItems.map(item => {
          const { static: _s, ...rest } = item;
          return [item.i, rest];
        }));

        merged[bp] = ALL_KEYS.map(key => {
          if (rglMap.has(key)) {
            return rglMap.get(key);
          }
          const saved = (prev[bp] || []).find(i => i.i === key);
          return saved ? { ...saved } : DEFAULT_LAYOUTS[bp].find(i => i.i === key);
        });
      });

      const newStr = JSON.stringify(merged);
      const prevStr = JSON.stringify(prev);
      if (newStr === prevStr) return prev;

      localStorage.setItem('dashboardLayouts_v7', newStr);
      return merged;
    });
  }, [ALL_KEYS]);

  const resetLayout = () => {
    setLayouts(DEFAULT_LAYOUTS);
    localStorage.removeItem('dashboardLayouts_v7');
  };

  const toggleFilter = (key) => {
    setFilters(prev => {
      if (prev[key]) {
        const currentActiveCount = Object.values(prev).filter(Boolean).length;
        if (currentActiveCount <= 1) {
          setWarning("Minimal 1 tampilan data harus dipilih.");
          setTimeout(() => setWarning(""), 3000);
          return prev;
        }
      }
      return { ...prev, [key]: !prev[key] };
    });
  };

  const showAll = () => {
    setFilters({ status: true, uPhase: true, uLine: true, current: true, power: true, energy: true, frequency: true, efficiency: true });
  };

  const [waNotif, setWaNotif] = useState({ message: '', type: '' });

  const showWaNotif = (message, type) => {
    setWaNotif({ message, type });
    setTimeout(() => {
      setWaNotif({ message: '', type: '' });
    }, 5000);
  };

  // Monitoring Data State
  const [data, setData] = useState({
    vPhase: { A: 0.0, B: 0.0, C: 0.0, Avg: 0.0 },
    vLine: { AB: 0.0, BC: 0.0, CA: 0.0, Avg: 0.0 },
    current: { A: 0.0, B: 0.0, C: 0.0, N: 0.0, Avg: 0.0, Unbalance: 0.0 },
    frequency: 0.0,
    power: { ActiveTotal: 0.0, ReactiveTotal: 0.0, ApparentTotal: 0.0, PFTotal: 0.0, ActiveA: 0.0, ActiveB: 0.0, ActiveC: 0.0 },
    energy: { ActiveTotal: 0.0, ReactiveTotal: 0.0 },
    efficiency: 0.0,
    status: { OnOff: 0, Relay: 0, Alarm: 0, Synced: 0 }
  });

  useEffect(() => {
    if (wsData && wsData.phaseA !== undefined) { // Check if it's new schema
      setData({
        vPhase: { A: wsData.phaseA || 0, B: wsData.phaseB || 0, C: wsData.phaseC || 0, Avg: wsData.avgPhaseV || 0 },
        vLine: { AB: wsData.lineAB || 0, BC: wsData.lineBC || 0, CA: wsData.lineCA || 0, Avg: wsData.avgLineV || 0 },
        current: { A: wsData.currentA || 0, B: wsData.currentB || 0, C: wsData.currentC || 0, N: wsData.currentN || 0, Avg: wsData.avgCurrent || 0, Unbalance: wsData.currentUnbalance || 0 },
        frequency: wsData.frequency || 0,
        power: {
          ActiveTotal: wsData.powerActiveTotal || 0,
          ReactiveTotal: wsData.powerReactiveTotal || 0,
          ApparentTotal: wsData.powerApparentTotal || 0,
          PFTotal: wsData.pfTotal || 0,
          ActiveA: wsData.powerActiveA || 0,
          ActiveB: wsData.powerActiveB || 0,
          ActiveC: wsData.powerActiveC || 0
        },
        energy: {
          ActiveTotal: wsData.energyActiveTotal || 0,
          ReactiveTotal: wsData.energyReactiveTotal || 0
        },
        efficiency: wsData.efficiency || 0,
        status: { OnOff: wsData.onOffStatus || 0, Relay: wsData.relayStatus || 0, Alarm: wsData.alarmStatus || 0, Synced: wsData.synced || 0 }
      });
    } else if (liveData && liveData.length > 0) {
      // Gunakan data historis terakhir jika wsData belum ada
      const latest = liveData[liveData.length - 1];
      setData({
        vPhase: { A: latest.phaseA || 0, B: latest.phaseB || 0, C: latest.phaseC || 0, Avg: latest.avgPhaseV || 0 },
        vLine: { AB: latest.lineAB || 0, BC: latest.lineBC || 0, CA: latest.lineCA || 0, Avg: latest.avgLineV || 0 },
        current: { A: latest.currentA || 0, B: latest.currentB || 0, C: latest.currentC || 0, N: latest.currentN || 0, Avg: latest.avgCurrent || 0, Unbalance: latest.currentUnbalance || 0 },
        frequency: latest.frequency || 0,
        power: {
          ActiveTotal: latest.powerActiveTotal || 0,
          ReactiveTotal: latest.powerReactiveTotal || 0,
          ApparentTotal: latest.powerApparentTotal || 0,
          PFTotal: latest.pfTotal || 0,
          ActiveA: latest.powerActiveA || 0,
          ActiveB: latest.powerActiveB || 0,
          ActiveC: latest.powerActiveC || 0
        },
        energy: {
          ActiveTotal: latest.energyActiveTotal || 0,
          ReactiveTotal: latest.energyReactiveTotal || 0
        },
        efficiency: latest.efficiency || 0,
        status: { OnOff: latest.onOffStatus || 0, Relay: latest.relayStatus || 0, Alarm: latest.alarmStatus || 0, Synced: latest.synced || 0 }
      });
    }
  }, [wsData, liveData]);

  // Trends Data State
  const [trendData, setTrendData] = useState([]);
  const [dataInterval, setDataInterval] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Date/Time Filter for Charts
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterError, setFilterError] = useState(null);

  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Lock all items as static when not editing to completely prevent drag/resize
  const effectiveLayouts = useMemo(() => {
    const result = {};
    Object.keys(layouts).forEach(bp => {
      result[bp] = (layouts[bp] || []).map(item => ({
        ...item,
        static: !isEditingLayout
      }));
    });
    return result;
  }, [layouts, isEditingLayout]);

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [exportInterval, setExportInterval] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [downloadMB, setDownloadMB] = useState("0.0");
  const [exportError, setExportError] = useState(null);
  const [showFilterOptions, setShowFilterOptions] = useState(false);

  const fetchTrends = async (forceFilter = false) => {
    try {
      setLoading(true);
      let url = `${apiUrl}/api/trends`;

      const useFilter = forceFilter || isFiltering;

      if (useFilter && startTime && endTime) {
        const startISO = new Date(startTime).toISOString();
        const endISO = new Date(endTime).toISOString();
        url += `?start=${startISO}&end=${endISO}`;
      }

      const response = await axios.get(url);

      const formattedData = response.data.map(item => {
        const date = new Date(item.timestamp);
        return {
          ...item,
          time: date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' })
        };
      });

      if (useFilter && formattedData.length === 0) {
        setFilterError('Tidak ada data yang ditemukan pada rentang waktu tersebut.');
      } else {
        setTrendData(formattedData);
        setFilterError(null);
      }
      setError(null);
    } catch (err) {
      console.error("Error fetching trends:", err);
      if (err.response && err.response.status === 404) {
        setFilterError(err.response.data.error || 'Tidak ada data yang ditemukan pada rentang waktu tersebut.');
        setTrendData([]);
        setError(null);
      } else {
        setError("Failed to load trend data.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = () => {
    if (startTime && endTime) {
      if (new Date(startTime) >= new Date(endTime)) {
        setFilterError('Waktu mulai harus lebih awal dari waktu akhir.');
        return;
      }
      setFilterError(null);
      setIsFiltering(true);
      fetchTrends(true);
    } else if (!startTime && !endTime) {
      setFilterError(null);
      setIsFiltering(false);
    } else {
      setFilterError('Isi kedua waktu (mulai dan akhir) untuk memfilter.');
    }
  };

  const handleDownloadExcel = async () => {
    setExportError(null);
    if (!exportStart || !exportEnd) {
      setExportError("Silakan isi rentang waktu untuk export Excel.");
      return;
    }
    if (new Date(exportStart) >= new Date(exportEnd)) {
      setExportError("Waktu mulai harus lebih awal dari waktu akhir.");
      return;
    }

    try {
      setIsExporting(true);
      setDownloadMB("0.0");
      // Kirim waktu lokal langsung (tanpa konversi UTC) karena DB menyimpan waktu lokal
      const startParam = exportStart.replace('T', ' ') + ':00';
      const endParam = exportEnd.replace('T', ' ') + ':00';
      const url = `${apiUrl}/api/trends/export?start=${encodeURIComponent(startParam)}&end=${encodeURIComponent(endParam)}`;

      const response = await axios.get(url, { 
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.loaded) {
            const mb = (progressEvent.loaded / (1024 * 1024)).toFixed(1);
            setDownloadMB(mb);
          }
        }
      });

      // Get row count from header
      const rowCount = response.headers['x-row-count'];

      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `Export_${exportStart}_to_${exportEnd}.xlsx`;
      saveAs(blob, filename);
      setShowExportModal(false);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 404) {
        try {
          let errorMsg = "Tidak ada data pada rentang waktu tersebut.";
          if (err.response.data instanceof Blob) {
            const errorText = await err.response.data.text();
            const errorObj = JSON.parse(errorText);
            if (errorObj.error) errorMsg = errorObj.error;
          }
          setExportError(errorMsg);
        } catch (e) {
          setExportError("Tidak ada data pada rentang waktu tersebut.");
        }
      } else {
        setExportError("Gagal mengunduh Excel.");
      }
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (isFiltering) {
      fetchTrends();
    }
    setLoading(false);
  }, [isFiltering]);

  const rawChartData = isFiltering ? trendData : liveData;
  const chartData = useMemo(() => {
    let processData = rawChartData;
    if (dataInterval > 1) {
      const downsampled = [];
      let lastTime = null;
      rawChartData.forEach(point => {
        const pointTime = new Date(point.timestamp || new Date()).getTime();
        if (!lastTime || (pointTime - lastTime) >= dataInterval * 1000) {
          downsampled.push(point);
          lastTime = pointTime;
        }
      });
      processData = downsampled;
    } else if (!isFiltering) {
      const maxLivePoints = 30;
      if (processData.length > maxLivePoints) {
        processData = processData.slice(processData.length - maxLivePoints);
      }
    }
    return processData.map(d => ({
      ...d,
      timestampMs: new Date(d.timestamp || new Date()).getTime()
    }));
  }, [rawChartData, dataInterval, isFiltering]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#151521] border border-[#dfe1e6] dark:border-white/10 p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-[#172b4d] dark:text-white mb-2">
            {typeof label === 'number' ? new Date(label).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : label}
          </p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-medium">
              {entry.name}: {entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const activeCount = Object.values(filters).filter(Boolean).length;


  const handleTestWA = async () => {
    try {
      const dbName = sessionStorage.getItem('company_name');
      const username = sessionStorage.getItem('username');
      if (!dbName || !username) {
        showWaNotif("Session expired, please login again.", "error");
        return;
      }

      const res = await axios.post(`${apiUrl}/api/whatsapp/test`, {
        frequency: data.frequency,
        dbName,
        username
      });
      showWaNotif("✅ " + res.data.message, "success");
    } catch (error) {
      showWaNotif("❌ Gagal uji WA: " + (error.response?.data?.error || error.message), "error");
    }
  };

  const handleLogoutWA = async () => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus sesi WhatsApp (Logout)? Anda harus scan ulang QR code di server terminal.")) return;
    try {
      const res = await axios.post(`${apiUrl}/api/whatsapp/logout`);
      showWaNotif("✅ " + res.data.message, "success");
    } catch (error) {
      showWaNotif("❌ Gagal logout WA: " + (error.response?.data?.error || error.message), "error");
    }
  };

  // Calculate Overall Status based on Frequency
  const isFreqSafe = data.frequency <= 52.5;

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.5s_ease-out] w-full max-w-7xl mx-auto">

      {/* Header Section */}
      <div className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#172b4d] dark:text-white font-heading mb-1 transition-colors flex items-center gap-4">
            Dashboard Electrical
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-[#151521] border border-gray-200 dark:border-white/10 shadow-sm mt-1 sm:mt-0">
              <span className="text-sm font-semibold text-[#5e6c84] dark:text-[#94a3b8]">Overall Status:</span>
              <span className={`text-sm font-bold ${isFreqSafe ? 'text-emerald-500' : 'text-red-500'}`}>
                {isFreqSafe ? 'Safe' : 'Danger'}
              </span>
              <div className="relative w-3 h-3 ml-1">
                <div className={`absolute inset-0 rounded-full blur-sm opacity-80 animate-pulse ${isFreqSafe ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                <div className={`relative w-3 h-3 rounded-full ${isFreqSafe ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              </div>
            </div>
          </h2>
          <p className="text-[#5e6c84] dark:text-[#94a3b8] text-[0.95rem] transition-colors mt-1">
            Real-time Monitoring & Historical Trends from SPM33
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${isLive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 animate-glow-pulse" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
            {isLive ? <Wifi size={16} /> : <WifiOff size={16} />}
            {isLive ? "Live" : "Offline"}
          </div>
        </div>
      </div>

      {warning && (
        <div className="text-red-500 dark:text-red-400 text-sm font-semibold -mt-2 mb-2 animate-[slideUpFade_0.2s_ease-out]">
          * {warning}
        </div>
      )}

      {/* Show Options Card */}
      <div className="bg-white dark:bg-[#151521] p-5 rounded-2xl border border-[#dfe1e6] dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-4 animate-[slideUpFade_0.3s_ease-out]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 pb-3 border-b border-[#dfe1e6] dark:border-white/10 gap-3">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-[#5e6c84] dark:text-[#94a3b8]" />
            <h3 className="font-semibold text-[#172b4d] dark:text-white">Show Options</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={showAll} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors">
              Show All
            </button>
            <button
              onClick={() => setShowFilterOptions(!showFilterOptions)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${showFilterOptions ? 'bg-[#0052cc] text-white' : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20'}`}
            >
              <Settings size={12} /> {showFilterOptions ? 'Hide Options' : 'Show Options'}
            </button>
            <button
              onClick={() => setIsEditingLayout(!isEditingLayout)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${isEditingLayout ? 'bg-[#0052cc] text-white' : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20'}`}
            >
              <Edit3 size={12} /> {isEditingLayout ? 'Done Editing' : 'Edit Layout'}
            </button>

            <div className="relative">
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors flex items-center gap-1"
              >
                <RefreshCw size={12} /> Reset Layout
              </button>

              {showResetConfirm && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#151521] border border-[#dfe1e6] dark:border-white/10 shadow-xl rounded-xl p-3 z-50 animate-[slideUpFade_0.2s_ease-out]">
                  <p className="text-sm font-semibold text-[#172b4d] dark:text-white mb-3">Reset layout to default?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { resetLayout(); setShowResetConfirm(false); }}
                      className="flex-1 px-2 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 px-2 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-[#172b4d] dark:text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      No
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {showFilterOptions && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/10 cursor-pointer transition-all">
                <input type="checkbox" checked={filters.status} onChange={() => toggleFilter('status')} className="w-4 h-4 text-[#0052cc] rounded border-gray-300 focus:ring-[#0052cc]" />
                <span className="text-sm font-medium text-[#172b4d] dark:text-white">System Status</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/10 cursor-pointer transition-all">
                <input type="checkbox" checked={filters.uPhase} onChange={() => toggleFilter('uPhase')} className="w-4 h-4 text-[#0052cc] rounded border-gray-300 focus:ring-[#0052cc]" />
                <span className="text-sm font-medium text-[#172b4d] dark:text-white">Phase Voltage</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/10 cursor-pointer transition-all">
                <input type="checkbox" checked={filters.uLine} onChange={() => toggleFilter('uLine')} className="w-4 h-4 text-[#0052cc] rounded border-gray-300 focus:ring-[#0052cc]" />
                <span className="text-sm font-medium text-[#172b4d] dark:text-white">Line Voltage</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/10 cursor-pointer transition-all">
                <input type="checkbox" checked={filters.current} onChange={() => toggleFilter('current')} className="w-4 h-4 text-[#0052cc] rounded border-gray-300 focus:ring-[#0052cc]" />
                <span className="text-sm font-medium text-[#172b4d] dark:text-white">Current</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/10 cursor-pointer transition-all">
                <input type="checkbox" checked={filters.power} onChange={() => toggleFilter('power')} className="w-4 h-4 text-[#0052cc] rounded border-gray-300 focus:ring-[#0052cc]" />
                <span className="text-sm font-medium text-[#172b4d] dark:text-white">Power</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/10 cursor-pointer transition-all">
                <input type="checkbox" checked={filters.energy} onChange={() => toggleFilter('energy')} className="w-4 h-4 text-[#0052cc] rounded border-gray-300 focus:ring-[#0052cc]" />
                <span className="text-sm font-medium text-[#172b4d] dark:text-white">Energy</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/10 cursor-pointer transition-all">
                <input type="checkbox" checked={filters.frequency} onChange={() => toggleFilter('frequency')} className="w-4 h-4 text-[#0052cc] rounded border-gray-300 focus:ring-[#0052cc]" />
                <span className="text-sm font-medium text-[#172b4d] dark:text-white">Frequency</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/10 cursor-pointer transition-all">
                <input type="checkbox" checked={filters.efficiency} onChange={() => toggleFilter('efficiency')} className="w-4 h-4 text-[#0052cc] rounded border-gray-300 focus:ring-[#0052cc]" />
                <span className="text-sm font-medium text-[#172b4d] dark:text-white">Efficiency Chart</span>
              </label>
            </div>
            {filterError && (
              <span className="text-red-500 dark:text-red-400 text-sm font-medium mt-3 block animate-[fadeIn_0.3s_ease-out]">
                {filterError}
              </span>
            )}
          </>
        )}
      </div>

      {/* Filter Waktu Historis (Tetap statis di atas) */}
      {(filters.uPhase || filters.uLine || filters.current || filters.frequency) && (
        <div className="flex flex-col gap-4 mt-2 mb-4 animate-[slideUpFade_0.4s_ease-out]">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-white dark:bg-[#151521] p-2.5 sm:p-2 rounded-xl border border-[#dfe1e6] dark:border-white/10 shadow-sm self-start w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="sm:hidden text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] w-10">Start:</span>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => { setStartTime(e.target.value); setFilterError(null); }}
                  className="flex-1 min-w-[140px] text-sm px-3 py-1.5 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none focus:border-[#0052cc]"
                />
              </div>
              <span className="hidden sm:inline text-[#5e6c84] dark:text-[#94a3b8] text-sm font-medium">to</span>
              <div className="flex items-center gap-2 w-full md:w-auto mt-1 sm:mt-0">
                <span className="sm:hidden text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] w-10">End:</span>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => { setEndTime(e.target.value); setFilterError(null); }}
                  className="flex-1 min-w-[140px] text-sm px-3 py-1.5 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none focus:border-[#0052cc]"
                />
              </div>
            </div>
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 border-t sm:border-t-0 sm:border-l border-[#dfe1e6] dark:border-white/10 pt-2.5 sm:pt-0 sm:pl-3 w-full md:w-auto mt-1 sm:mt-0">
              <div className="flex items-center gap-2 w-full lg:w-auto lg:mr-2">
                <span className="text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] w-12 sm:w-10 lg:w-auto">Interval:</span>
                <select
                  value={dataInterval}
                  onChange={(e) => setDataInterval(Number(e.target.value))}
                  className="flex-1 lg:flex-none px-3 py-1.5 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#0052cc] shadow-sm cursor-pointer"
                >
                  <option className="bg-white dark:bg-[#151521] text-[#172b4d] dark:text-white" value={1}>1 Detik (Live)</option>
                  <option className="bg-white dark:bg-[#151521] text-[#172b4d] dark:text-white" value={5}>5 Detik</option>
                  <option className="bg-white dark:bg-[#151521] text-[#172b4d] dark:text-white" value={10}>10 Detik</option>
                  <option className="bg-white dark:bg-[#151521] text-[#172b4d] dark:text-white" value={30}>30 Detik</option>
                  <option className="bg-white dark:bg-[#151521] text-[#172b4d] dark:text-white" value={60}>1 Menit</option>
                </select>
              </div>
              <div className="flex items-center gap-2 w-full lg:w-auto">
                <button
                  onClick={handleApplyFilter}
                  className={`flex-1 lg:flex-none whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors ${isFiltering ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-[#0052cc] text-white hover:bg-[#0047b3]'
                    }`}
                >
                  {isFiltering ? 'Filter Aktif' : 'Filter Chart'}
                </button>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm font-semibold shadow-sm transition-colors whitespace-nowrap"
                >
                  <Download size={16} /> Export Data
                </button>
                <button
                  onClick={() => fetchTrends(false)}
                  disabled={loading}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-[#dfe1e6] dark:border-white/10 rounded-lg text-[#172b4d] dark:text-white hover:bg-[#ebecf0] dark:hover:bg-white/10 transition-all flex items-center justify-center shadow-sm"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800/30 mt-2 mb-4">
          {error}
        </div>
      )}

      {/* DASHBOARD DRAGGABLE GRID */}
      <div ref={containerRef} className={isEditingLayout ? 'ring-2 ring-[#0052cc] ring-opacity-50 rounded-xl p-1 bg-[#0052cc]/5 dark:bg-[#0052cc]/10 transition-all' : 'transition-all'}>
        <ResponsiveGridLayout
          key={`${filterKey}-${isEditingLayout}`}
          className="layout -mx-2 mt-4"
          width={width}
          layouts={effectiveLayouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={140}
          compactType="horizontal"
          preventCollision={false}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
          margin={[16, 16]}
          isDraggable={isEditingLayout}
          isResizable={isEditingLayout}
        >

          {filters.status && (
            <div key="statusCard" className="flex">
              <div className={`bg-white dark:bg-[#151521] rounded-2xl p-3 sm:p-4 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md h-full w-full flex items-center justify-center group relative overflow-hidden bg-opacity-95 backdrop-blur select-none ${isEditingLayout ? 'cursor-move drag-handle hover:opacity-80' : ''}`}>
                <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-3 sm:gap-4 lg:gap-6 w-full justify-around sm:divide-x divide-gray-200 dark:divide-gray-800">
                  <div className="flex flex-col items-center sm:w-1/4">
                    <span className="text-[10px] sm:text-xs text-[#5e6c84] dark:text-[#94a3b8] font-semibold mb-1 uppercase tracking-wider">System</span>
                    <div className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-sm font-bold flex items-center gap-1 sm:gap-2 ${data.status.OnOff === 1 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${data.status.OnOff === 1 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}></div>
                      {data.status.OnOff === 1 ? 'ON' : 'OFF'}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center sm:w-1/4">
                    <span className="text-[10px] sm:text-xs text-[#5e6c84] dark:text-[#94a3b8] font-semibold mb-1 uppercase tracking-wider">Relay</span>
                    <div className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-sm font-bold flex items-center gap-1 sm:gap-2 ${data.status.Relay === 1 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                      <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${data.status.Relay === 1 ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                      {data.status.Relay === 1 ? 'ACTIVE' : 'IDLE'}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center sm:w-1/4">
                    <span className="text-[10px] sm:text-xs text-[#5e6c84] dark:text-[#94a3b8] font-semibold mb-1 uppercase tracking-wider">Alarm</span>
                    <div className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-sm font-bold flex items-center gap-1 sm:gap-2 ${data.status.Alarm === 1 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                      <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${data.status.Alarm === 1 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse' : 'bg-emerald-500'}`}></div>
                      {data.status.Alarm === 1 ? 'TRIGGERED' : 'CLEAR'}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center sm:w-1/4">
                    <span className="text-[10px] sm:text-xs text-[#5e6c84] dark:text-[#94a3b8] font-semibold mb-1 uppercase tracking-wider">Sync</span>
                    <div className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-sm font-bold flex items-center gap-1 sm:gap-2 ${data.status.Synced === 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${data.status.Synced === 1 ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
                      {data.status.Synced === 1 ? 'SYNCED' : 'PENDING'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {filters.uPhase && (
            <div key="uPhaseCard" className="flex">
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md h-full w-full flex flex-col group relative overflow-hidden bg-opacity-95 backdrop-blur">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 dark:bg-blue-400/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                <div className={`flex items-center gap-3 mb-5 select-none transition-opacity ${isEditingLayout ? 'cursor-move drag-handle hover:opacity-80' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0052cc] to-[#4c9aff] flex items-center justify-center text-white shadow-lg shadow-blue-500/20 pointer-events-none">
                    <Zap size={20} />
                  </div>
                  <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">Phase Voltage (U Phase)</h3>
                  {isEditingLayout && <GripHorizontal size={20} className="text-gray-400 mr-2" />}
                </div>
                <div className="space-y-3 flex-1 flex flex-col justify-center">
                  {["A", "B", "C"].map((phase) => (
                    <div key={phase} className="flex justify-between items-center p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                      <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-sm">Phase {phase}</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-[#172b4d] dark:text-white font-mono">{data.vPhase[phase].toFixed(1)}</span>
                        <span className="text-xs font-semibold text-[#8993a4] dark:text-[#64748b]">V</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {filters.uLine && (
            <div key="uLineCard" className="flex">
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md h-full w-full flex flex-col group relative overflow-hidden bg-opacity-95 backdrop-blur">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 dark:bg-cyan-400/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                <div className={`flex items-center gap-3 mb-5 select-none transition-opacity ${isEditingLayout ? 'cursor-move drag-handle hover:opacity-80' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00b8d9] to-[#36c9e5] flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 pointer-events-none">
                    <Activity size={20} />
                  </div>
                  <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">Line Voltage (U Line)</h3>
                  {isEditingLayout && <GripHorizontal size={20} className="text-gray-400 mr-2" />}
                </div>
                <div className="space-y-3 flex-1 flex flex-col justify-center">
                  {["AB", "BC", "CA"].map((line) => (
                    <div key={line} className="flex justify-between items-center p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                      <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-sm">Line {line}</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-[#172b4d] dark:text-white font-mono">{data.vLine[line].toFixed(1)}</span>
                        <span className="text-xs font-semibold text-[#8993a4] dark:text-[#64748b]">V</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {filters.current && (
            <div key="currentCard" className="flex">
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md h-full w-full flex flex-col group relative overflow-hidden bg-opacity-95 backdrop-blur">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 dark:bg-amber-400/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                <div className={`flex items-center gap-3 mb-5 select-none transition-opacity ${isEditingLayout ? 'cursor-move drag-handle hover:opacity-80' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffab00] to-[#ffc400] flex items-center justify-center text-white shadow-lg shadow-amber-500/20 pointer-events-none">
                    <Waves size={20} />
                  </div>
                  <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">Current (I)</h3>
                  {isEditingLayout && <GripHorizontal size={20} className="text-gray-400 mr-2" />}
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2 content-center">
                  {["A", "B", "C"].map((phase) => (
                    <div key={phase} className="flex justify-between items-center p-2 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                      <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-xs">Ph {phase}</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-[#172b4d] dark:text-white font-mono">{data.current[phase].toFixed(2)}</span>
                        <span className="text-[10px] font-semibold text-[#8993a4] dark:text-[#64748b]">A</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-2 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                    <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-xs">Neutral</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-[#172b4d] dark:text-white font-mono">{data.current.N.toFixed(2)}</span>
                      <span className="text-[10px] font-semibold text-[#8993a4] dark:text-[#64748b]">A</span>
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-between items-center p-2 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 transition-colors">
                    <span className="text-amber-700 dark:text-amber-400 font-semibold text-xs">Current Unbalance</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-amber-700 dark:text-amber-400 font-mono">{data.current.Unbalance.toFixed(2)}</span>
                      <span className="text-[10px] font-semibold text-amber-600/70 dark:text-amber-400/70">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {filters.power && (
            <div key="powerCard" className="flex">
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md h-full w-full flex flex-col group relative overflow-hidden bg-opacity-95 backdrop-blur">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 dark:bg-purple-400/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                <div className={`flex items-center gap-3 mb-5 select-none transition-opacity ${isEditingLayout ? 'cursor-move drag-handle hover:opacity-80' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8777d9] to-[#6554c0] flex items-center justify-center text-white shadow-lg shadow-purple-500/20 pointer-events-none">
                    <Activity size={20} />
                  </div>
                  <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">Power</h3>
                  {isEditingLayout && <GripHorizontal size={20} className="text-gray-400 mr-2" />}
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2 content-center">
                  <div className="flex justify-between items-center p-2 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 transition-colors">
                    <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-xs">Active</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-[#172b4d] dark:text-white font-mono">{data.power.ActiveTotal.toFixed(1)}</span>
                      <span className="text-[10px] font-semibold text-[#8993a4]">kW</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 transition-colors">
                    <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-xs">Reactive</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-[#172b4d] dark:text-white font-mono">{data.power.ReactiveTotal.toFixed(1)}</span>
                      <span className="text-[10px] font-semibold text-[#8993a4]">kVAR</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 transition-colors">
                    <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-xs">Apparent</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-[#172b4d] dark:text-white font-mono">{data.power.ApparentTotal.toFixed(1)}</span>
                      <span className="text-[10px] font-semibold text-[#8993a4]">kVA</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 transition-colors">
                    <span className="text-indigo-700 dark:text-indigo-400 font-semibold text-xs">PF Total</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400 font-mono">{data.power.PFTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {filters.frequency && (
            <div key="freqCard" className="flex">
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md h-full w-full group relative overflow-hidden flex flex-col bg-opacity-95 backdrop-blur">
                <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 dark:bg-indigo-400/5 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110"></div>
                <div className={`flex items-center gap-3 mb-4 select-none transition-opacity ${isEditingLayout ? 'cursor-move drag-handle hover:opacity-80' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6554c0] to-[#8777d9] flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 pointer-events-none">
                    <Gauge size={20} />
                  </div>
                  <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">Frequency</h3>

                  {waNotif.message && (
                    <div className={`mr-2 text-[10px] font-medium px-2 py-1 rounded-md ${waNotif.type === 'success'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                      {waNotif.message}
                    </div>
                  )}

                  <div className="flex gap-1 mr-2 pointer-events-auto">
                    <button
                      onClick={handleTestWA}
                      title="Test WA Notification"
                      className="p-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800/80 transition-colors"
                    >
                      <Send size={14} />
                    </button>
                    <button
                      onClick={handleLogoutWA}
                      title="Logout WA Session"
                      className="p-1.5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/80 transition-colors"
                    >
                      <LogOut size={14} />
                    </button>
                  </div>
                  {isEditingLayout && <GripHorizontal size={20} className="text-gray-400 mr-2" />}
                </div>
                <div className="mt-auto flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-[#172b4d] dark:text-white font-mono tracking-tight">{data.frequency.toFixed(2)}</span>
                  <span className="text-sm font-semibold text-[#8993a4] dark:text-[#64748b]">Hz</span>
                </div>
              </div>
            </div>
          )}

          {filters.energy && (
            <div key="energyCard" className="flex">
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md h-full w-full group relative overflow-hidden flex flex-col bg-opacity-95 backdrop-blur">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 dark:bg-emerald-400/5 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110"></div>
                <div className={`flex items-center gap-3 mb-4 select-none transition-opacity ${isEditingLayout ? 'cursor-move drag-handle hover:opacity-80' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#36b37e] to-[#57d9a3] flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 pointer-events-none">
                    <Activity size={20} />
                  </div>
                  <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">Energy</h3>
                  {isEditingLayout && <GripHorizontal size={20} className="text-gray-400 mr-2" />}
                </div>
                <div className="flex-1 flex flex-col justify-center gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-sm">Active Energy</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-[#172b4d] dark:text-white font-mono tracking-tight">{data.energy.ActiveTotal.toFixed(1)}</span>
                      <span className="text-xs font-semibold text-[#8993a4] dark:text-[#64748b]">kWh</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-sm">Reactive Energy</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-[#172b4d] dark:text-white font-mono tracking-tight">{data.energy.ReactiveTotal.toFixed(1)}</span>
                      <span className="text-xs font-semibold text-[#8993a4] dark:text-[#64748b]">kVARh</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CHARTS */}
          {filters.uPhase && (
            <div key="uPhaseChart" className="flex">
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 flex flex-col h-full w-full bg-opacity-95 backdrop-blur">
                <div className={`flex items-center gap-3 mb-6 select-none transition-opacity ${isEditingLayout ? 'cursor-move drag-handle hover:opacity-80' : ''}`}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-[#0052cc] to-[#4c9aff] pointer-events-none">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-[#172b4d] dark:text-white font-heading flex-1">Phase Voltage Trend</h3>
                  {isEditingLayout && <GripHorizontal size={20} className="text-gray-400 mr-2" />}
                </div>
                <div className="flex-1 w-full h-full min-h-[100px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={true} />
                      <XAxis dataKey="time" stroke="#8898aa" fontSize={12} tickMargin={10} interval={5} />
                      <YAxis domain={[215, 240]} ticks={[215, 220, 225, 230, 235, 240]} stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Area fillOpacity={0.15} fill="#0052cc" type="monotone" dataKey="phaseA" name="Phase A" stroke="#0052cc" strokeWidth={2} dot={false} activeDot={{ r: 6 }}  />
                      <Area fillOpacity={0.15} fill="#00e676" type="monotone" dataKey="phaseB" name="Phase B" stroke="#00e676" strokeWidth={2} dot={false} activeDot={{ r: 6 }}  />
                      <Area fillOpacity={0.15} fill="#ff8b00" type="monotone" dataKey="phaseC" name="Phase C" stroke="#ff8b00" strokeWidth={2} dot={false} activeDot={{ r: 6 }}  />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {filters.uLine && (
            <div key="uLineChart" className="flex">
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 flex flex-col h-full w-full bg-opacity-95 backdrop-blur">
                <div className={`flex items-center gap-3 mb-6 select-none transition-opacity ${isEditingLayout ? 'cursor-move drag-handle hover:opacity-80' : ''}`}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-[#00b8d9] to-[#79f2ff] pointer-events-none">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-[#172b4d] dark:text-white font-heading flex-1">Line Voltage Trend (U Line)</h3>
                  {isEditingLayout && <GripHorizontal size={20} className="text-gray-400 mr-2" />}
                </div>
                <div className="flex-1 w-full h-full min-h-[100px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={true} />
                      <XAxis dataKey="time" stroke="#8898aa" fontSize={12} tickMargin={10} interval={5} />
                      <YAxis domain={[370, 410]} ticks={[370, 375, 380, 385, 390, 395, 400, 405, 410]} stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Area fillOpacity={0.15} fill="#00b8d9" type="monotone" dataKey="lineAB" name="Line AB" stroke="#00b8d9" strokeWidth={2} dot={false} activeDot={{ r: 6 }}  />
                      <Area fillOpacity={0.15} fill="#6554c0" type="monotone" dataKey="lineBC" name="Line BC" stroke="#6554c0" strokeWidth={2} dot={false} activeDot={{ r: 6 }}  />
                      <Area fillOpacity={0.15} fill="#ff5630" type="monotone" dataKey="lineCA" name="Line CA" stroke="#ff5630" strokeWidth={2} dot={false} activeDot={{ r: 6 }}  />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {filters.current && (
            <div key="currentChart" className="flex">
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 flex flex-col h-full w-full bg-opacity-95 backdrop-blur">
                <div className={`flex items-center gap-3 mb-6 select-none transition-opacity ${isEditingLayout ? 'cursor-move drag-handle hover:opacity-80' : ''}`}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-[#ff5630] to-[#ff9873] pointer-events-none">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-[#172b4d] dark:text-white font-heading flex-1">Current Trend</h3>
                  {isEditingLayout && <GripHorizontal size={20} className="text-gray-400 mr-2" />}
                </div>
                <div className="flex-1 w-full h-full min-h-[100px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={true} />
                      <XAxis dataKey="time" stroke="#8898aa" fontSize={12} tickMargin={10} interval={5} />
                      <YAxis domain={[0, 2500]} ticks={[0, 500, 1000, 1500, 2000, 2500]} stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Area fillOpacity={0.15} fill="#ff5630" type="monotone" dataKey="currentA" name="Current A" stroke="#ff5630" strokeWidth={2} dot={false} activeDot={{ r: 6 }}  />
                      <Area fillOpacity={0.15} fill="#6554c0" type="monotone" dataKey="currentB" name="Current B" stroke="#6554c0" strokeWidth={2} dot={false} activeDot={{ r: 6 }}  />
                      <Area fillOpacity={0.15} fill="#00b8d9" type="monotone" dataKey="currentC" name="Current C" stroke="#00b8d9" strokeWidth={2} dot={false} activeDot={{ r: 6 }}  />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Power Chart */}
          {filters.power && (
            <div key="powerChart" className="w-full h-full">
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 flex flex-col animate-[slideUpFade_0.4s_ease-out_0.4s] h-full w-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-[#8777d9] to-[#6554c0]">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-[#172b4d] dark:text-white font-heading flex-1">Power Trend</h3>
                  {isEditingLayout && <GripHorizontal size={20} className={`text-gray-400  transition-opacity ${isEditingLayout ? 'cursor-move drag-handle hover:opacity-80' : ''}`} />}
                </div>
                <div className="flex-1 w-full h-full min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={true} />
                      <XAxis dataKey="timestampMs" type="number" scale="time" domain={['dataMin', 'dataMax']} tickCount={20} tickFormatter={(time) => new Date(time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <YAxis domain={['dataMin', 'dataMax']} stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Area fillOpacity={0.15} fill="#6554c0" type="monotone" dataKey="powerActiveTotal" name="Active (kW)" stroke="#6554c0" strokeWidth={2} dot={false} activeDot={{ r: 6 }}  />
                      <Area fillOpacity={0.15} fill="#00b8d9" type="monotone" dataKey="powerReactiveTotal" name="Reactive (kVAR)" stroke="#00b8d9" strokeWidth={2} dot={false} activeDot={{ r: 6 }}  />
                      <Area fillOpacity={0.15} fill="#ffab00" type="monotone" dataKey="powerApparentTotal" name="Apparent (kVA)" stroke="#ffab00" strokeWidth={2} dot={false} activeDot={{ r: 6 }}  />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Frequency Chart */}
          {filters.frequency && (
            <div key="freqChart" className="w-full h-full">
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 flex flex-col animate-[slideUpFade_0.4s_ease-out_0.4s] h-full w-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-[#8950fc] to-[#a274fd]">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-[#172b4d] dark:text-white font-heading flex-1">Frequency Trend</h3>
                  {isEditingLayout && <GripHorizontal size={20} className={`text-gray-400  transition-opacity ${isEditingLayout ? 'cursor-move drag-handle hover:opacity-80' : ''}`} />}
                </div>
                <div className="flex-1 w-full h-full min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={true} />
                      <XAxis dataKey="timestampMs" type="number" scale="time" domain={['dataMin', 'dataMax']} tickCount={20} tickFormatter={(time) => new Date(time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <YAxis domain={[49, 55]} ticks={[49, 50, 51, 52, 53, 54, 55]} stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Area fillOpacity={0.15} fill="#8950fc" type="monotone" dataKey="frequency" name="Frequency (Hz)" stroke="#8950fc" strokeWidth={2} dot={false} activeDot={{ r: 6 }}  />
                      <ReferenceLine y={50} stroke="#cbd5e1" strokeDasharray="3 3" />
                      <ReferenceLine y={52.5} stroke="red" strokeDasharray="3 3" label={{ position: 'top', value: 'Limit (52.5)', fill: 'red', fontSize: 12 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Efficiency Chart */}
          {filters.efficiency && (
            <div key="efficiencyChart" className="w-full h-full">
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 flex flex-col animate-[slideUpFade_0.4s_ease-out_0.4s] h-full w-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-[#e83e8c] to-[#f06292]">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-[#172b4d] dark:text-white font-heading flex-1">Transformer Efficiency (%)</h3>
                  {isEditingLayout && <GripHorizontal size={20} className={`text-gray-400  transition-opacity ${isEditingLayout ? 'cursor-move drag-handle hover:opacity-80' : ''}`} />}
                </div>
                <div className="flex-1 w-full h-full min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={true} />
                      <XAxis dataKey="time" stroke="#8898aa" fontSize={12} tickMargin={10} interval={5} />
                      <YAxis domain={[95, 101]} ticks={[95, 96, 97, 98, 99, 100, 101]} stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Area fillOpacity={0.15} fill="#e83e8c" type="monotone" dataKey="efficiency" name="Efficiency (%)" stroke="#e83e8c" strokeWidth={2} dot={false} activeDot={{ r: 6 }}  />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </ResponsiveGridLayout>
      </div>

      {/* EXPORT EXCEL MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-[#151521] rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#172b4d] dark:text-white flex items-center gap-2">
                <Download size={20} className="text-green-500" />
                Export Excel
              </h3>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportError(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                Pilih rentang waktu untuk mengunduh seluruh data riwayat Electrical (tegangan, arus, daya, dsb.) ke dalam format Excel (.xlsx).
              </p>

              {exportError && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg border border-red-200 dark:border-red-800/30 text-sm font-semibold animate-[fadeIn_0.2s_ease-out]">
                  {exportError}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Mulai (Start)</label>
                <input
                  type="datetime-local"
                  value={exportStart}
                  onChange={(e) => setExportStart(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none focus:border-green-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Akhir (End)</label>
                <input
                  type="datetime-local"
                  value={exportEnd}
                  onChange={(e) => setExportEnd(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none focus:border-green-500 transition-colors"
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5">
              {isExporting ? (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8]">
                    <span className="flex items-center gap-2">
                      <span className="animate-spin inline-block w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full"></span>
                      Memproses & Mengunduh Data...
                    </span>
                    <span className="text-green-600 dark:text-green-400">{downloadMB} MB</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 left-0 h-full bg-green-500 rounded-full animate-[progress_1.5s_ease-in-out_infinite] w-[30%]"></div>
                  </div>
                  <style>{`
                    @keyframes progress {
                      0% { left: -30%; }
                      100% { left: 100%; }
                    }
                  `}</style>
                </div>
              ) : (
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowExportModal(false);
                      setExportError(null);
                    }}
                    className="px-4 py-2 rounded-lg font-semibold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleDownloadExcel}
                    disabled={isExporting}
                    className="px-5 py-2 rounded-lg font-semibold text-sm bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    Download Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
