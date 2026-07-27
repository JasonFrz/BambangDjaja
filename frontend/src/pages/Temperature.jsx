import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { Thermometer, Gauge, Wifi, WifiOff, Filter, ChevronDown, RefreshCw, Activity, Settings, Edit3, GripHorizontal } from "lucide-react";
import { useApi } from '../contexts/ApiContext';
import { useTemperatureData } from '../contexts/TemperatureDataContext';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';


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

  const [trendData, setTrendData] = useState([]);
  const [dataInterval, setDataInterval] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Date/Time Filter for Charts
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterError, setFilterError] = useState(null);
  
  // Layout Management State
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
  const STORAGE_KEY_TEMP = 'dashboardLayouts_temp_v4';
  const ALL_KEYS_TEMP = useMemo(() => ['oilLevelCard', 'temperatureCard', 'pressureCard', 'temperatureChart', 'pressureChart'], []);

  const [layouts, setLayouts] = useState(() => {
    const savedLayouts = localStorage.getItem('dashboardLayouts_temp_v4');
    return savedLayouts ? JSON.parse(savedLayouts) : DEFAULT_LAYOUTS;
  });

  const filterKey = useMemo(() => Object.values(filters).map(v => v ? '1' : '0').join(''), [filters]);

  const handleLayoutChange = useCallback((currentLayout, allLayouts) => {
    setLayouts(prev => {
      const merged = {};
      Object.keys(DEFAULT_LAYOUTS).forEach(bp => {
        const rglItems = allLayouts[bp] || [];
        const rglMap = new Map(rglItems.map(item => [item.i, { ...item }]));
        
        merged[bp] = ALL_KEYS_TEMP.map(key => {
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
      
      localStorage.setItem('dashboardLayouts_temp_v4', newStr);
      return merged;
    });
  }, [ALL_KEYS_TEMP]);

  const resetLayout = () => {
    setLayouts(DEFAULT_LAYOUTS);
    localStorage.removeItem('dashboardLayouts_temp_v4');
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
            Dashboard Physical
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/10 cursor-pointer transition-all">
            <input type="checkbox" checked={filters.temperature} onChange={() => toggleFilter('temperature')} className="w-4 h-4 text-[#0052cc] rounded border-gray-300 focus:ring-[#0052cc]" />
            <span className="text-sm font-medium text-[#172b4d] dark:text-white">Temperature</span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/10 cursor-pointer transition-all">
            <input type="checkbox" checked={filters.pressure} onChange={() => toggleFilter('pressure')} className="w-4 h-4 text-[#0052cc] rounded border-gray-300 focus:ring-[#0052cc]" />
            <span className="text-sm font-medium text-[#172b4d] dark:text-white">Pressure</span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/10 cursor-pointer transition-all">
            <input type="checkbox" checked={filters.oilLevel} onChange={() => toggleFilter('oilLevel')} className="w-4 h-4 text-[#0052cc] rounded border-gray-300 focus:ring-[#0052cc]" />
            <span className="text-sm font-medium text-[#172b4d] dark:text-white">Oil Level</span>
          </label>
        </div>
        {filterError && (
          <span className="text-red-500 dark:text-red-400 text-sm font-medium mt-3 block animate-[fadeIn_0.3s_ease-out]">
            {filterError}
          </span>
        )}
      </div>

      {(filters.temperature || filters.pressure) && (
            <div className="flex flex-col gap-4 mb-4">
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
                      className={`flex-1 lg:flex-none whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors ${
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
            </div>
          )}
      <div ref={containerRef} className={isEditingLayout ? 'ring-2 ring-[#0052cc] ring-opacity-50 rounded-xl p-1 bg-[#0052cc]/5 dark:bg-[#0052cc]/10 transition-all' : 'transition-all'}>
        <ResponsiveGridLayout
          key={filterKey}
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
          isDraggable={isEditingLayout}
          isResizable={isEditingLayout}
        >
        {/* Oil Level Card (Always visible) */}
        {filters.oilLevel && (
          <div key="oilLevelCard" className="w-full h-full">
        <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md flex flex-col group relative overflow-hidden h-full w-full bg-opacity-95 backdrop-blur animate-[slideUpFade_0.4s_ease-out]">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 dark:bg-emerald-400/5 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center gap-3 mb-4 cursor-move drag-handle select-none hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#36b37e] to-[#57d9a3] flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 pointer-events-none">
              <Activity size={20} />
            </div>
            <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">Oil Level</h3>
            <GripHorizontal size={20} className="text-gray-400 mr-2" />
          </div>
          <div className="mt-auto flex items-baseline gap-1">
            <span className={`text-3xl font-bold font-mono tracking-tight ${isOilLevelSafe ? 'text-emerald-500' : 'text-red-500'}`}>
              {isOilLevelSafe ? 'Active' : 'Non Active'}
            </span>
          </div>
        </div>
        </div>
        )}
        {/* Temperature Card */}
        {filters.temperature && (
          <div key="temperatureCard" className="w-full h-full">
          <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md flex flex-col group relative overflow-hidden h-full w-full bg-opacity-95 backdrop-blur animate-[slideUpFade_0.4s_ease-out]">
            <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 dark:bg-orange-400/5 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center gap-3 mb-4 cursor-move drag-handle select-none hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff5630] to-[#ff8b00] flex items-center justify-center text-white shadow-lg shadow-orange-500/20 pointer-events-none">
                <Thermometer size={20} />
              </div>
              <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">Oil Temp</h3>
              <GripHorizontal size={20} className="text-gray-400 mr-2" />
            </div>
            <div className="mt-auto flex items-baseline gap-1">
              <span className="text-3xl font-bold text-[#172b4d] dark:text-white font-mono tracking-tight">
                {data.oil_temperature.toFixed(2)}
              </span>
              <span className="text-sm font-semibold text-[#8993a4] dark:text-[#64748b]">°C</span>
            </div>
          </div>
        </div>
        )}

        {/* Pressure Card */}
        {filters.pressure && (
          <div key="pressureCard" className="w-full h-full">
          <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md flex flex-col group relative overflow-hidden h-full w-full bg-opacity-95 backdrop-blur animate-[slideUpFade_0.4s_ease-out_0.1s]">
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 dark:bg-indigo-400/5 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center gap-3 mb-4 cursor-move drag-handle select-none hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6554c0] to-[#8777d9] flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 pointer-events-none">
                <Gauge size={20} />
              </div>
              <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">Oil Pressure</h3>
              <GripHorizontal size={20} className="text-gray-400 mr-2" />
            </div>
            <div className="mt-auto flex items-baseline gap-1">
              <span className="text-3xl font-bold text-[#172b4d] dark:text-white font-mono tracking-tight">
                {data.oil_pressure.toFixed(3)}
              </span>
              <span className="text-sm font-semibold text-[#8993a4] dark:text-[#64748b]">Bar</span>
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
                      <XAxis dataKey="timestampMs" type="number" scale="time" domain={['dataMin', 'dataMax']} tickCount={20} tickFormatter={(time) => new Date(time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <YAxis domain={[0, 150]} stroke="#8898aa" fontSize={12} tickMargin={10} />
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
                      <XAxis dataKey="time" stroke="#8898aa" fontSize={12} tickMargin={10} interval={5} />
                      <YAxis domain={[0, 1]} stroke="#8898aa" fontSize={12} tickMargin={10} />
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
