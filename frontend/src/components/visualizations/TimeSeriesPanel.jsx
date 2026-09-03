import React, { memo, useState, useMemo } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Activity, BarChart3, GripVertical } from "lucide-react";
import { METRICS } from "../../config/metrics";
import EnergyLoader from "../../components/EnergyLoader";
import { useTrendData } from "../../contexts/TrendDataContext";

export const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white dark:bg-[#111217] border border-gray-200 dark:border-[#32363e] rounded-sm px-4 py-3 shadow-2xl">
      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider font-mono">
        {typeof label === 'number' ? new Date(label).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : label}
      </p>
      {payload.map((entry, i) => {
        const meta = METRICS[entry.dataKey];
        return (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">{meta?.label || entry.name}</span>
            <span className="text-xs font-bold text-gray-900 dark:text-white ml-auto pl-3 font-mono">
              {entry.value != null ? Number(entry.value).toFixed(2) : '—'} <span className="font-sans text-[10px] font-semibold">{meta?.unit || ''}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const TimeSeriesPanel = memo(({ panel, chartData, isEditing, isSyncHoverActive }) => {
  const { isLoading } = useTrendData() || { isLoading: false };
  const metrics = panel.metrics || [];
  
  const commonXAxis = {
    dataKey: "time", tick: { fontSize: 10, fill: '#94a3b8' }, tickLine: false,
    axisLine: { stroke: '#e2e8f033' }, interval: 'preserveStartEnd', minTickGap: 50,
  };
  const commonYAxis = {
    tick: { fontSize: 10, fill: '#94a3b8' }, tickLine: false, axisLine: false, width: 50,
    domain: ['auto', 'auto'],
  };
  const gridProps = { strokeDasharray: "3 3", stroke: '#e2e8f020', vertical: false };

  const [timeWindow, setTimeWindow] = useState(15);

  const displayData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    if (timeWindow >= chartData.length) return chartData;
    return chartData.slice(-timeWindow);
  }, [chartData, timeWindow]);

  const renderChart = () => {
    if (metrics.length === 0) {
      return (
        <div className="h-full w-full flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 mb-2">
            <Activity size={24} />
          </div>
          <span className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
            No Metrics Selected
          </span>
          <span className="text-[11px] text-gray-400 max-w-xs">
            Please select one or more metrics below to plot time series trends.
          </span>
        </div>
      );
    }

    if (!displayData || displayData.length === 0) {
      if (isLoading) {
        return (
          <div className="flex items-center justify-center h-full">
            <EnergyLoader size="small" text="Loading data..." />
          </div>
        );
      }
      return (
        <div className="flex items-center justify-center h-full">
          <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold">Data not found</span>
        </div>
      );
    }

    if (panel.chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} syncId={isSyncHoverActive ? "dashboardSync" : undefined}>
            <CartesianGrid {...gridProps} />
            <XAxis {...commonXAxis} />
            <YAxis {...commonYAxis} />
            <RechartsTooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {metrics.map(m => (
              <Bar key={m} dataKey={m} name={METRICS[m]?.label || m} fill={METRICS[m]?.color || '#8884d8'} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={true} animationDuration={400} animationEasing="ease-out" />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (panel.chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} syncId={isSyncHoverActive ? "dashboardSync" : undefined}>
            <CartesianGrid {...gridProps} />
            <XAxis {...commonXAxis} />
            <YAxis {...commonYAxis} />
            <RechartsTooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {metrics.map(m => (
              <Line key={m} type="monotone" dataKey={m} name={METRICS[m]?.label || m} stroke={METRICS[m]?.color || '#8884d8'} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} connectNulls isAnimationActive={true} animationDuration={400} animationEasing="ease-out" />
            ))}
            {metrics.includes('frequency') && <ReferenceLine y={50.5} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Limit (50.5)', fill: '#ef4444', fontSize: 10 }} />}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Default: area
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={displayData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} syncId={isSyncHoverActive ? "dashboardSync" : undefined}>
          <defs>
            {metrics.map(m => (
              <linearGradient key={`g-${m}`} id={`areaGrad-${m}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={METRICS[m]?.color || '#8884d8'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={METRICS[m]?.color || '#8884d8'} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis {...commonXAxis} />
          <YAxis {...commonYAxis} />
          <RechartsTooltip content={<ChartTooltip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          {metrics.map(m => (
            <Area key={m} type="monotone" dataKey={m} name={METRICS[m]?.label || m} stroke={METRICS[m]?.color || '#8884d8'} fill={`url(#areaGrad-${m})`} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} connectNulls isAnimationActive={true} animationDuration={400} animationEasing="ease-out" />
          ))}
          {metrics.includes('frequency') && <ReferenceLine y={50.5} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Limit (50.5)', fill: '#ef4444', fontSize: 10 }} />}
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="h-full w-full flex flex-col transition-colors duration-500">
      <div className={`flex items-center justify-between gap-2 px-1 mb-1.5 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 font-sans truncate tracking-wide">{panel.title}</h3>

          {/* Time Window Pills (15s / 30s / 60s) */}
          <div className="inline-flex p-0.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[10px] font-medium shrink-0 ml-1">
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
                className={`px-1.5 py-0.5 rounded transition-all duration-200 cursor-pointer ${
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
        </div>

        <div className="flex items-center gap-2 shrink-0 pr-14">
          {isEditing && <GripVertical size={16} className="text-gray-400 shrink-0" />}
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col h-full w-full">
        {renderChart()}
      </div>
    </div>
  );
});

