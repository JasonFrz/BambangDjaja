import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import { Wifi, Globe, X } from 'lucide-react';

const NetworkBadge = () => {
  const { apiUrl } = useApi();
  const [isVisible, setIsVisible] = useState(true);
  
  // Deteksi apakah menggunakan IP lokal
  const isLocal = apiUrl.includes('192.168.') || apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1');

  // Auto-hide setelah 5 detik
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-[slideUp_0.5s_ease-out]">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md ${
        isLocal 
          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
          : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400'
      }`}>
        {isLocal ? <Wifi size={20} /> : <Globe size={20} />}
        <div>
          <p className="text-sm font-bold m-0 leading-tight">
            {isLocal ? 'Intranet Mode' : 'Internet Mode'}
          </p>
          <p className="text-xs opacity-80 m-0">
            {isLocal ? 'Koneksi Lokal (Cepat)' : 'Koneksi Cloud (Publik)'}
          </p>
        </div>
        <button 
          onClick={() => setIsVisible(false)}
          className="ml-2 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default NetworkBadge;
