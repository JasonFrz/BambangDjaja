import React, { memo, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { GripVertical, BarChart3 } from "lucide-react";
import { METRICS } from "../../config/metrics";
import EnergyLoader from "../../components/EnergyLoader";
import { useTrendData } from "../../contexts/TrendDataContext";

export const HistogramPanel = memo(({ panel, chartData, isEditing, isSyncHoverActive }) => {
  const { isLoading } = useTrendData() || { isLoading: false };
  const metric = panel.metrics?.[0]; // Restrict to 1 metric
  const buckets = panel.buckets || 10;
  
  const histogramData = useMemo(() => {
    if (!chartData || chartData.length === 0 || !metric) return [];
    
    const values = chartData.map(d => parseFloat(d[metric])).filter(v => !isNaN(v));
    if (values.length === 0) return [];
    
    let min = Math.min(...values);
    let max = Math.max(...values);
    
    if (min === max) {
      min -= 1;
      max += 1;
    }
    
    const binSize = (max - min) / buckets;
    
    // Create buckets
    const bins = Array.from({ length: buckets }, (_, i) => ({
      bin: `${(min + i * binSize).toFixed(1)}`,
      rangeStart: min + i * binSize,
      rangeEnd: min + (i + 1) * binSize,
      count: 0
    }));
    
    // Fill buckets
    values.forEach(v => {
      const binIdx = Math.min(Math.floor((v - min) / binSize), buckets - 1);
      if (bins[binIdx]) bins[binIdx].count++;
    });
    
    return bins;
  }, [chartData, metric, buckets]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 font-sans tracking-wide">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 min-h-0 flex flex-col h-full w-full">
        {!metric ? (
          <div className="h-full w-full flex-1 flex flex-col items-center justify-center p-4 text-center">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 mb-2">
              <BarChart3 size={24} />
            </div>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">No Metric Selected</span>
            <span className="text-[11px] text-gray-400 max-w-xs">Please select 1 metric below to view the value distribution histogram.</span>
          </div>
        ) : histogramData.length === 0 ? (
           <div className="h-full flex items-center justify-center text-gray-500 text-xs font-semibold">
             {isLoading ? <EnergyLoader size="small" text="Loading data..." /> : "Data not found"}
           </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData} margin={{ top: 15, right: 15, bottom: -5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
              <XAxis dataKey="bin" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', borderColor: '#ffffff20', color: 'white', borderRadius: '8px' }} itemStyle={{ color: '#6366f1' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
              <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});

