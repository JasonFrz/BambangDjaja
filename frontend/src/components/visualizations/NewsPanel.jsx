import React, { memo } from 'react';
import { GripVertical, Rss } from "lucide-react";

export const NewsPanel = memo(({ panel, latestData, isEditing }) => {
  // We use latestData to generate mock "system news" based on real values
  const sysLoad = latestData?.['SystemLoad'] || 0;
  const temp = latestData?.['OilTemp'] || 0;
  
  const news = [
    { t: sysLoad > 80 ? "System Load High Warning" : "System Running Optimally", d: "Just now", tag: sysLoad > 80 ? "Alert" : "Info", color: sysLoad > 80 ? 'text-red-500' : 'text-blue-500' },
    { t: temp > 70 ? "Oil Temperature above normal" : "Temperature Checks Passed", d: "10 mins ago", tag: "Sensor", color: temp > 70 ? 'text-amber-500' : 'text-emerald-500' },
    { t: "Scheduled Maintenance for Substation B", d: "1 day ago", tag: "Notice", color: 'text-blue-500' },
    { t: "Firmware v4.2.1 Deployed", d: "3 days ago", tag: "Update", color: 'text-blue-500' }
  ];

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-sm font-semibold text-[#172b4d] dark:text-white font-heading truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 overflow-auto flex flex-col gap-3 pr-2 custom-scrollbar">
        {news.map((n, i) => (
          <div key={i} className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 flex flex-col gap-1 border border-transparent hover:border-gray-200 dark:hover:border-white/10 cursor-pointer transition-colors">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${n.color}`}>{n.tag}</span>
              <span className="text-[10px] text-gray-400 flex items-center gap-1"><Rss size={10} /> {n.d}</span>
            </div>
            <h4 className="text-xs font-semibold text-gray-800 dark:text-white mt-1">{n.t}</h4>
          </div>
        ))}
      </div>
    </div>
  );
});
