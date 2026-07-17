import React, { useState, useEffect } from "react";
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { Link, useLocation } from "react-router-dom";
import { Zap, Activity, Waves, Gauge, Wifi, WifiOff, Filter, ChevronDown, RefreshCw, Settings, GripHorizontal } from "lucide-react";
import { useTrendData } from "../contexts/TrendDataContext";
import { useApi } from '../contexts/ApiContext';

import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';



const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'uPhaseCard', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'uLineCard', x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'currentCard', x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'freqCard', x: 9, y: 0, w: 3, h: 1, minW: 2, minH: 1 },
    { i: 'energyCard', x: 9, y: 1, w: 3, h: 1, minW: 2, minH: 1 },
    { i: 'uPhaseChart', x: 0, y: 2, w: 6, h: 3, minW: 4, minH: 2 },
    { i: 'uLineChart', x: 6, y: 2, w: 6, h: 3, minW: 4, minH: 2 },
    { i: 'currentChart', x: 0, y: 5, w: 6, h: 3, minW: 4, minH: 2 },
    { i: 'freqChart', x: 6, y: 5, w: 6, h: 3, minW: 4, minH: 2 }
  ],
  md: [
    { i: 'uPhaseCard', x: 0, y: 0, w: 5, h: 2, minW: 3, minH: 2 },
    { i: 'uLineCard', x: 5, y: 0, w: 5, h: 2, minW: 3, minH: 2 },
    { i: 'currentCard', x: 0, y: 2, w: 5, h: 2, minW: 3, minH: 2 },
    { i: 'freqCard', x: 5, y: 2, w: 5, h: 1, minW: 3, minH: 1 },
    { i: 'energyCard', x: 5, y: 3, w: 5, h: 1, minW: 3, minH: 1 },
    { i: 'uPhaseChart', x: 0, y: 4, w: 10, h: 3, minW: 4, minH: 2 },
    { i: 'uLineChart', x: 0, y: 7, w: 10, h: 3, minW: 4, minH: 2 },
    { i: 'currentChart', x: 0, y: 10, w: 10, h: 3, minW: 4, minH: 2 },
    { i: 'freqChart', x: 0, y: 13, w: 10, h: 3, minW: 4, minH: 2 }
  ],
  sm: [
    { i: 'uPhaseCard', x: 0, y: 0, w: 6, h: 2, minW: 2, minH: 2 },
    { i: 'uLineCard', x: 0, y: 2, w: 6, h: 2, minW: 2, minH: 2 },
    { i: 'currentCard', x: 0, y: 4, w: 6, h: 2, minW: 2, minH: 2 },
    { i: 'freqCard', x: 0, y: 6, w: 6, h: 1, minW: 2, minH: 1 },
    { i: 'energyCard', x: 0, y: 7, w: 6, h: 1, minW: 2, minH: 1 },
    { i: 'uPhaseChart', x: 0, y: 8, w: 6, h: 3, minW: 3, minH: 2 },
    { i: 'uLineChart', x: 0, y: 11, w: 6, h: 3, minW: 3, minH: 2 },
    { i: 'currentChart', x: 0, y: 14, w: 6, h: 3, minW: 3, minH: 2 },
    { i: 'freqChart', x: 0, y: 17, w: 6, h: 3, minW: 3, minH: 2 }
  ]
};

