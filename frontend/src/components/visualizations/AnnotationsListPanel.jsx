import React, { memo, useMemo } from 'react';
import { GripVertical } from "lucide-react";

export const AnnotationsListPanel = memo(({ panel, chartData, isEditing }) => {
  const annotations = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    const list = [];
    // Scan recent chart data for significant events
    const recent = chartData.slice(-20);
    
    // Check phase A voltage spike
    if (recent.some(d => d['PhaseAVoltage'] > 240)) {
       list.push({ t: "Overvoltage detected on Phase A", user: "system", time: recent[recent.length-1]?.time, c: "bg-red-500" });
    } else if (recent.some(d => d['PhaseAVoltage'] < 200)) {
       list.push({ t: "Undervoltage detected on Phase A", user: "system", time: recent[recent.length-1]?.time, c: "bg-amber-500" });
    }
    
    // Check Temperature
    if (recent.some(d => d['OilTemp'] > 80)) {
       list.push({ t: "Oil Temperature Critical", user: "sensor_mon", time: recent[recent.length-1]?.time, c: "bg-red-500" });
    }
    
    // Always add some standard logs
    list.push({ t: "Automated scan completed", user: "system", time: chartData[chartData.length-5]?.time || "Recent", c: "bg-blue-500" });
    list.push({ t: "System initialized", user: "admin", time: chartData[0]?.time || "Startup", c: "bg-emerald-500" });
    
    return list;
  }, [chartData]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-sm font-semibold text-[#172b4d] dark:text-white font-heading truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 overflow-auto flex flex-col gap-3 relative pl-3 py-1 custom-scrollbar">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200 dark:bg-white/10" />
        {annotations.map((a, i) => (
          <div key={i} className="flex gap-3 relative z-10">
            <div className={`w-2.5 h-2.5 rounded-full ${a.c} mt-1.5 ring-4 ring-white dark:ring-[#151521]`} />
            <div className="flex flex-col flex-1 bg-white dark:bg-white/5 p-2 rounded-lg border border-gray-100 dark:border-white/5 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-gray-500">{a.user}</span>
                <span className="text-[9px] text-gray-400">{a.time}</span>
              </div>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{a.t}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
