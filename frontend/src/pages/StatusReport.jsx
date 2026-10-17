import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  ShieldCheck, AlertTriangle, Zap, Thermometer, HeartPulse, 
  Download, RefreshCw, BarChart2, Table as TableIcon, LineChart as ChartIcon, CheckCircle2,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { useApi } from '../contexts/ApiContext';
import EnergyLoader from '../components/EnergyLoader';
import DateRangePicker from '../components/DateRangePicker';
import { generateFullTmuReport } from '../utils/statusReportPdf';

const BADGE_STYLES = {
  normal: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40',
  alarm: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40',
  trip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40',
};

const getIsoDateStr = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const StatusReport = () => {
  const { apiUrl } = useApi();
  const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
  const dbName = sessionStorage.getItem('db_name') || 'base_tmu_company_table_v2';
  const companyName = sessionStorage.getItem('company_name') || dbName;
  const sessionTrafoName = sessionStorage.getItem('selectedTrafoName');

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getIsoDateStr(d);
  });
  const [endDate, setEndDate] = useState(() => getIsoDateStr(new Date()));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [liveMeter, setLiveMeter] = useState(null);
  const [liveOil, setLiveOil] = useState(null);
  const [thiViewMode, setThiViewMode] = useState('chart');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const fetchStatusData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${apiUrl}/api/status-report`, {
        params: { trafo_id: trafoId, startDate, endDate },
        headers: { 'X-DB-Name': dbName }
      });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load status report');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, trafoId, dbName, startDate, endDate]);

  useEffect(() => {
    fetchStatusData();
  }, [fetchStatusData]);

  useEffect(() => {
    if (!apiUrl) return;

    const socket = io(apiUrl, {
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      socket.emit('subscribe_transformer', { trafoId, dbName });
      socket.emit('set_poll_interval', 1000);
    });

    socket.on('meter', (msg) => {
      if (msg) setLiveMeter(msg);
    });

    socket.on('oil_sensor', (msg) => {
      if (msg) setLiveOil(msg);
    });

    return () => {
      socket.disconnect();
    };
  }, [apiUrl, trafoId, dbName]);

  const currentLoadingKva = useMemo(() => {
    if (liveMeter?.power !== undefined && liveMeter?.power !== null) {
      return Number((Number(liveMeter.power) / 1000).toFixed(1));
    }
    return data?.telemetryCards?.currentPowerKva || 44.5;
  }, [liveMeter, data]);

  const ratedPowerKva = data?.telemetryCards?.ratedPowerVal || 100;
  const loadFactorPct = ratedPowerKva > 0 ? Number(((currentLoadingKva / ratedPowerKva) * 100).toFixed(1)) : 45.0;

  const currentOilTemperature = useMemo(() => {
    if (liveOil?.oil_temperature !== undefined && liveOil?.oil_temperature !== null) {
      return Number(Number(liveOil.oil_temperature).toFixed(1));
    }
    return data?.telemetryCards?.currentOilTemp || 57.0;
  }, [liveOil, data]);

  const overallStatus = data?.allSafe ? 'SAFE' : (data?.counts?.trip > 0 ? 'TRIP' : 'ALARM');
  const trafoDisplayName = sessionTrafoName || data?.trafo?.trafoSerialNo || `Transformer #${trafoId}`;

  const exportStatusPdf = async () => {
    if (!data || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      await generateFullTmuReport(data, companyName, trafoDisplayName, { startDate, endDate });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const statusItems = useMemo(() => {
    return data?.items || [];
  }, [data]);

  const trendData = useMemo(() => {
    return data?.trend || [];
  }, [data]);

  return (
    <div className="flex flex-col gap-3.5 w-full min-h-0 flex-1 overflow-y-auto pb-24 sm:pb-8 animate-slide-up-fade custom-scrollbar">
      <div className="relative rounded-2xl bg-gradient-to-br from-white via-white to-indigo-50/40 dark:from-[#151521] dark:via-[#151521] dark:to-[#1a1b2e] border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs p-3.5 sm:p-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <h1 className="text-base sm:text-lg font-black text-[#172b4d] dark:text-white font-heading tracking-tight truncate">
              Analysis & Diagnostics - {trafoDisplayName}
            </h1>
            <span
              className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full uppercase tracking-wider shrink-0 ${
                overallStatus === 'SAFE'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : overallStatus === 'ALARM'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse'
              }`}
            >
              {overallStatus}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />

            <button
              onClick={exportStatusPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-600/30 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 whitespace-nowrap"
            >
              <Download size={13} className={isGeneratingPdf ? 'animate-bounce' : ''} />
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2 shrink-0">
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="flex-1 flex items-center justify-center py-24">
          <EnergyLoader text="Loading Status Diagnostics..." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
            <div className="bg-white dark:bg-[#151521] p-3 sm:p-3.5 rounded-xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Health Index</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{data?.healthIndex || 100}%</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <ShieldCheck size={11} /> {data?.allSafe ? 'Optimal Condition' : 'Attention Required'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <HeartPulse size={20} />
              </div>
            </div>

            <div className="bg-white dark:bg-[#151521] p-3 sm:p-3.5 rounded-xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Active Anomalies</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {data?.counts?.alarm || 0} <span className="text-xs font-normal text-slate-400">Alarm</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {data?.counts?.trip || 0} Trip Detected
                </span>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                (data?.counts?.alarm || 0) > 0 || (data?.counts?.trip || 0) > 0
                  ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500'
                  : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500'
              }`}>
                <AlertTriangle size={20} />
              </div>
            </div>

            <div className="bg-white dark:bg-[#151521] p-3 sm:p-3.5 rounded-xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Current Loading</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{currentLoadingKva} <span className="text-xs font-normal text-slate-400">kVA</span></span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {loadFactorPct}% of {ratedPowerKva} kVA
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Zap size={20} />
              </div>
            </div>

            <div className="bg-white dark:bg-[#151521] p-3 sm:p-3.5 rounded-xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Operating Temperature</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{currentOilTemperature}°C</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Top Oil (Alarm: &gt;70°C)
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Thermometer size={20} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#151521] p-4 rounded-2xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs flex flex-col shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <HeartPulse size={16} className="text-indigo-600 dark:text-indigo-400" />
                  Transformer Health Index (THI)
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Multi-metric composite health evaluation (Thermal, Electrical Balance, Harmonics & Power Factor)
                </p>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setThiViewMode('chart')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    thiViewMode === 'chart'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <ChartIcon size={13} />
                  <span>Chart View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThiViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    thiViewMode === 'table'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <TableIcon size={13} />
                  <span>Table View</span>
                </button>
              </div>
            </div>

            {thiViewMode === 'chart' ? (
              <div className="w-full h-64 pt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderRadius: '12px',
                        border: '1px solid #475569',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                      formatter={(val, name) => [`${val}%`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                    <Line
                      type="monotone"
                      dataKey="health"
                      name="Transformer Health Index (THI)"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#4f46e5' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="w-full pt-3 overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">THI Health (%)</th>
                      <th className="py-2.5 px-3">Thermal Score</th>
                      <th className="py-2.5 px-3">Electrical Score</th>
                      <th className="py-2.5 px-3">PQ Score</th>
                      <th className="py-2.5 px-3">Top Oil Temp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {trendData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{row.date}</td>
                        <td className="py-2.5 px-3 font-bold text-indigo-600 dark:text-indigo-400">{row.health}%</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{row.thermalScore ?? 95}%</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{row.electricalScore ?? 95}%</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{row.pqScore ?? 95}%</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{row.oilTemp ?? 50}°C</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#151521] rounded-2xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs overflow-hidden flex flex-col shrink-0">
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Parameter Diagnostic & Recommendation Matrix
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Direct telemetry evaluation linked to master failure SOP recommendations
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {statusItems.length} Parameters Evaluated
              </span>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[460px] custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#181926] border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 w-[30%]">VARIABLE</th>
                    <th className="py-3 px-4 w-[25%]">STATUS</th>
                    <th className="py-3 px-4 w-[45%]">DESCRIPTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {statusItems.map((item) => {
                    const isAbnormal = item.level !== 'normal';
                    const isExpanded = expandedRow === item.parameter;
                    const badgeClass = BADGE_STYLES[item.level] || BADGE_STYLES.normal;

                    return (
                      <React.Fragment key={item.parameter}>
                        <tr 
                          onClick={() => isAbnormal && setExpandedRow(isExpanded ? null : item.parameter)}
                          className={`transition-colors ${
                            isAbnormal 
                              ? 'cursor-pointer bg-amber-500/5 hover:bg-amber-500/10' 
                              : 'hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {item.label}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {item.parameter} {item.category ? `• ${item.category}` : ''}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
                                {item.level}
                              </span>
                              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                                {item.value !== null && item.value !== undefined ? `${item.value} ${item.unit}` : '-'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                                {isAbnormal ? (
                                  <div>
                                    <span className="font-semibold text-rose-600 dark:text-rose-400 block">
                                      {item.statusLabel || 'Anomali Terdeteksi'}
                                    </span>
                                    {item.thresholdInfo && (
                                      <span className="text-[10px] text-slate-400 block mt-0.5">
                                        {item.thresholdInfo}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 size={13} />
                                    <span>Operating within nominal threshold</span>
                                  </span>
                                )}
                              </div>

                              {isAbnormal && (item.recommendations?.length || 0) > 0 && (
                                <button
                                  type="button"
                                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition"
                                >
                                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  <span>{item.recommendations.length} Rekomendasi</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && isAbnormal && (
                          <tr className="bg-indigo-50/40 dark:bg-indigo-950/20">
                            <td colSpan={3} className="px-6 py-3 border-t border-indigo-100 dark:border-indigo-900/40">
                              <div className="flex flex-col gap-1.5 text-xs">
                                <span className="font-bold text-indigo-900 dark:text-indigo-300">
                                  Langkah Rekomendasi SOP B&D ({item.label}):
                                </span>
                                <ol className="list-decimal pl-5 space-y-1 text-slate-700 dark:text-slate-300">
                                  {item.recommendations.map((rec, rIdx) => (
                                    <li key={rIdx}>{rec}</li>
                                  ))}
                                </ol>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StatusReport;
