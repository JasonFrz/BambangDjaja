import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useWebSocket } from '../hooks/useWebSocket';
import { useApi } from './ApiContext';

const TrendDataContext = createContext();

export const useTrendData = () => useContext(TrendDataContext);

export const TrendDataProvider = ({ children }) => {
  const [liveData, setLiveData] = useState([]);
  const { apiUrl } = useApi();
  const [updateInterval, setUpdateInterval] = useState(() => {
    const saved = localStorage.getItem('updateInterval');
    return saved !== null ? parseInt(saved, 10) : 2000;
  });
  
  useEffect(() => {
    localStorage.setItem('updateInterval', updateInterval.toString());
    window.dispatchEvent(new CustomEvent('intervalChanged', { detail: updateInterval }));
  }, [updateInterval]);

  const { data: wsData, isConnected } = useWebSocket(apiUrl, updateInterval);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const lastDataRef = useRef(null);

  useEffect(() => {
    const dbName = sessionStorage.getItem('company_name');
    if (!dbName) return;

    axios.get(`${apiUrl}/api/trends/meter`, {
      headers: { 
        'X-DB-Name': dbName,
        'ngrok-skip-browser-warning': '69420'
      }
    })
    .then(res => {
      const historical = res.data.map(reading => {
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
          powerActiveTotal: parseFloat(reading.power_active_total) || 0,
          powerReactiveTotal: parseFloat(reading.power_reactive_total) || 0,
          powerApparentTotal: parseFloat(reading.power_apparent_total) || 0,
          pfTotal: parseFloat(reading.pf_total) || 0,
          powerActiveA: parseFloat(reading.power_active_a) || 0,
          powerActiveB: parseFloat(reading.power_active_b) || 0,
          powerActiveC: parseFloat(reading.power_active_c) || 0,
          frequency: parseFloat(reading.frequency) || 0,
          energyActiveTotal: parseFloat(reading.energy_active_total) || 0,
          energyReactiveTotal: parseFloat(reading.energy_reactive_total) || 0,
          avgPhaseV: parseFloat(reading.avg_phase_v) || 0,
          avgLineV: parseFloat(reading.avg_line_v) || 0,
          avgCurrent: parseFloat(reading.avg_current) || 0,
          onOffStatus: parseInt(reading.on_off_status) || 0,
          relayStatus: parseInt(reading.relay_status) || 0,
          alarmStatus: parseInt(reading.alarm_status) || 0,
          synced: parseInt(reading.synced) || 0,
          efficiency: parseFloat(reading.efficiency) || 0,
        };
      });
      if (historical.length > 0) {
        const receiptTime = Date.now();
        lastDataRef.current = { ...historical[historical.length - 1], _receivedAt: receiptTime };
        setLiveData(historical);
      }
    })
    .catch(err => console.error("Error fetching trend data:", err))
    .finally(() => setIsLoading(false));
  }, [apiUrl]);

  useEffect(() => {
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
  }, [wsData]);

  useEffect(() => {
    const checkLive = () => {
      if (lastDataRef.current && lastDataRef.current._receivedAt) {
        const diffMs = Date.now() - lastDataRef.current._receivedAt;
        const isDataRecent = diffMs < Math.max(15000, updateInterval * 3); // Toleransi 3x interval atau minimal 15 detik
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
      isLoading,
      updateInterval,
      setUpdateInterval
    }}>
      {children}
    </TrendDataContext.Provider>
  );
};
