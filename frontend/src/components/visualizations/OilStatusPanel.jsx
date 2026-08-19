import React, { memo } from 'react';
import { GripVertical, AlertTriangle, ShieldCheck, Siren } from "lucide-react";

export const OilStatusPanel = memo(({ panel, tempData, isEditing }) => {
  const latestData = tempData || {};
  const trip = Number(latestData.oil_level_trip);
  const alarm = Number(latestData.oil_level_alarm);

  let statusText = "UNKNOWN";
  let colorClass = "bg-gray-100 text-gray-500 border-gray-200";
  let darkColorClass = "dark:bg-white/5 dark:text-gray-400 dark:border-white/10";
  let Icon = AlertTriangle;

  if (Number.isNaN(trip) || Number.isNaN(alarm)) {
    // Keep UNKNOWN
  } else if (trip === 0) {
    statusText = "TRIP";
    colorClass = "bg-red-50 text-red-600 border-red-200";
    darkColorClass = "dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
    Icon = Siren;
  } else if (alarm === 0) {
    statusText = "ALARM";
    colorClass = "bg-amber-50 text-amber-600 border-amber-200";
    darkColorClass = "dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
    Icon = AlertTriangle;
  } else {
    statusText = "SAFE";
    colorClass = "bg-emerald-50 text-emerald-600 border-emerald-200";
    darkColorClass = "dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
    Icon = ShieldCheck;
  }

  return (
    <div className="h-full w-full flex flex-col transition-colors duration-500 rounded-none overflow-hidden">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 font-sans text-center truncate flex-1 tracking-wide">{panel.title || 'Oil Status'}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 flex items-center justify-center pt-2">
        <div className={`w-full h-full flex flex-col items-center justify-center rounded-none border ${colorClass} ${darkColorClass} transition-all duration-300`}>
           <Icon size={48} className="mb-2 opacity-80" />
           <span className="text-3xl font-bold font-mono tracking-widest">{statusText}</span>
        </div>
      </div>
    </div>
  );
});

