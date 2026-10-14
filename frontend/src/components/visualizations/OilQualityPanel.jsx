import React, { memo } from 'react';
import { GripVertical, Droplets } from 'lucide-react';
import { useTrafoApi } from '../../hooks/useTrafoApi';
import { oilConditionClass } from '../../config/panelHelpers';

const Item = ({ label, value, unit }) => (
  <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3 flex flex-col">
    <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500">{label}</div>
    <div className="text-xl font-bold text-[#172b4d] dark:text-white">{value === null || value === undefined ? '-' : `${value}${unit ? ` ${unit}` : ''}`}</div>
  </div>
);

export const OilQualityPanel = memo(({ panel, latestData, isEditing }) => {
  const { data, isLoading } = useTrafoApi('oil-quality', 300000);
  const available = data && data.available;
  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="font-medium text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      {isLoading ? <div className="flex-1 flex items-center justify-center text-xs text-gray-400">Memuat...</div> : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-2">
          <Item label="Hydrogen (H2)" value={latestData && latestData.h2ppm} unit="ppm" />
          <Item label="Moisture" value={latestData && latestData.moisturePpm} unit="ppm" />
          {available ? (<>
            <Item label="Water Activity" value={data.waterActivity} unit="" />
            <Item label="Oil BDV" value={data.oilBDV} unit="kV" />
            <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3 flex flex-col gap-1">
              <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Oil Condition</div>
              <span className={`self-start px-2 py-0.5 rounded-md text-sm font-bold ${oilConditionClass(data.oilCondition)}`}>{data.oilCondition || '-'}</span>
            </div>
          </>) : (
            <div className="col-span-2 rounded-xl border border-dashed border-gray-300 dark:border-white/10 p-3 text-[11px] text-gray-500 flex items-center gap-2">
              <Droplets size={14} /> Water activity, BDV, dan kondisi oli belum tersedia di database ini (kolom tidak ada di skema `transformer_data`).
            </div>
          )}
        </div>
      )}
    </div>
  );
});
