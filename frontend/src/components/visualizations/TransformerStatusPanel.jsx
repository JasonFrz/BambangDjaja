import React, { memo, useState } from 'react';
import { GripVertical, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useTrafoApi } from '../../hooks/useTrafoApi';

const LEVEL_CLASS = {
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  alarm: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  trip: 'bg-red-50 text-red-700 border-red-300 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30',
};

export const TransformerStatusPanel = memo(({ panel, isEditing }) => {
  const { data, isLoading, error } = useTrafoApi('status', 60000);
  const [open, setOpen] = useState(null);
  const noStatus = !!data && data.hasStatus === false;
  const items = (noStatus ? [] : (data && data.items)) || [];
  const abnormal = items.filter((i) => i.level !== 'normal');
  const selected = items.find((i) => i.parameter === open);

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="font-medium text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        {data && !noStatus && (data.allSafe
          ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><ShieldCheck size={12} /> Semua Normal</span>
          : <span className="flex items-center gap-1 text-[10px] font-bold text-red-500"><AlertTriangle size={12} /> {data.counts.alarm} alarm · {data.counts.trip} trip</span>)}
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      {isLoading ? <div className="flex-1 flex items-center justify-center text-xs text-gray-400">Memuat...</div>
      : error ? <div className="flex-1 flex items-center justify-center text-xs text-red-400">{error}</div>
      : noStatus ? <div className="flex-1 flex items-center justify-center text-xs text-gray-400">Belum ada data status dari Raspi</div>
      : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
            {items.map((it) => (
              <button key={it.parameter} onClick={() => setOpen(open === it.parameter ? null : it.parameter)}
                className={`rounded-lg border px-2 py-1.5 text-left transition-colors ${LEVEL_CLASS[it.level]} ${open === it.parameter ? 'ring-2 ring-blue-400' : ''}`}>
                <div className="text-[10px] font-bold truncate">{it.parameter}</div>
                <div className="text-[10px] opacity-80 truncate">{it.label}{data.tripActive && data.tripActive.includes(it.parameter) ? ' · TRIP' : ''}</div>
              </button>
            ))}
          </div>
          {selected && (
            <div className="mt-2 rounded-lg border border-gray-200 dark:border-white/10 p-2 text-[11px] text-[#172b4d] dark:text-gray-200">
              <div className="font-bold mb-1">{selected.parameter}: {selected.label}</div>
              {selected.recommendations.length === 0 ? <div className="text-gray-400">Tidak ada rekomendasi (status normal).</div>
                : <ol className="list-decimal pl-4 space-y-0.5">{selected.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ol>}
            </div>
          )}
          {abnormal.length === 0 && !selected && <div className="mt-2 text-[10px] text-gray-400">Klik parameter untuk melihat rekomendasi.</div>}
        </div>
      )}
    </div>
  );
});
