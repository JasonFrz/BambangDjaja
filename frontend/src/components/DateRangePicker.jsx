import React from 'react';
import { Calendar } from 'lucide-react';

export const DateRangePicker = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-1.5 p-1 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs shadow-xs ${className}`}>
      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 pl-1.5">
        <Calendar size={12} />
      </span>
      <input
        type="date"
        value={startDate || ''}
        onChange={(e) => onStartDateChange(e.target.value)}
        className="text-xs py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:border-indigo-500 font-medium"
        title="Start Date"
      />
      <span className="text-slate-400 text-xs">-</span>
      <input
        type="date"
        value={endDate || ''}
        onChange={(e) => onEndDateChange(e.target.value)}
        className="text-xs py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:border-indigo-500 font-medium"
        title="End Date"
      />
    </div>
  );
};

export default DateRangePicker;
