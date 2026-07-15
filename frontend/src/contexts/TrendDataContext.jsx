import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useApi } from './ApiContext';

const TrendDataContext = createContext();

export const useTrendData = () => useContext(TrendDataContext);

export const TrendDataProvider = ({ children }) => {
  const [liveData, setLiveData] = useState([]);
  const { apiUrl } = useApi();
  const { data: wsData, isConnected } = useWebSocket(apiUrl);
  const isLive = isConnected && (!wsData || wsData.modbus_connected !== false);
  const lastDataRef = useRef(null);

  useEffect(() => {
    if (!wsData || !wsData.modbus_connected) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' });

    const newPoint = {
      time: timeStr,
      timestamp: now.toISOString(),
      phaseA: wsData.vPhase?.A || 0,
      phaseB: wsData.vPhase?.B || 0,
      phaseC: wsData.vPhase?.C || 0,
      lineAB: wsData.vLine?.AB || 0,
      lineBC: wsData.vLine?.BC || 0,
      lineCA: wsData.vLine?.CA || 0,
      currentA: wsData.current?.A || 0,
      currentB: wsData.current?.B || 0,
      currentC: wsData.current?.C || 0,
      frequency: wsData.frequency || 0,
      efficiency: wsData.efficiency || 0,
    };

    // Only add point if data actually changed
    if (lastDataRef.current) {
      const last = lastDataRef.current;
      const hasChanged =
        newPoint.phaseA !== last.phaseA ||
        newPoint.phaseB !== last.phaseB ||
        newPoint.phaseC !== last.phaseC ||
        newPoint.lineAB !== last.lineAB ||
        newPoint.lineBC !== last.lineBC ||
        newPoint.lineCA !== last.lineCA ||
        newPoint.currentA !== last.currentA ||
        newPoint.currentB !== last.currentB ||
        newPoint.currentC !== last.currentC ||
        newPoint.frequency !== last.frequency ||
        newPoint.efficiency !== last.efficiency;

      if (!hasChanged) return;
    }

    lastDataRef.current = newPoint;

    setLiveData((prev) => {
      const updated = [...prev, newPoint];
      // Keep last 120 points
      if (updated.length > 120) {
        return updated.slice(updated.length - 120);
      }
      return updated;
    });
  }, [wsData]);

  return (
    <TrendDataContext.Provider value={{ liveData, wsData, isConnected, isLive }}>
      {children}
    </TrendDataContext.Provider>
  );
};
