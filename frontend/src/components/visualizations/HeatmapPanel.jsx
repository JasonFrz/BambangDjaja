import React, { memo, useMemo } from 'react';
import { GripVertical } from "lucide-react";
import { METRICS } from "../../config/metrics";

export const HeatmapPanel = memo(({ panel, chartData, isEditing }) => {
  const metrics = panel.metrics || [];
  
  const heatmapData = useMemo(() => {
    if (!chartData || chartData.length === 0 || metrics.length === 0) return [];
    
    // Y-axis = metrics, X-axis = time segments
    const timeSegments = Math.min(24, chartData.length);
    const step = Math.ceil(chartData.length / timeSegments);
    
    return metrics.map(m => {
      const row = [];
      const meta = METRICS[m];
      const maxVal = meta?.thresholds?.max || 100; // rough normalization
      
      for(let i = 0; i < timeSegments; i++) {
        const point = chartData[i * step];
        if (!point) continue;
        const val = point[m] || 0;
        const intensity = Math.min(1, Math.max(0, val / (maxVal * 1.5)));
        row.push({ time: point.time, val, intensity });
      }
      return { key: m, label: meta?.label || m, data: row };
    });
  }, [chartData, metrics]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-sm font-semibold text-[#172b4d] dark:text-white font-heading truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex flex-col justify-around pr-2 py-2 shrink-0 w-24">
          {heatmapData.map(r => <span key={r.key} className="text-[9px] text-gray-500 font-semibold truncate" title={r.label}>{r.label}</span>)}
        </div>
        <div className="flex-1 flex flex-col justify-around py-2 gap-1 overflow-x-auto">
          {heatmapData.map(r => (
            <div key={r.key} className="flex-1 flex gap-[2px]">
              {r.data.map((d, i) => {
                const opacity = 0.1 + (d.intensity * 0.9);
                return (
                  <div key={i} className="flex-1 h-full rounded-sm transition-colors hover:ring-1 hover:ring-white/50 cursor-pointer" 
                       style={{ backgroundColor: `rgba(239, 68, 68, ${opacity})` }} 
                       title={`${d.time} - ${r.label}: ${d.val.toFixed(2)}`} />
                );
              })}
            </div>
          ))}
          {heatmapData.length === 0 && <div className="text-xs text-gray-400 mt-4">No data</div>}
        </div>
      </div>
    </div>
  );
});