const Dashboard = () => {
  // Shared context
  const { liveData, wsData, isConnected, isLive } = useTrendData();
  const { apiUrl } = useApi();

  // Unified Filter State for both Monitoring and Charts
  const [filters, setFilters] = useState({
    uPhase: true,
    uLine: true,
    current: true,
    power: true,
    frequency: true
  });
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [warning, setWarning] = useState("");
  const { width, containerRef } = useContainerWidth();

  const [layouts, setLayouts] = useState(() => {
    const savedLayouts = localStorage.getItem('dashboardLayouts_v3');
    return savedLayouts ? JSON.parse(savedLayouts) : DEFAULT_LAYOUTS;
  });

  const handleLayoutChange = (currentLayout, allLayouts) => {
    const stringifiedLayouts = JSON.stringify(allLayouts);
    const savedLayouts = localStorage.getItem('dashboardLayouts_v3');
    if (stringifiedLayouts !== savedLayouts) {
      setLayouts(allLayouts);
      localStorage.setItem('dashboardLayouts_v3', stringifiedLayouts);
    }
  };

  const resetLayout = () => {
    setLayouts(DEFAULT_LAYOUTS);
    localStorage.removeItem('dashboardLayouts_v3');
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
    setFilters({ uPhase: true, uLine: true, current: true, power: true, frequency: true });
  };

  // Monitoring Data State
  const [data, setData] = useState({
    vPhase: { A: 0.0, B: 0.0, C: 0.0 },
    vLine: { AB: 0.0, BC: 0.0, CA: 0.0 },
    current: { A: 0.0, B: 0.0, C: 0.0 },
    frequency: 0.0,
    power: 0.0,
    energy: 0.0,
    efficiency: 0.0,
  });

  useEffect(() => {
    if (wsData && wsData.vPhase && wsData.vLine) {
      setData(wsData);
    }
  }, [wsData]);

  // Trends Data State
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Date/Time Filter for Charts
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterError, setFilterError] = useState(null);

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
      setError("Failed to load trend data.");
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

  useEffect(() => {
    if (isFiltering) {
      fetchTrends();
    }
    setLoading(false);
  }, [isFiltering]);

  const chartData = isFiltering ? trendData : liveData;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#151521] border border-[#dfe1e6] dark:border-white/10 p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-[#172b4d] dark:text-white mb-2">{label}</p>
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

  // Calculate Overall Status based on Frequency
  const isFreqSafe = data.frequency <= 52.5;

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.5s_ease-out] w-full max-w-7xl mx-auto">
      
      {/* Header Section */}
      <div className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#172b4d] dark:text-white font-heading mb-1 transition-colors flex items-center gap-4">
            Voltage Dashboard
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

      {/* Unified Filter Bar */}
      <div className="relative z-20 -mx-4 px-4 sm:mx-0 sm:px-0 mb-2">
        {/* Mobile Dropdown */}
        <div className="md:hidden relative w-full mb-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-full flex items-center justify-between bg-white/60 dark:bg-[#151521]/80 backdrop-blur-xl border border-white/40 dark:border-white/10 px-4 py-3 rounded-xl shadow-sm text-sm font-semibold text-[#172b4d] dark:text-white"
          >
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-[#5e6c84] dark:text-[#94a3b8]" />
              <span>View Filters ({activeCount} Active)</span>
            </div>
            <ChevronDown size={16} className={`transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isMobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#151521] border border-gray-100 dark:border-white/10 rounded-xl shadow-xl overflow-hidden animate-[slideUpFade_0.2s_ease-out] z-50">
              <div className="p-2 space-y-1">
                <button onClick={() => { showAll(); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors">
                  Show All
                </button>
                <div className="h-px bg-gray-100 dark:bg-white/5 my-1 mx-2"></div>
                <button onClick={() => toggleFilter('uPhase')} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-[#172b4d] dark:text-white">
                  <div className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${filters.uPhase ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {filters.uPhase && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <Zap size={14} className={filters.uPhase ? 'text-blue-500' : 'text-gray-400'} /> U Phase
                </button>
                <button onClick={() => toggleFilter('uLine')} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-[#172b4d] dark:text-white">
                  <div className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${filters.uLine ? 'bg-cyan-500 border-cyan-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {filters.uLine && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <Activity size={14} className={filters.uLine ? 'text-cyan-500' : 'text-gray-400'} /> U Line
                </button>
                <button onClick={() => toggleFilter('current')} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-[#172b4d] dark:text-white">
                  <div className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${filters.current ? 'bg-amber-500 border-amber-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {filters.current && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <Waves size={14} className={filters.current ? 'text-amber-500' : 'text-gray-400'} /> Current
                </button>
                <button onClick={() => toggleFilter('power')} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-[#172b4d] dark:text-white">
                  <div className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${filters.power ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {filters.power && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <Gauge size={14} className={filters.power ? 'text-indigo-500' : 'text-gray-400'} /> Freq & Energy
                </button>
                <button onClick={() => toggleFilter('frequency')} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-[#172b4d] dark:text-white">
                  <div className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${filters.frequency ? 'bg-purple-500 border-purple-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {filters.frequency && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <Activity size={14} className={filters.frequency ? 'text-purple-500' : 'text-gray-400'} /> Frequency Chart
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col xl:flex-row justify-between items-start gap-4 mb-6">
          {/* Desktop Filter Bar */}
          <div className="hidden md:flex items-stretch gap-1 bg-white/40 dark:bg-[#151521]/60 backdrop-blur-xl border border-white/40 dark:border-white/10 p-2 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-2 px-3 py-2 text-[#5e6c84] dark:text-[#94a3b8] font-medium text-sm whitespace-nowrap border-r border-gray-200 dark:border-white/10 mr-2">
              <Filter size={16} /> Views
            </div>
            
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <button 
                onClick={resetLayout}
                className="whitespace-nowrap px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all duration-300 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20"
              >
                <RefreshCw size={14} /> Reset Layout
              </button>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>
              <button 
                onClick={showAll}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  activeCount === 5 
                    ? 'bg-gray-800 text-white dark:bg-white dark:text-black shadow-md scale-100'
                    : 'bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:scale-105'
                }`}
              >
                Show All
              </button>

              <button 
                onClick={() => toggleFilter('uPhase')}
                className={`whitespace-nowrap px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all duration-300 ${
                  filters.uPhase 
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-500/30 shadow-sm border'
                    : 'bg-transparent text-gray-400 border border-transparent hover:bg-gray-50 dark:hover:bg-white/5 opacity-60'
                }`}
              >
                <Zap size={14} className={filters.uPhase ? 'animate-pulse' : ''} /> U Phase
              </button>

              <button 
                onClick={() => toggleFilter('uLine')}
                className={`whitespace-nowrap px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all duration-300 ${
                  filters.uLine 
                    ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30 shadow-sm border'
                    : 'bg-transparent text-gray-400 border border-transparent hover:bg-gray-50 dark:hover:bg-white/5 opacity-60'
                }`}
              >
                <Activity size={14} className={filters.uLine ? 'animate-pulse' : ''} /> U Line
              </button>

              <button 
                onClick={() => toggleFilter('current')}
                className={`whitespace-nowrap px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all duration-300 ${
                  filters.current 
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30 shadow-sm border'
                    : 'bg-transparent text-gray-400 border border-transparent hover:bg-gray-50 dark:hover:bg-white/5 opacity-60'
                }`}
              >
                <Waves size={14} className={filters.current ? 'animate-pulse' : ''} /> Current
              </button>

              <button 
                onClick={() => toggleFilter('power')}
                className={`whitespace-nowrap px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all duration-300 ${
                  filters.power 
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30 shadow-sm border'
                    : 'bg-transparent text-gray-400 border border-transparent hover:bg-gray-50 dark:hover:bg-white/5 opacity-60'
                }`}
              >
                <Gauge size={14} className={filters.power ? 'animate-pulse' : ''} /> Freq & Energy
              </button>

              <button 
                onClick={() => toggleFilter('frequency')}
                className={`whitespace-nowrap px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all duration-300 ${
                  filters.frequency 
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-200 dark:border-purple-500/30 shadow-sm border'
                    : 'bg-transparent text-gray-400 border border-transparent hover:bg-gray-50 dark:hover:bg-white/5 opacity-60'
                }`}
              >
                <Activity size={14} className={filters.frequency ? 'animate-pulse' : ''} /> Frequency Chart
              </button>
            </div>
          </div>

        </div>
        {filterError && (
          <span className="text-red-500 dark:text-red-400 text-sm font-medium mb-4 block animate-[fadeIn_0.3s_ease-out]">
            {filterError}
          </span>
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
            <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-[#dfe1e6] dark:border-white/10 pt-2.5 sm:pt-0 sm:pl-3 w-full md:w-auto mt-1 sm:mt-0">
              <button 
                onClick={handleApplyFilter}
                className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors ${
                  isFiltering ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-[#0052cc] text-white hover:bg-[#0047b3]'
                }`}
              >
                {isFiltering ? 'Filter Aktif' : 'Filter Chart'}
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
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800/30 mt-2 mb-4">
          {error}
        </div>
      )}

      {/* DASHBOARD DRAGGABLE GRID */}
      <div ref={containerRef}>
      <ResponsiveGridLayout
        className="layout -mx-2 mt-4"
        width={width}
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={140}
        compactType="horizontal"
        preventCollision={false}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".drag-handle"
        margin={[16, 16]}
      >
        
        {filters.uPhase && (
          <div key="uPhaseCard" className="flex">
            <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md h-full w-full flex flex-col group relative overflow-hidden bg-opacity-95 backdrop-blur">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 dark:bg-blue-400/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <div className="flex items-center gap-3 mb-5 cursor-move drag-handle select-none hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0052cc] to-[#4c9aff] flex items-center justify-center text-white shadow-lg shadow-blue-500/20 pointer-events-none">
                  <Zap size={20} />
                </div>
                <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">Phase Voltage (U Phase)</h3>
                <GripHorizontal size={20} className="text-gray-400 mr-2" />
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
              <div className="flex items-center gap-3 mb-5 cursor-move drag-handle select-none hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00b8d9] to-[#36c9e5] flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 pointer-events-none">
                  <Activity size={20} />
                </div>
                <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">Line Voltage (U Line)</h3>
                <GripHorizontal size={20} className="text-gray-400 mr-2" />
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
              <div className="flex items-center gap-3 mb-5 cursor-move drag-handle select-none hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffab00] to-[#ffc400] flex items-center justify-center text-white shadow-lg shadow-amber-500/20 pointer-events-none">
                  <Waves size={20} />
                </div>
                <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">Current (I)</h3>
                <GripHorizontal size={20} className="text-gray-400 mr-2" />
              </div>
              <div className="space-y-3 flex-1 flex flex-col justify-center">
                {["A", "B", "C"].map((phase) => (
                  <div key={phase} className="flex justify-between items-center p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                    <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-sm">Phase {phase}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-[#172b4d] dark:text-white font-mono">{data.current[phase].toFixed(3)}</span>
                      <span className="text-xs font-semibold text-[#8993a4] dark:text-[#64748b]">A</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {filters.power && (
          <div key="freqCard" className="flex">
            <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md h-full w-full group relative overflow-hidden flex flex-col bg-opacity-95 backdrop-blur">
              <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 dark:bg-indigo-400/5 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110"></div>
              <div className="flex items-center gap-3 mb-4 cursor-move drag-handle select-none hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6554c0] to-[#8777d9] flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 pointer-events-none">
                  <Gauge size={20} />
                </div>
                <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">Frequency</h3>
                <GripHorizontal size={20} className="text-gray-400 mr-2" />
              </div>
              <div className="mt-auto flex items-baseline gap-1">
                <span className="text-3xl font-bold text-[#172b4d] dark:text-white font-mono tracking-tight">{data.frequency.toFixed(2)}</span>
                <span className="text-sm font-semibold text-[#8993a4] dark:text-[#64748b]">Hz</span>
              </div>
            </div>
          </div>
        )}

        {filters.power && (
          <div key="energyCard" className="flex">
            <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md h-full w-full group relative overflow-hidden flex flex-col bg-opacity-95 backdrop-blur">
              <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 dark:bg-emerald-400/5 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110"></div>
              <div className="flex items-center gap-3 mb-4 cursor-move drag-handle select-none hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#36b37e] to-[#57d9a3] flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 pointer-events-none">
                  <Activity size={20} />
                </div>
                <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">Total Active Energy</h3>
                <GripHorizontal size={20} className="text-gray-400 mr-2" />
              </div>
              <div className="mt-auto flex items-baseline gap-1">
                <span className="text-3xl font-bold text-[#172b4d] dark:text-white font-mono tracking-tight">{data.energy.toFixed(1)}</span>
                <span className="text-sm font-semibold text-[#8993a4] dark:text-[#64748b]">kWh</span>
              </div>
            </div>
          </div>
        )}

        {/* CHARTS */}
        {filters.uPhase && (
          <div key="uPhaseChart" className="flex">
            <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 flex flex-col h-full w-full bg-opacity-95 backdrop-blur">
              <div className="flex items-center gap-3 mb-6 cursor-move drag-handle select-none hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-[#0052cc] to-[#4c9aff] pointer-events-none">
                  <Activity size={20} />
                </div>
                <h3 className="text-lg font-semibold text-[#172b4d] dark:text-white font-heading flex-1">Phase Voltage Trend</h3>
                <GripHorizontal size={20} className="text-gray-400 mr-2" />
              </div>
              <div className="flex-1 w-full h-full min-h-[100px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="time" stroke="#8898aa" fontSize={12} tickMargin={10} />
                    <YAxis domain={['auto', 'auto']} stroke="#8898aa" fontSize={12} tickMargin={10} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line type="monotone" dataKey="phaseA" name="Phase A" stroke="#0052cc" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="phaseB" name="Phase B" stroke="#00e676" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="phaseC" name="Phase C" stroke="#ff8b00" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {filters.uLine && (
          <div key="uLineChart" className="flex">
            <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 flex flex-col h-full w-full bg-opacity-95 backdrop-blur">
              <div className="flex items-center gap-3 mb-6 cursor-move drag-handle select-none hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-[#00b8d9] to-[#79f2ff] pointer-events-none">
                  <Activity size={20} />
                </div>
                <h3 className="text-lg font-semibold text-[#172b4d] dark:text-white font-heading flex-1">Line Voltage Trend (U Line)</h3>
                <GripHorizontal size={20} className="text-gray-400 mr-2" />
              </div>
              <div className="flex-1 w-full h-full min-h-[100px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="time" stroke="#8898aa" fontSize={12} tickMargin={10} />
                    <YAxis domain={['auto', 'auto']} stroke="#8898aa" fontSize={12} tickMargin={10} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line type="monotone" dataKey="lineAB" name="Line AB" stroke="#00b8d9" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="lineBC" name="Line BC" stroke="#6554c0" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="lineCA" name="Line CA" stroke="#ff5630" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {filters.current && (
          <div key="currentChart" className="flex">
            <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 flex flex-col h-full w-full bg-opacity-95 backdrop-blur">
              <div className="flex items-center gap-3 mb-6 cursor-move drag-handle select-none hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-[#ff5630] to-[#ff9873] pointer-events-none">
                  <Activity size={20} />
                </div>
                <h3 className="text-lg font-semibold text-[#172b4d] dark:text-white font-heading flex-1">Current Trend</h3>
                <GripHorizontal size={20} className="text-gray-400 mr-2" />
              </div>
              <div className="flex-1 w-full h-full min-h-[100px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="time" stroke="#8898aa" fontSize={12} tickMargin={10} />
                    <YAxis domain={['auto', 'auto']} stroke="#8898aa" fontSize={12} tickMargin={10} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line type="monotone" dataKey="currentA" name="Current A" stroke="#ff5630" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="currentB" name="Current B" stroke="#6554c0" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="currentC" name="Current C" stroke="#00b8d9" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {filters.frequency && (
          <div key="freqChart" className="flex">
            <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 flex flex-col h-full w-full bg-opacity-95 backdrop-blur">
              <div className="flex items-center justify-between mb-6 cursor-move drag-handle select-none hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-[#6554c0] to-[#998dd9] pointer-events-none">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-[#172b4d] dark:text-white font-heading">Frequency Trend</h3>
                </div>
                <div className="flex items-center gap-2 mr-4">
                  <span className={`text-sm font-bold ${isFreqSafe ? 'text-emerald-500' : 'text-red-500'}`}>
                    {isFreqSafe ? 'Safe' : 'Danger'}
                  </span>
                  <div className="relative w-4 h-4">
                    <div className={`absolute inset-0 rounded-full blur-sm opacity-80 animate-pulse ${isFreqSafe ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                    <div className={`relative w-4 h-4 rounded-full ${isFreqSafe ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  </div>
                </div>
                <GripHorizontal size={20} className="text-gray-400 mr-2" />
              </div>
              <div className="flex-1 w-full h-full min-h-[100px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="time" stroke="#8898aa" fontSize={12} tickMargin={10} />
                    <YAxis domain={['auto', 'auto']} stroke="#8898aa" fontSize={12} tickMargin={10} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <ReferenceLine y={52.5} stroke="red" strokeDasharray="3 3" label={{ position: 'top', value: 'Limit (52.5)', fill: 'red', fontSize: 12 }} />
                    <Line type="monotone" dataKey="frequency" name="Frequency (Hz)" stroke="#6554c0" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </ResponsiveGridLayout>
      </div>

    </div>
  );
};

export default Dashboard;

