import React, { memo } from 'react';
import { GitCommit, GripVertical, CheckCircle2, Zap } from "lucide-react";
import { METRICS } from "../../config/metrics";

export const TransformerSLDPanel = memo(({ panel, latestData, isEditing }) => {
  const userMetrics = panel.metrics || [];

  // Categorize ONLY the metrics that the user explicitly selected
  const voltKeys = userMetrics.filter(m => m.toLowerCase().includes('phase') || m.toLowerCase().includes('line') || m.toLowerCase().includes('v'));
  const currKeys = userMetrics.filter(m => m.toLowerCase().includes('current') || m.toLowerCase().includes('i'));
  const powerKeys = userMetrics.filter(m => m.toLowerCase().includes('power') || m.toLowerCase().includes('kw') || m.toLowerCase().includes('kva'));
  const freqKeys = userMetrics.filter(m => m.toLowerCase().includes('freq') || m.toLowerCase().includes('hz'));
  const pfKeys = userMetrics.filter(m => m.toLowerCase().includes('pf'));

  // Clean voltage label generator (e.g. lineBC -> Vbc, phaseA -> Va)
  const getVoltLabel = (k) => {
    const meta = METRICS[k];
    if (k.toLowerCase().includes('line')) {
      const match = k.match(/line([a-c]{2})/i);
      return match ? `V${match[1].toLowerCase()}` : (meta?.label || k);
    }
    const match = k.match(/phase([a-c])/i);
    return match ? `V${match[1].toLowerCase()}` : (meta?.label || k);
  };

  // Check if system has active signal from any selected metric
  const hasActiveSignal = userMetrics.some(k => {
    const val = latestData?.[k];
    return val !== undefined && val !== null && Number(val) > 0;
  });

  return (
    <div className="h-full w-full flex flex-col transition-colors duration-300">
      {/* ─── Header ─── */}
      <div className={`flex items-center justify-between gap-2 px-1 mb-1.5 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-blue-500/10 text-blue-500 dark:text-blue-400 shrink-0">
            <GitCommit size={14} />
          </div>
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 font-sans truncate tracking-wide">
            {panel.title || 'Transformer Single Line Diagram (SLD)'}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0 pr-14">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            hasActiveSignal ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
          }`}>
            <CheckCircle2 size={11} />
            <span>{hasActiveSignal ? 'ENERGIZED' : 'STANDBY'}</span>
          </span>
          {isEditing && <GripVertical size={16} className="text-gray-400 shrink-0" />}
        </div>
      </div>

      {/* ─── Diagram Body ─── */}
      <div className="flex-1 min-h-0 bg-gray-50/50 dark:bg-black/20 rounded-xl border border-gray-200/60 dark:border-white/5 p-3 flex flex-col justify-between overflow-hidden relative">
        {/* Top: Grid Infeed (Primary Side) */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white dark:bg-[#151521] border border-gray-200/80 dark:border-white/10 shadow-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${hasActiveSignal ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Grid Infeed (Primary Side)</span>
            {freqKeys.length > 0 && latestData?.frequency !== undefined && (
              <span className="text-[10px] font-mono text-gray-400">{Number(latestData.frequency).toFixed(1)} Hz</span>
            )}
            {pfKeys.length > 0 && latestData?.pfTotal !== undefined && (
              <span className="text-[10px] font-mono text-gray-400">PF: {Number(latestData.pfTotal).toFixed(2)}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-gray-500">Status:</span>
            <span className={hasActiveSignal ? 'text-emerald-500 font-bold' : 'text-gray-400 font-bold'}>
              {hasActiveSignal ? 'ACTIVE' : 'STANDBY'}
            </span>
          </div>
        </div>

        {/* Center: Transformer Core Card */}
        <div className="my-2 flex items-center justify-center gap-4 relative">
          {/* Animated Power Flow Line (Left to Center) */}
          <div className={`flex-1 border-t-2 border-dashed ${hasActiveSignal ? 'border-blue-500/60 animate-pulse' : 'border-gray-300 dark:border-white/10'}`} />

          {/* Transformer Core Card */}
          <div className="w-80 p-3 rounded-2xl bg-white dark:bg-[#181826] border-2 border-blue-500/40 shadow-xl flex flex-col gap-2 relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Zap size={13} className="text-amber-500" />
                <span className="text-xs font-bold text-gray-800 dark:text-gray-100">B&D Transformer</span>
              </div>
              <span className="text-[10px] font-mono text-blue-500 font-semibold">
                {userMetrics.length} Metrics Selected
              </span>
            </div>

            {/* Core Metrics: 100% strictly displays whatever the user selected */}
            {userMetrics.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-400">
                Please select metrics below to display on the transformer diagram
              </div>
            ) : (
              <div className={`grid gap-2 text-xs ${userMetrics.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {userMetrics.slice(0, 6).map(key => {
                  const meta = METRICS[key];
                  const rawVal = latestData?.[key];
                  const displayVal = rawVal !== undefined && rawVal !== null ? Number(rawVal).toFixed(1) : '-';
                  return (
                    <div key={key} className="flex items-center gap-1.5 p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200/60 dark:border-white/5">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate font-medium">
                          {meta?.label || key}
                        </span>
                        <span className="font-bold font-mono text-gray-800 dark:text-gray-100 text-xs mt-0.5">
                          {displayVal} <span className="text-[10px] text-blue-500 font-normal">{meta?.unit}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Animated Power Flow Line (Center to Right) */}
          <div className={`flex-1 border-t-2 border-dashed ${hasActiveSignal ? 'border-blue-500/60 animate-pulse' : 'border-gray-300 dark:border-white/10'}`} />
        </div>

        {/* Bottom: LV Outgoing Busbar (Secondary Side) */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white dark:bg-[#151521] border border-gray-200/80 dark:border-white/10 shadow-xs">
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${hasActiveSignal ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">LV Outgoing (Secondary Side)</span>
            {voltKeys.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono">
                {voltKeys.map((k, idx) => {
                  const v = latestData?.[k];
                  const colors = ['text-red-500', 'text-amber-500', 'text-blue-500', 'text-purple-500'];
                  const color = colors[idx % colors.length];
                  return (
                    <span key={k} className={color}>
                      {getVoltLabel(k)}: {v !== undefined && v !== null ? Number(v).toFixed(0) : '-'}V
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono">
            {currKeys.map(k => {
              const val = latestData?.[k];
              if (val === undefined || val === null) return null;
              return <span key={k}><strong className="text-gray-800 dark:text-gray-100">{Number(val).toFixed(1)}</strong> A</span>;
            })}
            {powerKeys.map(k => {
              const val = latestData?.[k];
              const meta = METRICS[k];
              if (val === undefined || val === null) return null;
              return <span key={k}><strong className="text-gray-800 dark:text-gray-100">{Number(val).toFixed(1)}</strong> {meta?.unit || 'kW'}</span>;
            })}
          </div>
        </div>

        {/* Extra Metrics Bar (If user selected > 6 metrics) */}
        {userMetrics.length > 6 && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/5 border border-blue-500/20 text-[10px] overflow-x-auto custom-scrollbar shrink-0 mt-1">
            <span className="font-bold text-blue-500 shrink-0 uppercase tracking-wider">Extra:</span>
            {userMetrics.slice(6).map(key => {
              const val = latestData?.[key];
              const meta = METRICS[key];
              if (val === undefined || val === null) return null;
              return (
                <span key={key} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 shrink-0 font-mono">
                  <span className="text-gray-500 dark:text-gray-400">{meta?.label || key}:</span>
                  <span className="font-bold text-gray-800 dark:text-gray-100">{Number(val).toFixed(1)} {meta?.unit}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
