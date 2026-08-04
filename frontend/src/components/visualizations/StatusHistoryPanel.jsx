import React, { memo } from 'react';
import { GripVertical } from "lucide-react";
import { METRICS } from "../../config/metrics";

export const StatusHistoryPanel = memo(({ panel, chartData, isEditing }) => {
  const metrics = panel.metrics || [];
  
  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-sans text-center truncate flex-1 tracking-wide">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 flex items-center justify-center p-2">
         {metrics.length === 0 ? <div className="text-xs text-gray-400">Select metrics</div> : (
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
