import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useWebSocket } from '../hooks/useWebSocket';
import { useApi } from './ApiContext';

const TrendDataContext = createContext();

export const useTrendData = () => useContext(TrendDataContext);

const mapReadingToPoint = (reading) => {
  const date = new Date(reading.timestamp);
  return {
    time: date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }),
    timestamp: date.toISOString(),
    phaseA: parseFloat(reading.phase_a_v) || 0,
    phaseB: parseFloat(reading.phase_b_v) || 0,
    phaseC: parseFloat(reading.phase_c_v) || 0,
    lineAB: parseFloat(reading.line_ab_v) || 0,
    lineBC: parseFloat(reading.line_bc_v) || 0,
    lineCA: parseFloat(reading.line_ca_v) || 0,
    currentA: parseFloat(reading.current_a) || 0,
    currentB: parseFloat(reading.current_b) || 0,
    currentC: parseFloat(reading.current_c) || 0,
    currentN: parseFloat(reading.current_n) || 0,
    currentUnbalance: parseFloat(reading.current_unbalance) || 0,
    powerActiveTotal: parseFloat(reading.power_active_total || reading.power_active_total_kw) || 0,
    powerReactiveTotal: parseFloat(reading.power_reactive_total || reading.power_reactive_total_kvar) || 0,
    powerApparentTotal: parseFloat(reading.power_apparent_total || reading.power_apparent_total_kva) || 0,
    pfTotal: Number((parseFloat(reading.pf_total) || 0).toFixed(2)),
    powerActiveA: parseFloat(reading.power_active_a) || 0,
    powerActiveB: parseFloat(reading.power_active_b) || 0,
    powerActiveC: parseFloat(reading.power_active_c) || 0,
    frequency: parseFloat(reading.frequency) || 0,
    energyActiveTotal: parseFloat(reading.energy_active_total) || 0,
    energyReactiveTotal: parseFloat(reading.energy_reactive_total) || 0,
    avgPhaseV: parseFloat(reading.avg_phase_v) || 0,
    avgLineV: parseFloat(reading.avg_line_v) || 0,
    avgCurrent: parseFloat(reading.avg_current) || 0,
    onOffStatus: parseInt(reading.on_off_status, 10) || 0,
    relayStatus: parseInt(reading.relay_status, 10) || 0,
    alarmStatus: parseInt(reading.alarm_status, 10) || 0,
    synced: parseInt(reading.synced, 10) || 0,
    efficiency: parseFloat(reading.efficiency) || 0,
  };
};

export const TrendDataProvider = ({ children }) => {
  const [liveData, setLiveData] = useState([]);
  const { apiUrl } = useApi();
  const [updateInterval, setUpdateInterval] = useState(() => {
    const saved = localStorage.getItem('updateInterval');
    return saved !== null ? parseInt(saved, 10) : 5000;
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

  // Initial fetch for Live mode
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
      const historical = (res.data || []).map(mapReadingToPoint);
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

  // Universal Range Data Fetcher (Grafana Time Engine)
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
          interval = 0; // Raw or 2s
          label = 'Last 15m';
        } else if (preset === '1h') {
          start = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
          interval = 5; // 5s interval
          label = 'Last 1h';
        } else if (preset === '6h') {
          start = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
          interval = 30; // 30s interval
          label = 'Last 6h';
        } else if (preset === '24h') {
          start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
          interval = 120; // 2 min interval
          label = 'Last 24h';
        } else if (preset === '7d') {
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          interval = 600; // 10 min interval
          label = 'Last 7 Days';
        }
      } else {
        label = 'Custom Range';
        // Auto calculate interval based on duration
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

      const historical = (res.data || []).map(mapReadingToPoint);
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

  // Live WebSocket point streaming (only active in Live Mode)
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

  // Liveness checker
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
