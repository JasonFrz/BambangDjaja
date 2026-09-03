import React, { memo, useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import { GripVertical, BarChart3, Activity } from "lucide-react";
import { METRICS } from "../../config/metrics";
import { ChartTooltip } from "./TimeSeriesPanel";

export const BarChartPanel = memo(({ panel, chartData, isEditing, isSyncHoverActive }) => {
  const metrics = (panel.metrics || []).slice(0, 3);
  
  // Window selector state: 15 points (spacious), 30 points (balanced), 60 points (all)
  const [timeWindow, setTimeWindow] = useState(20);

  // Sliced data based on selected window
  const displayData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    if (timeWindow >= chartData.length) return chartData;
    return chartData.slice(-timeWindow);
  }, [chartData, timeWindow]);

  // Latest readings for header live metrics display
  const latestPoint = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    return chartData[chartData.length - 1];
  }, [chartData]);

  // Bulletproof syncMethod for synchronized hover across all charts
  const handleSyncMethod = useCallback((tooltipTicks, syncData) => {
    if (!syncData || !tooltipTicks || tooltipTicks.length === 0) return -1;

    // 1. Direct match by time label
    if (syncData.activeLabel) {
      const exactIdx = tooltipTicks.findIndex(t => t.value === syncData.activeLabel);
      if (exactIdx !== -1) return exactIdx;
    }

    // 2. If hovering on the far-right (latest data) on any other chart, lock to our far-right
    if (typeof syncData.activeTooltipIndex === 'number') {
      if (syncData.activeTooltipIndex >= 55) {
        return tooltipTicks.length - 1;
      }
      // 3. Proportional position fallback for synchronized movement
      const ratio = syncData.activeTooltipIndex / 60;
      const mappedIdx = Math.round(ratio * (tooltipTicks.length - 1));
      return Math.max(0, Math.min(tooltipTicks.length - 1, mappedIdx));
    }

    return -1;
  }, []);

  // Compute responsive bar sizing based on density
  const barSize = useMemo(() => {
    if (timeWindow <= 15) return 14;
    if (timeWindow <= 25) return 10;
    if (timeWindow <= 35) return 7;
    return 4;
  }, [timeWindow]);

  const panelId = panel.id || 'bar';

  return (
    <div className="h-full w-full flex flex-col transition-colors duration-300">
      {/* ─── Premium Header Bar ─── */}
      <div className={`flex items-center justify-between gap-2 px-1 mb-1.5 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-blue-500/10 text-blue-500 dark:text-blue-400 shrink-0">
            <BarChart3 size={14} />
          </div>
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 font-sans truncate tracking-wide">
            {panel.title}
          </h3>
        </div>

        {/* Header Right: Live Metric Badges & Window Selector */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Latest Metric Chips */}
          {latestPoint && (
            <div className="hidden sm:flex items-center gap-1.5">
              {metrics.map(m => {
                const val = latestPoint[m];
                const meta = METRICS[m];
                if (val === undefined || val === null) return null;
                return (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 border border-gray-200/60 dark:border-white/10"
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta?.color || '#3b82f6' }} />
                    <span className="text-gray-500 dark:text-gray-400 font-sans text-[9px]">{meta?.label?.split(' ')[0] || m}:</span>
                    <span className="font-bold text-gray-800 dark:text-gray-100">{Number(val).toFixed(1)}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Time Window Pills (15s / 30s / 60s) */}
          <div className="inline-flex p-0.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[10px] font-medium">
            {[
              { label: '15s', val: 15 },
              { label: '30s', val: 30 },
              { label: '60s', val: 60 }
            ].map(tab => (
              <button
                key={tab.val}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTimeWindow(tab.val);
                }}
                className={`px-1.5 py-0.5 rounded transition-all duration-200 ${
                  timeWindow === tab.val
                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs font-semibold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
                title={`Show last ${tab.label} window`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isEditing && <GripVertical size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />}
        </div>
      </div>

      {/* ─── Chart Area ─── */}
      <div className="flex-1 min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={displayData}
            margin={{ top: 8, right: 10, bottom: 0, left: -10 }}
            syncId={isSyncHoverActive ? "dashboardSync" : undefined}
            syncMethod={handleSyncMethod}
            barCategoryGap={timeWindow <= 15 ? "32%" : timeWindow <= 30 ? "24%" : "15%"}
            barGap={timeWindow <= 15 ? 3 : 2}
          >
            <defs>
              {metrics.map(m => {
                const color = METRICS[m]?.color || '#8884d8';
                return (
                  <linearGradient key={`barGrad-${panelId}-${m}`} id={`barGrad-${panelId}-${m}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.45} />
                  </linearGradient>
                );
              })}
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="currentColor"
              className="text-gray-200/80 dark:text-white/5"
            />

            <XAxis
              dataKey="time"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#94a3b830' }}
              minTickGap={45}
              interval="preserveStartEnd"
            />

            <YAxis
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={45}
              domain={['auto', 'auto']}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
            />

            <RechartsTooltip
              content={<ChartTooltip />}
              cursor={{ fill: 'rgba(148, 163, 184, 0.12)', radius: 4 }}
            />

            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 4, color: '#94a3b8' }}
            />

            {metrics.map(m => (
              <Bar
                key={m}
                dataKey={m}
                name={METRICS[m]?.label || m}
                fill={`url(#barGrad-${panelId}-${m})`}
                radius={[4, 4, 0, 0]}
                maxBarSize={barSize}
                isAnimationActive={true}
                animationDuration={400}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
