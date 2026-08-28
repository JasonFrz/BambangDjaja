import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Zap, Activity, ShieldCheck, ShieldAlert, Building2, MessageCircle } from 'lucide-react';
import EnergyLoader from '../components/EnergyLoader';
import { useApi } from '../contexts/ApiContext';


const TransformerSelection = () => {
  const [transformers, setTransformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { apiUrl } = useApi();
  const navigate = useNavigate();

  const [selectedTrafoName, setSelectedTrafoName] = useState("");
  
  const [waSending, setWaSending] = useState(null);
  const [waStatus, setWaStatus] = useState({});

  // Inline rename states
  const [editingTrafoId, setEditingTrafoId] = useState(null);
  const [editNameValue, setEditNameValue] = useState("");



  useEffect(() => {
    const fetchTransformers = async () => {
      try {
        const username = sessionStorage.getItem('username');
        const role = sessionStorage.getItem('role');
        const companyName = sessionStorage.getItem('company_name');
        const token = sessionStorage.getItem('token');

        const response = await fetch(`${apiUrl}/api/trafo`, {
          headers: {
            'X-Username': username,
            'X-Role': role,
            'X-DB-Name': companyName,
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setTransformers(data);
        } else {
          setError("Gagal mengambil data trafo dari server.");
        }
      } catch (err) {
        setError("Koneksi ke server gagal.");
      } finally {
        setLoading(false);
      }
    };

    fetchTransformers();
  }, [apiUrl]);

  const handleMonitor = (trafo) => {
    setSelectedTrafoName(trafo.nama || trafo.name);
    
    sessionStorage.setItem('selectedTrafoId', trafo.id);
    window.dispatchEvent(new Event('trafoChanged'));
    
    navigate('/dashboard', { state: { fromHome: true } });
  };

  const handleRenameSubmit = async (trafoId, currentName) => {
    if (!editNameValue || editNameValue.trim() === '' || editNameValue.trim() === currentName) {
      setEditingTrafoId(null);
      return;
    }
    
    try {
      const companyName = sessionStorage.getItem('company_name');
      const token = sessionStorage.getItem('token');
      
      const response = await fetch(`${apiUrl}/api/trafo/${trafoId}/name`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-DB-Name': companyName,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: editNameValue.trim() })
      });
      
      if (response.ok) {
        setTransformers(prev => prev.map(t => t.id === trafoId ? { ...t, nama: editNameValue.trim() } : t));
      } else {
        alert('Gagal mengubah nama trafo');
      }
    } catch (err) {
      console.error('Failed to rename trafo', err);
    } finally {
      setEditingTrafoId(null);
    }
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
          transformer_name: trafo.nama || trafo.name,
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

  const companyName = sessionStorage.getItem('company_name');
  const totalUnits = transformers.length;
  const onlineUnits = transformers.filter(t => t.status !== 'Offline' && t.status !== undefined).length;
  const offlineUnits = totalUnits - onlineUnits;



  return (
    <div 
      className="relative min-h-full w-full bg-dot-pattern flex flex-col overflow-hidden"
    >

      {/* Elegant ambient glow behind the content, shining from the bottom up */}
      <div className="absolute bottom-[-20%] left-1/2 -translate-x-1/2 w-[80vw] h-[60vh] bg-gradient-to-t from-[#0052cc]/15 via-[#0052cc]/5 dark:from-[#4c9aff]/20 dark:via-[#4c9aff]/5 to-transparent blur-[120px] pointer-events-none rounded-full z-0"></div>

      {/* Gradient fade to blend seamlessly into the bottom edge without dimming text */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#f4f7fe] dark:from-[#111217] to-transparent pointer-events-none z-0"></div>



      <div className="flex flex-col items-center justify-start flex-1 w-full max-w-6xl mx-auto py-6 md:py-8 px-4 relative z-10">
        
        {/* Premium Hero Section */}
        <div className="text-center mb-6 flex flex-col items-center animate-slide-up-fade">
          <h1 className="text-3xl md:text-[38px] font-heading font-bold tracking-tight text-[#172b4d] dark:text-white leading-tight mb-4">
            Select a unit to begin monitoring
          </h1>
          <p className="text-[#5e6c84] dark:text-[#94a3b8] text-sm md:text-base font-medium mx-auto">
            Every transformer runs its own live dashboard, reports, and settings.
          </p>
          
          <div className="mt-6 inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-[#dfe1e6]/60 dark:border-white/10 bg-white dark:bg-[#151521] text-[#172b4d] dark:text-white text-sm font-semibold hover:border-gray-300 dark:hover:border-white/20 transition-colors cursor-default shadow-sm">
            <Building2 size={16} className="text-[#5e6c84] dark:text-[#94a3b8]" />
            {companyName || 'Unknown Company'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 ml-1"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="flex items-center gap-4 text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] mb-8 animate-slide-up-fade" style={{ animationDelay: '100ms' }}>
          <span className="flex items-center gap-1.5"><Activity size={14}/> {totalUnits} units</span>
          <span>·</span>
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>{onlineUnits} online</span>
          <span>·</span>
          <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>{offlineUnits} offline</span>
        </div>

        {error ? (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800/30">
            {error}
          </div>
        ) : loading ? (
          <EnergyLoader text="Loading fleet..." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {transformers.map((trafo, index) => {
              const isOnline = trafo.status !== 'Offline' && trafo.status !== undefined;
              
              return (
                <div 
                  key={trafo.id} 
                  className={`bg-white dark:bg-[#151521] rounded-[16px] overflow-hidden hover:-translate-y-1 transition-all duration-300 flex flex-col group opacity-0 animate-slide-up-fade border-y border-r border-l-4 ${
                    isOnline 
                      ? 'border-y-[#dfe1e6] border-r-[#dfe1e6] border-l-emerald-500 dark:border-y-white/5 dark:border-r-white/5 dark:border-l-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.03)]' 
                      : 'border-[#dfe1e6] dark:border-white/5 hover:border-[#b3bac5] dark:hover:border-white/20'
                  }`}
                  style={{ animationDelay: `${index * 100 + 200}ms` }}
                >
                  
                  {/* Top Area */}
                  <div className="relative h-[200px] w-full bg-gray-50/50 dark:bg-white/[0.02] border-b border-[#dfe1e6]/50 dark:border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                    
                    {trafo.image_url ? (
                      <img src={trafo.image_url} alt={trafo.nama || trafo.name} className="w-full h-full object-cover" />
                    ) : (
                      <svg viewBox="0 0 100 40" className={`w-32 h-auto transition-colors duration-500 ${isOnline ? 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'text-[#5e6c84] dark:text-gray-600 opacity-40'}`}>
                        <path 
                          d="M 0 20 L 30 20 L 40 5 L 50 35 L 60 20 L 100 20" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2.5" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          className={isOnline ? 'animate-waveform-dash' : ''}
                          style={isOnline ? { strokeDasharray: '8 6' } : {}}
                        />
                      </svg>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-[#111217] border border-[#dfe1e6]/80 dark:border-white/10 shadow-sm z-10">
                      {isOnline ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-status-pulse"></div>
                          <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Online</span>
                        </>
                      ) : (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-500">Offline</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Body Area */}
                  <div className="p-5 flex flex-col flex-1 z-10">
                    {editingTrafoId === trafo.id ? (
                      <input 
                        type="text" 
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        onBlur={() => handleRenameSubmit(trafo.id, trafo.nama || trafo.name)}
                        onKeyDown={(e) => { 
                          if(e.key === 'Enter') handleRenameSubmit(trafo.id, trafo.nama || trafo.name); 
                          if(e.key === 'Escape') setEditingTrafoId(null); 
                        }}
                        autoFocus
                        className="font-bold text-[15px] text-[#172b4d] dark:text-white leading-tight bg-transparent border-b-2 border-blue-500 outline-none w-full"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <h3 
                        className="font-bold text-[15px] text-[#172b4d] dark:text-white leading-tight truncate cursor-text"
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingTrafoId(trafo.id); setEditNameValue(trafo.nama || trafo.name); }}
                        title="Double click to rename"
                      >
                        {trafo.nama || trafo.name}
                      </h3>
                    )}
                    <p className="font-mono text-[11px] text-[#5e6c84] dark:text-gray-500 mt-1 truncate">
                      {trafo.device_serial || '-'}
                    </p>

                    {/* Specs Badges */}
                    <div className="flex items-center gap-2 mt-4 mb-6">
                      <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                        {trafo.power_capacity || '1000 kVA'}
                      </span>
                      <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                        {trafo.type || 'DyN'}
                      </span>
                    </div>

                    <div className="mt-auto">
                      <button 
                        onClick={() => handleMonitor(trafo)}
                        className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all duration-200 hover:-translate-y-[1px] flex items-center justify-center gap-2 ${
                          isOnline 
                            ? 'bg-[#0052cc] hover:bg-[#0047b3] dark:bg-[#5744c6] dark:hover:bg-[#6554c0] text-white shadow-sm' 
                            : 'bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 border border-transparent dark:border-white/5'
                        }`}
                      >
                        Enter console
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransformerSelection;
