import React, { useState, useRef, useEffect } from 'react';
import { Clock, Play, RotateCcw, Calendar, ChevronDown, Check, RefreshCw } from 'lucide-react';
import { useTrendData } from '../contexts/TrendDataContext';

export const UniversalTimePicker = () => {
  const {
    timeRange,
    fetchRangeData,
    resetToLive,
    isLiveMode,
    isLoading,
    updateInterval,
    setUpdateInterval
  } = useTrendData();

  const [isOpen, setIsOpen] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const presets = [
    { key: 'live', label: 'Live (Streaming)', desc: 'Real-time WebSocket feed' },
    { key: '15m', label: 'Last 15 Minutes', desc: 'Raw high-frequency data' },
    { key: '1h', label: 'Last 1 Hour', desc: '5-second interval average' },
    { key: '6h', label: 'Last 6 Hours', desc: '30-second interval average' },
    { key: '24h', label: 'Last 24 Hours', desc: '2-minute downsampled' },
    { key: '7d', label: 'Last 7 Days', desc: '10-minute downsampled' },
  ];

  const handleSelectPreset = (key) => {
    setIsOpen(false);
    if (key === 'live') {
      resetToLive();
    } else {
      fetchRangeData(key);
    }
  };

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (!customStart || !customEnd) return;
    setShowCustomModal(false);
    fetchRangeData('custom', new Date(customStart).toISOString(), new Date(customEnd).toISOString());
  };

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      {/* ─── Main Range Button ─── */}
      <div className="inline-flex items-center rounded-xl bg-white/80 dark:bg-[#151521]/90 border border-gray-200/80 dark:border-white/10 shadow-sm p-1 gap-1 backdrop-blur-md">
        {/* Mode Status Pill */}
        {isLiveMode ? (
          <button
            onClick={() => handleSelectPreset('live')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all hover:bg-emerald-500/20"
            title="Currently streaming real-time data from Iriv PiControll"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>LIVE</span>
          </button>
        ) : (
          <button
            onClick={resetToLive}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all group"
            title="Viewing historical data. Click to resume live streaming."
          >
            <RotateCcw size={12} className="group-hover:-rotate-90 transition-transform duration-300" />
            <span>PAUSED</span>
            <span className="hidden md:inline text-[10px] text-amber-500 underline ml-0.5">Resume</span>
          </button>
        )}

        {/* Time Selector Dropdown Trigger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
        >
          <Clock size={13} className="text-gray-400" />
          <span>{timeRange.label}</span>
          <ChevronDown size={13} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Refresh / Loader indicator */}
        {isLoading && (
          <div className="px-1.5 text-blue-500 animate-spin">
            <RefreshCw size={12} />
          </div>
        )}
      </div>

      {/* ─── Dropdown Menu ─── */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-white/10 shadow-2xl z-50 p-2 overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-white/5 mb-1 flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Universal Time Range</span>
          </div>

          <div className="space-y-0.5">
            {presets.map((p) => {
              const isSelected = timeRange.preset === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => handleSelectPreset(p.key)}
                  className={`w-full flex items-start justify-between p-2 rounded-xl text-left transition-colors ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold">{p.label}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">{p.desc}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-blue-500 mt-1 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Custom Date Range Trigger */}
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-white/5">
            <button
              onClick={() => {
                setIsOpen(false);
                setShowCustomModal(true);
              }}
              className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <Calendar size={14} className="text-blue-500" />
              <span>Custom Date Range...</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Custom Date Modal ─── */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181826] rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-blue-500" />
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Pilih Rentang Waktu Kustom</h4>
            </div>

            <form onSubmit={handleApplyCustom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  Waktu Mulai (Start Time)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  Waktu Akhir (End Time)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all"
                >
                  Terapkan Rentang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
