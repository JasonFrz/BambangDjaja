import React, { memo, useState, useMemo } from 'react';
import { Compass, GripVertical, Zap, Waves } from "lucide-react";
import { METRICS } from "../../config/metrics";

export const PhasorDiagramPanel = memo(({ panel, latestData, isEditing }) => {
  const userMetrics = panel.metrics || [];

  // Helper polar coordinate converter (0° = top / 12 o'clock, clockwise)
  const toSvgCoords = (magnitudeNormalized, angleDeg, radius, cx, cy) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    const r = magnitudeNormalized * radius;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  // Dimensions
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.40;

  // Selected vectors extraction (up to 3 metrics)
  const vectors = useMemo(() => {
    if (userMetrics.length === 0) return [];

    // Assign standard electrical 3-phase angles: 0° (Phase 1), 240° (Phase 2), 120° (Phase 3)
    const angles = [0, 240, 120];
    const colors = ['#ef4444', '#eab308', '#3b82f6']; // Red (A/R), Yellow (B/S), Blue (C/T)

    const rawVals = userMetrics.slice(0, 3).map(k => {
      const v = latestData?.[k];
      return v !== undefined && v !== null ? Number(v) : 0;
    });

    const maxVal = Math.max(...rawVals, 1);

    return userMetrics.slice(0, 3).map((k, idx) => {
      const meta = METRICS[k];
      const val = rawVals[idx];
      const norm = maxVal > 0 ? Math.min(1.0, (val / (maxVal * 1.1)) * 0.9) : 0;
      const angle = angles[idx] || 0;
      const pt = toSvgCoords(norm, angle, maxR, cx, cy);

      // Clean short label
      let shortLabel = meta?.label || k;
      if (k.toLowerCase().includes('line')) {
        const match = k.match(/line([a-c]{2})/i);
        if (match) shortLabel = `V${match[1].toLowerCase()}`;
      } else if (k.toLowerCase().includes('phase')) {
        const match = k.match(/phase([a-c])/i);
        if (match) shortLabel = `V${match[1].toLowerCase()}`;
      } else if (k.toLowerCase().includes('current')) {
        const match = k.match(/current([a-c])/i);
        if (match) shortLabel = `I${match[1].toLowerCase()}`;
      }

      return {
        key: k,
        label: meta?.label || k,
        shortLabel,
        unit: meta?.unit || '',
        val,
        angle,
        pt,
        color: colors[idx % colors.length]
      };
    });
  }, [userMetrics, latestData, maxR, cx, cy]);

  // Unbalance calculation strictly from selected vectors
  const unbalance = useMemo(() => {
    if (vectors.length < 2) return null;
    const vals = vectors.map(v => v.val);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (avg === 0) return '0.00';
    const maxDev = Math.max(...vals.map(v => Math.abs(v - avg)));
    return ((maxDev / avg) * 100).toFixed(2);
  }, [vectors]);

  // Measured PF from data if available
  const rawPf = latestData?.pfTotal ?? latestData?.pf_total;
  const pf = rawPf !== undefined && rawPf !== null ? Number(rawPf) : null;
  const phiDeg = pf !== null ? Math.acos(Math.min(1, Math.max(0, pf))) * (180 / Math.PI) : null;

  return (
    <div className="h-full w-full flex flex-col transition-colors duration-300">
      {/* Header */}
      <div className={`flex items-center justify-between gap-2 px-1 mb-1.5 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-purple-500/10 text-purple-500 dark:text-purple-400 shrink-0">
            <Compass size={14} />
          </div>
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 font-sans truncate tracking-wide">
            {panel.title || '3-Phase Phasor Diagram'}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0 pr-14">
          {unbalance !== null && (
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
              parseFloat(unbalance) <= 2 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
            }`}>
              Unbalance: {unbalance}%
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      {userMetrics.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500 mb-2">
            <Compass size={28} />
          </div>
          <span className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
            Select Phase Metrics for Phasor Diagram
          </span>
          <span className="text-[11px] text-gray-400 max-w-xs">
            Please select up to 3 phase metrics below (e.g., Phase A, B, C or Line AB, BC, CA) to visualize polar vector angles.
          </span>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col md:flex-row items-center justify-around gap-4 p-2">
          {/* Polar SVG Diagram */}
          <div className="relative shrink-0 flex items-center justify-center">
            <svg width={size} height={size} className="overflow-visible select-none">
              <defs>
                <marker id="arrow0" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#ef4444" />
                </marker>
                <marker id="arrow1" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#eab308" />
                </marker>
                <marker id="arrow2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#3b82f6" />
                </marker>
              </defs>

              {/* Concentric Circles */}
              {[0.33, 0.66, 1.0].map((frac, idx) => (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r={maxR * frac}
                  fill="none"
                  stroke="currentColor"
                  className="text-gray-200 dark:text-white/5"
                  strokeDasharray={frac === 1.0 ? "none" : "2 3"}
                />
              ))}

              {/* Radial Spokes (every 30°) */}
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
                const pt = toSvgCoords(1.0, deg, maxR, cx, cy);
                return (
                  <line
                    key={deg}
                    x1={cx}
                    y1={cy}
                    x2={pt.x}
                    y2={pt.y}
                    stroke="currentColor"
                    className={deg % 90 === 0 ? "text-gray-300 dark:text-white/10" : "text-gray-200/50 dark:text-white/5"}
                    strokeWidth={deg % 90 === 0 ? 1 : 0.5}
                  />
                );
              })}

              {/* Polar Angle Labels */}
              <text x={cx} y={cy - maxR - 8} textAnchor="middle" className="fill-gray-400 text-[9px] font-mono">0°</text>
              <text x={cx + maxR + 12} y={cy + 3} textAnchor="start" className="fill-gray-400 text-[9px] font-mono">90°</text>
              <text x={cx} y={cy + maxR + 14} textAnchor="middle" className="fill-gray-400 text-[9px] font-mono">180°</text>
              <text x={cx - maxR - 12} y={cy + 3} textAnchor="end" className="fill-gray-400 text-[9px] font-mono">270°</text>

              {/* Render ONLY Selected Vectors */}
              {vectors.map((v, idx) => {
                const markerId = `url(#arrow${idx})`;
                return (
                  <g key={v.key}>
                    <line
                      x1={cx}
                      y1={cy}
                      x2={v.pt.x}
                      y2={v.pt.y}
                      stroke={v.color}
                      strokeWidth="2.5"
                      markerEnd={markerId}
                    />
                    <text
                      x={v.pt.x + (v.angle === 0 ? 0 : v.angle > 180 ? -8 : 8)}
                      y={v.pt.y + (v.angle === 0 ? -8 : 10)}
                      textAnchor={v.angle === 0 ? 'middle' : v.angle > 180 ? 'end' : 'start'}
                      fill={v.color}
                      className="font-bold text-[9px] font-mono"
                    >
                      {v.shortLabel}: {v.val.toFixed(0)}{v.unit}
                    </text>
                  </g>
                );
              })}

              {/* Origin Center Point */}
              <circle cx={cx} cy={cy} r={3} fill="#64748b" />
            </svg>
          </div>

          {/* Diagnostics & Phasor Metrics List */}
          <div className="flex-1 w-full flex flex-col justify-center gap-2">
            {/* Selected Metric Badges */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                Selected Vectors ({vectors.length}/3)
              </span>
              <div className="grid gap-1.5">
                {vectors.map(v => (
                  <div key={v.key} className="p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200/60 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">{v.label}</span>
                    </div>
                    <span className="font-bold font-mono text-xs text-gray-800 dark:text-gray-100">
                      {v.val.toFixed(1)} <span className="text-[10px] text-gray-400 font-normal">{v.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Unbalance & Power Factor Info */}
            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 flex flex-col gap-1 text-xs">
              {unbalance !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Deviation / Unbalance:</span>
                  <span className="font-bold font-mono text-gray-800 dark:text-gray-100">{unbalance}%</span>
                </div>
              )}
              {pf !== null && (
                <div className="flex items-center justify-between border-t border-gray-200/50 dark:border-white/5 pt-1">
                  <span className="text-gray-500 dark:text-gray-400">Power Factor (cos φ):</span>
                  <span className="font-bold font-mono text-gray-800 dark:text-gray-100">{pf.toFixed(2)}</span>
                </div>
              )}
              {phiDeg !== null && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 dark:text-gray-400">Phase Shift Angle (θ):</span>
                  <span className="font-bold font-mono text-gray-800 dark:text-gray-100">{phiDeg.toFixed(1)}°</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
