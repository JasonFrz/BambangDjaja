import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  X, Send, RefreshCw, Bot, User, Sparkles, Check, RotateCcw, Plus,
  Activity, Gauge, BarChart3, TrendingUp, Droplets, HeartPulse,
  Layers, Terminal, Compass, BarChart2, CheckCircle2
} from 'lucide-react';
import { useApi } from '../contexts/ApiContext';

const getPanelIcon = (type) => {
  switch (type) {
    case 'stat': return <Activity size={16} />;
    case 'gauge': return <Gauge size={16} />;
    case 'bargauge': return <BarChart2 size={16} />;
    case 'barchart': return <BarChart3 size={16} />;
    case 'areachart':
    case 'linechart': return <TrendingUp size={16} />;
    case 'oilstatus':
    case 'heatmap': return <Droplets size={16} />;
    case 'phasor': return <Compass size={16} />;
    case 'healthindex': return <HeartPulse size={16} />;
    case 'sld': return <Layers size={16} />;
    case 'eventstream': return <Terminal size={16} />;
    default: return <Sparkles size={16} />;
  }
};

const generateLocalRecommendations = (prompt = '') => {
  const p = prompt.toLowerCase();
  const ts = Date.now();

  if (p.includes('efisiens') || p.includes('eff') || p.includes('rugi') || p.includes('hemat')) {
    return {
      agentMessage: 'Saya telah menyiapkan 3 opsi rekomendasi panel untuk memantau Efisiensi Trafo. Silakan pilih panel yang paling cocok untuk dashboard Anda:',
      recommendations: [
        {
          id: `p_eff_stat_${ts}`,
          type: 'stat',
          title: 'Efisiensi Trafo (KPI)',
          metrics: ['efficiency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Paling Populer',
          description: 'Kartu KPI angka efisiensi (%) dengan tren sparkline real-time.'
        },
        {
          id: `p_eff_bargauge_${ts}`,
          type: 'bargauge',
          title: 'Bar Gauge Efisiensi',
          metrics: ['efficiency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Visual Gauge',
          description: 'Progress bar horizontal untuk memantau ambang batas efisiensi.'
        },
        {
          id: `p_eff_area_${ts}`,
          type: 'areachart',
          title: 'Tren Efisiensi Real-Time',
          metrics: ['efficiency'],
          chartType: 'area',
          colorScheme: 'spectral',
          badge: 'Grafik Tren',
          description: 'Grafik continuous time-series fluktuasi efisiensi trafo.'
        }
      ]
    };
  }

  if (p.includes('frekuensi') || p.includes('frequency') || p.includes('hz')) {
    return {
      agentMessage: 'Saya telah menyiapkan 3 opsi rekomendasi panel untuk memantau Frekuensi (Hz). Silakan pilih panel yang Anda inginkan:',
      recommendations: [
        {
          id: `p_freq_gauge_${ts}`,
          type: 'gauge',
          title: 'Frekuensi Trafo (Radial)',
          metrics: ['frequency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Direkomendasikan',
          description: 'Speedometer radial dial presisi tinggi batas toleransi 50 Hz.'
        },
        {
          id: `p_freq_stat_${ts}`,
          type: 'stat',
          title: 'KPI Frekuensi Grid',
          metrics: ['frequency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Angka Ringkas',
          description: 'Display nilai numerik presisi tinggi dengan sparkline fluktuasi.'
        },
        {
          id: `p_freq_line_${ts}`,
          type: 'linechart',
          title: 'Tren Stabilitas Frekuensi',
          metrics: ['frequency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Grafik Garis',
          description: 'Grafik garis real-time untuk memantau stabilitas frekuensi sistem.'
        }
      ]
    };
  }

  if (p.includes('tegangan') || p.includes('volt') || p.includes('voltage') || p.includes('phase') || p.includes('fasa')) {
    return {
      agentMessage: 'Saya telah menyiapkan 3 opsi rekomendasi panel untuk memantau Tegangan Trafo. Silakan pilih panel yang Anda inginkan:',
      recommendations: [
        {
          id: `p_volt_line_${ts}`,
          type: 'linechart',
          title: 'Tegangan 3-Fasa (LN)',
          metrics: ['phaseA', 'phaseB', 'phaseC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Direkomendasikan',
          description: 'Grafik komparasi kontinyu fasa A, B, dan C secara bersamaan.'
        },
        {
          id: `p_volt_bar_${ts}`,
          type: 'barchart',
          title: 'Perbandingan Tegangan Fasa',
          metrics: ['phaseA', 'phaseB', 'phaseC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Grafik Batang',
          description: 'Bar chart perbandingan magnitudo tegangan untuk deteksi ketidakseimbangan.'
        },
        {
          id: `p_volt_phasor_${ts}`,
          type: 'phasor',
          title: 'Phasor Diagram Tegangan',
          metrics: ['phaseA', 'phaseB', 'phaseC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Vektor Polar',
          description: 'Diagram vektor kutub polar 3-fasa untuk analisa sudut fasa.'
        }
      ]
    };
  }

  if (p.includes('arus') || p.includes('current') || p.includes('ampere') || p.includes('beban') || p.includes('load')) {
    return {
      agentMessage: 'Saya telah menyiapkan 3 opsi rekomendasi panel untuk memantau Beban Arus Trafo. Silakan pilih panel yang Anda inginkan:',
      recommendations: [
        {
          id: `p_curr_bar_${ts}`,
          type: 'barchart',
          title: 'Arus 3-Fasa & Netral',
          metrics: ['currentA', 'currentB', 'currentC', 'currentN'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Direkomendasikan',
          description: 'Grafik batang beban arus fasa A, B, C dan arus netral.'
        },
        {
          id: `p_curr_line_${ts}`,
          type: 'linechart',
          title: 'Tren Fluktuasi Arus Beban',
          metrics: ['currentA', 'currentB', 'currentC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Grafik Tren',
          description: 'Grafik kontinu pembebanan arus trafo terhadap waktu.'
        },
        {
          id: `p_curr_stat_${ts}`,
          type: 'stat',
          title: 'Arus Beban Trafo (KPI)',
          metrics: ['currentA', 'currentB', 'currentC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Angka Ringkas',
          description: 'Stat card nilai arus real-time dengan status beban.'
        }
      ]
    };
  }

  if (p.includes('suhu') || p.includes('temperatur') || p.includes('temp') || p.includes('oli') || p.includes('oil') || p.includes('minyak') || p.includes('tekanan') || p.includes('pressure')) {
    return {
      agentMessage: 'Saya telah menyiapkan 3 opsi rekomendasi panel untuk memantau Kondisi Minyak & Suhu Trafo. Silakan pilih panel yang Anda inginkan:',
      recommendations: [
        {
          id: `p_oil_stat_${ts}`,
          type: 'oilstatus',
          title: 'Status Proteksi Oli & Alarm',
          metrics: [],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Proteksi Kritis',
          description: 'Indikator visual level trip & alarm minyak isolasi transformator.'
        },
        {
          id: `p_oil_heat_${ts}`,
          type: 'heatmap',
          title: 'Matriks Suhu & Tekanan Oli',
          metrics: ['oil_temperature', 'oil_pressure'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Visual Matriks',
          description: 'Peta intensitas suhu (°C) dan tekanan minyak tangki trafo.'
        },
        {
          id: `p_oil_gauge_${ts}`,
          type: 'gauge',
          title: 'Gauge Temperatur Oli',
          metrics: ['oil_temperature'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Dial Meter',
          description: 'Radial dial gauge batas aman kenaikan suhu oli transformator.'
        }
      ]
    };
  }

  if (p.includes('daya') || p.includes('power') || p.includes('energi') || p.includes('energy') || p.includes('kw') || p.includes('kwh') || p.includes('kvar') || p.includes('kva') || p.includes('faktor')) {
    return {
      agentMessage: 'Saya telah menyiapkan 3 opsi rekomendasi panel untuk memantau Daya & Energi Trafo. Silakan pilih panel yang Anda inginkan:',
      recommendations: [
        {
          id: `p_pwr_stat_${ts}`,
          type: 'stat',
          title: 'Daya Aktif Total (kW)',
          metrics: ['powerActiveTotal'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'KPI Utama',
          description: 'Total output daya aktif transformator secara real-time.'
        },
        {
          id: `p_pwr_pie_${ts}`,
          type: 'piechart',
          title: 'Komposisi Daya (P, Q, S)',
          metrics: ['powerActiveTotal', 'powerReactiveTotal', 'powerApparentTotal'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Proporsi Daya',
          description: 'Pie chart rasio daya aktif (kW), reaktif (kVAR), dan semu (kVA).'
        },
        {
          id: `p_pwr_area_${ts}`,
          type: 'areachart',
          title: 'Tren Akumulasi Energi (kWh)',
          metrics: ['energyActiveTotal', 'energyReactiveTotal'],
          chartType: 'area',
          colorScheme: 'spectral',
          badge: 'Grafik Tren',
          description: 'Grafik konsumsi energi transformator berkelanjutan.'
        }
      ]
    };
  }

  return {
    agentMessage: 'Saya telah menyiapkan 3 opsi rekomendasi panel monitoring terbaik. Silakan pilih tampilan yang paling cocok:',
    recommendations: [
      {
        id: `p_gen_stat_${ts}`,
        type: 'stat',
        title: 'Ringkasan Metrik (KPI Card)',
        metrics: ['powerActiveTotal'],
        chartType: 'line',
        colorScheme: 'spectral',
        badge: 'Angka Cepat',
        description: 'Tampilan numerik ringkas dengan status indikator real-time.'
      },
      {
        id: `p_gen_gauge_${ts}`,
        type: 'gauge',
        title: 'Radial Meter Dial',
        metrics: ['frequency'],
        chartType: 'line',
        colorScheme: 'spectral',
        badge: 'Gauge Dial',
        description: 'Speedometer dial visual untuk memantau batas aman toleransi.'
      },
      {
        id: `p_gen_area_${ts}`,
        type: 'areachart',
        title: 'Grafik Tren Historis',
        metrics: ['powerActiveTotal'],
        chartType: 'area',
        colorScheme: 'spectral',
        badge: 'Grafik Tren',
        description: 'Grafik continuous area chart fluktuasi metrik terhadap waktu.'
      }
    ]
  };
};

export const AiLayoutModal = ({ isOpen, onClose, onApply, currentPanelsCount = 0 }) => {
  const { apiUrl } = useApi();
  const [messages, setMessages] = useState([
    {
      id: 'init',
      sender: 'agent',
      text: 'Halo! Tuliskan panel atau metrik apa yang ingin Anda tampilkan (misal: "tampilkan efisiensi", "frekuensi", "tegangan", atau "suhu oli"). Saya akan merekomendasikan 3 opsi panel terbaik untuk Anda pilih.',
      recommendations: null,
      actions: null
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecs, setSelectedRecs] = useState({});
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setMessages([
        {
          id: 'init',
          sender: 'agent',
          text: 'Halo! Tuliskan panel atau metrik apa yang ingin Anda tampilkan (misal: "tampilkan efisiensi", "frekuensi", "tegangan", atau "suhu oli"). Saya akan merekomendasikan 3 opsi panel terbaik untuk Anda pilih.',
          recommendations: null,
          actions: null
        }
      ]);
      setInput('');
      setIsLoading(false);
      setSelectedRecs({});
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, selectedRecs]);

  const handleSend = async (userText = null) => {
    const textToSend = (userText || input).trim();
    if (!textToSend || isLoading) return;

    const userMessage = {
      id: 'u_' + Date.now(),
      sender: 'user',
      text: textToSend
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const token = sessionStorage.getItem('token');
    const dbName = sessionStorage.getItem('db_name');
    const savedKey = localStorage.getItem('tmu_gemini_api_key') || undefined;

    let resultData = null;

    try {
      const response = await axios.post(
        `${apiUrl}/api/layouts/ai-generate`,
        {
          prompt: textToSend,
          apiKey: savedKey,
          currentPanelsCount
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(dbName ? { 'X-DB-Name': dbName } : {})
          },
          timeout: 18000
        }
      );

      if (response.data && response.data.success) {
        resultData = response.data;
      }
    } catch (err) {
      console.warn('Backend /ai-generate endpoint error, using smart client-side fallback:', err.message);
    }

    // Jika backend tidak mengembalikan recommendations, pakai fallback lokal 3 panel
    if (!resultData || (!resultData.recommendations && !resultData.panels)) {
      resultData = generateLocalRecommendations(textToSend);
    }

    const recs = resultData.recommendations || resultData.panels || [];
    const msgId = 'a_' + Date.now();

    // Set default pilihan ke opsi index 0
    setSelectedRecs((prev) => ({
      ...prev,
      [msgId]: 0
    }));

    const agentReply = {
      id: msgId,
      sender: 'agent',
      text: resultData.agentMessage || 'Saya telah menyiapkan 3 opsi panel untuk Anda. Silakan pilih salah satu panel di bawah:',
      recommendations: recs,
      actions: resultData.suggestedActions || [
        { label: '+ Tambahkan ke Dashboard', mode: 'append' },
        { label: '🔄 Ganti Seluruh Dashboard', mode: 'replace' }
      ]
    };

    setMessages((prev) => [...prev, agentReply]);
    setIsLoading(false);
  };

  const handleSelectPanel = (msgId, idx) => {
    setSelectedRecs((prev) => ({
      ...prev,
      [msgId]: idx
    }));
  };

  const handleApplySelection = (msg, mode) => {
    if (!msg.recommendations || msg.recommendations.length === 0) return;
    const selectedIdx = selectedRecs[msg.id] ?? 0;
    const chosenPanel = msg.recommendations[selectedIdx] || msg.recommendations[0];
    onApply([chosenPanel], mode);
    onClose();
  };

  const handleApplyAll = (msg) => {
    if (!msg.recommendations || msg.recommendations.length === 0) return;
    onApply(msg.recommendations, 'append');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#181b24] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col h-[580px] max-h-[90vh] overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-gray-50/70 dark:bg-white/2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Bot size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                Asisten Layout Dashboard
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  Rekomendasi 3 Panel Interaktif
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto custom-scrollbar space-y-4">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const currentSelectedIdx = selectedRecs[msg.id] ?? 0;
            const hasRecs = msg.recommendations && msg.recommendations.length > 0;
            const chosenPanel = hasRecs ? (msg.recommendations[currentSelectedIdx] || msg.recommendations[0]) : null;

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'} animate-[fadeIn_0.2s_ease-out]`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={15} />
                  </div>
                )}

                <div className={`flex flex-col gap-2.5 max-w-[94%] sm:max-w-[90%] ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Bubble Text */}
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                        : 'bg-gray-100 dark:bg-[#202430] text-gray-900 dark:text-gray-100 rounded-tl-xs border border-gray-200/60 dark:border-white/5'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* 3 Interactive Recommendation Cards */}
                  {hasRecs && (
                    <div className="w-full space-y-2.5 pt-0.5">
                      <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={12} className="text-amber-500" />
                        Pilih 1 dari 3 Opsi Rekomendasi Panel:
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full">
                        {msg.recommendations.map((rec, recIdx) => {
                          const isSelected = currentSelectedIdx === recIdx;
                          return (
                            <div
                              key={rec.id || recIdx}
                              onClick={() => handleSelectPanel(msg.id, recIdx)}
                              className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between relative group ${
                                isSelected
                                  ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                                  : 'bg-white dark:bg-[#1a1e28] border-gray-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-white/20 hover:bg-gray-50/50 dark:hover:bg-white/2'
                              }`}
                            >
                              <div>
                                {/* Top Badge & Icon */}
                                <div className="flex items-center justify-between gap-1 mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <div
                                      className={`p-1 rounded-md ${
                                        isSelected
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                                      }`}
                                    >
                                      {getPanelIcon(rec.type)}
                                    </div>
                                    <span className="text-[10px] font-mono uppercase px-1 py-0.2 rounded bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 font-bold">
                                      {rec.type}
                                    </span>
                                  </div>

                                  {rec.badge && (
                                    <span
                                      className={`text-[9.5px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${
                                        isSelected
                                          ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                                          : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'
                                      }`}
                                    >
                                      {rec.badge}
                                    </span>
                                  )}
                                </div>

                                {/* Panel Title */}
                                <h4
                                  className={`text-xs font-bold leading-tight mb-1 ${
                                    isSelected
                                      ? 'text-blue-900 dark:text-blue-200'
                                      : 'text-gray-900 dark:text-gray-200'
                                  }`}
                                >
                                  {rec.title}
                                </h4>

                                {/* Panel Description */}
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug line-clamp-3 mb-2">
                                  {rec.description}
                                </p>
                              </div>

                              {/* Footer Selection Indicator */}
                              <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between mt-1">
                                {rec.metrics && rec.metrics.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 max-w-[70%]">
                                    {rec.metrics.slice(0, 2).map((m, mIdx) => (
                                      <span
                                        key={mIdx}
                                        className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-mono truncate"
                                      >
                                        {m}
                                      </span>
                                    ))}
                                    {rec.metrics.length > 2 && (
                                      <span className="text-[9px] text-gray-400">+{rec.metrics.length - 2}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[9.5px] text-gray-400 italic">Auto-metric</span>
                                )}

                                <div className="flex items-center gap-1 shrink-0">
                                  {isSelected ? (
                                    <div className="flex items-center gap-1 text-[10.5px] font-bold text-blue-600 dark:text-blue-400">
                                      <CheckCircle2 size={14} className="text-blue-600 dark:text-blue-400" />
                                      <span>Terpilih</span>
                                    </div>
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600" />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Action Bar for Selected Recommendation */}
                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/2 border border-gray-200 dark:border-white/10 flex flex-col gap-2.5 mt-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">Panel Terpilih:</span>
                            <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                              {chosenPanel?.title}
                              <span className="text-[10px] px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono uppercase">
                                {chosenPanel?.type}
                              </span>
                            </span>
                          </div>

                          {msg.recommendations.length === 3 && (
                            <button
                              type="button"
                              onClick={() => handleApplyAll(msg)}
                              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                            >
                              + Tambahkan Semua (3 Panel)
                            </button>
                          )}
                        </div>

                        {/* Decision Buttons */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => handleApplySelection(msg, 'append')}
                            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/20 active:scale-[0.98]"
                          >
                            <Plus size={14} strokeWidth={2.5} />
                            <span>+ Tambahkan ke Dashboard</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApplySelection(msg, 'replace')}
                            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10 active:scale-[0.98]"
                          >
                            <RotateCcw size={14} />
                            <span>🔄 Ganti Seluruh Dashboard</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <User size={15} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Loading Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 italic py-1 animate-[fadeIn_0.2s_ease-out]">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <RefreshCw size={12} className="animate-spin" />
              </div>
              <span>Agent sedang merancang 3 opsi panel terbaik...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/70 dark:bg-white/2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik permintaan metrik (contoh: 'tampilkan efisiensi')..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/30 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0"
              title="Kirim"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AiLayoutModal;
