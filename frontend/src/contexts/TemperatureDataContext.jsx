import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from "socket.io-client";
import { useApi } from './ApiContext';

const TemperatureDataContext = createContext();

export const useTemperatureData = () => useContext(TemperatureDataContext);

export const TemperatureDataProvider = ({ children }) => {
  const { apiUrl } = useApi();
  
  const [isConnected, setIsConnected] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [liveData, setLiveData] = useState([]);
  
  const [data, setData] = useState({
    oil_temperature: 0.0,
    oil_pressure: 0.0,
    oil_level: false,
    adc_connected: false
  });

  const lastDataRef = useRef(null);

  useEffect(() => {
    const socket = io(apiUrl, {
      transports: ["websocket"],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("oil_sensor", (msg) => {
      if (!msg) return;
      
      const newTemp = msg.oil_temperature !== undefined ? msg.oil_temperature : 0;
      const newPress = msg.oil_pressure !== undefined ? msg.oil_pressure : 0;
      const newLevel = msg.oil_level === true; // Default false if missing
      const connected = msg.adc_connected !== false;
      
      setData({
        oil_temperature: newTemp,
        oil_pressure: newPress,
        oil_level: newLevel,
        adc_connected: connected
      });
      setIsLive(connected);

      if (connected) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' });
        
        const newPoint = {
          time: timeStr,
          timestamp: now.toISOString(),
          oil_temperature: newTemp,
          oil_pressure: newPress,
          oil_level: newLevel
        };

        // Only add if changed
        if (lastDataRef.current) {
          const last = lastDataRef.current;
          if (last.oil_temperature === newPoint.oil_temperature && 
              last.oil_pressure === newPoint.oil_pressure &&
              last.oil_level === newPoint.oil_level) {
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
      }
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      setIsLive(false);
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
      setIsLive(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [apiUrl]);

  return (
    <TemperatureDataContext.Provider value={{ liveData, data, isConnected, isLive }}>
      {children}
    </TemperatureDataContext.Provider>
  );
};
