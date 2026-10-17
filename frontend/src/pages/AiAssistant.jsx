import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { 
  Bot, Send, Mic, MicOff, AlertTriangle, ShieldCheck, HeartPulse, 
  Thermometer, Zap, Activity, Phone, MessageCircle, RefreshCw, Sparkles, CheckCircle2
} from 'lucide-react';
import { useApi } from '../contexts/ApiContext';

const formatTimeId = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  });
};

const AiAssistant = () => {
  const { apiUrl } = useApi();
  const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
  const dbName = sessionStorage.getItem('db_name') || 'base_tmu_company_table_v2';
  const sessionTrafoName = sessionStorage.getItem('selectedTrafoName');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveMeter, setLiveMeter] = useState(null);
  const [liveOil, setLiveOil] = useState(null);

  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Halo! Saya adalah B&D TMU Diagnostic Assistant berbasis AI. Saya siap menganalisis data telemetri, memberikan rekomendasi SOP teknis, dan mendeteksi anomali unit transformator Anda.',
      time: new Date(),
      showContact: false
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const recognitionRef = useRef(null);
  const chatBottomRef = useRef(null);

  const fetchStatusData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${apiUrl}/api/status-report`, {
        params: { trafo_id: trafoId },
        headers: { 'X-DB-Name': dbName }
      });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Gagal memuat status telemetri');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, trafoId, dbName]);

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

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'id-ID';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        setSpeechError('Gagal mendengarkan suara. Periksa izin mikrofon browser Anda.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      setSpeechError('Browser ini belum mendukung fitur Voice-to-Text.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setSpeechError(null);
      try {
        recognitionRef.current.start();
      } catch (e) {
        recognitionRef.current.stop();
      }
    }
  };

  const handleSendMessage = async (textToSend) => {
    const q = (textToSend || inputMessage).trim();
    if (!q || chatLoading) return;

    const userMsg = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: q,
      time: new Date()
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setChatLoading(true);

    try {
      const historyPayload = chatMessages.slice(-6).map((m) => ({
        sender: m.sender,
        text: m.text
      }));

      const res = await axios.post(
        `${apiUrl}/api/status-report/chat`,
        {
          message: q,
          history: historyPayload
        },
        {
          params: { trafo_id: trafoId },
          headers: { 'X-DB-Name': dbName }
        }
      );

      const botReply = {
        id: 'bot-' + Date.now(),
        sender: 'assistant',
        text: res.data.reply || 'Data status telah dianalisis.',
        time: new Date(),
        showContact: !!res.data.showContact,
        contact: res.data.contact
      };
      setChatMessages((prev) => [...prev, botReply]);
    } catch (err) {
      const botError = {
        id: 'bot-err-' + Date.now(),
        sender: 'assistant',
        text: 'Koneksi ke AI diagnostik mengalami kendala. Anda dapat menghubungi Teknisi B&D di +62 813-2650-7575.',
        time: new Date(),
        showContact: true,
        contact: { phone: '+62 813-2650-7575', whatsapp: '6281326507575' }
      };
      setChatMessages((prev) => [...prev, botError]);
    } finally {
      setChatLoading(false);
    }
  };

  const quickQuestions = useMemo(() => {
    const active = data?.activeAnomalies || [];
    if (active.length > 0) {
      const primary = active[0];
      return [
        `Apa penyebab parameter ${primary.label} memicu alarm?`,
        `Langkah SOP mitigasi darurat untuk ${primary.label}`,
        `Apakah unit trafo aman dioperasikan dengan kondisi ini?`,
        `Hubungi Teknisi B&D (+62 813-2650-7575)`
      ];
    }
    return [
      'Evaluasi menyeluruh kesehatan transformator saat ini',
      'Jadwal rekomendasi uji kualitas minyak & DGA',
      'Analisis efisiensi pembebanan trafo',
      'Kontak Tim Engineering PT Bambang Djaja'
    ];
  }, [data]);

  const currentLoadingKva = useMemo(() => {
    if (liveMeter?.power !== undefined && liveMeter?.power !== null) {
      return Number((Number(liveMeter.power) / 1000).toFixed(1));
    }
    return data?.telemetryCards?.currentPowerKva || 44.5;
  }, [liveMeter, data]);

  const currentOilTemperature = useMemo(() => {
    if (liveOil?.oil_temperature !== undefined && liveOil?.oil_temperature !== null) {
      return Number(Number(liveOil.oil_temperature).toFixed(1));
    }
    return data?.telemetryCards?.currentOilTemp || 57.0;
  }, [liveOil, data]);

  const trafoDisplayName = sessionTrafoName || data?.trafo?.trafoSerialNo || `Transformer #${trafoId}`;
  const healthIndex = data?.healthIndex || 100;
  const alarmCount = data?.counts?.alarm || 0;
  const tripCount = data?.counts?.trip || 0;

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0 h-full p-2 sm:p-4 max-w-7xl mx-auto w-full">
      <div className="bg-white dark:bg-[#151521] p-3.5 sm:p-4 rounded-2xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                B&D AI Diagnostic Assistant
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                AI Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Unit Aktif: <span className="font-semibold text-slate-700 dark:text-slate-200">{trafoDisplayName}</span> • Analisis Telemetri Real-time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <button
            onClick={fetchStatusData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Sinkron Data</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
        <div className="bg-white dark:bg-[#151521] p-3 rounded-xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Health Index</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{healthIndex}%</span>
            <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1 mt-0.5">
              <ShieldCheck size={11} /> {healthIndex >= 85 ? 'Optimal' : 'Perhatian'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <HeartPulse size={18} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#151521] p-3 rounded-xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Status Anomali</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {alarmCount} <span className="text-xs font-normal text-slate-400">Alarm</span>
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              {tripCount} Trip Terdeteksi
            </span>
          </div>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            alarmCount > 0 || tripCount > 0 ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500'
          }`}>
            <AlertTriangle size={18} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#151521] p-3 rounded-xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Beban Aktif</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{currentLoadingKva} <span className="text-xs font-normal text-slate-400">kVA</span></span>
            <span className="text-[10px] text-indigo-500 font-medium block mt-0.5">Daya Nyata Terpantau</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Zap size={18} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#151521] p-3 rounded-xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Suhu Top Oil</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{currentOilTemperature}°C</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">Batas Alarm: &gt;70°C</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Thermometer size={18} />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#151521] rounded-2xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs overflow-hidden">
        <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 w-full sm:w-auto">
            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap mr-1">Pertanyaan Cepat:</span>
            {quickQuestions.map((qText, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(qText)}
                className="px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition whitespace-nowrap shadow-xs"
              >
                {qText}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 flex flex-col gap-3 min-h-0">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[80%] p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-xs shadow-sm shadow-indigo-600/20'
                    : 'bg-slate-100 dark:bg-[#1e1e2d] text-slate-800 dark:text-slate-200 rounded-bl-xs border border-slate-200/80 dark:border-white/5 shadow-xs'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>

                {(msg.showContact || /(\+?62\s*813[- ]?2650[- ]?7575|engineer|teknisi|technician|contact|hubungi|kontak)/i.test(msg.text)) && msg.sender === 'assistant' && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                      <Phone size={13} />
                      <span>B&D Hotline Engineer: +62 813-2650-7575</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://wa.me/6281326507575?text=${encodeURIComponent(`Halo Teknisi B&D, saya memerlukan asistensi teknis untuk transformator unit ${trafoDisplayName}.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
                      >
                        <MessageCircle size={13} />
                        <span>WhatsApp Teknisi</span>
                      </a>
                      <a
                        href="tel:+6281326507575"
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
                      >
                        <Phone size={13} />
                        <span>Panggilan Telepon</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1">
                {formatTimeId(msg.time)}
              </span>
            </div>
          ))}

          {chatLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]"></div>
              <span>Menganalisis telemetri & SOP B&D...</span>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {speechError && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border-t border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{speechError}</span>
          </div>
        )}

        <div className="p-3 bg-white dark:bg-[#151521] border-t border-slate-100 dark:border-slate-800 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleVoiceInput}
              title={isListening ? 'Berhenti merekam suara' : 'Bicara (Voice-to-Text)'}
              className={`p-2.5 rounded-xl border transition-all ${
                isListening
                  ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={isListening ? 'Mendengarkan ucapan Anda...' : 'Ketik pertanyaan atau permasalahan teknis transformator...'}
              className="flex-1 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-indigo-500 transition"
            />

            <button
              type="submit"
              disabled={!inputMessage.trim() || chatLoading}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition shadow-xs"
              title="Kirim Pesan"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AiAssistant;
