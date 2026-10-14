import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useWebSocket } from '../hooks/useWebSocket';
import { useApi } from './ApiContext';

const TrendDataContext = createContext();

export const useTrendData = () => useContext(TrendDataContext);

// Respons backend sudah memakai key frontend; hanya pastikan time/timestamp ada.
const toPoint = (r) => {
  const date = new Date(r.timestamp);
  return {
    ...r,
    time: r.time || date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }),
    timestamp: date.toISOString(),
  };
};

export const TrendDataProvider = ({ children }) => {
  const [liveData, setLiveData] = useState([]);
  const { apiUrl } = useApi();
  const [updateInterval, setUpdateInterval] = useState(() => {
    const saved = localStorage.getItem('updateInterval');
    return saved !== null ? parseInt(saved, 10) : 0;
  });

  const [timeRange, setTimeRange] = useState({
    mode: 'live',
    preset: 'live',
    label: 'Live (Streaming)',
    start: null,
    end: null,
    interval: null
  });

  const isLiveMode = timeRange.mode === 'live';

  useEffect(() => {
    localStorage.setItem('updateInterval', updateInterval.toString());
    window.dispatchEvent(new CustomEvent('intervalChanged', { detail: updateInterval }));
  }, [updateInterval]);

  const { data: wsData, isConnected } = useWebSocket(apiUrl, updateInterval);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const lastDataRef = useRef(null);

  const fetchLiveInitial = useCallback(async () => {
    const dbName = sessionStorage.getItem('db_name');
    if (!dbName) return;

    try {
      setIsLoading(true);
      const res = await axios.get(`${apiUrl}/api/trends/meter`, {
        headers: {
          'X-DB-Name': dbName,
          'ngrok-skip-browser-warning': '69420'
        }
      });
      const historical = (res.data || []).map(toPoint);
      if (historical.length > 0) {
        const receiptTime = Date.now();
        lastDataRef.current = { ...historical[historical.length - 1], _receivedAt: receiptTime };
        setLiveData(historical);
      }
    } catch (err) {
      console.error("Error fetching live trend data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchLiveInitial();
  }, [fetchLiveInitial]);

  // Ganti trafo: buang data lama dan ambil ulang untuk trafo yang baru dipilih.
  useEffect(() => {
    const onTrafoChange = () => { lastDataRef.current = null; setLiveData([]); fetchLiveInitial(); };
    window.addEventListener('trafoChanged', onTrafoChange);
    return () => window.removeEventListener('trafoChanged', onTrafoChange);
  }, [fetchLiveInitial]);

  const fetchRangeData = useCallback(async (preset, customStart = null, customEnd = null) => {
    const dbName = sessionStorage.getItem('db_name');
    if (!dbName) return;

    if (preset === 'live') {
      setTimeRange({
        mode: 'live',
        preset: 'live',
        label: 'Live (Streaming)',
        start: null,
        end: null,
        interval: null
      });
      fetchLiveInitial();
      return;
    }

    try {
      setIsLoading(true);
      let start = customStart;
      let end = customEnd;
      let interval = 0;
      let label = preset;

      const now = new Date();
      if (!start || !end) {
        end = now.toISOString();
        if (preset === '15m') {
          start = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
          interval = 0; 
          label = 'Last 15m';
        } else if (preset === '1h') {
          start = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
          interval = 5; 
          label = 'Last 1h';
        } else if (preset === '6h') {
          start = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
          interval = 30; 
          label = 'Last 6h';
        } else if (preset === '24h') {
          start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
          interval = 120; 
          label = 'Last 24h';
        } else if (preset === '7d') {
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          interval = 600; 
          label = 'Last 7 Days';
        }
      } else {
        label = 'Custom Range';
        const diffHours = (new Date(end) - new Date(start)) / (1000 * 60 * 60);
        if (diffHours <= 1) interval = 5;
        else if (diffHours <= 6) interval = 30;
        else if (diffHours <= 24) interval = 120;
        else interval = 600;
      }

      const params = { start, end };
      if (interval > 0) params.interval = interval;

      const res = await axios.get(`${apiUrl}/api/trends`, {
        headers: {
          'X-DB-Name': dbName,
          'ngrok-skip-browser-warning': '69420'
        },
        params
      });

      const historical = (res.data || []).map(toPoint);
      setLiveData(historical);
      setTimeRange({
        mode: 'historical',
        preset,
        label,
        start,
        end,
        interval
      });
    } catch (err) {
      console.error("Error fetching historical range data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, fetchLiveInitial]);

  const resetToLive = useCallback(() => {
    fetchRangeData('live');
  }, [fetchRangeData]);

  useEffect(() => {
    if (!isLiveMode) return;
    if (!wsData || !wsData.modbus_connected) return;

    const dataDate = wsData.timestamp ? new Date(wsData.timestamp) : new Date();
    const timeStr = dataDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' });

    const receiptTime = Date.now();
    const newPoint = {
      ...wsData,
      time: timeStr,
      timestamp: dataDate.toISOString(),
      _receivedAt: receiptTime,
    };

    if (lastDataRef.current) {
      const last = lastDataRef.current;
      if (newPoint.timestamp === last.timestamp) {
        return;
      }
    }

    lastDataRef.current = newPoint;

    setLiveData((prev) => {
      const updated = [...prev, newPoint];
      if (updated.length > 120) {
        return updated.slice(updated.length - 120);
      }
      return updated;
    });
  }, [wsData, isLiveMode]);

  useEffect(() => {
    const checkLive = () => {
      if (lastDataRef.current && lastDataRef.current._receivedAt) {
        const diffMs = Date.now() - lastDataRef.current._receivedAt;
        const isDataRecent = diffMs < Math.max(15000, updateInterval * 3);
        setIsLive(isConnected && isDataRecent && (!wsData || wsData.modbus_connected !== false));
      } else {
        setIsLive(false);
      }
    };

    checkLive();
    const interval = setInterval(checkLive, 5000);
    return () => clearInterval(interval);
  }, [isConnected, wsData, updateInterval]);

  return (
    <TrendDataContext.Provider value={{
      liveData,
      wsData,
      isConnected,
      isLive,
      isLiveMode,
      isLoading,
      timeRange,
      fetchRangeData,
      resetToLive,
      updateInterval,
      setUpdateInterval
    }}>
      {children}
    </TrendDataContext.Provider>
  );
};
