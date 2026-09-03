import React, { memo } from 'react';
import { GripVertical, CalendarClock } from "lucide-react";
import { METRICS } from "../../config/metrics";

export const StateTimelinePanel = memo(({ panel, chartData, isEditing }) => {
  const metrics = panel.metrics || [];
  
  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 font-sans tracking-wide">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 flex flex-col justify-center gap-4 overflow-y-auto pr-2">
        {metrics.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 mb-2">
              <CalendarClock size={24} />
            </div>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">No Metrics Selected</span>
            <span className="text-[11px] text-gray-400 max-w-xs">Please select metrics below to track state changes over time.</span>
          </div>
        ) : (
         metrics.map(m => {
          const meta = METRICS[m];
          const tMin = meta?.thresholds?.min;
          const tMax = meta?.thresholds?.max;
          
          return (
            <div key={m} className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-gray-500 uppercase">{meta?.label || m}</span>
              <div className="h-5 w-full flex rounded-md overflow-hidden bg-gray-100 dark:bg-white/5">
                {(!chartData || chartData.length === 0) ? <div className="h-full w-full bg-gray-200 dark:bg-white/10" /> : 
                 chartData.map((d, i) => {
                   const val = d[m];
                   if (val === undefined) return null;
                   const isError = (tMin !== undefined && val < tMin) || (tMax !== undefined && val > tMax);
                   return <div key={i} className="h-full flex-1" style={{ backgroundColor: isError ? '#ef4444' : '#10b981' }} title={`${d.time}: ${val}`} />
                 })
                }
              </div>
            </div>
          );
        }))}
      </div>
    </div>
  );
});

