import React, { memo, useState, useEffect } from 'react';
import { GripVertical } from "lucide-react";
import axios from 'axios';
import { useApi } from '../../contexts/ApiContext';

export const AnnotationsListPanel = memo(({ panel, isEditing }) => {
  const { apiUrl } = useApi();
  const [annotations, setAnnotations] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const fetchAlerts = async () => {
      try {
        const dbName = sessionStorage.getItem('company_name');
        if (!dbName) return;

        const res = await axios.get(`${apiUrl}/api/alerts?limit=20`, {
          headers: { 'X-DB-Name': dbName, 'ngrok-skip-browser-warning': '69420' }
        });
        
        if (isMounted) {
          const list = res.data.map(alert => {
            const date = new Date(alert.created_at);
            const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }) + " - " + date.toLocaleDateString('id-ID');
            return {
              t: `[${alert.alert_type}] ${alert.parameter_name} ${alert.condition_text} (${alert.current_value} / ${alert.threshold_limit})`,
              user: "System Alarm",
              time: timeStr,
              c: alert.alert_type === 'OVER' ? "bg-red-500" : "bg-orange-500"
            };
          });
          
          if (list.length === 0) {
             list.push({ t: "No recent alarms detected.", user: "System", time: "Now", c: "bg-emerald-500" });
          }
          
          setAnnotations(list);
        }
      } catch (err) {
        console.error("Failed to fetch alert logs:", err);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000); // refresh every 10 seconds
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiUrl]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className={`flex items-center gap-3 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 font-sans text-center truncate flex-1 tracking-wide">{panel.title}</h3>
        {isEditing && <GripVertical size={16} className="text-gray-300 shrink-0" />}
      </div>
      <div className="flex-1 overflow-auto flex flex-col gap-3 relative pl-3 py-1 custom-scrollbar">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200 dark:bg-white/10" />
        {annotations.map((a, i) => (
          <div key={i} className="flex gap-3 relative z-10">
            <div className={`w-2.5 h-2.5 rounded-full ${a.c} mt-1.5 ring-4 ring-white dark:ring-[#151521]`} />
            <div className="flex flex-col flex-1 bg-white dark:bg-white/5 p-2 rounded-lg border border-gray-100 dark:border-white/5 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-gray-500">{a.user}</span>
                <span className="text-[9px] text-gray-400">{a.time}</span>
              </div>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{a.t}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

