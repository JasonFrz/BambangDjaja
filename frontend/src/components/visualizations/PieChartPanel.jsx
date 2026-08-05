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
  }));

  const sum = data.reduce((acc, d) => acc + Math.abs(d.value), 0);
  const renderData = data.map(d => ({ ...d, renderValue: sum === 0 ? 1 : Math.max(Math.abs(d.value), 0.0001) }));

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-sans text-center truncate flex-1 tracking-wide">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 min-h-0">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-xs">Select metrics to display</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie 
                data={renderData} 
                cx="50%" 
                cy="50%" 
                innerRadius="50%" 
                outerRadius="80%" 
                paddingAngle={2} 
                dataKey="renderValue" 
                stroke="none" 
                minAngle={15} 
                isAnimationActive={true}
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {renderData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color} 
                    style={{ transition: 'fill 0.8s ease-in-out, stroke 0.8s ease-in-out' }}
                  />
                ))}
              </Pie>
              <RechartsTooltip 
                formatter={(val, name, props) => [props.payload.value.toFixed(2), name]}
                contentStyle={{ backgroundColor: '#1a1a2e', borderColor: '#ffffff20', color: 'white', borderRadius: '8px' }} 
                itemStyle={{ color: 'white' }} 
              />
              <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
