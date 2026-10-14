import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { WifiOff, CalendarX, RefreshCw } from 'lucide-react';
import { useApi } from '../contexts/ApiContext';
import { deviceState } from '../config/panelHelpers';

// Tampilan state Offline / No Data dari dashboard-documentation 3.5 dan 8.5.
export const DeviceStateNotice = ({ state, onRefresh }) => {
  if (!state) return null;
  const offline = state === 'offline';
  const Icon = offline ? WifiOff : CalendarX;
  return (
    <div className={`mb-3 flex items-center gap-3 rounded-xl border px-4 py-3 ${offline
      ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300'
      : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300'}`}>
      <Icon size={22} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">{offline ? 'Device is Offline' : 'No Data Found For Today'}</div>
        <div className="text-xs opacity-80">{offline
          ? 'Raspberry Pi trafo ini tidak terhubung. Panel menampilkan data terakhir yang tersimpan.'
          : 'Device online, tetapi belum ada data pembacaan hari ini.'}</div>
      </div>
      {offline && (
        <button onClick={onRefresh} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700">
          <RefreshCw size={13} /> Refresh
        </button>
      )}
    </div>
  );
};

// Status Online/Offline dari GET /api/trafo/:id (koneksi Raspi atau trafo_last_connection < 2 menit).
export const DeviceStateBanner = ({ isLiveMode, isLoading, lastTimestamp }) => {
  const { apiUrl } = useApi();
  const [online, setOnline] = useState(null);

  const load = useCallback(async () => {
    const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
    if (!sessionStorage.getItem('db_name')) return;
    try {
      const res = await axios.get(`${apiUrl}/api/trafo/${trafoId}`);
      setOnline(!!res.data && res.data.status === 'Online');
    } catch {
      setOnline(null);
    }
  }, [apiUrl]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 30000);
    const onTrafoChange = () => { setOnline(null); load(); };
    window.addEventListener('trafoChanged', onTrafoChange);
    return () => { clearInterval(t); window.removeEventListener('trafoChanged', onTrafoChange); };
  }, [load]);

  const state = deviceState({ online, isLiveMode, isLoading, lastTimestamp });
  return <DeviceStateNotice state={state} onRefresh={() => window.location.reload()} />;
};
