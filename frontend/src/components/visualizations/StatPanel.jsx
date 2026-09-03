import React, { memo } from 'react';
import { GripVertical, TrendingUp } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { METRICS } from "../../config/metrics";

export const StatPanel = memo(({ panel, latestData, chartData, isEditing }) => {
  const metrics = panel.metrics || [];

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-3 select-none ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="font-medium text-[#172b4d] dark:text-white text-sm font-heading tracking-tight truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>

      {metrics.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 mb-2">
            <TrendingUp size={24} />
          </div>
          <span className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">No Metrics Selected</span>
          <span className="text-[11px] text-gray-400 max-w-xs">Please select one or more metrics below to display live stats.</span>
        </div>
      ) : metrics.length === 1 ? (
        <div className="flex-1 flex flex-col min-h-0 relative group" style={{ containerType: 'inline-size' }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center pb-8 z-10 pointer-events-none">
            <span className="font-bold text-[#172b4d] dark:text-white font-mono tracking-tight drop-shadow-md leading-none" style={{ fontSize: 'clamp(24px, 20cqi, 72px)' }}>
              {(latestData[metrics[0]] ?? 0).toFixed(2)}
            </span>
            <span className="font-semibold text-[#8993a4] dark:text-[#64748b] mt-1" style={{ fontSize: 'clamp(10px, 5cqi, 16px)' }}>{METRICS[metrics[0]]?.unit}</span>
          </div>
          {chartData && chartData.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-2/5 opacity-40 group-hover:opacity-80 transition-opacity">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`spark-${panel.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={METRICS[metrics[0]]?.color || '#3b82f6'} stopOpacity={0.5} />
                      <stop offset="95%" stopColor={METRICS[metrics[0]]?.color || '#3b82f6'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey={metrics[0]} stroke={METRICS[metrics[0]]?.color || '#3b82f6'} fill={`url(#spark-${panel.id})`} strokeWidth={2} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center gap-2 overflow-y-auto custom-scrollbar">
          {metrics.map(m => {
            const meta = METRICS[m];
            if (!meta) return null;
            return (
              <div key={m} className="flex justify-between items-center px-3 py-2 rounded-xl bg-gray-50/50 dark:bg-white/[0.03] border border-gray-100/50 dark:border-white/[0.04] transition-colors hover:bg-gray-100/70 dark:hover:bg-white/[0.06]">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                  <span className="text-[#5e6c84] dark:text-[#94a3b8] font-medium text-xs truncate">{meta.label}</span>
                </div>
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className="text-base font-bold text-[#172b4d] dark:text-white font-mono">{(latestData[m] ?? 0).toFixed(2)}</span>
                  {meta.unit && <span className="text-[10px] font-semibold text-[#8993a4] dark:text-[#64748b]">{meta.unit}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

