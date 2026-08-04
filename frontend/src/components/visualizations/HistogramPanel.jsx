import React, { memo, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { GripVertical } from "lucide-react";
import { METRICS } from "../../config/metrics";

export const HistogramPanel = memo(({ panel, chartData, isEditing, isSyncHoverActive }) => {
  const metric = panel.metrics?.[0]; // Restrict to 1 metric
  const buckets = panel.buckets || 10;
  
  const histogramData = useMemo(() => {
    if (!chartData || chartData.length === 0 || !metric) return [];
    
    // Extract values
    const values = chartData.map(d => d[metric]).filter(v => v !== undefined && v !== null);
    if (values.length === 0) return [];
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Create buckets
    const binSize = (max - min) / buckets || 1;
    const bins = Array.from({length: buckets}, (_, i) => ({
      rangeStart: min + (i * binSize),
      rangeEnd: min + ((i + 1) * binSize),
      bin: `${(min + (i * binSize)).toFixed(1)} - ${(min + ((i + 1) * binSize)).toFixed(1)}`,
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
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-sans text-center truncate flex-1 tracking-wide">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 min-h-0">
        {!metric || histogramData.length === 0 ? (
           <div className="h-full flex items-center justify-center text-xs text-gray-400">Waiting for data...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData} margin={{ top: 15, right: 15, bottom: -5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
              <XAxis dataKey="bin" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', borderColor: '#ffffff20', color: 'white', borderRadius: '8px' }} itemStyle={{ color: '#6366f1' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
              <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} name="Frequency" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
