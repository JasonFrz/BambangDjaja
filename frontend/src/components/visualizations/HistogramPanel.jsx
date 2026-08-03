import React, { memo, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { GripVertical } from "lucide-react";
import { METRICS } from "../../config/metrics";

export const HistogramPanel = memo(({ panel, chartData, isEditing }) => {
  const metric = panel.metrics?.[0]; // Restrict to 1 metric
  
  const histogramData = useMemo(() => {
    if (!chartData || chartData.length === 0 || !metric) return [];
    const values = chartData.map(d => d[metric]).filter(v => v !== undefined);
    if (values.length === 0) return [];
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = 15;
    const binSize = (max - min) / binCount;
    if (binSize === 0) return [{ bin: `${min.toFixed(1)}`, count: values.length }];
    
    const bins = Array.from({ length: binCount }).map((_, i) => ({
      binMin: min + i * binSize,
      binMax: min + (i + 1) * binSize,
      bin: `${(min + i * binSize).toFixed(1)}-${(min + (i + 1) * binSize).toFixed(1)}`,
      count: 0
    }));
    
    values.forEach(v => {
      let bIdx = Math.floor((v - min) / binSize);
      if (bIdx >= binCount) bIdx = binCount - 1;
      bins[bIdx].count++;
    });
    
    return bins;
  }, [chartData, metric]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-sm font-semibold text-[#172b4d] dark:text-white font-heading truncate flex-1">{panel.title}</h3>
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
