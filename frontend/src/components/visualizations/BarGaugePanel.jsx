import React, { memo } from 'react';
import { GripVertical, LayoutPanelLeft } from "lucide-react";
import { METRICS } from "../../config/metrics";
import { useThresholds } from "../../contexts/ThresholdContext";

export const BarGaugePanel = memo(({ panel, latestData, isEditing }) => {
  const { getThreshold } = useThresholds();
  const metrics = panel.metrics || [];

  if (metrics.length === 0) {
    return (
      <div className="h-full w-full flex flex-col">
        <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 font-sans tracking-wide">{panel.title}</h3>
          {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 mb-2">
            <LayoutPanelLeft size={24} />
          </div>
          <span className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">No Metric Selected</span>
          <span className="text-[11px] text-gray-400 max-w-xs">Please select 1 metric below to display the horizontal progress bar.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 font-sans tracking-wide">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3 justify-center">
        {metrics.map(m => {
          const meta = METRICS[m];
          const val = latestData?.[m] ?? 0;
          const threshold = getThreshold(m);
          const tMin = (threshold.is_active && threshold.min !== null) ? threshold.min : undefined;
          const tMax = (threshold.is_active && threshold.max !== null) ? threshold.max : undefined;

          let min = 0;
          let max = 100;
          if (m === 'frequency') { min = 45; max = 55; }
          else if (m === 'pfTotal') { min = 0; max = 1; }
          else if (meta?.group?.includes('Voltage')) { min = 0; max = 500; }
          else if (meta?.group === 'Current') { min = 0; max = 100; }
          else if (meta?.group === 'Power') { min = 0; max = 1000; }
          else if (m === 'oil_temperature') { min = 0; max = 150; }
          else if (m === 'oil_pressure') { min = 0; max = 10; }

          if (tMax !== undefined && tMax > max) max = Math.ceil(tMax * 1.2);
          if (val > max) max = Math.ceil(val * 1.2);
          if (val < min) min = Math.floor(val * 0.8);

          const percent = max > min ? Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100)) : 0;
          const isDanger = (tMin !== undefined && val < tMin) || (tMax !== undefined && val > tMax);
          const barColor = isDanger ? '#ef4444' : (meta?.color || '#3b82f6');
          
          return (
            <div key={m} className="flex flex-col gap-1">
              <div className="flex justify-between items-end">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{meta?.label || m}</span>
                <span className="text-sm font-bold font-mono text-gray-900 dark:text-white">{val.toFixed(2)} <span className="text-[10px] font-sans text-gray-400">{meta?.unit}</span></span>
              </div>
              <div className="h-4 w-full bg-gray-100 dark:bg-black/30 rounded-full overflow-hidden shadow-inner border border-gray-200 dark:border-white/5 relative">
                <div 
                  className="h-full rounded-full transition-all duration-700 ease-out" 
                  style={{ width: `${percent}%`, backgroundColor: barColor, boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.2)' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

