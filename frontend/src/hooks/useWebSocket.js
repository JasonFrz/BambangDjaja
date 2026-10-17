import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

export const useWebSocket = (url, updateInterval = 0) => {
  const [data, setData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    
    const socket = io(url, {
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      
      const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
      const dbName = sessionStorage.getItem('db_name');
      if (trafoId) {
        socket.emit("subscribe_transformer", { trafoId, dbName });
      }

      socket.emit("set_poll_interval", updateInterval);
    });

    socket.on("meter", (msg) => {
      if (!msg) return;

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
    });

    socket.on("connect_error", (error) => {
      
      setIsConnected(false);
    });

    const handleTrafoChange = () => {
      if (socket.connected) {
        const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
        const dbName = sessionStorage.getItem('db_name');
        if (trafoId && dbName) {
          socket.emit("subscribe_transformer", { trafoId, dbName });
        }
      }
    };
    window.addEventListener("trafoChanged", handleTrafoChange);

    return () => {
      window.removeEventListener("trafoChanged", handleTrafoChange);
      socket.disconnect();
    };
  }, [url]);

  useEffect(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("set_poll_interval", updateInterval);
    }
  }, [updateInterval]);

  return { data, isConnected };
};
