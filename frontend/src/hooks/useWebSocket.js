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
      
      const trafoId = sessionStorage.getItem('selectedTrafoId');
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

      // Map the backend's flat structure to the nested structure Dashboard expects
      const formattedData = {
        vPhase: {
          A: msg.phaseA || 0,
          B: msg.phaseB || 0,
          C: msg.phaseC || 0,
        },
        vLine: {
          AB: msg.lineAB || 0,
          BC: msg.lineBC || 0,
          CA: msg.lineCA || 0,
        },
        // We preserve default zeroes for things the modbus is not reading yet (only 6 registers read)
        current: {
          A: msg.currentA || 0,
          B: msg.currentB || 0,
          C: msg.currentC || 0,
        },
        frequency: msg.frequency || 0,
        power: msg.power || 0,
        energy: msg.energy || 0,
        efficiency: (msg.efficiency_value && msg.efficiency_value.length > 0) ? msg.efficiency_value[0] : (msg.efficiency || 0),
        modbus_connected: msg.modbus_connected !== false, // defaults to true if undefined
      };

      setData(formattedData);
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
