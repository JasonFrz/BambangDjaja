import React, { memo, useMemo, useState } from 'react';
import { GripVertical, Palette } from "lucide-react";
import { METRICS } from "../../config/metrics";

const COLOR_SCHEMES = {
  spectral: {
    label: "Spectral",
    getColor: (val) => `hsl(${240 - (val * 240)}, 100%, 50%)` // Blue to Red
  },
  inferno: {
    label: "Inferno",
    getColor: (val) => `hsl(${280 - (val * 220)}, 100%, ${20 + (val * 60)}%)` // Dark Purple to Yellow
  },
  matrix: {
    label: "Matrix",
    getColor: (val) => `rgba(16, 185, 129, ${0.1 + (val * 0.9)})` // Green opacity
  },
  classic: {
    label: "Classic Red",
    getColor: (val) => `rgba(239, 68, 68, ${0.1 + (val * 0.9)})` // Red opacity
  }
};

export const HeatmapPanel = memo(({ panel, chartData, isEditing }) => {
  const metrics = panel.metrics || [];
  const [colorScheme, setColorScheme] = useState('spectral');
  
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
    <div className="h-full w-full flex flex-col bg-white dark:bg-black transition-colors duration-500 rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 p-3 pb-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-sm font-semibold text-[#172b4d] dark:text-white font-heading truncate flex-1">{panel.title}</h3>
        
        {/* Color Scheme Selector */}
        {isEditing && (
          <div className="relative group flex items-center">
             <Palette size={14} className="text-gray-400 group-hover:text-blue-500 cursor-pointer" />
             <select 
                value={colorScheme} 
                onChange={(e) => setColorScheme(e.target.value)}
                className="opacity-0 group-hover:opacity-100 absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-md text-xs shadow-lg transition-opacity outline-none text-gray-700 dark:text-gray-300 z-10 p-1 cursor-pointer"
             >
                {Object.entries(COLOR_SCHEMES).map(([key, scheme]) => (
                  <option key={key} value={key}>{scheme.label}</option>
                ))}
             </select>
          </div>
        )}

        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 flex overflow-hidden pl-3 pb-3">
        <div className="flex flex-col justify-around pr-2 py-2 shrink-0 w-24">
          {heatmapData.map(r => <span key={r.key} className="text-[10px] text-gray-500 font-semibold truncate" title={r.label}>{r.label}</span>)}
        </div>
        <div className="flex-1 flex flex-col justify-around py-2 gap-1 overflow-x-auto pr-3">
          {heatmapData.map(r => (
            <div key={r.key} className="flex-1 flex gap-[2px]">
              {r.data.map((d, i) => {
                const color = d.intensity > 0 ? COLOR_SCHEMES[colorScheme].getColor(d.intensity) : 'transparent';
                return (
                  <div key={i} className="flex-1 h-full rounded-[2px] transition-colors hover:ring-2 hover:ring-white/80 cursor-crosshair border border-gray-100 dark:border-white/5" 
                       style={{ backgroundColor: color }} 
                       title={`${d.time}\n${r.label}: ${d.val.toFixed(2)}`} />
                );
              })}
            </div>
          ))}
          {heatmapData.length === 0 && <div className="text-xs text-gray-400 mt-4">Waiting for data...</div>}
        </div>
      </div>
    </div>
  );
});
