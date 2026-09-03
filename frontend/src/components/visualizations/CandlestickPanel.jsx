import React, { memo, useState, useMemo, useCallback } from 'react';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { GripVertical, CandlestickChart } from "lucide-react";
import { METRICS } from "../../config/metrics";
import { useTrendData } from "../../contexts/TrendDataContext";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const td = data.tooltipData || data;
    if (td.open === undefined) return null;
    return (
      <div className="bg-white dark:bg-[#111217] border border-gray-200 dark:border-[#32363e] p-3 shadow-2xl flex flex-col gap-1 min-w-[120px] rounded-lg">
        <span className="text-gray-500 dark:text-gray-400 text-[11px] font-bold mb-1.5 uppercase tracking-wider border-b border-gray-200 dark:border-white/10 pb-1.5">{label}</span>
        <div className="flex justify-between text-xs py-0.5"><span className="text-gray-600 dark:text-gray-300 font-medium">Open:</span> <span className="text-gray-900 dark:text-white font-bold font-mono ml-3">{td.open.toFixed(2)}</span></div>
        <div className="flex justify-between text-xs py-0.5"><span className="text-gray-600 dark:text-gray-300 font-medium">High:</span> <span className="text-gray-900 dark:text-white font-bold font-mono ml-3">{td.high !== undefined ? td.high.toFixed(2) : td.wick?.[1]?.toFixed(2)}</span></div>
        <div className="flex justify-between text-xs py-0.5"><span className="text-gray-600 dark:text-gray-300 font-medium">Low:</span> <span className="text-gray-900 dark:text-white font-bold font-mono ml-3">{td.low !== undefined ? td.low.toFixed(2) : td.wick?.[0]?.toFixed(2)}</span></div>
        <div className="flex justify-between text-xs py-0.5"><span className="text-gray-600 dark:text-gray-300 font-medium">Close:</span> <span className="text-gray-900 dark:text-white font-bold font-mono ml-3">{td.close.toFixed(2)}</span></div>
      </div>
    );
  }
  return null;
};

export const CandlestickPanel = memo(({ panel, chartData, isEditing, isSyncHoverActive }) => {
  const { isLoading } = useTrendData() || { isLoading: false };
  const metric = panel.metrics?.[0]; 

  // Synchronized hover method
  const handleSyncMethod = useCallback((tooltipTicks, syncData) => {
    if (!syncData || !tooltipTicks || tooltipTicks.length === 0) return -1;
    if (syncData.activeLabel) {
      const exactIdx = tooltipTicks.findIndex(t => t.value === syncData.activeLabel);
      if (exactIdx !== -1) return exactIdx;
    }
    if (typeof syncData.activeTooltipIndex === 'number') {
      if (syncData.activeTooltipIndex >= 55) {
        return tooltipTicks.length - 1;
      }
      const ratio = syncData.activeTooltipIndex / 60;
      const mappedIdx = Math.round(ratio * (tooltipTicks.length - 1));
      return Math.max(0, Math.min(tooltipTicks.length - 1, mappedIdx));
    }
    return -1;
  }, []);

  // Build candlestick data mapping 1:1 with chartData
  const data = useMemo(() => {
    if (!chartData || chartData.length === 0 || !metric) return [];
    
    return chartData.map((point, i) => {
      const val = point[metric];
      const prevVal = i > 0 ? chartData[i - 1][metric] : val;
      
      if (val === undefined || val === null) {
        return { time: point.time };
      }
      
      const open = prevVal !== undefined && prevVal !== null ? prevVal : val;
      const close = val;
      const minVal = Math.min(open, close);
      const maxVal = Math.max(open, close);
      
      const renderMin = minVal === maxVal ? minVal - 0.05 : minVal;
      const renderMax = minVal === maxVal ? maxVal + 0.05 : maxVal;
      
      return {
        time: point.time,
        open, close,
        wick: [renderMin, renderMax],
        body: [Math.min(open, close), Math.max(open, close)],
        color: close >= open ? '#10b981' : '#ef4444',
        tooltipData: { open, close, high: maxVal, low: minVal }
      };
    });
  }, [chartData, metric]);

  const [timeWindow, setTimeWindow] = useState(15);

  const displayData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (timeWindow >= data.length) return data;
    return data.slice(-timeWindow);
  }, [data, timeWindow]);

  return (
    <div className="h-full w-full flex flex-col transition-colors duration-500 rounded-none overflow-hidden">
      <div className={`flex items-center justify-between gap-2 px-1 mb-1.5 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 shrink-0">
            <CandlestickChart size={14} />
          </div>
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 font-sans truncate tracking-wide">{panel.title}</h3>

          {/* Time Window Pills */}
          <div className="inline-flex p-0.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[10px] font-medium shrink-0 ml-1">
            {[
              { label: '15s', val: 15 },
              { label: '30s', val: 30 },
              { label: '60s', val: 60 }
            ].map(tab => (
              <button
                key={tab.val}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTimeWindow(tab.val);
                }}
                className={`px-1.5 py-0.5 rounded transition-all duration-200 cursor-pointer ${
                  timeWindow === tab.val
                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs font-semibold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
                title={`Show last ${tab.label} window`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pr-14">
          {isEditing && <GripVertical size={16} className="text-gray-400 shrink-0" />}
        </div>
      </div>
      <div className="flex-1 min-h-0 pb-2 relative flex flex-col h-full w-full">
        {!metric ? (
          <div className="h-full w-full flex-1 flex flex-col items-center justify-center p-4 text-center">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 mb-2">
              <CandlestickChart size={24} />
            </div>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">No Metric Selected</span>
            <span className="text-[11px] text-gray-400 max-w-xs">Please select 1 metric below to render the candlestick chart.</span>
          </div>
        ) : displayData.length === 0 ? (
           <div className="h-full flex items-center justify-center text-gray-500 text-xs font-semibold">
             {isLoading ? "Waiting for data..." : "Data not found"}
           </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={displayData}
              margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
              barCategoryGap="20%"
              syncId={isSyncHoverActive ? "dashboardSync" : undefined}
              syncMethod={handleSyncMethod}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-200 dark:text-white/10" />
              <XAxis dataKey="time" xAxisId="body" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f033' }} tickLine={false} minTickGap={30} />
              <XAxis dataKey="time" xAxisId="wick" hide />
              <YAxis yAxisId="price" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1)} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.12)', radius: 4 }} isAnimationActive={false} />
              
              <Bar xAxisId="wick" yAxisId="price" dataKey="wick" barSize={2} isAnimationActive={true} animationDuration={400} animationEasing="ease-out">
                 {displayData.map((entry, index) => <Cell key={`wick-${index}`} fill={entry.color} />)}
              </Bar>
              
              <Bar xAxisId="body" yAxisId="price" dataKey="body" isAnimationActive={true} animationDuration={400} animationEasing="ease-out">
                 {displayData.map((entry, index) => <Cell key={`body-${index}`} fill={entry.color} />)}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
