import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import {
  Zap,
  Thermometer,
  Gauge,
  Activity,
  ArrowRightLeft,
  Search,
  Download,
  RefreshCw,
  Copy,
  Check,
  Grid,
  List,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Info,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import EnergyLoader from '../components/EnergyLoader';

// Deskripsi dan unit untuk setiap parameter agar UX lebih ramah dan profesional
const PARAM_META = {
  // Power Quality
  THDV1: { label: 'THD Voltage Phase 1', unit: '%' },
  THDV2: { label: 'THD Voltage Phase 2', unit: '%' },
  THDV3: { label: 'THD Voltage Phase 3', unit: '%' },
  THDI1: { label: 'THD Current Phase 1', unit: '%' },
  THDI2: { label: 'THD Current Phase 2', unit: '%' },
  THDI3: { label: 'THD Current Phase 3', unit: '%' },
  Pa: { label: 'Active Power Phase A', unit: 'W' },
  Pb: { label: 'Active Power Phase B', unit: 'W' },
  Pc: { label: 'Active Power Phase C', unit: 'W' },
  Psig: { label: 'Total Active Power (Σ)', unit: 'W' },
  Qa: { label: 'Reactive Power Phase A', unit: 'VAR' },
  Qb: { label: 'Reactive Power Phase B', unit: 'VAR' },
  Qc: { label: 'Reactive Power Phase C', unit: 'VAR' },
  Qsig: { label: 'Total Reactive Power (Σ)', unit: 'VAR' },
  Sa: { label: 'Apparent Power Phase A', unit: 'VA' },
  Sb: { label: 'Apparent Power Phase B', unit: 'VA' },
  Sc: { label: 'Apparent Power Phase C', unit: 'VA' },
  Ssig: { label: 'Total Apparent Power (Σ)', unit: 'VA' },
  PFa: { label: 'Power Factor Phase A', unit: '' },
  PFb: { label: 'Power Factor Phase B', unit: '' },
  PFc: { label: 'Power Factor Phase C', unit: '' },
  PFsig: { label: 'Total Power Factor (Σ)', unit: '' },
  KRateda: { label: 'K-Factor Phase A', unit: '' },
  KRatedb: { label: 'K-Factor Phase B', unit: '' },
  KRatedc: { label: 'K-Factor Phase C', unit: '' },
  deRatinga: { label: 'De-Rating Phase A', unit: '%' },
  deRatingb: { label: 'De-Rating Phase B', unit: '%' },
  deRatingc: { label: 'De-Rating Phase C', unit: '%' },

  // Electrical
  Van: { label: 'Voltage Phase-Neutral A-N', unit: 'V' },
  Vbn: { label: 'Voltage Phase-Neutral B-N', unit: 'V' },
  Vcn: { label: 'Voltage Phase-Neutral C-N', unit: 'V' },
  Vab: { label: 'Voltage Phase-Phase A-B', unit: 'V' },
  Vbc: { label: 'Voltage Phase-Phase B-C', unit: 'V' },
  Vca: { label: 'Voltage Phase-Phase C-A', unit: 'V' },
  Ia: { label: 'Current Phase A', unit: 'A' },
  Ib: { label: 'Current Phase B', unit: 'A' },
  Ic: { label: 'Current Phase C', unit: 'A' },
  Iavg: { label: 'Average Current', unit: 'A' },
  Ineutral: { label: 'Neutral Current', unit: 'A' },
  kWhInp: { label: 'Active Energy Input', unit: 'kWh' },
  kWhOut: { label: 'Active Energy Output', unit: 'kWh' },
  kVARhInp: { label: 'Reactive Energy Input', unit: 'kVARh' },
  kVARhOut: { label: 'Reactive Energy Output', unit: 'kVARh' },

  // Physical
  BusTemp1: { label: 'Busbar Temperature R', unit: '°C' },
  BusTemp2: { label: 'Busbar Temperature S', unit: '°C' },
  BusTemp3: { label: 'Busbar Temperature T', unit: '°C' },
  OilTemp: { label: 'Top Oil Temperature', unit: '°C' },
  WTITemp1: { label: 'Winding Temp Phase R', unit: '°C' },
  WTITemp2: { label: 'Winding Temp Phase S', unit: '°C' },
  WTITemp3: { label: 'Winding Temp Phase T', unit: '°C' },
  Pressure: { label: 'Tank Pressure', unit: 'Bar' }
};

const InstantaneousReport = () => {
  const { apiUrl } = useApi();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('powerQuality'); // 'powerQuality' | 'electrical' | 'physical' | 'all'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [searchQuery, setSearchQuery] = useState('');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  // Tutup dropdown export saat klik di luar
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
  const dbName = sessionStorage.getItem('db_name') || 'base_tmu_company_table_v2';
  const token = sessionStorage.getItem('token');

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`${apiUrl}/api/trafo/${trafoId}/instantaneous`, {
        headers: {
          'X-DB-Name': dbName,
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const json = await res.json();
      if (json.success) {
        setData(json);
        setError(null);
      } else {
        throw new Error(json.error || 'Failed to load report data');
      }
    } catch (err) {
      console.error('Fetch instantaneous report failed:', err);
      setError(err.message || 'Failed to load instantaneous report data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [trafoId, apiUrl, dbName, token]);

  // Auto-refresh interval (tiap 10 detik bila aktif)
  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(() => {
      fetchData(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [isAutoRefresh, trafoId, apiUrl, dbName]);

  const getExportRows = () => {
    if (!data || !data.categories) return [];
    const rows = [];
    Object.entries(data.categories).forEach(([catKey, items]) => {
      const catName = catKey === 'powerQuality' ? 'Power Quality' : catKey === 'electrical' ? 'Electrical' : 'Physical';
      items.forEach(item => {
        const meta = PARAM_META[item.param] || {};
        rows.push({
          category: catName,
          param: item.param,
          label: meta.label || item.label || item.param,
          value: item.value !== null && item.value !== undefined ? item.value : '-',
          unit: item.unit || meta.unit || ''
        });
      });
    });
    return rows;
  };

  const getExportTimestamp = () => new Date().toISOString().slice(0, 10);

  const handleExportPDF = () => {
    const rows = getExportRows();
    if (rows.length === 0) return;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(`Instantaneous Report - ${trafoDisplayName}`, 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Waktu Export: ${new Date().toLocaleString('id-ID')} | Total: ${rows.length} Parameter`, 14, 25);

    autoTable(doc, {
      startY: 30,
      head: [['Category', 'Parameter', 'Description', 'Value', 'Unit']],
      body: rows.map(r => [r.category, r.param, r.label, formatVal(r.value), r.unit]),
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { cellWidth: 70 },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 20, halign: 'center' }
      }
    });

    doc.save(`Instantaneous_Report_${trafoDisplayName.replace(/\s+/g, '_')}_${getExportTimestamp()}.pdf`);
  };

  const handleExportExcel = async () => {
    const rows = getExportRows();
    if (rows.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bambang Djaja TMU';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Instantaneous');
    ws.columns = [
      { header: 'Category', key: 'category', width: 22 },
      { header: 'Parameter', key: 'param', width: 18 },
      { header: 'Description', key: 'label', width: 34 },
      { header: 'Value', key: 'value', width: 14 },
      { header: 'Unit', key: 'unit', width: 10 }
    ];

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    rows.forEach(r => {
      const row = ws.addRow({
        category: r.category,
        param: r.param,
        label: r.label,
        value: typeof r.value === 'number' ? Math.round(r.value * 100) / 100 : (r.value ?? '-'),
        unit: r.unit || '-'
      });
      row.getCell('value').alignment = { horizontal: 'right' };
      row.getCell('unit').alignment = { horizontal: 'center' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Instantaneous_Report_${trafoDisplayName.replace(/\s+/g, '_')}_${getExportTimestamp()}.xlsx`);
  };

  const handleExportText = () => {
    const rows = getExportRows();
    if (rows.length === 0) return;

    let content = `========================================================================================\n`;
    content += `INSTANTANEOUS REPORT - ${trafoDisplayName}\n`;
    content += `Waktu Export: ${new Date().toLocaleString('id-ID')}\n`;
    content += `Total Parameter: ${rows.length}\n`;
    content += `========================================================================================\n\n`;
    content += `${'CATEGORY'.padEnd(16)} | ${'PARAMETER'.padEnd(12)} | ${'DESCRIPTION'.padEnd(32)} | ${'VALUE'.padEnd(12)} | ${'UNIT'}\n`;
    content += `${'-'.repeat(88)}\n`;

    rows.forEach(r => {
      content += `${r.category.padEnd(16)} | ${r.param.padEnd(12)} | ${r.label.padEnd(32)} | ${String(formatVal(r.value)).padEnd(12)} | ${r.unit}\n`;
    });

    content += `${'-'.repeat(88)}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `Instantaneous_Report_${trafoDisplayName.replace(/\s+/g, '_')}_${getExportTimestamp()}.txt`);
  };

  const handleExportDocx = () => {
    const rows = getExportRows();
    if (rows.length === 0) return;

    const docxHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Instantaneous Report</title>
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
        <h2>Instantaneous Report - ${trafoDisplayName}</h2>
        <p class="meta">Waktu Export: ${new Date().toLocaleString('id-ID')} | Total: ${rows.length} Parameter</p>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Parameter</th>
              <th>Description</th>
              <th style="text-align: right;">Value</th>
              <th style="text-align: center;">Unit</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.category}</td>
                <td><b>${r.param}</b></td>
                <td>${r.label}</td>
                <td style="text-align: right;">${formatVal(r.value)}</td>
                <td style="text-align: center;">${r.unit}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob([docxHtml], { type: 'application/msword;charset=utf-8' });
    saveAs(blob, `Instantaneous_Report_${trafoDisplayName.replace(/\s+/g, '_')}_${getExportTimestamp()}.doc`);
  };

  // Kategori data aktif yang disaring (3 kategori: Power Quality, Electrical, Physical)
  const currentList = useMemo(() => {
    if (!data || !data.categories) return [];

    const list = data.categories[activeTab] || [];

    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase();
    return list.filter(item => {
      const meta = PARAM_META[item.param] || {};
      return (
        item.param.toLowerCase().includes(query) ||
        (item.label && item.label.toLowerCase().includes(query)) ||
        (meta.label && meta.label.toLowerCase().includes(query))
      );
    });
  }, [data, activeTab, searchQuery]);

  // Format angka agar rapi (desimal maksimal 3 digit bila ada angka pecahan)
  const formatVal = (val) => {
    if (val === null || val === undefined) return '-';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    if (Number.isInteger(num)) return num.toLocaleString('id-ID');
    return num.toLocaleString('id-ID', { maximumFractionDigits: 3 });
  };

  const trafoInfo = data?.trafo || {};
  const trafoDisplayName = trafoInfo.name 
    ? (trafoInfo.serial_no && trafoInfo.serial_no !== trafoInfo.name 
        ? `${trafoInfo.serial_no} (${trafoInfo.name})` 
        : trafoInfo.name)
    : (trafoInfo.serial_no || '1800003781');

  return (
    <div className="flex flex-col w-full max-w-[1600px] mx-auto gap-2 sm:gap-2.5 h-[calc(100dvh-175px)] sm:h-[calc(100dvh-160px)] md:h-[calc(100vh-92px)] overflow-hidden animate-[fadeIn_0.3s_ease-out]">

      {/* ========================================================= */}
      {/* 1. HEADER BANNER: Instantaneous Report - <Nama trafo>      */}
      {/* ========================================================= */}
      <div className="relative rounded-xl sm:rounded-2xl md:rounded-3xl bg-gradient-to-br from-white via-white to-indigo-50/40 dark:from-[#151521] dark:via-[#151521] dark:to-[#1a1b2e] border border-[#dfe1e6]/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.2)] p-2.5 sm:p-3.5 md:p-5 shrink-0 z-20">
        
        {/* Glow aksen latar belakang terisolasi */}
        <div className="absolute inset-0 overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl pointer-events-none">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 sm:w-64 h-48 sm:h-64 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 -mb-20 w-60 sm:w-80 h-32 sm:h-40 bg-blue-500/10 dark:bg-blue-500/15 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Judul: Instantaneous Report - <Nama trafo> */}
          <div className="flex items-center min-w-0">
            <h1 className="text-sm sm:text-lg md:text-2xl font-black text-[#172b4d] dark:text-white font-heading tracking-tight truncate">
              Instantaneous Report - {trafoDisplayName}
            </h1>
          </div>

          {/* Action Button: Export Dropdown (Width matching dropdown) */}
          <div className="relative shrink-0 z-30" ref={exportDropdownRef}>
            <button
              onClick={() => setIsExportOpen(!isExportOpen)}
              className="min-w-[100px] sm:min-w-[110px] flex items-center justify-between gap-1 px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-white dark:bg-[#1e1e2d] text-[#172b4d] dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 select-none whitespace-nowrap"
            >
              <div className="flex items-center gap-1.5 shrink-0">
                <Download size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Export</span>
              </div>
              <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 shrink-0 ${isExportOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-full min-w-[100px] bg-white dark:bg-[#1e1e2d] border border-[#dfe1e6] dark:border-white/10 rounded-lg sm:rounded-xl shadow-2xl overflow-hidden z-50 py-1 animate-fadeIn">
                <button
                  onClick={() => { handleExportPDF(); setIsExportOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-indigo-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <FileText size={14} className="text-rose-500 shrink-0" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => { handleExportExcel(); setIsExportOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-indigo-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <FileSpreadsheet size={14} className="text-emerald-500 shrink-0" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => { handleExportText(); setIsExportOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-indigo-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <FileText size={14} className="text-amber-500 shrink-0" />
                  <span>Text</span>
                </button>
                <button
                  onClick={() => { handleExportDocx(); setIsExportOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#172b4d] dark:text-white hover:bg-indigo-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <FileText size={14} className="text-blue-500 shrink-0" />
                  <span>Docx</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. TABS NAVIGATION & SEARCH CONTROLS (Shrink-0)           */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 bg-white dark:bg-[#151521] p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs shrink-0">
        
        {/* Horizontal Category Tabs (Touch scrollable on mobile without visible scrollbar) */}
        <div className="overflow-x-auto no-scrollbar scrollbar-none flex items-center gap-1 sm:gap-1.5 shrink-0 py-0.5 -mx-0.5 px-0.5">
          {[
            { key: 'powerQuality', label: 'Power Quality', icon: Zap, count: data?.categories?.powerQuality?.length || 28 },
            { key: 'electrical', label: 'Electrical', icon: Activity, count: data?.categories?.electrical?.length || 20 },
            { key: 'physical', label: 'Physical', icon: Thermometer, count: data?.categories?.physical?.length || 8 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 md:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm whitespace-nowrap transition-all duration-200 select-none shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm sm:shadow-md shadow-indigo-500/25'
                    : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/5'
                }`}
              >
                <Icon size={14} className={`sm:size-[16px] ${isActive ? 'text-white' : 'text-indigo-500 dark:text-indigo-400'}`} />
                <span>{tab.label}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 sm:py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-white/10 text-[#5e6c84] dark:text-[#94a3b8]'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Layout View Toggles */}
        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60 md:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search parameters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs sm:text-sm pl-8 pr-7 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-gray-50/70 dark:bg-white/5 text-[#172b4d] dark:text-white placeholder-gray-400 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Toggle View Mode (Table / Cards) */}
          <div className="flex items-center p-0.5 sm:p-1 rounded-lg sm:rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-1.5 rounded-md sm:rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-[#1e1e2d] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              }`}
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              title="Cards View"
              className={`p-1.5 rounded-md sm:rounded-lg transition-all ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-[#1e1e2d] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              }`}
            >
              <Grid size={15} />
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* 3. MAIN DATA VIEW (Tabel yang scrolling di dalam)          */}
      {/* ========================================================= */}
      {loading ? (
        <div className="py-16">
          <EnergyLoader text="Loading Realtime Parameters..." />
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-center">
          <ShieldAlert size={36} className="mx-auto text-rose-500 mb-2" />
          <h3 className="text-base font-bold text-rose-700 dark:text-rose-400">Failed to Fetch Data</h3>
          <p className="text-xs sm:text-sm text-rose-600/80 dark:text-rose-400/80 mt-1">{error}</p>
          <button
            onClick={() => fetchData(true)}
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            Try Again
          </button>
        </div>
      ) : currentList.length === 0 ? (
        <div className="py-12 px-4 rounded-2xl bg-white dark:bg-[#151521] border border-[#dfe1e6]/80 dark:border-white/10 text-center text-[#5e6c84] dark:text-[#94a3b8]">
          <Search size={32} className="mx-auto text-gray-400 mb-2 opacity-50" />
          <p className="font-semibold text-sm">No parameters match "{searchQuery}"</p>
          <p className="text-xs mt-1">Try different keywords or select another category tab.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW (Inner Scroll, Sticky Header, Responsive Columns) */
        <div className="bg-white dark:bg-[#151521] rounded-xl sm:rounded-2xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50/95 dark:bg-[#1e1e2d]/95 backdrop-blur-xs border-b border-[#dfe1e6] dark:border-white/10 text-[10px] sm:text-[11px] font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider shadow-xs">
                <tr>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-6 text-left">Parameter</th>
                  <th className="py-2.5 sm:py-3 px-4 hidden md:table-cell w-[45%]">Description</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-6 text-right">Value</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center hidden sm:table-cell w-24">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs sm:text-sm font-medium">
                {currentList.map((item, idx) => {
                  const meta = PARAM_META[item.param] || {};

                  return (
                    <tr
                      key={item.param + idx}
                      className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors group"
                    >
                      {/* Parameter Name & Mobile Description */}
                      <td className="py-2 sm:py-2.5 md:py-3 px-3 sm:px-6 align-middle">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-xs sm:text-sm text-[#172b4d] dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {item.param}
                          </span>
                          {/* Mobile description fallback */}
                          <span className="text-[10px] sm:text-[11px] text-[#5e6c84] dark:text-[#94a3b8] font-normal md:hidden mt-0.5 leading-tight line-clamp-1">
                            {meta.label || item.label}
                          </span>
                        </div>
                      </td>

                      {/* Tablet/Desktop Description Column */}
                      <td className="py-2 sm:py-2.5 md:py-3 px-4 hidden md:table-cell align-middle text-[#5e6c84] dark:text-[#94a3b8]">
                        <span className="font-medium text-xs sm:text-sm text-[#172b4d] dark:text-gray-200">{meta.label || item.label}</span>
                      </td>

                      {/* Value (With inline unit on mobile screens) */}
                      <td className="py-2 sm:py-2.5 md:py-3 px-3 sm:px-6 text-right align-middle">
                        <div className="inline-flex items-baseline justify-end gap-1 sm:gap-1.5 font-mono">
                          <span className="font-bold text-xs sm:text-sm md:text-base text-[#172b4d] dark:text-white tracking-tight">
                            {formatVal(item.value)}
                          </span>
                          {/* Inline unit on mobile (< sm) */}
                          <span className="sm:hidden text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            {item.unit || meta.unit || ''}
                          </span>
                        </div>
                      </td>

                      {/* Separate Unit Column (Visible on Tablet/Desktop >= sm) */}
                      <td className="py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 text-center hidden sm:table-cell align-middle font-semibold text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm">
                        {item.unit || meta.unit || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS / GRID VIEW (Inner Scroll, Responsive Grid for Mobile & Tablet) */
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-4 pb-4">
            {currentList.map((item, idx) => {
              const meta = PARAM_META[item.param] || {};

              return (
                <div
                  key={item.param + idx}
                  className="bg-white dark:bg-[#151521] rounded-xl sm:rounded-2xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-xs p-3 sm:p-4 md:p-5 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:shadow-md transition-all duration-200 group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-black text-xs sm:text-sm md:text-base text-indigo-600 dark:text-indigo-400">
                        {item.param}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-white/5 text-indigo-600 dark:text-indigo-400">
                        {item.unit || meta.unit || '-'}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-[#172b4d] dark:text-white mt-1 leading-tight line-clamp-1">
                      {meta.label || item.label}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 sm:mt-4 sm:pt-3 border-t border-gray-100 dark:border-white/5 flex items-baseline justify-between">
                    <span className="font-mono text-base sm:text-xl md:text-2xl font-black text-[#172b4d] dark:text-white tracking-tight">
                      {formatVal(item.value)}
                    </span>
                    <span className="text-[11px] sm:text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8]">
                      {item.unit || meta.unit || ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

export default InstantaneousReport;
