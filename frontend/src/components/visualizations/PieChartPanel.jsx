import React, { memo } from 'react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { GripVertical } from "lucide-react";
import { METRICS } from "../../config/metrics";

export const PieChartPanel = memo(({ panel, latestData, isEditing }) => {
  const metrics = panel.metrics || [];
  const data = metrics.map(m => ({
    name: METRICS[m]?.label || m,
    value: latestData?.[m] || 0,
    color: METRICS[m]?.color || '#8884d8'
  })).filter(d => d.value > 0);

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-sm font-semibold text-[#172b4d] dark:text-white font-heading truncate flex-1">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie data={data} cx="50%" cy="50%" innerRadius="50%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <RechartsTooltip contentStyle={{ backgroundColor: '#1a1a2e', borderColor: '#ffffff20', color: 'white', borderRadius: '8px' }} itemStyle={{ color: 'white' }} />
            <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
