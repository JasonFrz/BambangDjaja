import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Zap, Activity, ShieldCheck, ShieldAlert, Building2, MessageCircle } from 'lucide-react';
import EnergyLoader from '../components/EnergyLoader';
import { useApi } from '../contexts/ApiContext';
import LoadingScreen from '../components/LoadingScreen';

const TransformerSelection = () => {
  const [transformers, setTransformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { apiUrl } = useApi();
  const navigate = useNavigate();

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedTrafoName, setSelectedTrafoName] = useState("");
  
  const [waSending, setWaSending] = useState(null);
  const [waStatus, setWaStatus] = useState({});

  useEffect(() => {
    const fetchTransformers = async () => {
      try {
        const username = sessionStorage.getItem('username');
        const role = sessionStorage.getItem('role');
        const companyName = sessionStorage.getItem('company_name');
        
        const response = await axios.get(`${apiUrl}/api/transformers`, {
          headers: { 
            'X-Username': username,
            'X-Role': role,
            'X-Company-Name': companyName
          }
        });
        setTransformers(response.data);
        setError(null);
      } catch (err) {
        console.error("Error fetching transformers:", err);
        setError("Failed to load transformers. Ensure backend is running.");
      } finally {
        setLoading(false);
      }
    };

    fetchTransformers();
  }, []);

  const handleMonitor = (trafo) => {
    setSelectedTrafoName(trafo.name);
    setIsTransitioning(true);
    
    sessionStorage.setItem('selectedTrafoId', trafo.id);
    
    setTimeout(() => {
      navigate('/dashboard');
    }, 2500);
  };

  const handleSendWA = async (trafo) => {
    setWaSending(trafo.id);
    setWaStatus(prev => ({ ...prev, [trafo.id]: null }));

    try {
      const username = sessionStorage.getItem('username');
      const role = sessionStorage.getItem('role');
      const companyName = sessionStorage.getItem('company_name');

      const response = await fetch(`${apiUrl}/api/whatsapp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Username': username,
          'X-Role': role,
          'X-Company-Name': companyName
        },
        body: JSON.stringify({
          transformer_id: trafo.id,
          transformer_name: trafo.name,
          message_type: 'report'
        })
      });

      const data = await response.json();

      if (response.ok) {
        setWaStatus(prev => ({ ...prev, [trafo.id]: { type: 'success', msg: data.message + (data.simulated ? ' (Simulasi)' : '') } }));
      } else {
        setWaStatus(prev => ({ ...prev, [trafo.id]: { type: 'error', msg: data.error || 'Gagal mengirim pesan' } }));
        
        if (data.needsQR) {
          window.open(`${apiUrl}/api/whatsapp/qr`, '_blank');
        }
      }
    } catch (err) {
      setWaStatus(prev => ({ ...prev, [trafo.id]: { type: 'error', msg: 'Tidak dapat terhubung ke server' } }));
    } finally {
      setWaSending(null);
      setTimeout(() => {
        setWaStatus(prev => ({ ...prev, [trafo.id]: null }));
      }, 5000);
    }
  };

  return (
    <>
      {/* Show Loading Screen if transitioning */}
      {isTransitioning && (
        <LoadingScreen 
          text="Loading Dashboard..." 
          subtext={selectedTrafoName}
        />
      )}

      <div className="flex flex-col items-center justify-start min-h-full w-full max-w-6xl mx-auto py-10 animate-[fadeIn_0.5s_ease-out]">
        
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-[#0052cc] dark:text-[#6554c0] font-heading mb-4">
            Select Transformer to Monitor
          </h1>
          <p className="text-[#5e6c84] dark:text-[#94a3b8] text-lg">
            Choose a transformer unit to access real-time monitoring and analytics
          </p>
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#dfe1e6] dark:border-white/10 bg-white dark:bg-[#151521] text-[#172b4d] dark:text-white text-sm font-medium shadow-sm">
            <Building2 size={16} className="text-[#0052cc] dark:text-[#4c9aff]" />
            PT. Bambang Djaja
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800/30">
            {error}
          </div>
        ) : loading ? (
          <EnergyLoader text="Memuat daftar trafo..." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
            {transformers.map((trafo, index) => (
              <div 
                key={trafo.id} 
                className="bg-white dark:bg-[#151521] rounded-2xl overflow-hidden border border-[#dfe1e6] dark:border-white/10 shadow-md hover:shadow-xl hover:border-[#0052cc]/50 dark:hover:border-[#6554c0]/50 hover:-translate-y-2 transition-all duration-500 flex flex-col group opacity-0 animate-slide-up-fade"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                
                <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-[#0052cc] to-[#4c9aff] flex-shrink-0 group-hover:from-[#0047b3] group-hover:to-[#3b82f6] transition-colors duration-500">
                  <div className="absolute inset-0 opacity-40 mix-blend-overlay" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  }}></div>
                  <div className="absolute inset-0 flex items-center justify-center text-white/30 group-hover:text-white/80 group-hover:scale-125 transition-all duration-700 animate-float-soft">
                    <Activity size={80} strokeWidth={1} />
                  </div>

                  <div className="absolute top-4 right-4">
                    {trafo.status === 'Online' ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-sm">
                        <ShieldCheck size={14} />
                        Safe
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-500/20 backdrop-blur-md border border-gray-500/30 text-gray-700 dark:text-gray-300 text-xs font-bold shadow-sm">
                        <ShieldAlert size={14} />
                        Offline
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-lg text-[#172b4d] dark:text-white leading-tight truncate pr-2" title={trafo.name}>
                      {trafo.name}
                    </h3>
                    {trafo.status === 'Online' ? (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        Online
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-medium shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                        Offline
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#5e6c84] dark:text-[#94a3b8] mb-6">ID: {trafo.id}</p>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-[#f4f5f7] dark:bg-white/5 text-[#172b4d] dark:text-white text-sm font-medium border border-[#dfe1e6]/50 dark:border-white/5">
                      <Zap size={16} className="text-[#0052cc] dark:text-[#4c9aff]" />
                      {trafo.power_capacity}
                    </div>
                    <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-[#f4f5f7] dark:bg-white/5 text-[#172b4d] dark:text-white text-sm font-medium border border-[#dfe1e6]/50 dark:border-white/5">
                      <Activity size={16} className="text-[#6554c0] dark:text-[#8777d9]" />
                      {trafo.type}
                    </div>
                  </div>

                  <div className="mt-auto space-y-2">
                    {waStatus[trafo.id] && (
                      <div className={`text-xs px-3 py-2 rounded-lg ${waStatus[trafo.id].type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                        {waStatus[trafo.id].msg}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleMonitor(trafo)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#0052cc] to-[#3f51b5] dark:from-[#5744c6] dark:to-[#7462db] text-white font-semibold hover:shadow-lg hover:opacity-90 transition-all focus:ring-4 focus:ring-[#0052cc]/30"
                      >
                        <Activity size={18} />
                        Monitor
                      </button>
                      <button 
                        onClick={() => handleSendWA(trafo)}
                        disabled={waSending === trafo.id}
                        className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white font-semibold hover:shadow-lg transition-all focus:ring-4 focus:ring-[#25D366]/30 disabled:opacity-60"
                        title="Kirim Notifikasi WhatsApp"
                      >
                        {waSending === trafo.id ? (
                          <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <MessageCircle size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default TransformerSelection;
