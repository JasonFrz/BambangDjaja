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
    oil_level_alarm: 0,
    oil_level_trip: 0,
    adc_connected: false
  });

  const lastDataRef = useRef(null);

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
          oil_level: reading.oil_level == 1,
          oil_level_alarm: (reading.oil_level_alarm == 1 || reading.oil_level_alarm === true) ? 1 : 0,
          oil_level_trip: (reading.oil_level_trip == 1 || reading.oil_level_trip === true) ? 1 : 0 
        };
      });
      if (historical.length > 0) {
        lastDataRef.current = historical[historical.length - 1];
        setLiveData(historical);

        const latest = historical[historical.length - 1];
        setData(prev => ({
          ...prev,
          oil_temperature: latest.oil_temperature,
          oil_pressure: latest.oil_pressure,
          oil_level: latest.oil_level,
          oil_level_alarm: latest.oil_level_alarm,
          oil_level_trip: latest.oil_level_trip
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
      const newLevel = msg.oil_level === true; 
      const connected = msg.adc_connected !== false;
      setData(prev => {
        const newAlarm = msg.oil_level_alarm !== undefined ? (msg.oil_level_alarm == 1 ? 1 : 0) : prev.oil_level_alarm;
        const newTrip = msg.oil_level_trip !== undefined ? (msg.oil_level_trip == 1 ? 1 : 0) : prev.oil_level_trip;

        return {
          oil_temperature: newTemp,
          oil_pressure: newPress,
          oil_level: newLevel,
          oil_level_alarm: newAlarm,
          oil_level_trip: newTrip,
          adc_connected: connected
        };
      });

      if (connected) {
        const dataDate = msg.timestamp ? new Date(msg.timestamp) : new Date();
        const timeStr = dataDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' });
        
        const newPoint = {
          time: timeStr,
          timestamp: dataDate.toISOString(),
          oil_temperature: newTemp,
          oil_pressure: newPress,
          oil_level: newLevel,
          oil_level_alarm: msg.oil_level_alarm !== undefined ? (msg.oil_level_alarm == 1 ? 1 : 0) : (lastDataRef.current ? lastDataRef.current.oil_level_alarm : 0),
          oil_level_trip: msg.oil_level_trip !== undefined ? (msg.oil_level_trip == 1 ? 1 : 0) : (lastDataRef.current ? lastDataRef.current.oil_level_trip : 0)
        };

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
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [apiUrl]);

  useEffect(() => {
    const checkLive = () => {
      if (lastDataRef.current && lastDataRef.current.timestamp) {
        const lastDataTime = new Date(lastDataRef.current.timestamp);
        const diffMs = Date.now() - lastDataTime.getTime();
        const isDataRecent = diffMs < 120000; // 2 menit
        
        // Kita juga perlu mengecek apakah socket masih connected
        setIsLive(isConnected && isDataRecent);
      } else {
        setIsLive(false);
      }
    };
    
    checkLive();
    const interval = setInterval(checkLive, 5000); 
    return () => clearInterval(interval);
  }, [isConnected]);

  return (
    <TemperatureDataContext.Provider value={{ liveData, data, isConnected, isLive }}>
      {children}
    </TemperatureDataContext.Provider>
  );
};
