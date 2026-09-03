import React, { memo, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { HeartPulse, Activity, Zap, Waves, Gauge, Thermometer, Sliders } from "lucide-react";
import { METRICS } from "../../config/metrics";
import { useApi } from "../../contexts/ApiContext";

export const HealthIndexPanel = memo(({ panel, latestData, isEditing }) => {
  const userMetrics = panel.metrics || [];
  const { apiUrl } = useApi();
  const [thiData, setThiData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch THI calculation and thresholds directly from backend webservice
  const fetchThiWebservice = useCallback(async () => {
    if (userMetrics.length === 0) return;

    try {
      if (!thiData) {
        setIsLoading(true);
      }
      const dbName = sessionStorage.getItem('db_name');
      const trafoId = sessionStorage.getItem('selected_trafo_id') || 1;
      if (!dbName) return;

      const metricsParam = userMetrics.join(',');
      const res = await axios.get(`${apiUrl}/api/trends/thi?trafo_id=${trafoId}&metrics=${metricsParam}`);

      if (res.data?.success) {
        setThiData(prev => {
          // Avoid re-renders if score and timestamp are unchanged
          if (prev && prev.overallScore === res.data.overallScore && prev.timestamp === res.data.timestamp) {
            return prev;
          }
          return res.data;
        });
      }
    } catch (err) {
      console.warn("Could not fetch THI from webservice:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, userMetrics, thiData]);

  // Fetch on mount or when metrics change
  useEffect(() => {
    fetchThiWebservice();
  }, [fetchThiWebservice]);

  // Periodic refresh (every 6 seconds, paused when tab is hidden)
  useEffect(() => {
    if (userMetrics.length === 0) return;
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchThiWebservice();
      }
    }, 6000);

    const handleVisibility = () => {
      if (!document.hidden) fetchThiWebservice();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchThiWebservice, userMetrics.length]);

  // Determine icon for metric
  const getMetricIcon = (key) => {
    const k = key.toLowerCase();
    if (k.includes('phase') || (k.includes('line') && k.includes('voltage')) || k.includes('volt')) return Zap;
    if (k.includes('current') || k.includes('unbalance')) return Waves;
    if (k.includes('pf')) return Gauge;
    if (k.includes('temp')) return Thermometer;
    return Activity;
  };

  const overallScore = thiData?.overallScore ?? 0;
  const overallStatus = thiData?.overallStatus ?? 'EVALUATING';
  const overallColor = thiData?.overallColor ?? '#10b981';

  // Fallback evaluated metrics if webservice is loading
  const displayMetrics = (thiData?.evaluatedMetrics && thiData.evaluatedMetrics.length > 0)
    ? thiData.evaluatedMetrics
    : userMetrics.map(key => {
        const meta = METRICS[key];
        const val = latestData?.[key];
        return {
          key,
          label: meta?.label || key,
          unit: meta?.unit || '',
          displayVal: val !== undefined && val !== null ? Number(val).toFixed(1) : '-',
          score: 100,
          status: 'NORMAL',
          color: '#10b981',
          thresholdLabel: 'DB Limits'
        };
      });

  return (
    <div className="h-full w-full flex flex-col transition-colors duration-300">
      {/* Header */}
      <div className={`flex items-center justify-between gap-2 px-1 mb-1.5 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-rose-500/10 text-rose-500 dark:text-rose-400 shrink-0">
            <HeartPulse size={14} />
          </div>
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 font-sans truncate tracking-wide">
            {panel.title || 'Transformer Health Index (THI)'}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0 pr-14">
          {userMetrics.length > 0 && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${overallColor}20`, color: overallColor }}>
              {overallStatus}
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      {userMetrics.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 mb-2">
            <HeartPulse size={28} />
          </div>
          <span className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
            Select Metrics to Calculate Health Index
          </span>
          <span className="text-[11px] text-gray-400 max-w-xs">
            Please select up to 6 metrics below to analyze transformer condition and evaluate thresholds in real-time.
          </span>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col md:flex-row items-center justify-between gap-3 p-1.5 overflow-hidden">
          {/* Left: Dynamic Health Index Circular Gauge */}
          <div className="relative flex items-center justify-center shrink-0 w-28 h-28">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="9" fill="transparent" className="text-gray-200 dark:text-white/10" />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke={overallColor}
                strokeWidth="9"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * overallScore) / 100}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-black font-mono tracking-tighter text-gray-800 dark:text-gray-100">{overallScore}</span>
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">/ 100 THI</span>
            </div>
          </div>

          {/* Right: Cards of User Selected Metrics evaluated against Threshold Settings */}
          <div className="flex-1 w-full flex flex-col gap-1.5 min-h-0 overflow-y-auto custom-scrollbar">
            <div className={`grid gap-1.5 text-xs ${displayMetrics.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {displayMetrics.map(m => {
                const meta = METRICS[m.key];
                const Icon = getMetricIcon(m.key);
                const unit = meta?.unit || m.unit || '';
                const label = meta?.label || m.label || m.key;

                // Format threshold label in English
                let thresholdText = m.thresholdLabel || 'Normal Operation';
                thresholdText = thresholdText
                  .replace(/^Batas:\s*/i, 'Limit: ')
                  .replace(/^Maks:\s*/i, 'Max: ')
                  .replace(/^Min:\s*/i, 'Min: ')
                  .replace('Beban Aktif', 'Active Load')
                  .replace('Operasi Normal', 'Normal Operation')
                  .replace('Tidak ada data', 'No data')
                  .replace('Batas DB', 'DB Limits');

                return (
                  <div key={m.key} className="p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200/60 dark:border-white/5 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold truncate flex items-center gap-1">
                        <Icon size={11} style={{ color: m.color }} className="shrink-0" />
                        <span className="truncate">{label}</span>
                      </span>
                      <span className="text-[9px] font-bold font-mono px-1 py-0.2 rounded" style={{ backgroundColor: `${m.color}20`, color: m.color }}>
                        {m.status}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="text-xs font-bold font-mono text-gray-800 dark:text-gray-100">
                        {m.displayVal} <span className="text-[10px] text-gray-400 font-normal">{unit}</span>
                      </span>
                      <span className="text-[9px] font-mono text-gray-400 font-semibold">
                        {m.score}/100
                      </span>
                    </div>

                    {/* Direct Reference to Thresholds from Settings */}
                    <div className="mt-1 pt-1 border-t border-gray-200/40 dark:border-white/5 flex items-center justify-between text-[9px] text-gray-400 font-mono">
                      <span className="flex items-center gap-0.5 text-gray-400 truncate">
                        <Sliders size={8} className="shrink-0" /> {thresholdText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
