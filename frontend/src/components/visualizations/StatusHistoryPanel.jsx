import React, { memo } from 'react';
import { GripVertical, Activity } from "lucide-react";
import { METRICS } from "../../config/metrics";

export const StatusHistoryPanel = memo(({ panel, chartData, isEditing }) => {
  const metrics = panel.metrics || [];
  
  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 font-sans tracking-wide">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 flex items-center justify-center p-2">
         {metrics.length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
             <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 mb-2">
               <Activity size={24} />
             </div>
             <span className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">No Metrics Selected</span>
             <span className="text-[11px] text-gray-400 max-w-xs">Please select metrics below to view status history heat blocks.</span>
           </div>
         ) : (
           <div className="w-full flex gap-1 h-16">
              {(!chartData || chartData.length === 0) ? null : chartData.slice(-40).map((d, i) => {
                 // Determine overall status for this time bucket across selected metrics
                 let isError = false;
                 for (const m of metrics) {
                   const val = d[m];
                   const meta = METRICS[m];
                   const tMin = meta?.thresholds?.min;
                   const tMax = meta?.thresholds?.max;
                   if (val !== undefined && ((tMin !== undefined && val < tMin) || (tMax !== undefined && val > tMax))) {
                     isError = true; break;
                   }
                 }
                 return <div key={i} className={`flex-1 rounded-sm ${isError ? 'bg-red-500' : 'bg-emerald-500'} opacity-80 hover:opacity-100 cursor-pointer transition-colors`} title={`${d.time}: ${isError ? 'Error detected' : 'Healthy'}`} />
              })}
           </div>
         )}
      </div>
    </div>
  );
});

