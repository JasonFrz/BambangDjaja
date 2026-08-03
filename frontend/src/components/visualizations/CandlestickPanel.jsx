import React, { memo, useMemo } from 'react';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { GripVertical } from "lucide-react";
import { METRICS } from "../../config/metrics";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 dark:bg-[#151521]/95 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 p-3 rounded-xl shadow-2xl flex flex-col gap-1 min-w-[120px]">
        <span className="text-gray-500 dark:text-gray-400 text-[11px] font-bold mb-1.5 uppercase tracking-wider border-b border-gray-200 dark:border-white/10 pb-1.5">{label}</span>
        <div className="flex justify-between text-xs py-0.5"><span className="text-gray-600 dark:text-gray-300 font-medium">Open:</span> <span className="text-gray-900 dark:text-white font-bold font-mono ml-3">{data.open.toFixed(2)}</span></div>
        <div className="flex justify-between text-xs py-0.5"><span className="text-gray-600 dark:text-gray-300 font-medium">High:</span> <span className="text-gray-900 dark:text-white font-bold font-mono ml-3">{data.wick[1].toFixed(2)}</span></div>
        <div className="flex justify-between text-xs py-0.5"><span className="text-gray-600 dark:text-gray-300 font-medium">Low:</span> <span className="text-gray-900 dark:text-white font-bold font-mono ml-3">{data.wick[0].toFixed(2)}</span></div>
        <div className="flex justify-between text-xs py-0.5"><span className="text-gray-600 dark:text-gray-300 font-medium">Close:</span> <span className="text-gray-900 dark:text-white font-bold font-mono ml-3">{data.close.toFixed(2)}</span></div>
      </div>
    );
  }
  return null;
};

export const CandlestickPanel = memo(({ panel, chartData, isEditing }) => {
  const metric = panel.metrics?.[0]; // Candlestick is restricted to 1 metric

  const data = useMemo(() => {
    if (!chartData || chartData.length === 0 || !metric) return [];
    
    // Group chartData into buckets of 5 points for OHLC
    const bucketSize = 5;
    const result = [];
    
    for (let i = 0; i < chartData.length; i += bucketSize) {
      const chunk = chartData.slice(i, i + bucketSize);
      if (chunk.length === 0) break;
      
      const values = chunk.map(d => d[metric]).filter(v => v !== undefined);
      if (values.length === 0) continue;
      
      const open = values[0];
      const close = values[values.length - 1];
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      
      result.push({
        time: chunk[chunk.length-1].time,
        open, close,
        wick: [minVal, maxVal],
        body: [Math.min(open, close), Math.max(open, close)],
        color: close >= open ? '#10b981' : '#ef4444' // Green if up, Red if down
      });
    }
    return result;
  }, [chartData, metric]);

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-black transition-colors duration-500 rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 p-3 pb-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-sm font-semibold text-[#172b4d] dark:text-white font-heading truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 min-h-0 pb-2 relative">
        {!metric || data.length === 0 ? (
           <div className="h-full flex items-center justify-center text-gray-500 text-xs">Waiting for data...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b830" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f033' }} tickLine={false} minTickGap={30} />
              <YAxis yAxisId="price" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1)} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#94a3b820' }} />
              
              <Bar yAxisId="price" dataKey="wick" maxBarSize={2} isAnimationActive={false}>
                 {data.map((entry, index) => <Cell key={`wick-${index}`} fill={entry.color} />)}
              </Bar>
              
              <Bar yAxisId="price" dataKey="body" maxBarSize={12} isAnimationActive={false}>
                 {data.map((entry, index) => <Cell key={`body-${index}`} fill={entry.color} />)}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
