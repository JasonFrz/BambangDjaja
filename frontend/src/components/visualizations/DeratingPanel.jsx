import React, { memo } from 'react';
import { GripVertical } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = { used: '#3b82f6', free: '#10b981', lost: '#ef4444' };

const PhasePie = ({ label, d }) => {
  if (!d) return <div className="flex-1 flex items-center justify-center text-xs text-gray-400">-</div>;
  const used = Math.max(0, Number(d.used) || 0);
  const available = Math.max(0, Number(d.available) || 0);
  const lost = Math.max(0, Number(d.lost) || 0);
  const free = Math.max(0, available - used);
  const data = [{ name: 'Terpakai', key: 'used', value: used }, { name: 'Sisa', key: 'free', value: free }, { name: 'Hilang (de-rating)', key: 'lost', value: lost }];
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center">
      <ResponsiveContainer width="100%" height="80%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
            {data.map((e) => <Cell key={e.key} fill={COLORS[e.key]} />)}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v, n) => [`${Number(v).toFixed(2)} kVA`, n]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="text-[11px] font-bold text-[#172b4d] dark:text-white">{label}</div>
      <div className="text-[10px] text-gray-500">{available.toFixed(1)} / {Number(d.full || 0).toFixed(1)} kVA{d.kRated ? ` · K${d.kRated}` : ''}</div>
    </div>
  );
};

export const DeratingPanel = memo(({ panel, latestData, isEditing }) => {
  const dr = latestData && latestData.derating;
  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="font-medium text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        <div className="flex gap-2 text-[10px] text-gray-500">
          <span><i className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: COLORS.used }} />Terpakai</span>
          <span><i className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: COLORS.free }} />Sisa</span>
          <span><i className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: COLORS.lost }} />Hilang</span>
        </div>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      {!dr ? <div className="flex-1 flex items-center justify-center text-xs text-gray-400">Menunggu data meter (nameplate ratedPower diperlukan)</div>
        : <div className="flex-1 min-h-0 flex gap-2"><PhasePie label="Fase R" d={dr.a} /><PhasePie label="Fase S" d={dr.b} /><PhasePie label="Fase T" d={dr.c} /></div>}
    </div>
  );
});
