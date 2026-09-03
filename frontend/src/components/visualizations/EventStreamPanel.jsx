import React, { memo, useState, useMemo, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Terminal, GripVertical, AlertTriangle, ShieldAlert, CheckCircle2, Info, Database } from "lucide-react";
import { useApi } from "../../contexts/ApiContext";

export const EventStreamPanel = memo(({ panel, latestData, isEditing }) => {
  const { apiUrl } = useApi();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState([]);
  const [isDbLoading, setIsDbLoading] = useState(false);

  // Fetch events directly from MySQL backend database webservice
  const fetchDbEvents = useCallback(async () => {
    try {
      // Only show loading indicator on initial cold load
      if (events.length === 0) {
        setIsDbLoading(true);
      }
      const dbName = sessionStorage.getItem('db_name');
      const trafoId = sessionStorage.getItem('selected_trafo_id') || 1;
      if (!dbName) return;

      const res = await axios.get(`${apiUrl}/api/trends/events?trafo_id=${trafoId}&limit=50`);
      if (res.data?.success && Array.isArray(res.data.events)) {
        setEvents(prev => {
          // Avoid re-rendering if events have not changed
          if (
            prev.length === res.data.events.length &&
            prev[0]?.id === res.data.events[0]?.id &&
            prev[prev.length - 1]?.id === res.data.events[res.data.events.length - 1]?.id
          ) {
            return prev;
          }
          return res.data.events;
        });
      }
    } catch (err) {
      console.warn("Could not fetch events from database webservice:", err.message);
    } finally {
      setIsDbLoading(false);
    }
  }, [apiUrl, events.length]);

  // Initial fetch and smart background polling (every 6 seconds, paused when tab hidden)
  useEffect(() => {
    fetchDbEvents();

    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchDbEvents();
      }
    }, 6000);

    const handleVisibility = () => {
      if (!document.hidden) fetchDbEvents();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchDbEvents]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (filter !== 'ALL' && e.level !== filter) return false;
      if (search && !e.msg.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [events, filter, search]);

  const getBadge = (lvl) => {
    switch (lvl) {
      case 'CRITICAL':
        return <span className="px-1.5 py-0.2 rounded bg-red-500/10 text-red-500 font-bold border border-red-500/20 text-[9px] flex items-center gap-1"><ShieldAlert size={10} /> CRIT</span>;
      case 'ALARM':
        return <span className="px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-500 font-bold border border-orange-500/20 text-[9px] flex items-center gap-1"><AlertTriangle size={10} /> ALARM</span>;
      case 'WARN':
        return <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 text-[9px] flex items-center gap-1"><AlertTriangle size={10} /> WARN</span>;
      case 'OK':
        return <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20 text-[9px] flex items-center gap-1"><CheckCircle2 size={10} /> OK</span>;
      default:
        return <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-500 font-bold border border-blue-500/20 text-[9px] flex items-center gap-1"><Info size={10} /> INFO</span>;
    }
  };

  return (
    <div className="h-full w-full flex flex-col transition-colors duration-300">
      {/* Header */}
      <div className={`flex items-center justify-between gap-2 px-1 mb-1.5 select-none shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 shrink-0">
            <Terminal size={14} />
          </div>
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 font-sans truncate tracking-wide">
            {panel.title || 'Live Event & Alarm Stream'}
          </h3>
          <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Database size={9} /> DB
          </span>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center gap-1 shrink-0 text-[10px] pr-14">
          {['ALL', 'CRITICAL', 'ALARM', 'WARN', 'OK', 'INFO'].map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={`px-1.5 py-0.5 rounded font-semibold transition-all ${
                filter === lvl
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-white/5'
              }`}
            >
              {lvl}
            </button>
          ))}
          {isEditing && <GripVertical size={16} className="text-gray-400 shrink-0" />}
        </div>
      </div>

      {/* Terminal List Body */}
      <div className="flex-1 min-h-0 bg-gray-900 text-gray-100 rounded-xl border border-gray-800 p-2 font-mono text-xs overflow-y-auto custom-scrollbar flex flex-col gap-1.5 shadow-inner">
        {filteredEvents.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-[11px]">
            {isDbLoading ? 'Loading events from database...' : 'No events found for this filter.'}
          </div>
        ) : (
          filteredEvents.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-2 py-1 px-1.5 rounded hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-blue-500"
            >
              <span className="text-gray-500 text-[10px] shrink-0 pt-0.5">{item.time}</span>
              <div className="shrink-0">{getBadge(item.level)}</div>
              <span className="text-[11px] text-gray-200 break-all leading-tight">
                {item.source && <span className="text-gray-400 font-semibold mr-1">[{item.source}]</span>}
                {item.msg}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
