import React, { memo, useState } from 'react';
import { GripVertical, ShieldCheck, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { useTrafoApi } from '../../hooks/useTrafoApi';

const BADGE = {
  alarm: 'bg-amber-400 text-black',
  trip: 'bg-red-500 text-white',
};

// dashboard-documentation bagian 5: hanya parameter yang tidak Normal (kode != 3) yang ditampilkan,
// dengan rekomendasi yang bisa dibuka; kalau semua Normal tampil "All Systems Optimal".
export const TransformerStatusPanel = memo(({ panel, isEditing }) => {
  const { data, isLoading, error } = useTrafoApi('status', 60000);
  const [open, setOpen] = useState(null);
  const noStatus = !!data && data.hasStatus === false;
  const items = (noStatus ? [] : (data && data.items)) || [];
  const abnormal = items.filter((i) => i.level !== 'normal');
  const tripActive = (data && data.tripActive) || [];

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="font-medium text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        {data && !noStatus && !data.allSafe && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-500"><AlertTriangle size={12} /> {data.counts.alarm} alarm · {data.counts.trip} trip</span>
        )}
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      {isLoading ? <div className="flex-1 flex items-center justify-center text-xs text-gray-400">Loading...</div>
      : error ? <div className="flex-1 flex items-center justify-center text-xs text-red-400">{error}</div>
      : noStatus ? <div className="flex-1 flex items-center justify-center text-xs text-gray-400">No status data from Raspi yet</div>
      : abnormal.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <ShieldCheck size={40} className="animate-pulse" />
          <div className="text-lg font-bold">All Systems Optimal</div>
          <div className="text-[11px] opacity-80">All transformer parameters are operating within normal limits.</div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <table className="w-full text-[11px] text-[#172b4d] dark:text-gray-200">
            <thead className="text-[10px] uppercase tracking-wider text-gray-500 text-left">
              <tr>
                <th className="py-1 pr-2 font-bold">Parameter</th>
                <th className="py-1 pr-2 font-bold">Status</th>
                <th className="py-1 pr-2 font-bold">Description</th>
                <th className="py-1 font-bold">Recommendations</th>
              </tr>
            </thead>
            <tbody>
              {abnormal.map((it) => (
                <React.Fragment key={it.parameter}>
                  <tr className="border-t border-gray-100 dark:border-white/10">
                    <td className="py-1.5 pr-2 font-bold">{it.parameter}</td>
                    <td className="py-1.5 pr-2"><span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${BADGE[it.level]}`}>{it.level === 'trip' ? 'Trip' : 'Alarm'}</span></td>
                    <td className="py-1.5 pr-2">{it.label}{tripActive.includes(it.parameter) ? ' · TRIP' : ''}</td>
                    <td className="py-1.5">
                      {it.recommendations.length === 0 ? <span className="text-gray-400">-</span> : (
                        <button onClick={() => setOpen(open === it.parameter ? null : it.parameter)} className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold">
                          {open === it.parameter ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {it.recommendations.length} steps
                        </button>
                      )}
                    </td>
                  </tr>
                  {open === it.parameter && (
                    <tr>
                      <td colSpan={4} className="pb-2">
                        <ol className="list-decimal pl-5 space-y-0.5 text-gray-600 dark:text-gray-300">{it.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ol>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
