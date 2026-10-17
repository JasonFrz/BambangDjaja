import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApi } from '../contexts/ApiContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import EnergyLoader from './EnergyLoader';
import {
  History,
  Search,
  Eye,
  X,
  Clock,
  User,
  Cpu,
  FileSpreadsheet,
  FileText,
  Download,
  ChevronDown,
  Calendar,
  AlertCircle,
  Check
} from 'lucide-react';

const MODULE_COLORS = {
  'Transformer Data': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'Settings': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  'Trip Settings': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  'Users': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'Auth': 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  'default': 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
};

const ACTIVITY_TYPE_OPTIONS = [
  { label: 'All Activities', value: 'ALL' },
  { label: 'Login', value: 'LOGIN' },
  { label: 'Update Data', value: 'UPDATE_TRANSFORMER_DATA' },
  { label: 'Update Settings', value: 'UPDATE_TRANSFORMER_SETTINGS' },
  { label: 'Update Trip', value: 'UPDATE_TRIP_SETTINGS' },
  { label: 'User Management', value: 'USER_MANAGEMENT' }
];

const MODULE_OPTIONS = [
  { label: 'All Modules', value: 'ALL' },
  { label: 'Auth', value: 'Auth' },
  { label: 'Transformer Data', value: 'Transformer Data' },
  { label: 'Settings', value: 'Settings' },
  { label: 'Trip Settings', value: 'Trip Settings' },
  { label: 'Users', value: 'Users' }
];

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalDateStr = (dInput) => {
  if (!dInput) return '';
  const d = new Date(dInput);
  if (isNaN(d.getTime())) return String(dInput).slice(0, 10);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const UserActivityLog = () => {
  const { apiUrl } = useApi();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());

  // Custom Dropdown Open States
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isModuleOpen, setIsModuleOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isMobileExportOpen, setIsMobileExportOpen] = useState(false);

  // Refs for click outside
  const typeDropdownRef = useRef(null);
  const moduleDropdownRef = useRef(null);
  const exportDropdownRef = useRef(null);
  const mobileExportDropdownRef = useRef(null);

  // Modal Detail State
  const [selectedLog, setSelectedLog] = useState(null);

  const dbName = sessionStorage.getItem('db_name');
  const sessionUsername = sessionStorage.getItem('username');
  const role = sessionStorage.getItem('role');
  const token = sessionStorage.getItem('token');

  // Close custom dropdowns when clicking outside (desktop + mobile touch)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target)) {
        setIsTypeOpen(false);
      }
      if (moduleDropdownRef.current && !moduleDropdownRef.current.contains(event.target)) {
        setIsModuleOpen(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setIsExportOpen(false);
      }
      if (mobileExportDropdownRef.current && !mobileExportDropdownRef.current.contains(event.target)) {
        setIsMobileExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const fetchLogs = async () => {
    setError(null);
    try {
      const endpoint = role === 'superuser' 
        ? `${apiUrl}/api/superuser-users/activity-logs` 
        : `${apiUrl}/api/users/activity-logs`;

      const res = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          'X-DB-Name': dbName,
          'X-Username': sessionUsername,
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const json = await res.json();
      if (json.success && Array.isArray(json.logs)) {
        setLogs(json.logs);
      } else {
        throw new Error(json.error || 'Failed to fetch activity logs');
      }
    } catch (err) {
      console.error('Failed to load activity logs:', err);
      setError(err.message || 'Failed to load activity log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [apiUrl, dbName, sessionUsername]);

  // Format timestamp helper
  const formatTimestamp = (ts) => {
    if (!ts) return '-';
    try {
      const d = new Date(ts);
      return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return String(ts);
    }
  };

  const getExportTimestamp = () => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // Filtered log list
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Search Query
      const matchesSearch = !searchQuery.trim() || 
        String(log.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(log.activity_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(log.activity_description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(log.trafo_serial_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(log.module || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(log.ip_address || '').toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Module Filter
      const matchesModule = selectedModule === 'ALL' || log.module === selectedModule;

      // 3. Activity Type Filter
      let matchesType = true;
      if (selectedType !== 'ALL') {
        if (selectedType === 'USER_MANAGEMENT') {
          matchesType = ['USER_CREATE', 'USER_UPDATE', 'USER_DELETE'].includes(log.activity_type);
        } else {
          matchesType = log.activity_type === selectedType;
        }
      }

      // 4. Date Filter (Start Date & End Date using local calendar timezone)
      let matchesDate = true;
      if (log.created_at) {
        const logDateStr = getLocalDateStr(log.created_at);
        if (startDate && logDateStr < startDate) matchesDate = false;
        if (endDate && logDateStr > endDate) matchesDate = false;
      }

      return matchesSearch && matchesModule && matchesType && matchesDate;
    });
  }, [logs, searchQuery, selectedModule, selectedType, startDate, endDate]);

  const parseJsonSafe = (raw) => {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };

  // =========================================================
  // EXPORT METHODS: PDF, EXCEL, TEXT, DOCX (Same as Instantaneous)
  // =========================================================
  const getExportRows = () => {
    return filteredLogs.map(l => ({
      timestamp: formatTimestamp(l.created_at),
      user: l.username || '-',
      activity: l.activity_type || '-',
      module: l.module || '-',
      transformer: l.trafo_serial_no || (l.trafo_id ? `Trafo #${l.trafo_id}` : '-')
    }));
  };

  const handleExportPDF = () => {
    const rows = getExportRows();
    if (rows.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.setTextColor(30, 27, 75);
    doc.text('USER ACTIVITY LOG REPORT', 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Waktu Export: ${new Date().toLocaleString('id-ID')} | Total: ${rows.length} Aktivitas`, 14, 25);

    autoTable(doc, {
      startY: 30,
      head: [['Timestamp', 'User', 'Activity', 'Module', 'Transformer']],
      body: rows.map(r => [r.timestamp, r.user, r.activity, r.module, r.transformer]),
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 50, fontStyle: 'bold' },
        2: { cellWidth: 70 },
        3: { cellWidth: 50 },
        4: { cellWidth: 50 }
      }
    });

    doc.save(`User_Activity_Log_${getExportTimestamp()}.pdf`);
  };

  const handleExportExcel = async () => {
    const rows = getExportRows();
    if (rows.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bambang Djaja TMU';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('ActivityLog');
    ws.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 22 },
      { header: 'User', key: 'user', width: 20 },
      { header: 'Activity', key: 'activity', width: 34 },
      { header: 'Module', key: 'module', width: 20 },
      { header: 'Transformer', key: 'transformer', width: 18 }
    ];

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    rows.forEach(r => {
      ws.addRow({
        timestamp: r.timestamp,
        user: r.user,
        activity: r.activity,
        module: r.module,
        transformer: r.transformer
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `User_Activity_Log_${getExportTimestamp()}.xlsx`);
  };

  const handleExportText = () => {
    const rows = getExportRows();
    if (rows.length === 0) return;

    let content = `========================================================================================\n`;
    content += `USER ACTIVITY LOG REPORT\n`;
    content += `Waktu Export: ${new Date().toLocaleString('id-ID')}\n`;
    content += `Total Log: ${rows.length}\n`;
    content += `========================================================================================\n\n`;
    content += `${'TIMESTAMP'.padEnd(22)} | ${'USER'.padEnd(20)} | ${'ACTIVITY'.padEnd(32)} | ${'MODULE'.padEnd(20)} | ${'TRANSFORMER'}\n`;
    content += `${'-'.repeat(110)}\n`;

    rows.forEach(r => {
      content += `${r.timestamp.padEnd(22)} | ${r.user.padEnd(20)} | ${r.activity.padEnd(32)} | ${r.module.padEnd(20)} | ${r.transformer}\n`;
    });

    content += `${'-'.repeat(110)}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `User_Activity_Log_${getExportTimestamp()}.txt`);
  };

  const handleExportDocx = () => {
    const rows = getExportRows();
    if (rows.length === 0) return;

    const docxHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>User Activity Log Report</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; }
          h2 { color: #1e1b4b; font-size: 16pt; margin-bottom: 4px; }
          p.meta { color: #64748b; font-size: 9.5pt; margin-top: 0; margin-bottom: 16px; }
          table { border-collapse: collapse; width: 100%; }
          th { background-color: #4f46e5; color: #ffffff; padding: 7px 10px; font-size: 10pt; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 9.5pt; }
          tr:nth-child(even) { background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <h2>User Activity Log Report</h2>
        <p class="meta">Waktu Export: ${new Date().toLocaleString('id-ID')} | Total: ${rows.length} Aktivitas</p>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Activity</th>
              <th>Module</th>
              <th>Transformer</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.timestamp}</td>
                <td><b>${r.user}</b></td>
                <td>${r.activity}</td>
                <td>${r.module}</td>
                <td>${r.transformer}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob([docxHtml], { type: 'application/msword;charset=utf-8' });
    saveAs(blob, `User_Activity_Log_${getExportTimestamp()}.doc`);
  };

  const renderExportDropdown = (isMobile = false) => {
    const isOpen = isMobile ? isMobileExportOpen : isExportOpen;
    const ref = isMobile ? mobileExportDropdownRef : exportDropdownRef;
    const toggle = () => {
      if (isMobile) {
        setIsMobileExportOpen(!isMobileExportOpen);
      } else {
        setIsExportOpen(!isExportOpen);
      }
      setIsTypeOpen(false);
      setIsModuleOpen(false);
    };
    const closeAll = () => {
      setIsExportOpen(false);
      setIsMobileExportOpen(false);
    };

    return (
      <div className="relative shrink-0 z-30" ref={ref}>
        <button
          type="button"
          onClick={toggle}
          className="flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-white dark:bg-[#1e1e2d] text-[#172b4d] dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 select-none whitespace-nowrap h-[38px]"
        >
          <div className="flex items-center gap-1.5">
            <Download size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Export</span>
          </div>
          <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-32 bg-white dark:bg-[#1e1e2d] border border-[#dfe1e6] dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 py-1 animate-fadeIn">
            <button
              onClick={() => { handleExportPDF(); closeAll(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-indigo-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <FileText size={14} className="text-rose-500 shrink-0" />
              <span>PDF</span>
            </button>
            <button
              onClick={() => { handleExportExcel(); closeAll(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-indigo-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <FileSpreadsheet size={14} className="text-emerald-500 shrink-0" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => { handleExportText(); closeAll(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-indigo-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <FileText size={14} className="text-amber-500 shrink-0" />
              <span>Text</span>
            </button>
            <button
              onClick={() => { handleExportDocx(); closeAll(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-indigo-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <FileText size={14} className="text-blue-500 shrink-0" />
              <span>Docx</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full animate-fadeIn">
      
      {/* 1. Header Toolbar & Custom Dropdowns */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3 bg-white dark:bg-[#151521] p-3 sm:p-4 rounded-2xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-sm">
        
        {/* Row 1 on mobile: Search Bar (flex-1) + Mobile Export Dropdown (shrink-0) */}
        <div className="flex items-center gap-2 flex-1 w-full">
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search activity, user, trafo, IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs sm:text-sm pl-9 pr-8 py-2 rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-gray-50/70 dark:bg-white/5 text-[#172b4d] dark:text-white placeholder-gray-400 outline-none focus:border-indigo-500 transition-colors h-[38px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Export button visible on mobile/tablet (< lg) */}
          <div className="lg:hidden shrink-0">
            {renderExportDropdown(true)}
          </div>
        </div>

        {/* Row 2 & 3 on mobile / Inline filters on desktop (>= lg) */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-2.5 sm:gap-2">
          
          {/* Custom Dropdowns: Activity Type & Module in 2 equal columns on mobile */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            
            {/* Custom Activity Type Dropdown */}
            <div className="flex flex-col gap-0.5 relative min-w-0" ref={typeDropdownRef}>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 pl-1">
                Activity Type
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsTypeOpen(!isTypeOpen);
                  setIsModuleOpen(false);
                  setIsExportOpen(false);
                  setIsMobileExportOpen(false);
                }}
                className="w-full sm:min-w-[145px] flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#172b4d] dark:text-white text-xs sm:text-sm font-semibold hover:bg-gray-100 dark:hover:bg-white/10 transition-all select-none shadow-2xs h-[38px]"
              >
                <span className="truncate">
                  {ACTIVITY_TYPE_OPTIONS.find(o => o.value === selectedType)?.label || 'All Activities'}
                </span>
                <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform duration-200 ${isTypeOpen ? 'rotate-180' : ''}`} />
              </button>

              {isTypeOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-full min-w-[155px] sm:w-48 bg-white dark:bg-[#1e1e2d] border border-[#dfe1e6] dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 p-1 animate-fadeIn">
                  {ACTIVITY_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSelectedType(opt.value);
                        setIsTypeOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        selectedType === opt.value
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                          : 'text-[#172b4d] dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {selectedType === opt.value && <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Module Dropdown */}
            <div className="flex flex-col gap-0.5 relative min-w-0" ref={moduleDropdownRef}>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 pl-1">
                Module
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsModuleOpen(!isModuleOpen);
                  setIsTypeOpen(false);
                  setIsExportOpen(false);
                  setIsMobileExportOpen(false);
                }}
                className="w-full sm:min-w-[145px] flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#172b4d] dark:text-white text-xs sm:text-sm font-semibold hover:bg-gray-100 dark:hover:bg-white/10 transition-all select-none shadow-2xs h-[38px]"
              >
                <span className="truncate">
                  {MODULE_OPTIONS.find(o => o.value === selectedModule)?.label || 'All Modules'}
                </span>
                <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform duration-200 ${isModuleOpen ? 'rotate-180' : ''}`} />
              </button>

              {isModuleOpen && (
                <div className="absolute right-0 sm:left-0 top-full mt-1.5 w-full min-w-[155px] sm:w-48 bg-white dark:bg-[#1e1e2d] border border-[#dfe1e6] dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 p-1 animate-fadeIn">
                  {MODULE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSelectedModule(opt.value);
                        setIsModuleOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        selectedModule === opt.value
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                          : 'text-[#172b4d] dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {selectedModule === opt.value && <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Date Range: 2 equal columns on mobile */}
          <div className="flex flex-col gap-0.5 w-full sm:w-auto">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">
              <span className="flex items-center gap-1">
                <Calendar size={11} /> Start Date
              </span>
              <span>End Date</span>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-1 w-full">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="min-w-0 w-full sm:w-auto text-xs py-1.5 px-2 sm:px-2.5 rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none cursor-pointer focus:border-indigo-500 font-medium h-[38px] text-center sm:text-left"
                title="Start Date"
              />
              <span className="hidden sm:inline text-gray-400 text-xs">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="min-w-0 w-full sm:w-auto text-xs py-1.5 px-2 sm:px-2.5 rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none cursor-pointer focus:border-indigo-500 font-medium h-[38px] text-center sm:text-left"
                title="End Date"
              />
            </div>
          </div>

          {/* Export Dropdown on desktop (>= lg) */}
          <div className="hidden lg:block shrink-0 self-end">
            {renderExportDropdown(false)}
          </div>

        </div>

      </div>

      {/* 2. Main Log Table: Timestamp | User | Activity | Module | Transformer | Action */}
      {loading ? (
        <div className="py-16">
          <EnergyLoader text="Loading User Activity Log..." />
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-center">
          <AlertCircle size={32} className="mx-auto text-rose-500 mb-2" />
          <h3 className="text-base font-bold text-rose-700 dark:text-rose-400">Failed to Fetch Log</h3>
          <p className="text-xs sm:text-sm text-rose-600/80 dark:text-rose-400/80 mt-1">{error}</p>
          <button
            onClick={fetchLogs}
            className="mt-3 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            Try Again
          </button>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-12 px-4 rounded-2xl bg-white dark:bg-[#151521] border border-[#dfe1e6]/80 dark:border-white/10 text-center text-[#5e6c84] dark:text-[#94a3b8]">
          <History size={32} className="mx-auto text-gray-400 mb-2 opacity-50" />
          <p className="font-semibold text-sm">No activity logs found.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#151521] rounded-2xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-sm overflow-hidden flex flex-col">
          
          <div className="overflow-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50/95 dark:bg-[#1e1e2d]/95 backdrop-blur-xs border-b border-[#dfe1e6] dark:border-white/10 text-[11px] font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider shadow-xs">
                <tr>
                  <th className="py-3 px-4 sm:px-5">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Activity</th>
                  <th className="py-3 px-3">Module</th>
                  <th className="py-3 px-4">Transformer</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs sm:text-sm font-medium">
                {filteredLogs.map((log) => {
                  const moduleColor = MODULE_COLORS[log.module] || MODULE_COLORS.default;
                  const hasDetails = log.old_value || log.new_value;

                  return (
                    <tr
                      key={log.log_id}
                      className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors"
                    >
                      {/* 1. Timestamp */}
                      <td className="py-3 px-4 sm:px-5 whitespace-nowrap text-xs text-[#5e6c84] dark:text-[#94a3b8]">
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-gray-400 shrink-0" />
                          <span>{formatTimestamp(log.created_at)}</span>
                        </div>
                      </td>

                      {/* 2. User */}
                      <td className="py-3 px-4 whitespace-nowrap font-semibold text-[#172b4d] dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-[10px] font-bold">
                            {(log.username || 'U').charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate max-w-[130px]">{log.username || 'System'}</span>
                        </div>
                      </td>

                      {/* 3. Activity (Single line, strictly no extra description underneath) */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs font-semibold font-mono text-[#172b4d] dark:text-white">
                        {log.activity_type}
                      </td>

                      {/* 4. Module */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${moduleColor}`}>
                          {log.module || 'System'}
                        </span>
                      </td>

                      {/* 5. Transformer */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-[#172b4d] dark:text-white">
                        {log.trafo_serial_no ? (
                          <div className="flex items-center gap-1.5">
                            <Cpu size={14} className="text-indigo-500 shrink-0" />
                            <span className="font-semibold">{log.trafo_serial_no}</span>
                          </div>
                        ) : log.trafo_id ? (
                          <span className="text-gray-400">Trafo #{log.trafo_id}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* 6. Action */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {hasDetails ? (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:bg-indigo-50 hover:border-indigo-300 dark:hover:bg-indigo-950/40 text-xs font-semibold text-indigo-600 dark:text-indigo-400 transition-colors shadow-2xs cursor-pointer active:scale-95"
                          >
                            <Eye size={13} />
                            <span>Details</span>
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Count: clean without embel-embel */}
          <div className="py-2.5 px-5 bg-gray-50/60 dark:bg-white/[0.02] border-t border-[#dfe1e6]/60 dark:border-white/5 flex items-center justify-between text-xs text-[#5e6c84] dark:text-[#94a3b8]">
            <span>Menampilkan <strong>{filteredLogs.length}</strong> aktivitas</span>
          </div>

        </div>
      )}

      {/* 3. Modal for Old vs New Value Details */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#151521] rounded-2xl border border-[#dfe1e6] dark:border-white/10 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-scaleUp">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#dfe1e6] dark:border-white/10 flex items-center justify-between bg-gray-50 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/25">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172b4d] dark:text-white">
                    Activity Detail #{selectedLog.log_id}
                  </h3>
                  <p className="text-xs text-[#5e6c84] dark:text-[#94a3b8]">
                    {selectedLog.activity_type} &bull; {formatTimestamp(selectedLog.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-white/5 text-xs">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">User</span>
                  <span className="font-semibold text-[#172b4d] dark:text-white">{selectedLog.username || 'System'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Module</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">{selectedLog.module || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Transformer</span>
                  <span className="font-semibold text-[#172b4d] dark:text-white">{selectedLog.trafo_serial_no || selectedLog.trafo_id || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">IP Address</span>
                  <span className="font-mono text-gray-500 dark:text-gray-400">{selectedLog.ip_address || '-'}</span>
                </div>
              </div>

              {/* Description */}
              {selectedLog.activity_description && (
                <div className="p-3 rounded-xl border border-[#dfe1e6]/80 dark:border-white/10 bg-white dark:bg-[#1e1e2d] text-xs">
                  <span className="text-gray-400 block text-[10px] uppercase font-bold mb-1">Description</span>
                  <p className="font-medium text-[#172b4d] dark:text-white">{selectedLog.activity_description}</p>
                </div>
              )}

              {/* Old vs New Value Diff Viewer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                
                {/* Old Value */}
                <div className="flex flex-col rounded-xl border border-rose-200 dark:border-rose-900/30 overflow-hidden bg-rose-50/20 dark:bg-rose-950/10">
                  <div className="py-2 px-3 bg-rose-100/60 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 font-bold text-xs flex items-center justify-between">
                    <span>OLD VALUE (Previous)</span>
                    <span className="text-[10px] uppercase opacity-75 font-mono">old_value</span>
                  </div>
                  <pre className="p-3 text-[11px] font-mono text-[#172b4d] dark:text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-60">
                    {selectedLog.old_value 
                      ? JSON.stringify(parseJsonSafe(selectedLog.old_value), null, 2)
                      : '(NULL / No Previous Value)'}
                  </pre>
                </div>

                {/* New Value */}
                <div className="flex flex-col rounded-xl border border-emerald-200 dark:border-emerald-900/30 overflow-hidden bg-emerald-50/20 dark:bg-emerald-950/10">
                  <div className="py-2 px-3 bg-emerald-100/60 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-between">
                    <span>NEW VALUE (Modified)</span>
                    <span className="text-[10px] uppercase opacity-75 font-mono">new_value</span>
                  </div>
                  <pre className="p-3 text-[11px] font-mono text-[#172b4d] dark:text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-60">
                    {selectedLog.new_value 
                      ? JSON.stringify(parseJsonSafe(selectedLog.new_value), null, 2)
                      : '(NULL / No New Value)'}
                  </pre>
                </div>

              </div>

              {/* User Agent */}
              {selectedLog.user_agent && (
                <div className="text-[10px] text-gray-400 truncate pt-2">
                  <span className="font-bold">Client User Agent: </span>{selectedLog.user_agent}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-3 px-5 border-t border-[#dfe1e6] dark:border-white/10 bg-gray-50 dark:bg-white/5 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-[#172b4d] dark:text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default UserActivityLog;
