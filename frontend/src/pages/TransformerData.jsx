import React, { useState, useEffect } from "react";
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Filter, ChevronDown, RefreshCw, Settings, Activity, Wifi, WifiOff } from "lucide-react";
import { useTrendData } from "../contexts/TrendDataContext";
import { useApi } from '../contexts/ApiContext';

const TransformerData = () => {
  // Shared context
  const { liveData, isLive } = useTrendData();
  const { apiUrl } = useApi();

  // Unified Filter State for both Monitoring and Charts
  const [filters, setFilters] = useState({
    efficiency: true,
    transformerData: true
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
    setFilters({ efficiency: true, transformerData: true });
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
              {entry.name}: {entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const activeCount = Object.values(filters).filter(Boolean).length;
  let gridColsClass = "grid-cols-1";
  if (activeCount >= 2) gridColsClass = "grid-cols-1 lg:grid-cols-2";

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.5s_ease-out] w-full max-w-7xl mx-auto">
      
      {/* Header Section */}
      <div className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#172b4d] dark:text-white font-heading mb-1 transition-colors flex items-center gap-4">
            Transformer Data
          </h2>
          <p className="text-[#5e6c84] dark:text-[#94a3b8] text-[0.95rem] transition-colors mt-1">
            Transformer Specifications & Efficiency Analysis
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
                <button onClick={() => toggleFilter('efficiency')} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-[#172b4d] dark:text-white">
                  <div className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${filters.efficiency ? 'bg-pink-500 border-pink-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {filters.efficiency && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <Activity size={14} className={filters.efficiency ? 'text-pink-500' : 'text-gray-400'} /> Efficiency Chart
                </button>
                <button onClick={() => toggleFilter('transformerData')} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-[#172b4d] dark:text-white">
                  <div className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${filters.transformerData ? 'bg-teal-500 border-teal-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {filters.transformerData && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <Settings size={14} className={filters.transformerData ? 'text-teal-500' : 'text-gray-400'} /> Transformer Specs
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
                onClick={showAll}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  activeCount === 2 
                    ? 'bg-gray-800 text-white dark:bg-white dark:text-black shadow-md scale-100'
                    : 'bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:scale-105'
                }`}
              >
                Show All
              </button>

              <button 
                onClick={() => toggleFilter('efficiency')}
                className={`whitespace-nowrap px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all duration-300 ${
                  filters.efficiency 
                    ? 'bg-pink-50 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300 border-pink-200 dark:border-pink-500/30 shadow-sm border'
                    : 'bg-transparent text-gray-400 border border-transparent hover:bg-gray-50 dark:hover:bg-white/5 opacity-60'
                }`}
              >
                <Activity size={14} className={filters.efficiency ? 'animate-pulse' : ''} /> Efficiency Chart
              </button>

              <button 
                onClick={() => toggleFilter('transformerData')}
                className={`whitespace-nowrap px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all duration-300 ${
                  filters.transformerData 
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300 border-teal-200 dark:border-teal-500/30 shadow-sm border'
                    : 'bg-transparent text-gray-400 border border-transparent hover:bg-gray-50 dark:hover:bg-white/5 opacity-60'
                }`}
              >
                <Settings size={14} className={filters.transformerData ? 'animate-pulse' : ''} /> Transformer Specs
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

      <div className={`grid ${gridColsClass} gap-6 transition-all duration-500 ease-in-out`}>
        {/* Transformer Data Card */}
        {filters.transformerData && (
          <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 transition-all hover:shadow-md h-full flex flex-col group relative overflow-hidden animate-[slideUpFade_0.4s_ease-out]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 dark:bg-teal-400/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#20c997] to-[#48c7a1] flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                <Settings size={20} />
              </div>
              <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight">Transformer Specs</h3>
            </div>
            <div className="space-y-3 flex-1 flex flex-col justify-center">
              <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-sm">Rated Power</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-[#172b4d] dark:text-white font-mono">100</span>
                  <span className="text-xs font-semibold text-[#8993a4] dark:text-[#64748b]">kVA</span>
                </div>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-sm">Rated Current (LV)</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-[#172b4d] dark:text-white font-mono">144</span>
                  <span className="text-xs font-semibold text-[#8993a4] dark:text-[#64748b]">A</span>
                </div>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-sm">No Load Loss</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-[#172b4d] dark:text-white font-mono">150</span>
                  <span className="text-xs font-semibold text-[#8993a4] dark:text-[#64748b]">W</span>
                </div>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-sm">Full Load Loss</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-[#172b4d] dark:text-white font-mono">1200</span>
                  <span className="text-xs font-semibold text-[#8993a4] dark:text-[#64748b]">W</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TREND CHARTS */}
      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800/30 mt-4">
          {error}
        </div>
      ) : (
        <>
          {filters.efficiency && (
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
          
          <div className="grid grid-cols-1 gap-6 transition-all duration-500 ease-in-out">
            {/* Efficiency Chart */}
            {filters.efficiency && (
              <div className="bg-white dark:bg-[#151521] rounded-2xl p-6 shadow-sm border border-transparent dark:border-white/5 flex flex-col h-[400px] animate-[slideUpFade_0.4s_ease-out_0.4s]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-[#e83e8c] to-[#f06292]">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-[#172b4d] dark:text-white font-heading">Transformer Efficiency (%)</h3>
                </div>
                <div className="flex-1 w-full h-full min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="time" stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <YAxis domain={['auto', 'auto']} stroke="#8898aa" fontSize={12} tickMargin={10} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Line type="monotone" dataKey="efficiency" name="Efficiency (%)" stroke="#e83e8c" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );
};

export default TransformerData;
