import React, { memo, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { GripVertical, Rss, Newspaper, Database, Zap, ShieldCheck, Thermometer, Radio } from "lucide-react";
import { useApi } from "../../contexts/ApiContext";

export const NewsPanel = memo(({ panel, latestData, isEditing }) => {
  const { apiUrl } = useApi();
  const [bulletins, setBulletins] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch real operational news & telemetry bulletins directly from MySQL backend
  const fetchNews = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!bulletins.length) setIsLoading(true);
      const dbName = sessionStorage.getItem('db_name');
      const trafoId = sessionStorage.getItem('selected_trafo_id') || 1;
      if (!dbName) return;

      const res = await axios.get(`${apiUrl}/api/trends/news?trafo_id=${trafoId}`);
      if (res.data?.success && Array.isArray(res.data.bulletins)) {
        setBulletins(prev => {
          if (
            prev.length === res.data.bulletins.length &&
            prev[0]?.id === res.data.bulletins[0]?.id &&
            prev[0]?.date === res.data.bulletins[0]?.date
          ) {
            return prev;
          }
          return res.data.bulletins;
        });
      }
    } catch (err) {
      console.warn("Could not fetch operational news from database webservice:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, bulletins.length]);

  // Initial fetch and poll every 30 seconds (paused when tab hidden)
  useEffect(() => {
    fetchNews();

    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchNews();
      }
    }, 30000);

    const handleVisibility = () => {
      if (!document.hidden) fetchNews();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchNews]);

  const getTagIcon = (tag) => {
    switch (tag?.toLowerCase()) {
      case 'asset':
        return Radio;
      case 'telemetry':
        return Zap;
      case 'diagnostics':
        return Thermometer;
      case 'policy':
        return ShieldCheck;
      default:
        return Newspaper;
    }
  };

  return (
    <div className="h-full w-full flex flex-col transition-colors duration-300">
      {/* Header */}
      <div className={`flex items-center justify-between gap-2 px-1 mb-2 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-blue-500/10 text-blue-500 dark:text-blue-400 shrink-0">
            <Newspaper size={14} />
          </div>
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 font-sans truncate tracking-wide">
            {panel.title || 'Operational News & Bulletin'}
          </h3>
          <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Database size={9} /> DB
          </span>
        </div>
        {isEditing && <GripVertical size={16} className="text-gray-400 shrink-0" />}
      </div>

      {/* Bulletin Feed Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2.5 pr-1">
        {bulletins.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-xs font-medium">
            {isLoading ? 'Generating operational bulletin from database...' : 'No bulletins recorded yet.'}
          </div>
        ) : (
          bulletins.map((n) => {
            const IconComponent = getTagIcon(n.tag);
            return (
              <div
                key={n.id}
                className="p-3 rounded-xl bg-gray-50/80 dark:bg-white/5 border border-gray-200/60 dark:border-white/5 hover:border-blue-400 dark:hover:border-blue-500/40 transition-all flex flex-col gap-1.5 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 ${n.color}`}>
                    <IconComponent size={10} />
                    {n.tag}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                    <Rss size={9} /> {n.date}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-snug">
                  {n.title}
                </h4>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed font-sans">
                  {n.summary}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
