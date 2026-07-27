import { useState, useEffect } from "react";
import { io } from "socket.io-client";

export const useWebSocket = (url) => {
  const [data, setData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Force websocket to avoid HTTP 400 Bad Request / session dropping issues
    const socket = io(url, {
      transports: ["websocket"], // STRICTLY websocket only
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

      // If backend only sends offline status, zero out the data
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

      // Pass the backend's flat structure directly so we don't lose any fields like onOffStatus, power, etc.
      setData(msg);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("Disconnected from backend");
    });

    socket.on("connect_error", (error) => {
      // console.error('Socket.IO connection error:', error);
      setIsConnected(false);
    });

    // Clean up on unmount
    return () => {
      socket.disconnect();
    };
  }, [url]);

  return { data, isConnected };
};
