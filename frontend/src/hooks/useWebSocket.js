import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

export const useWebSocket = (url, updateInterval = 0) => {
  const [data, setData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const lastUpdateRef = useRef(0);
  const intervalRef = useRef(updateInterval);

  useEffect(() => {
    intervalRef.current = updateInterval;
  }, [updateInterval]);

  useEffect(() => {
    
    const socket = io(url, {
      extraHeaders: {
        "ngrok-skip-browser-warning": "69420"
      },
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      setIsConnected(true);
      console.log("Connected to Pilot SPM33 backend");
      
      const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
      const dbName = sessionStorage.getItem('company_name');
      if (trafoId) {
        socket.emit("subscribe_transformer", { trafoId, dbName });
      }
    });

    socket.on("meter", (msg) => {
      if (!msg) return;

      const now = Date.now();
      if (intervalRef.current > 0 && now - lastUpdateRef.current < intervalRef.current) {
        return;
      }
      lastUpdateRef.current = now;

      if (msg.modbus_connected === false && msg.phaseA === undefined) {
        setData({
          vPhase: { A: 0, B: 0, C: 0 },
          vLine: { AB: 0, BC: 0, CA: 0 },
          current: { A: 0, B: 0, C: 0 },
          frequency: 0, power: 0, energy: 0, efficiency: 0,
          modbus_connected: false
        });
        return;
      }

      setData(msg);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("Disconnected from backend");
    });

    socket.on("connect_error", (error) => {
      
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [url]);

  return { data, isConnected };
};
