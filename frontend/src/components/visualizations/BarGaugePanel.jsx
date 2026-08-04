import React, { memo } from 'react';
import { GripVertical } from "lucide-react";
import { METRICS } from "../../config/metrics";

export const BarGaugePanel = memo(({ panel, latestData, isEditing }) => {
  const metrics = panel.metrics || [];
  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-sans text-center truncate flex-1 tracking-wide">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3 justify-center">
        {metrics.map(m => {
          const meta = METRICS[m];
          const val = latestData?.[m] ?? 0;
          let min = meta?.thresholds?.min ?? 0;
          let max = meta?.thresholds?.max ?? (min + 100);
          if (val > max) max = Math.ceil(val * 1.2);
          const percent = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
          
          return (
            <div key={m} className="flex flex-col gap-1">
              <div className="flex justify-between items-end">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{meta?.label || m}</span>
                <span className="text-sm font-bold font-mono text-gray-900 dark:text-white">{val.toFixed(2)} <span className="text-[10px] font-sans text-gray-400">{meta?.unit}</span></span>
              </div>
              <div className="h-4 w-full bg-gray-100 dark:bg-black/30 rounded-full overflow-hidden shadow-inner border border-gray-200 dark:border-white/5 relative">
                <div 
                  className="h-full rounded-full transition-all duration-700 ease-out" 
                  style={{ width: `${percent}%`, backgroundColor: meta?.color || '#3b82f6', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.2)' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
