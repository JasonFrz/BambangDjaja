import React, { memo } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Activity, BarChart3, GripVertical } from "lucide-react";
import { METRICS } from "../../config/metrics";

export const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white/95 dark:bg-[#151521]/95 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
        {typeof label === 'number' ? new Date(label).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : label}
      </p>
      {payload.map((entry, i) => {
        const meta = METRICS[entry.dataKey];
        return (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">{meta?.label || entry.name}</span>
            <span className="text-xs font-bold text-gray-900 dark:text-white ml-auto pl-3">
              {entry.value != null ? Number(entry.value).toFixed(2) : '—'} {meta?.unit || ''}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const TimeSeriesPanel = memo(({ panel, chartData, isEditing, isSyncHoverActive }) => {
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

  const renderChart = () => {
    if (!chartData || chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
          <div className="flex flex-col items-center gap-2">
            <BarChart3 size={28} />
            <span className="text-xs font-medium">Waiting for data...</span>
          </div>
        </div>
      );
    }

    if (panel.chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} syncId={isSyncHoverActive ? "dashboardSync" : undefined}>
            <CartesianGrid {...gridProps} />
            <XAxis {...commonXAxis} />
            <YAxis {...commonYAxis} />
            <RechartsTooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {metrics.map(m => (
              <Bar key={m} dataKey={m} name={METRICS[m]?.label || m} fill={METRICS[m]?.color || '#8884d8'} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (panel.chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} syncId={isSyncHoverActive ? "dashboardSync" : undefined}>
            <CartesianGrid {...gridProps} />
            <XAxis {...commonXAxis} />
            <YAxis {...commonYAxis} />
            <RechartsTooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {metrics.map(m => (
              <Line key={m} type="monotone" dataKey={m} name={METRICS[m]?.label || m} stroke={METRICS[m]?.color || '#8884d8'} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} connectNulls isAnimationActive={false} />
            ))}
            {metrics.includes('frequency') && <ReferenceLine y={50.5} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Limit (50.5)', fill: '#ef4444', fontSize: 10 }} />}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Default: area
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} syncId={isSyncHoverActive ? "dashboardSync" : undefined}>
          <defs>
            {metrics.map(m => (
              <linearGradient key={`g-${m}`} id={`areaGrad-${m}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={METRICS[m]?.color || '#8884d8'} stopOpacity={0.25} />
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
            <Area key={m} type="monotone" dataKey={m} name={METRICS[m]?.label || m} stroke={METRICS[m]?.color || '#8884d8'} fill={`url(#areaGrad-${m})`} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} connectNulls isAnimationActive={false} />
          ))}
          {metrics.includes('frequency') && <ReferenceLine y={50.5} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Limit (50.5)', fill: '#ef4444', fontSize: 10 }} />}
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="h-full w-full flex flex-col transition-colors duration-500">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-sm font-semibold text-[#172b4d] dark:text-white font-heading truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 min-h-0">
        {renderChart()}
      </div>
    </div>
  );
});
