import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useApi } from '../contexts/ApiContext';

// Ambil GET /api/trafo/:id/<path> untuk trafo terpilih, ulangi tiap `intervalMs`, ulang saat trafoChanged.
export function useTrafoApi(path, intervalMs = 60000, params = undefined) {
  const { apiUrl } = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const paramsKey = JSON.stringify(params || {});

  const load = useCallback(async () => {
    const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
    if (!sessionStorage.getItem('db_name')) { setIsLoading(false); return; }
    try {
      const res = await axios.get(`${apiUrl}/api/trafo/${trafoId}/${path}`, { params: JSON.parse(paramsKey) });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, path, paramsKey]);

  useEffect(() => {
    load();
    const t = intervalMs > 0 ? setInterval(() => { if (!document.hidden) load(); }, intervalMs) : null;
    window.addEventListener('trafoChanged', load);
    return () => { if (t) clearInterval(t); window.removeEventListener('trafoChanged', load); };
  }, [load, intervalMs]);

  return { data, error, isLoading, reload: load };
}
