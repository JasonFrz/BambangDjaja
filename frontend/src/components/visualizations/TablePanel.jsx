import React, { memo } from 'react';
import { GripVertical } from "lucide-react";
import { METRICS } from "../../config/metrics";

export const TablePanel = memo(({ panel, latestData, isEditing }) => {
  const metrics = panel.metrics || [];
  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-sans text-center truncate flex-1 tracking-wide">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0 bg-white dark:bg-[#151521]">
              <th className="py-2 px-3 font-semibold">Metric</th>
              <th className="py-2 px-3 font-semibold text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(m => {
              const meta = METRICS[m];
              const val = latestData?.[m] ?? 0;
              return (
                <tr key={m} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta?.color || '#3b82f6' }} />
                    {meta?.label || m}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                    {val.toFixed(2)} <span className="text-gray-400 text-[10px] font-sans">{meta?.unit}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
