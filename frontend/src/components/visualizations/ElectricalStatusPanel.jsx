import React, { memo } from 'react';
import { GripVertical } from 'lucide-react';
import { useTrafoApi } from '../../hooks/useTrafoApi';

// dashboard-documentation 4.2 P: badge status dari transformer_status (Van/Vbn/Vcn memakai kode Vab/Vbc/Vca)
// dan Leading/Lagging dari tanda Qa/Qb/Qc (dihitung backend sebagai latestData.leadLag).
const GROUPS = [
  { title: 'Tegangan (V-N dan V-V)', params: ['Vab', 'Vbc', 'Vca'] },
  { title: 'Arus', params: ['Current1', 'Current2', 'Current3'] },
  { title: 'Power Quality', params: ['PF', 'Freq'] },
];
const LEVEL_CLASS = {
  normal: 'text-gray-400',
  alarm: 'px-1.5 rounded bg-amber-400 text-black',
  trip: 'px-1.5 rounded bg-red-500 text-white',
};
const LEAD_LAG = {
  leading: { text: 'Leading', cls: 'bg-blue-500 text-white' },
  lagging: { text: 'Lagging', cls: 'bg-orange-500 text-white' },
  unity: { text: 'Unity', cls: 'bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-300' },
};

export const ElectricalStatusPanel = memo(({ panel, latestData, isEditing }) => {
  const { data } = useTrafoApi('status', 60000);
  const hasStatus = !!data && data.hasStatus !== false;
  const byParam = Object.fromEntries(((hasStatus && data.items) || []).map((i) => [i.parameter, i]));
  const leadLag = (latestData && latestData.leadLag) || {};

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 -none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="font-medium text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-2 text-[11px] text-[#172b4d] dark:text-gray-200">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">{g.title}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {g.params.map((p) => {
                const it = byParam[p];
                return (
                  <span key={p} className="flex items-center gap-1">
                    <span className="font-bold">{p}</span>
                    <span className={`text-[10px] font-bold ${it ? LEVEL_CLASS[it.level] : 'text-gray-400'}`}>{it ? it.label : '-'}</span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">Reactive Power</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[['Qa', 'a'], ['Qb', 'b'], ['Qc', 'c']].map(([name, k]) => {
              const ll = LEAD_LAG[leadLag[k]];
              return (
                <span key={name} className="flex items-center gap-1">
                  <span className="font-bold">{name}</span>
                  <span className={`px-1.5 rounded text-[10px] font-bold ${ll ? ll.cls : 'text-gray-400'}`}>{ll ? ll.text : '-'}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
