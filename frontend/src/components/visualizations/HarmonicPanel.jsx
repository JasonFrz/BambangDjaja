import React, { memo, useMemo, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { useTrafoApi } from '../../hooks/useTrafoApi';
import { harmonicRows, harmonicPhaseLabel } from '../../config/panelHelpers';

const PHASE_COLORS = { 1: '#ef4444', 2: '#eab308', 3: '#3b82f6' };

export const HarmonicPanel = memo(({ panel, isEditing, updatePanel }) => {
  const [localSource, setLocalSource] = useState(null);
  const source = (localSource ?? panel.source) === 'current' ? 'current' : 'voltage';
  const { data, isLoading, error } = useTrafoApi('harmonics', 60000, { type: source });

  const rows = useMemo(() => harmonicRows(data), [data]);

  const setSource = (s) => { setLocalSource(s); if (updatePanel) updatePanel(panel.id, { source: s }); };

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="font-medium text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-white/10 text-[10px] font-bold">
          {['voltage', 'current'].map((s) => (
            <button key={s} onClick={(e) => { e.stopPropagation(); setSource(s); }} className={`px-2 py-0.5 ${source === s ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400'}`}>{s === 'voltage' ? 'V' : 'I'}</button>
          ))}
        </div>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 min-h-0">
        {isLoading ? <div className="h-full flex items-center justify-center text-xs text-gray-400">Loading...</div>
        : error ? <div className="h-full flex items-center justify-center text-xs text-red-400">{error}</div>
        : rows.length === 0 ? <div className="h-full flex items-center justify-center text-xs text-gray-400">No harmonic data from Raspi yet</div>
        : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="order" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v) => [`${Number(v).toFixed(2)} %`]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {[1, 2, 3].map((p) => <Bar key={p} dataKey={`phase${p}`} name={harmonicPhaseLabel(source, p)} fill={PHASE_COLORS[p]} radius={[2, 2, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
