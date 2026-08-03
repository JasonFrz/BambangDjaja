import React, { memo } from 'react';
import { GripVertical } from "lucide-react";
import { METRICS } from "../../config/metrics";

const SvgGauge = ({ percent, value, unit, isDanger, color }) => {
  const radius = 80;
  const strokeWidth = 24;
  const cx = 100;
  const cy = 90;
  const circumference = Math.PI * radius;
  const dashoffset = circumference - (percent * circumference);

  return (
    <svg viewBox="0 0 200 100" className="w-full h-full overflow-visible drop-shadow-sm">
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke="rgba(150,150,150,0.15)"
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
      />
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        strokeDasharray={circumference}
        strokeDashoffset={dashoffset}
        className="transition-all duration-700 ease-out"
      />
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        dominantBaseline="baseline"
        fontSize="34"
        fontWeight="bold"
        className={`font-sans tracking-tight ${isDanger ? 'fill-red-500' : 'fill-[#172b4d] dark:fill-white'}`}
      >
        {value.toFixed(2)}
      </text>
      <text
        x={cx}
        y={cy + 8}
        textAnchor="middle"
        dominantBaseline="hanging"
        fontSize="12"
        fontWeight="600"
        className="fill-[#8993a4] dark:fill-[#64748b]"
      >
        {unit}
      </text>
    </svg>
  );
};

export const GaugePanel = memo(({ panel, latestData, isEditing }) => {
  const metrics = panel.metrics || [];
  const meta = METRICS[metrics[0]];
  const val = latestData[metrics[0]] ?? 0;

  // Dynamic min/max defaults for the gauge bounds
  let min = meta?.thresholds?.min ?? 0;
  let max = meta?.thresholds?.max ?? (min + 100);
  if (metrics[0] === 'frequency') { min = 45; max = 55; }
  else if (metrics[0] === 'pfTotal') { min = 0; max = 1; }
  else if (meta?.group?.includes('Voltage')) { min = 0; max = 500; }
  else if (meta?.group === 'Current') { min = 0; max = 100; }
  else if (meta?.group === 'Power') { min = 0; max = 1000; }
  if (val > max) max = Math.ceil(val * 1.2);

  const percent = Math.max(0, Math.min(1, (val - min) / (max - min)));
  const tMin = meta?.thresholds?.min;
  const tMax = meta?.thresholds?.max;
  const isDanger = (tMin !== undefined && val < tMin) || (tMax !== undefined && val > tMax);
  const color = isDanger ? '#ef4444' : (meta?.color || '#3b82f6');

  return (
    <div className="h-full w-full flex flex-col relative">
      <div className={`flex items-center gap-3 mb-2 select-none z-10 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="font-semibold text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 relative overflow-hidden flex flex-col justify-end w-full pb-4">
        <SvgGauge percent={percent} value={val} unit={meta?.unit} isDanger={isDanger} color={color} />
      </div>
    </div>
  );
});
