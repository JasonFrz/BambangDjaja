import React, { useState, useEffect, useRef } from "react";
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { Thermometer, Gauge, Wifi, WifiOff, Filter, ChevronDown, RefreshCw, Activity } from "lucide-react";
import { useApi } from '../contexts/ApiContext';
import { useTemperatureData } from '../contexts/TemperatureDataContext';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import { GripHorizontal } from 'lucide-react';


const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'oilLevelCard', x: 0, y: 0, w: 4, h: 1, minW: 1, minH: 1 },
    { i: 'temperatureCard', x: 4, y: 0, w: 4, h: 1, minW: 1, minH: 1 },
    { i: 'pressureCard', x: 8, y: 0, w: 4, h: 1, minW: 1, minH: 1 },
    { i: 'temperatureChart', x: 0, y: 1, w: 6, h: 3, minW: 1, minH: 1 },
    { i: 'pressureChart', x: 6, y: 1, w: 6, h: 3, minW: 1, minH: 1 }
  ],
  md: [
    { i: 'oilLevelCard', x: 0, y: 0, w: 10, h: 1, minW: 1, minH: 1 },
    { i: 'temperatureCard', x: 0, y: 1, w: 5, h: 1, minW: 1, minH: 1 },
    { i: 'pressureCard', x: 5, y: 1, w: 5, h: 1, minW: 1, minH: 1 },
    { i: 'temperatureChart', x: 0, y: 2, w: 10, h: 3, minW: 1, minH: 1 },
    { i: 'pressureChart', x: 0, y: 5, w: 10, h: 3, minW: 1, minH: 1 }
  ],
  sm: [
    { i: 'oilLevelCard', x: 0, y: 0, w: 6, h: 1, minW: 1, minH: 1 },
    { i: 'temperatureCard', x: 0, y: 1, w: 6, h: 1, minW: 1, minH: 1 },
    { i: 'pressureCard', x: 0, y: 2, w: 6, h: 1, minW: 1, minH: 1 },
    { i: 'temperatureChart', x: 0, y: 3, w: 6, h: 3, minW: 1, minH: 1 },
    { i: 'pressureChart', x: 0, y: 6, w: 6, h: 3, minW: 1, minH: 1 }
  ]
};

