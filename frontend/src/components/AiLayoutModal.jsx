import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  X, Send, RefreshCw, User, Sparkles, Check, RotateCcw, Plus,
  Activity, Gauge, BarChart3, TrendingUp, Droplets, HeartPulse,
  Layers, Terminal, Compass, BarChart2, CheckCircle2,
  Image as ImageIcon, Mic, MicOff, LayoutGrid
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

  if (p.includes('efisiens') || p.includes('eff') || p.includes('rugi') || p.includes('hemat') || p.includes('efficiency')) {
    return {
      agentMessage: 'I have prepared 3 panel layout options to monitor Transformer Efficiency. Please select the most suitable panel for your dashboard:',
      recommendations: [
        {
          id: `p_eff_stat_${ts}`,
          type: 'stat',
          title: 'Transformer Efficiency (KPI)',
          metrics: ['efficiency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Most Popular',
          description: 'KPI stat card with real-time sparkline trend.'
        },
        {
          id: `p_eff_bargauge_${ts}`,
          type: 'bargauge',
          title: 'Efficiency Bar Gauge',
          metrics: ['efficiency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Visual Gauge',
          description: 'Horizontal progress bar to monitor efficiency limits.'
        },
        {
          id: `p_eff_area_${ts}`,
          type: 'areachart',
          title: 'Real-Time Efficiency Trend',
          metrics: ['efficiency'],
          chartType: 'area',
          colorScheme: 'spectral',
          badge: 'Trend Chart',
          description: 'Continuous time-series area chart of transformer efficiency.'
        }
      ]
    };
  }

  if (p.includes('frekuensi') || p.includes('frequency') || p.includes('hz')) {
    return {
      agentMessage: 'I have prepared 3 panel layout options to monitor Frequency (Hz). Please select your preferred panel:',
      recommendations: [
        {
          id: `p_freq_gauge_${ts}`,
          type: 'gauge',
          title: 'Transformer Frequency (Radial)',
          metrics: ['frequency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Recommended',
          description: 'High-precision radial dial gauge centered on 50 Hz tolerance.'
        },
        {
          id: `p_freq_stat_${ts}`,
          type: 'stat',
          title: 'Grid Frequency KPI',
          metrics: ['frequency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Compact Stat',
          description: 'High-precision numeric display with fluctuation sparkline.'
        },
        {
          id: `p_freq_line_${ts}`,
          type: 'linechart',
          title: 'Frequency Stability Trend',
          metrics: ['frequency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Line Chart',
          description: 'Real-time line chart to monitor grid frequency stability.'
        }
      ]
    };
  }

  if (p.includes('tegangan') || p.includes('volt') || p.includes('voltage') || p.includes('phase') || p.includes('fasa')) {
    return {
      agentMessage: 'I have prepared 3 panel layout options to monitor Transformer Voltage. Please select your preferred panel:',
      recommendations: [
        {
          id: `p_volt_line_${ts}`,
          type: 'linechart',
          title: '3-Phase Voltage (LN)',
          metrics: ['phaseA', 'phaseB', 'phaseC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Recommended',
          description: 'Simultaneous continuous comparison of Phase A, B, and C.'
        },
        {
          id: `p_volt_bar_${ts}`,
          type: 'barchart',
          title: 'Phase Voltage Comparison',
          metrics: ['phaseA', 'phaseB', 'phaseC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Bar Chart',
          description: 'Bar chart comparing voltage magnitudes for unbalance detection.'
        },
        {
          id: `p_volt_phasor_${ts}`,
          type: 'phasor',
          title: 'Voltage Phasor Diagram',
          metrics: ['phaseA', 'phaseB', 'phaseC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Polar Vector',
          description: '3-phase polar vector diagram for phase angle analysis.'
        }
      ]
    };
  }

  if (p.includes('arus') || p.includes('current') || p.includes('ampere') || p.includes('beban') || p.includes('load')) {
    return {
      agentMessage: 'I have prepared 3 panel layout options to monitor Current Load. Please select your preferred panel:',
      recommendations: [
        {
          id: `p_curr_bar_${ts}`,
          type: 'barchart',
          title: '3-Phase & Neutral Current',
          metrics: ['currentA', 'currentB', 'currentC', 'currentN'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Recommended',
          description: 'Bar chart of Phase A, B, C and Neutral currents.'
        },
        {
          id: `p_curr_line_${ts}`,
          type: 'linechart',
          title: 'Load Current Trend',
          metrics: ['currentA', 'currentB', 'currentC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Trend Chart',
          description: 'Continuous transformer current loading over time.'
        },
        {
          id: `p_curr_stat_${ts}`,
          type: 'stat',
          title: 'Current Load (KPI)',
          metrics: ['currentA', 'currentB', 'currentC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Compact Stat',
          description: 'Real-time current stat card with load status.'
        }
      ]
    };
  }

  if (p.includes('suhu') || p.includes('temperatur') || p.includes('temp') || p.includes('oli') || p.includes('oil') || p.includes('minyak') || p.includes('tekanan') || p.includes('pressure')) {
    return {
      agentMessage: 'I have prepared 3 panel layout options to monitor Oil Condition & Temperature. Please select your preferred panel:',
      recommendations: [
        {
          id: `p_oil_stat_${ts}`,
          type: 'oilstatus',
          title: 'Oil Protection & Alarm Status',
          metrics: [],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Critical Protection',
          description: 'Visual indicator of transformer oil alarm and trip levels.'
        },
        {
          id: `p_oil_heat_${ts}`,
          type: 'heatmap',
          title: 'Oil Temperature & Pressure Matrix',
          metrics: ['oil_temperature', 'oil_pressure'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Matrix View',
          description: 'Intensity map of oil temperature (°C) and tank pressure.'
        },
        {
          id: `p_oil_gauge_${ts}`,
          type: 'gauge',
          title: 'Oil Temperature Gauge',
          metrics: ['oil_temperature'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Dial Meter',
          description: 'Radial dial gauge for transformer oil temperature limits.'
        }
      ]
    };
  }

  if (p.includes('daya') || p.includes('power') || p.includes('energi') || p.includes('energy') || p.includes('kw') || p.includes('kwh') || p.includes('kvar') || p.includes('kva') || p.includes('faktor')) {
    return {
      agentMessage: 'I have prepared 3 panel layout options to monitor Power & Energy. Please select your preferred panel:',
      recommendations: [
        {
          id: `p_pwr_stat_${ts}`,
          type: 'stat',
          title: 'Total Active Power (kW)',
          metrics: ['powerActiveTotal'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Primary KPI',
          description: 'Real-time total active power output of the transformer.'
        },
        {
          id: `p_pwr_pie_${ts}`,
          type: 'piechart',
          title: 'Power Composition (P, Q, S)',
          metrics: ['powerActiveTotal', 'powerReactiveTotal', 'powerApparentTotal'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Power Ratio',
          description: 'Pie chart of active (kW), reactive (kVAR), and apparent (kVA) power.'
        },
        {
          id: `p_pwr_area_${ts}`,
          type: 'areachart',
          title: 'Energy Accumulation Trend (kWh)',
          metrics: ['energyActiveTotal', 'energyReactiveTotal'],
          chartType: 'area',
          colorScheme: 'spectral',
          badge: 'Trend Chart',
          description: 'Cumulative transformer energy consumption chart.'
        }
      ]
    };
  }

  return {
    agentMessage: 'I have prepared 3 top monitoring panel recommendations. Please select the layout that best fits your needs:',
    recommendations: [
      {
        id: `p_gen_stat_${ts}`,
        type: 'stat',
        title: 'Metrics Summary (KPI Card)',
        metrics: ['powerActiveTotal'],
        chartType: 'line',
        colorScheme: 'spectral',
        badge: 'Quick Stat',
        description: 'Compact numeric display with real-time status indicator.'
      },
      {
        id: `p_gen_gauge_${ts}`,
        type: 'gauge',
        title: 'Radial Meter Dial',
        metrics: ['frequency'],
        chartType: 'line',
        colorScheme: 'spectral',
        badge: 'Gauge Dial',
        description: 'Visual speedometer dial to monitor safe operational limits.'
      },
      {
        id: `p_gen_area_${ts}`,
        type: 'areachart',
        title: 'Historical Trend Chart',
        metrics: ['powerActiveTotal'],
        chartType: 'area',
        colorScheme: 'spectral',
        badge: 'Trend Chart',
        description: 'Continuous area chart of metric fluctuations over time.'
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
      text: 'Hello! Describe what panel or metric you want to monitor (e.g. "show efficiency", "frequency", "voltage", or "oil temperature"). I will recommend 3 panel options for you to choose from.',
      recommendations: null,
      actions: null
    }
  ]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecs, setSelectedRecs] = useState({});
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const baseInputRef = useRef('');

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
          text: 'Hello! Describe what panel or metric you want to monitor (e.g. "show efficiency", "frequency", "voltage", or "oil temperature"). I will recommend 3 panel options for you to choose from.',
          recommendations: null,
          actions: null
        }
      ]);
      setInput('');
      setSelectedImage(null);
      setIsLoading(false);
      setSelectedRecs({});
      if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, selectedRecs]);

  const toggleVoiceRecognition = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    try {
      baseInputRef.current = input;
      const recognition = new SpeechRecognition();
      recognition.lang = navigator.language || 'id-ID';
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            final += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }
        const spoken = (final + (interim ? ' ' + interim : '')).trim();
        if (spoken) {
          const base = baseInputRef.current.trim();
          setInput(base ? `${base} ${spoken}` : spoken);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage({
        dataUrl: reader.result,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
  };

  const handleSend = async (userText = null) => {
    const sanitizedText = (userText || input)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]*>?/gm, '')
      .trim();
    const textToSend = sanitizedText || (selectedImage ? 'Generate layout matching this reference layout image' : '');
    if (!textToSend || isLoading) return;

    const userMessage = {
      id: 'u_' + Date.now(),
      sender: 'user',
      text: textToSend,
      image: selectedImage?.dataUrl || null
    };

    setMessages((prev) => [...prev, userMessage]);
    const imagePayload = selectedImage?.dataUrl || undefined;
    setInput('');
    setSelectedImage(null);
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
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
          image: imagePayload,
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

    if (!resultData || (!resultData.recommendations && !resultData.panels)) {
      resultData = generateLocalRecommendations(textToSend);
    }

    const recs = resultData.recommendations || resultData.panels || [];
    const msgId = 'a_' + Date.now();

    setSelectedRecs((prev) => ({
      ...prev,
      [msgId]: 0
    }));

    const agentReply = {
      id: msgId,
      sender: 'agent',
      text: resultData.agentMessage || 'I have prepared 3 panel options for you. Please select one of the panels below:',
      recommendations: recs,
      actions: resultData.suggestedActions || [
        { label: '+ Add to Dashboard', mode: 'append' },
        { label: '🔄 Replace Entire Dashboard', mode: 'replace' }
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
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-gray-50/70 dark:bg-white/2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <LayoutGrid size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                AI Layout
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  3 Interactive Panel Recommendations
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
                    <LayoutGrid size={14} />
                  </div>
                )}

                <div className={`flex flex-col gap-2.5 max-w-[94%] sm:max-w-[90%] ${isUser ? 'items-end' : 'items-start'}`}>
                  {msg.image && (
                    <div className="max-w-[240px] rounded-xl overflow-hidden border border-white/20 shadow-xs bg-black/20">
                      <img src={msg.image} alt="Reference layout" className="w-full max-h-40 object-cover" />
                    </div>
                  )}
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                        : 'bg-gray-100 dark:bg-[#202430] text-gray-900 dark:text-gray-100 rounded-tl-xs border border-gray-200/60 dark:border-white/5'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {hasRecs && (
                    <div className="w-full space-y-2.5 pt-0.5">
                      <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={12} className="text-amber-500" />
                        Select 1 of 3 Recommended Panel Options:
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

                                <h4
                                  className={`text-xs font-bold leading-tight mb-1 ${
                                    isSelected
                                      ? 'text-blue-900 dark:text-blue-200'
                                      : 'text-gray-900 dark:text-gray-200'
                                  }`}
                                >
                                  {rec.title}
                                </h4>

                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug line-clamp-3 mb-2">
                                  {rec.description}
                                </p>
                              </div>

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
                                      <span>Selected</span>
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

                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/2 border border-gray-200 dark:border-white/10 flex flex-col gap-2.5 mt-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">Selected Panel:</span>
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
                              + Add All (3 Panels)
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => handleApplySelection(msg, 'append')}
                            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/20 active:scale-[0.98]"
                          >
                            <Plus size={14} strokeWidth={2.5} />
                            <span>+ Add to Dashboard</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApplySelection(msg, 'replace')}
                            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10 active:scale-[0.98]"
                          >
                            <RotateCcw size={14} />
                            <span>🔄 Replace Entire Dashboard</span>
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
              <span>Agent is designing 3 panel options...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="p-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/70 dark:bg-white/2">
          {selectedImage && (
            <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 rounded-xl w-fit max-w-full">
              <img
                src={selectedImage.dataUrl}
                alt="Preview"
                className="w-8 h-8 rounded-lg object-cover border border-blue-300 dark:border-blue-700 shrink-0"
              />
              <span className="text-xs font-medium text-blue-800 dark:text-blue-200 truncate max-w-[200px]">
                {selectedImage.name}
              </span>
              <button
                type="button"
                onClick={removeSelectedImage}
                className="p-1 text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 rounded-full cursor-pointer shrink-0"
                title="Remove image"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/30 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
              title="Upload reference layout from gallery"
            >
              <ImageIcon size={16} />
            </button>

            <button
              type="button"
              onClick={toggleVoiceRecognition}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-rose-500 text-white border-rose-500 animate-pulse shadow-sm shadow-rose-500/30'
                  : 'border-gray-200 dark:border-white/10 bg-white dark:bg-black/30 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-white/5'
              }`}
              title={isListening ? "Listening... click to stop" : "Voice input"}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Listening to your voice..." : "Type metric prompt or describe layout..."}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/30 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow min-w-0"
            />

            <button
              type="submit"
              disabled={isLoading || (!input.trim() && !selectedImage)}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0"
              title="Send"
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
