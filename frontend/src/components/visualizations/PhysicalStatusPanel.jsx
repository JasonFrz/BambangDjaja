import React, { memo } from 'react';
import { GripVertical } from 'lucide-react';
import { useTrafoApi } from '../../hooks/useTrafoApi';

const badge = (level) => level === 'trip' ? 'bg-red-500 text-white' : level === 'alarm' ? 'bg-amber-400 text-black' : 'bg-emerald-500 text-white';
const fmtTime = (t) => (t ? new Date(t).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }) : '-');

const Card = ({ title, children }) => (
  <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3 flex flex-col gap-1 min-w-0">
    <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500">{title}</div>
    {children}
  </div>
);

export const PhysicalStatusPanel = memo(({ panel, isEditing }) => {
  const { data, isLoading, error } = useTrafoApi('physical', 30000);
  const p = data || {};
  const pressure = p.pressure || {};
  const pct = pressure.value !== null && pressure.value !== undefined ? Math.max(0, Math.min(100, (pressure.value / 1) * 100)) : 0;
  const refPct = ((pressure.reference || 0.5) / 1) * 100;
  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="font-medium text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      {isLoading ? <div className="flex-1 flex items-center justify-center text-xs text-gray-400">Loading...</div>
      : error ? <div className="flex-1 flex items-center justify-center text-xs text-red-400">{error}</div>
      : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar grid grid-cols-2 lg:grid-cols-3 gap-2 text-[#172b4d] dark:text-white">
          <Card title="Tap Position">
            <div className="text-xl font-bold">{p.tap && p.tap.display !== null && p.tap.display !== undefined ? p.tap.display : '-'}</div>
            <div className="text-[10px] text-gray-500">{p.tap && p.tap.type ? `${p.tap.type}${p.tap.plus !== null ? ` · +${p.tap.plus}/-${p.tap.minus}` : ''}` : 'No nameplate data'}</div>
          </Card>
          <Card title="Oil Level">
            <span className={`self-start px-2 py-0.5 rounded-md text-xs font-bold ${badge(p.oilLevel ? p.oilLevel.level : 'normal')}`}>{p.oilLevel ? p.oilLevel.label : '-'}</span>
            <div className="text-[10px] text-gray-500">sensor: {p.oilLevel && p.oilLevel.raw === 1 ? 'normal' : p.oilLevel && p.oilLevel.raw === 0 ? 'low' : '-'}</div>
          </Card>
          <Card title="Tank Pressure">
            <div className="text-xl font-bold">{pressure.value !== null && pressure.value !== undefined ? `${Number(pressure.value).toFixed(2)} Bar` : '-'}</div>
            <div className="relative h-2 rounded-full bg-gray-200 dark:bg-white/10 overflow-visible">
              <div className={`h-2 rounded-full ${pressure.level === 'trip' ? 'bg-red-500' : pressure.level === 'alarm' ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
              <div className="absolute -top-1 h-4 w-0.5 bg-red-500" style={{ left: `${refPct}%` }} title={`Reference ${pressure.reference || 0.5} Bar`} />
            </div>
            <div className="text-[10px] text-gray-500">reference {pressure.reference || 0.5} Bar · {pressure.level || '-'}</div>
          </Card>
          <Card title="Last Gas Fault">
            <div className="text-xs font-bold">{p.gasFault ? `${p.gasFault.failure_type} (${p.gasFault.parameterValue ?? '-'})` : 'None'}</div>
            <div className="text-[10px] text-gray-500">{p.gasFault ? fmtTime(p.gasFault.time_start) : '-'}</div>
          </Card>
          <Card title="Sudden Pressure">
            <span className={`self-start px-2 py-0.5 rounded-md text-xs font-bold ${p.suddenPressure && Number(p.suddenPressure.flag) === 1 ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>{p.suddenPressure && Number(p.suddenPressure.flag) === 1 ? 'ACTIVE' : 'Normal'}</span>
            <div className="text-[10px] text-gray-500">{p.suddenPressure && p.suddenPressure.lastLog ? fmtTime(p.suddenPressure.lastLog.time_start) : 'no logs'}</div>
          </Card>
          <Card title="Last Updated">
            <div className="text-xs font-bold">{fmtTime(p.timestamp)}</div>
            <div className="text-[10px] text-gray-500">latest real-time data</div>
          </Card>
        </div>
      )}
    </div>
  );
});