const Temperature = () => {
  const { apiUrl } = useApi();
  const { liveData, data, isConnected, isLive } = useTemperatureData();


  // Filters State
  const [filters, setFilters] = useState({
    temperature: true,
    pressure: true,
    oilLevel: true
  });
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [warning, setWarning] = useState("");

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
    setFilters({ temperature: true, pressure: true, oilLevel: true });
  };

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
              {entry.name}: {entry.value.toFixed(3)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const activeCount = Object.values(filters).filter(Boolean).length;
  let gridColsClass = "grid-cols-1 md:grid-cols-3";
  if (activeCount === 1) gridColsClass = "grid-cols-1";
  else if (activeCount === 2) gridColsClass = "grid-cols-1 md:grid-cols-2";
  
  let chartGridColsClass = "grid-cols-1";
  
  const { width, containerRef } = useContainerWidth();
  const [layouts, setLayouts] = useState(() => {
    const savedLayouts = localStorage.getItem('dashboardLayouts_temp_v1');
    return savedLayouts ? JSON.parse(savedLayouts) : DEFAULT_LAYOUTS;
  });

  const handleLayoutChange = (currentLayout, allLayouts) => {
    const stringifiedLayouts = JSON.stringify(allLayouts);
    const savedLayouts = localStorage.getItem('dashboardLayouts_temp_v1');
    if (stringifiedLayouts !== savedLayouts) {
      setLayouts(allLayouts);
      localStorage.setItem('dashboardLayouts_temp_v1', stringifiedLayouts);
    }
  };

  const resetLayout = () => {
    setLayouts(DEFAULT_LAYOUTS);
    localStorage.removeItem('dashboardLayouts_temp_v1');
  };

  const chartActiveCount = [filters.temperature, filters.pressure].filter(Boolean).length;
  if (chartActiveCount > 1) chartGridColsClass = "grid-cols-1 lg:grid-cols-2";

  // Calculate Status
  const isPressSafe = data.oil_pressure <= 0.50;
  const isOilLevelSafe = data.oil_level === true;

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.5s_ease-out] w-full max-w-7xl mx-auto">
      
      {/* Header Section */}
      <div className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#172b4d] dark:text-white font-heading mb-1 transition-colors flex items-center gap-4">
            Temperature & Pressure
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-[#151521] border border-gray-200 dark:border-white/10 shadow-sm mt-1 sm:mt-0">
              <span className="text-sm font-semibold text-[#5e6c84] dark:text-[#94a3b8]">Overall Status:</span>
              <span className={`text-sm font-bold ${isPressSafe ? 'text-emerald-500' : 'text-red-500'}`}>
                {isPressSafe ? 'Safe' : 'Danger'}
              </span>
              <div className="relative w-3 h-3 ml-1">
                <div className={`absolute inset-0 rounded-full blur-sm opacity-80 animate-pulse ${isPressSafe ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                <div className={`relative w-3 h-3 rounded-full ${isPressSafe ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              </div>
            </div>
          </h2>
          <p className="text-[#5e6c84] dark:text-[#94a3b8] text-[0.95rem] transition-colors mt-1">
            Real-time Oil Monitoring & Trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${isConnected && isLive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 animate-glow-pulse" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
            {isConnected && isLive ? <Wifi size={16} /> : <WifiOff size={16} />}
            {isConnected && isLive ? "Live" : "Offline"}
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
                <button onClick={() => { resetLayout(); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors">
                  Reset Layout
                </button>
                <div className="h-px bg-gray-100 dark:bg-white/5 my-1 mx-2"></div>
                <button onClick={() => toggleFilter('temperature')} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-[#172b4d] dark:text-white">
                  <div className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${filters.temperature ? 'bg-orange-500 border-orange-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {filters.temperature && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <Thermometer size={14} className={filters.temperature ? 'text-orange-500' : 'text-gray-400'} /> Temperature
                </button>
                <button onClick={() => toggleFilter('pressure')} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-[#172b4d] dark:text-white">
                  <div className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${filters.pressure ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {filters.pressure && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <Gauge size={14} className={filters.pressure ? 'text-indigo-500' : 'text-gray-400'} /> Pressure
                </button>
                <button onClick={() => toggleFilter('oilLevel')} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-[#172b4d] dark:text-white">
                  <div className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${filters.oilLevel ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {filters.oilLevel && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <Activity size={14} className={filters.oilLevel ? 'text-emerald-500' : 'text-gray-400'} /> Oil Level
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col xl:flex-row justify-between items-start gap-4 mb-6">
          {/* Desktop Filter Bar */}
          <div className="hidden md:flex items-center gap-3 bg-white/40 dark:bg-[#151521]/60 backdrop-blur-xl border border-white/40 dark:border-white/10 p-2 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-2 px-3 py-2 text-[#5e6c84] dark:text-[#94a3b8] font-medium text-sm whitespace-nowrap border-r border-gray-200 dark:border-white/10 mr-1">
              <Filter size={16} /> Views
            </div>
            
            <button 
              onClick={showAll}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeCount === 3 
                  ? 'bg-gray-800 text-white dark:bg-white dark:text-black shadow-md scale-100'
                  : 'bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:scale-105'
              }`}
            >
              Show All
            </button>

            <button 
              onClick={resetLayout}
              className="whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:scale-105 flex items-center gap-1"
            >
              <RefreshCw size={14} /> Reset Layout
            </button>

            <button 
              onClick={() => toggleFilter('temperature')}
              className={`whitespace-nowrap px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all duration-300 ${
                filters.temperature 
                  ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 border-orange-200 dark:border-orange-500/30 shadow-sm border'
                  : 'bg-transparent text-gray-400 border border-transparent hover:bg-gray-50 dark:hover:bg-white/5 opacity-60'
              }`}
            >
              <Thermometer size={14} className={filters.temperature ? 'animate-pulse' : ''} /> Temperature
            </button>

            <button 
              onClick={() => toggleFilter('pressure')}
              className={`whitespace-nowrap px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all duration-300 ${
                filters.pressure 
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30 shadow-sm border'
                  : 'bg-transparent text-gray-400 border border-transparent hover:bg-gray-50 dark:hover:bg-white/5 opacity-60'
              }`}
            >
              <Gauge size={14} className={filters.pressure ? 'animate-pulse' : ''} /> Pressure
            </button>

            <button 
              onClick={() => toggleFilter('oilLevel')}
              className={`whitespace-nowrap px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all duration-300 ${
                filters.oilLevel 
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 shadow-sm border'
                  : 'bg-transparent text-gray-400 border border-transparent hover:bg-gray-50 dark:hover:bg-white/5 opacity-60'
              }`}
            >
              <Activity size={14} className={filters.oilLevel ? 'animate-pulse' : ''} /> Oil Level
            </button>
          </div>

        </div>
        {filterError && (
          <span className="text-red-500 dark:text-red-400 text-sm font-medium mb-4 block animate-[fadeIn_0.3s_ease-out]">
            {filterError}
          </span>
        )}
      </div>

      {/* MONITORING CARDS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-2 mb-6 gap-2">
        <h3 className="text-xl font-bold text-[#172b4d] dark:text-white font-heading">Real-time Monitoring</h3>
      </div>

      {(filters.temperature || filters.pressure) && (
            <div className="flex flex-col gap-4 mt-8 mb-4">
              <h3 className="text-xl font-bold text-[#172b4d] dark:text-white font-heading">Historical Trends</h3>
              
              {/* Date Time Filter for Charts - Responsive */}
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
      <div ref={containerRef}>
        <ResponsiveGridLayout
          className="layout -mx-2 mt-4"
          width={width}
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={180}
          compactType="horizontal"
          preventCollision={false}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
          margin={[10, 10]}
        >
        {/* Oil Level Card (Always visible) */}
        {filters.oilLevel && (
          <div key="oilLevelCard" className="w-full h-full">
        <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md flex flex-col group relative overflow-hidden animate-[slideUpFade_0.4s_ease-out] h-full w-full">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 dark:bg-emerald-400/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#36b37e] to-[#57d9a3] flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Activity size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight text-lg flex-1">Oil Level</h3>
                <GripHorizontal size={20} className="text-gray-400 drag-handle cursor-move hover:opacity-80 transition-opacity" />
              <p className="text-sm text-[#5e6c84] dark:text-[#94a3b8]">Live reading from ADC</p>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold font-mono tracking-tighter ${isOilLevelSafe ? 'text-emerald-500' : 'text-red-500'}`}>
                {isOilLevelSafe ? 'Active' : 'Non Active'}
              </span>
            </div>
          </div>
        </div>
        </div>
        )}
        {/* Temperature Card */}
        {filters.temperature && (
          <div key="temperatureCard" className="w-full h-full">
          <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md flex flex-col group relative overflow-hidden animate-[slideUpFade_0.4s_ease-out] h-full w-full">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 dark:bg-orange-400/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff5630] to-[#ff8b00] flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                <Thermometer size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight text-lg flex-1">Oil Temperature</h3>
                <GripHorizontal size={20} className="text-gray-400 drag-handle cursor-move hover:opacity-80 transition-opacity" />
                <p className="text-sm text-[#5e6c84] dark:text-[#94a3b8]">Live reading from ADC</p>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-[#172b4d] dark:text-white font-mono tracking-tighter">
                  {data.oil_temperature.toFixed(2)}
                </span>
                <span className="text-xl font-semibold text-[#8993a4] dark:text-[#64748b]">°C</span>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Pressure Card */}
        {filters.pressure && (
          <div key="pressureCard" className="w-full h-full">
          <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md flex flex-col group relative overflow-hidden animate-[slideUpFade_0.4s_ease-out_0.1s] h-full w-full">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 dark:bg-indigo-400/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6554c0] to-[#8777d9] flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <Gauge size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight text-lg flex-1">Oil Pressure</h3>
                <GripHorizontal size={20} className="text-gray-400 drag-handle cursor-move hover:opacity-80 transition-opacity" />
                <p className="text-sm text-[#5e6c84] dark:text-[#94a3b8]">Live reading from ADC</p>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-[#172b4d] dark:text-white font-mono tracking-tighter">
                  {data.oil_pressure.toFixed(3)}
                </span>
                <span className="text-xl font-semibold text-[#8993a4] dark:text-[#64748b]">Bar</span>
              </div>
            </div>
          </div>
        </div>
        )}
      {/* TREND CHARTS */}{/* Temperature Chart */}
            {filters.temperature && (
              <div key="temperatureChart" className="w-full h-full">
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 flex flex-col animate-[slideUpFade_0.4s_ease-out] h-full w-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-[#ff5630] to-[#ff8b00]">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-[#172b4d] dark:text-white font-heading flex-1">Temperature Trend</h3>
                  <GripHorizontal size={20} className="text-gray-400 drag-handle cursor-move hover:opacity-80 transition-opacity" />
                </div>
                <div className="flex-1 w-full h-full min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="time" stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <YAxis domain={['auto', 'auto']} stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Line type="monotone" dataKey="oil_temperature" name="Oil Temperature (°C)" stroke="#ff5630" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            )}

            {/* Pressure Chart */}
            {filters.pressure && (
              <div key="pressureChart" className="w-full h-full">
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 flex flex-col animate-[slideUpFade_0.4s_ease-out_0.1s] h-full w-full">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-[#6554c0] to-[#8777d9]">
                      <Activity size={20} />
                    </div>
                    <h3 className="text-lg font-semibold text-[#172b4d] dark:text-white font-heading flex-1">Pressure Trend</h3>
                  <GripHorizontal size={20} className="text-gray-400 drag-handle cursor-move hover:opacity-80 transition-opacity" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${isPressSafe ? 'text-emerald-500' : 'text-red-500'}`}>
                      {isPressSafe ? 'Safe' : 'Danger'}
                    </span>
                    <div className="relative w-4 h-4">
                      <div className={`absolute inset-0 rounded-full blur-sm opacity-80 animate-pulse ${isPressSafe ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      <div className={`relative w-4 h-4 rounded-full ${isPressSafe ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 w-full h-full min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="time" stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <YAxis domain={['auto', 'auto']} stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <ReferenceLine y={0.50} stroke="red" strokeDasharray="3 3" label={{ position: 'top', value: 'Limit (0.50)', fill: 'red', fontSize: 12 }} />
                      <Line type="monotone" dataKey="oil_pressure" name="Oil Pressure (Bar)" stroke="#6554c0" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
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

export default Temperature;
