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
  },
  soft: {
    label: "Soft Pastel",
    getColor: (val) => `hsl(${220 - (val * 160)}, 70%, 75%)` // Soft blue to soft yellow/orange
  }
};

export const HeatmapPanel = memo(({ panel, chartData, isEditing }) => {
  const metrics = panel.metrics || [];
  const colorScheme = panel.colorScheme || 'spectral';
  
  const heatmapData = useMemo(() => {
    if (!chartData || chartData.length === 0 || metrics.length === 0) return [];
    
    // Y-axis = metrics, X-axis = time segments
    const timeSegments = Math.min(24, chartData.length);
    const step = Math.ceil(chartData.length / timeSegments);
    
    return metrics.map(m => {
      const row = [];
      const meta = METRICS[m];
      // Step 1: Collect valid values to find min/max
      const validValues = [];
      for(let i = 0; i < timeSegments; i++) {
        const point = chartData[i * step];
        if (point && point[m] !== undefined && point[m] !== null) {
          validValues.push(Number(point[m]));
        }
      }
      
      const rowMin = validValues.length > 0 ? Math.min(...validValues) : 0;
      const rowMax = validValues.length > 0 ? Math.max(...validValues) : 100;
      const range = rowMax - rowMin;
      
      for(let i = 0; i < timeSegments; i++) {
        const point = chartData[i * step];
        if (!point) continue;
        const rawVal = point[m];
        if (rawVal === undefined || rawVal === null) {
          row.push({ time: point.time, val: null, intensity: 0, rawPoint: point });
        } else {
          const val = Number(rawVal);
          const intensity = range === 0 ? 0.5 : Math.max(0, Math.min(1, (val - rowMin) / range));
          row.push({ time: point.time, val, intensity, rawPoint: point });
        }
      }
      return { key: m, label: meta?.label || m, data: row };
    });
  }, [chartData, metrics]);

  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, time: '', label: '', val: null, data: null });

  const handleMouseEnter = (e, d, r) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = e.currentTarget.closest('.heatmap-container').getBoundingClientRect();
    
    let xPos = rect.left - parentRect.left + (rect.width / 2);
    // Tooltip is approx 140px wide, so it needs 70px on each side.
    if (xPos + 70 > parentRect.width) {
       xPos = parentRect.width - 70;
    } else if (xPos - 70 < 0) {
       xPos = 70;
    }
    
    setTooltip({
      show: true,
      x: xPos,
      y: rect.top - parentRect.top - 10,
      time: d.time,
      label: r.label,
      val: d.val,
      data: d.rawPoint
    });
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, show: false }));
  };

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-black transition-colors duration-500 rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden heatmap-container relative">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 p-3 pb-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-sm font-semibold text-[#172b4d] dark:text-white font-heading truncate flex-1">{panel.title}</h3>
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
                const color = d.val !== null ? COLOR_SCHEMES[colorScheme].getColor(d.intensity) : 'transparent';
                return (
                  <div key={i} 
                       className="flex-1 h-full rounded-[2px] transition-colors hover:ring-2 hover:ring-white/80 cursor-crosshair border border-gray-100 dark:border-white/5" 
                       style={{ backgroundColor: color }} 
                       onMouseEnter={(e) => handleMouseEnter(e, d, r)}
                       onMouseLeave={handleMouseLeave}
                       />
                );
              })}
            </div>
          ))}
          {heatmapData.length === 0 && <div className="text-xs text-gray-400 mt-4">Waiting for data...</div>}
        </div>
      </div>
      
      {/* Custom Tooltip */}
      {tooltip.show && (
        <div 
          className="absolute pointer-events-none z-50 bg-white/95 dark:bg-[#151521]/95 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 p-3 rounded-xl shadow-2xl flex flex-col gap-1 min-w-[120px]"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <span className="text-gray-500 dark:text-gray-400 text-[11px] font-bold mb-1.5 uppercase tracking-wider border-b border-gray-200 dark:border-white/10 pb-1.5">
            {tooltip.time}
          </span>
          <div className="flex justify-between text-xs py-0.5">
            <span className="text-gray-600 dark:text-gray-300 font-medium">{tooltip.label}:</span>
            <span className="text-gray-900 dark:text-white font-bold font-mono ml-3">
              {tooltip.val !== null ? tooltip.val.toFixed(2) : 'No Data'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
