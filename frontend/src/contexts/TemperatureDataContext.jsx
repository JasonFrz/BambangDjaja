import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
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

  // Fetch initial history (last 50)
  useEffect(() => {
    const trafoId = sessionStorage.getItem('selectedTrafoId');
    const dbName = sessionStorage.getItem('company_name');
    if (!trafoId || !dbName) return;

    axios.get(`${apiUrl}/api/trends/oil`, {
      headers: { 'X-DB-Name': dbName }
    })
    .then(res => {
      const historical = res.data.map(reading => {
        const date = new Date(reading.timestamp);
        return {
          time: date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }),
          timestamp: date.toISOString(),
          oil_temperature: parseFloat(reading.oil_temperature) || 0,
          oil_pressure: parseFloat(reading.oil_pressure) || 0,
          oil_level: 1 // Hardcoded per user request
        };
      });
      if (historical.length > 0) {
        lastDataRef.current = historical[historical.length - 1];
        setLiveData(historical);
        
        // Update current `data` state with latest
        const latest = historical[historical.length - 1];
        setData(prev => ({
          ...prev,
          oil_temperature: latest.oil_temperature,
          oil_pressure: latest.oil_pressure,
          oil_level: latest.oil_level == 1
        }));
      }
    })
    .catch(err => console.error("Failed to load historical temperature data", err));
  }, [apiUrl]);

  useEffect(() => {
    const socket = io(apiUrl, {
      transports: ["websocket"],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      setIsConnected(true);
      const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
      const dbName = sessionStorage.getItem('company_name');
      if (trafoId) {
        socket.emit("subscribe_transformer", { trafoId, dbName });
      }
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
        const dataDate = msg.timestamp ? new Date(msg.timestamp) : new Date();
        const timeStr = dataDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' });
        
        const newPoint = {
          time: timeStr,
          timestamp: dataDate.toISOString(),
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
