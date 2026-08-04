import React, { memo } from 'react';
import { GripVertical, AlertTriangle, Wifi, WifiOff } from "lucide-react";

export const StatusPanel = memo(({ tempData, isLive, isEditing }) => (
  <div className="h-full w-full flex flex-col">
    <div className={`flex items-center gap-3 mb-3 select-none ${isEditing ? 'cursor-move drag-handle' : ''}`}>
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/10 shrink-0">
        <AlertTriangle size={18} />
      </div>
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-sans text-center truncate flex-1 tracking-wide">System Status</h3>
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isLive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
        {isLive ? <Wifi size={12} /> : <WifiOff size={12} />}
        {isLive ? 'Live' : 'Offline'}
      </div>
      {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
    </div>
    <div className="flex-1 flex items-center justify-center">
      <div className="grid grid-cols-2 gap-3 w-full">
        {[
          { label: 'Oil Level Alarm', value: tempData.oil_level_alarm, safe: tempData.oil_level_alarm !== 0 },
          { label: 'Oil Level Trip', value: tempData.oil_level_trip, safe: tempData.oil_level_trip !== 0 },
        ].map(item => (
          <div key={item.label} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-[#5e6c84] dark:text-[#94a3b8] font-semibold uppercase tracking-wider text-center">{item.label}</span>
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${item.safe ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${item.safe ? 'bg-emerald-500' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse'}`} />
              {item.safe ? 'CLEAR' : 'TRIGGERED'}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
));
