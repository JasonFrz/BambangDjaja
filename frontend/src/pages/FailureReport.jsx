import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApi } from '../contexts/ApiContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import {
  FileText,
  FileSpreadsheet,
  Calendar,
  Download,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  Search
} from 'lucide-react';
import axios from 'axios';
import EnergyLoader from '../components/EnergyLoader';
import { useTrafoApi } from '../hooks/useTrafoApi';
import { toUtcRange, formatDuration } from '../utils/failureReportUtils';

// Nama parameter dari Raspi (failure_log.parameter / kolom transformer_status) -> label dan satuan.
// Kode yang tidak ada di sini ditampilkan apa adanya.
const PARAM_INFO = {
  Vab: { label: 'Voltage Phase-Phase A-B', unit: 'V' },
  Vbc: { label: 'Voltage Phase-Phase B-C', unit: 'V' },
  Vca: { label: 'Voltage Phase-Phase C-A', unit: 'V' },
  Uab: { label: 'Voltage Unbalance A-B', unit: '' },
  Ubc: { label: 'Voltage Unbalance B-C', unit: '' },
  Uca: { label: 'Voltage Unbalance C-A', unit: '' },
  Current1: { label: 'Current Phase A', unit: 'A' },
  Current2: { label: 'Current Phase B', unit: 'A' },
  Current3: { label: 'Current Phase C', unit: 'A' },
  Ineutral: { label: 'Neutral Current', unit: 'A' },
  THDVoltage1: { label: 'THD Voltage Phase A', unit: '%' },
  THDVoltage2: { label: 'THD Voltage Phase B', unit: '%' },
  THDVoltage3: { label: 'THD Voltage Phase C', unit: '%' },
  THDCurrent1: { label: 'THD Current Phase A', unit: '%' },
  THDCurrent2: { label: 'THD Current Phase B', unit: '%' },
  THDCurrent3: { label: 'THD Current Phase C', unit: '%' },
  PF: { label: 'Power Factor', unit: '' },
  Freq: { label: 'Frequency', unit: 'Hz' },
  BusTemp1: { label: 'Busbar Temperature R', unit: '°C' },
  BusTemp2: { label: 'Busbar Temperature S', unit: '°C' },
  BusTemp3: { label: 'Busbar Temperature T', unit: '°C' },
  OilTemp: { label: 'Top Oil Temperature', unit: '°C' },
  WTITemp1: { label: 'Winding Temp Phase R', unit: '°C' },
  WTITemp2: { label: 'Winding Temp Phase S', unit: '°C' },
  WTITemp3: { label: 'Winding Temp Phase T', unit: '°C' },
  Pressure: { label: 'Tank Pressure', unit: 'Bar' },
  OilLevel: { label: 'Oil Level', unit: '' },
  H2ppm: { label: 'Hydrogen (H2)', unit: 'ppm' },
  Moistureppm: { label: 'Moisture', unit: 'ppm' },
};

// Warna badge sama dengan panel Transformer Status di dashboard.
const BADGE = {
  alarm: 'bg-amber-400 text-black',
  trip: 'bg-red-500 text-white',
};
const LEVEL_LABEL = { alarm: 'Alarm', trip: 'Trip' };

const REFRESH_MS = 60000;

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getExportTimestamp = () => {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
};

const paramLabel = (code) => PARAM_INFO[code]?.label || code || '-';

const formatTime = (ts) =>
  ts
    ? new Date(ts).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '-';

// parameterValue disimpan sebagai teks: angka dibulatkan 2 desimal, teks lain ditampilkan apa adanya.
const formatValue = (val, code) => {
  if (val === null || val === undefined || val === '') return '-';
  const n = Number(val);
  if (!Number.isFinite(n)) return String(val);
  const unit = PARAM_INFO[code]?.unit;
  const v = String(Math.round(n * 100) / 100);
  return unit ? `${v} ${unit}` : v;
};

const FailureReport = () => {
  const { apiUrl } = useApi();
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
  const dbName = sessionStorage.getItem('db_name') || 'base_tmu_company_table_v2';
  const companyName = sessionStorage.getItem('company_name') || dbName;
  const sessionTrafoName = sessionStorage.getItem('selectedTrafoName');

  // Kotak "Sedang aktif sekarang": status per parameter dari Raspi (dikirim tiap menit).
  const { data: statusData, isLoading: statusLoading } = useTrafoApi('status', REFRESH_MS);
  const noStatus = !!statusData && statusData.hasStatus === false;
  const activeItems = ((noStatus ? [] : statusData?.items) || []).filter((i) => i.level !== 'normal');

  // Close export dropdown when clicking outside (desktop + mobile touch)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!startDate || !endDate) {
        throw new Error('Pilih Start Date dan End Date.');
      }
      if (startDate > endDate) {
        throw new Error('Start Date tidak boleh lebih besar dari End Date.');
      }

      const { start, end } = toUtcRange(startDate, endDate);
      const url = `${apiUrl}/api/trends/failures?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&trafo_id=${trafoId}`;

      const res = await axios.get(url, {
        headers: {
          'x-db-name': dbName,
          'x-trafo-id': trafoId
        }
      });
      setReportData(res.data);
    } catch (err) {
      console.error('Fetch failure report error:', err);
      setError(err.response?.data?.error || err.message || 'Gagal memuat data report');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, trafoId, dbName, startDate, endDate]);

  // Muat saat tanggal/trafo berubah, lalu ulangi tiap 60 detik selama tab terlihat:
  // failure yang baru selesai di Raspi masuk ke server lewat sync tiap 10 menit.
  useEffect(() => {
    fetchReportData();
    const t = setInterval(() => { if (!document.hidden) fetchReportData(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchReportData]);

  const trafoInfo = reportData?.trafo || {};
  const trafoDisplayName = trafoInfo.name
    ? (trafoInfo.serialNo && trafoInfo.serialNo !== trafoInfo.name
        ? `${trafoInfo.serialNo} (${trafoInfo.name})`
        : trafoInfo.name)
    : (trafoInfo.serialNo || sessionTrafoName || `TRF-${String(trafoId).padStart(3, '0')}`);

  const allRows = useMemo(() => (reportData?.failures || []).map((f) => ({
    id: f.rowId,
    time: formatTime(f.time_start),
    level: f.level,
    type: f.failure_type || '-',
    // Teks jenis untuk export dan search, misalnya "Trip - Extreme High".
    jenis: LEVEL_LABEL[f.level] ? `${LEVEL_LABEL[f.level]} - ${f.failure_type || '-'}` : (f.failure_type || '-'),
    code: f.parameter || '',
    parameter: paramLabel(f.parameter),
    value: formatValue(f.parameterValue, f.parameter),
    duration: formatDuration(f.duration),
  })), [reportData]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return allRows;
    const q = searchQuery.toLowerCase().trim();
    return allRows.filter(r =>
      [r.time, r.jenis, r.parameter, r.code, r.value].some((s) => s && s.toLowerCase().includes(q))
    );
  }, [allRows, searchQuery]);

  // =========================================================
  // EXPORT METHODS: PDF, EXCEL, TEXT, DOCX (pola sama dengan Performance Report)
  // =========================================================
  const handleExportPDF = () => {
    const rows = filteredRows;
    if (rows.length === 0) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.setTextColor(23, 43, 77);
    doc.text(`Failure Report - ${trafoDisplayName}`, 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Company: ${companyName} | Periode: ${startDate} s/d ${endDate} | Export: ${new Date().toLocaleString('id-ID')}`, 14, 25);

    autoTable(doc, {
      startY: 30,
      head: [['Waktu (WIB)', 'Jenis', 'Parameter', 'Nilai', 'Durasi']],
      body: rows.map(r => [r.time, r.jenis, r.parameter, r.value, r.duration]),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { fontStyle: 'bold', cellWidth: 38 },
        2: { cellWidth: 52 },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold', textColor: [67, 56, 202] }
      }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 8, { align: 'center' });
    }

    doc.save(`Failure_Report_${trafoDisplayName.replace(/\s+/g, '_')}_${getExportTimestamp()}.pdf`);
  };

  const handleExportExcel = async () => {
    const rows = filteredRows;
    if (rows.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bambang Djaja TMU';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Failure');
    ws.columns = [
      { header: 'Waktu (WIB)', key: 'time', width: 24 },
      { header: 'Jenis', key: 'jenis', width: 24 },
      { header: 'Parameter', key: 'parameter', width: 30 },
      { header: 'Nilai', key: 'value', width: 14 },
      { header: 'Durasi', key: 'duration', width: 16 }
    ];

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    rows.forEach(r => {
      const row = ws.addRow({
        time: r.time,
        jenis: r.jenis,
        parameter: r.parameter,
        value: r.value,
        duration: r.duration
      });
      row.getCell('value').alignment = { horizontal: 'right' };
      row.getCell('duration').alignment = { horizontal: 'right' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Failure_Report_${trafoDisplayName.replace(/\s+/g, '_')}_${getExportTimestamp()}.xlsx`);
  };

  const handleExportText = () => {
    const rows = filteredRows;
    if (rows.length === 0) return;

    let content = `========================================================================================\n`;
    content += `FAILURE REPORT - ${trafoDisplayName}\n`;
    content += `Company: ${companyName} | Periode: ${startDate} s/d ${endDate}\n`;
    content += `Waktu Export: ${new Date().toLocaleString('id-ID')}\n`;
    content += `Total Failure: ${rows.length}\n`;
    content += `========================================================================================\n\n`;
    content += `${'WAKTU (WIB)'.padEnd(24)} | ${'JENIS'.padEnd(24)} | ${'PARAMETER'.padEnd(28)} | ${'NILAI'.padEnd(12)} | ${'DURASI'}\n`;
    content += `${'-'.repeat(106)}\n`;

    rows.forEach(r => {
      content += `${r.time.padEnd(24)} | ${r.jenis.padEnd(24)} | ${r.parameter.padEnd(28)} | ${r.value.padEnd(12)} | ${r.duration}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `Failure_Report_${trafoDisplayName.replace(/\s+/g, '_')}_${getExportTimestamp()}.txt`);
  };

  const handleExportDocx = () => {
    const rows = filteredRows;
    if (rows.length === 0) return;

    const docxHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Failure Report</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; }
          h2 { color: #1e1b4b; margin-bottom: 4px; }
          p.meta { color: #64748b; font-size: 9pt; margin-top: 0; margin-bottom: 14px; }
          table { border-collapse: collapse; width: 100%; }
          th { background-color: #4f46e5; color: #ffffff; padding: 6px 8px; font-size: 9pt; border: 1px solid #cbd5e1; }
          td { padding: 5px 8px; font-size: 9pt; border: 1px solid #cbd5e1; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>Failure Report - ${trafoDisplayName}</h2>
        <p class="meta">Company: ${companyName} | Periode: ${startDate} s/d ${endDate} | Waktu Export: ${new Date().toLocaleString('id-ID')}</p>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Waktu (WIB)</th>
              <th style="text-align: left;">Jenis</th>
              <th style="text-align: left;">Parameter</th>
              <th class="right">Nilai</th>
              <th class="right">Durasi</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.time}</td>
                <td class="bold">${r.jenis}</td>
                <td>${r.parameter}</td>
                <td class="right">${r.value}</td>
                <td class="right bold" style="color: #4338ca;">${r.duration}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob([docxHtml], { type: 'application/msword;charset=utf-8' });
    saveAs(blob, `Failure_Report_${trafoDisplayName.replace(/\s+/g, '_')}_${getExportTimestamp()}.doc`);
  };

  return (
    <div className="flex flex-col w-full max-w-[1600px] mx-auto gap-2 sm:gap-2.5 h-[calc(100dvh-175px)] sm:h-[calc(100dvh-160px)] md:h-[calc(100vh-92px)] overflow-hidden animate-[fadeIn_0.3s_ease-out]">

      {/* ========================================================= */}
      {/* 1. HEADER BANNER: Failure Report - <Nama trafo>           */}
      {/* ========================================================= */}
      <div className="relative rounded-xl sm:rounded-2xl md:rounded-3xl bg-gradient-to-br from-white via-white to-indigo-50/40 dark:from-[#151521] dark:via-[#151521] dark:to-[#1a1b2e] border border-[#dfe1e6]/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.2)] p-2.5 sm:p-3.5 md:p-5 shrink-0 z-20">

        {/* Glow aksen latar belakang terisolasi */}
        <div className="absolute inset-0 overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl pointer-events-none">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 sm:w-64 h-48 sm:h-64 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 -mb-20 w-60 sm:w-80 h-32 sm:h-40 bg-blue-500/10 dark:blue-500/15 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-4">

          {/* Judul: Failure Report - <Nama trafo> */}
          <div className="flex items-center min-w-0">
            <h1 className="text-sm sm:text-lg md:text-2xl font-black text-[#172b4d] dark:text-white font-heading tracking-tight truncate">
              Failure Report - {trafoDisplayName}
            </h1>
          </div>

          {/* Action Button: Export Dropdown */}
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
      {/* 2. TOOLBAR: SEARCH & DATE FILTER                          */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-2.5 sm:gap-3 bg-white dark:bg-[#151521] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-sm shrink-0">

        {/* Search Failure */}
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 pl-1">
            Search
          </label>
          <div className="relative w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search parameter, jenis, waktu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs sm:text-sm pl-9 pr-8 py-2 rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-gray-50/70 dark:bg-white/5 text-[#172b4d] dark:text-white placeholder-gray-400 outline-none focus:border-indigo-500 transition-colors h-[38px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Date Filter: Start Date & End Date */}
        <div className="flex flex-col gap-0.5 w-full sm:w-auto shrink-0">
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

      </div>

      {/* ========================================================= */}
      {/* 3. SEDANG AKTIF SEKARANG (status per parameter, tanpa jam mulai) */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-[#151521] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-sm shrink-0">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#172b4d] dark:text-white mb-2">
          <AlertTriangle size={16} className="text-amber-500" />
          <span>Sedang aktif sekarang</span>
        </div>
        {statusLoading && !statusData ? (
          <div className="text-xs text-gray-400">Memuat status...</div>
        ) : noStatus ? (
          <div className="text-xs text-gray-400">Belum ada data status dari Raspi</div>
        ) : activeItems.length === 0 ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck size={14} /> Tidak ada alarm/trip aktif
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {activeItems.map((it) => (
                <div
                  key={it.parameter}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-gray-100 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 text-xs text-[#172b4d] dark:text-gray-200"
                >
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${BADGE[it.level]}`}>
                    {LEVEL_LABEL[it.level]}
                  </span>
                  <span className="font-semibold">{paramLabel(it.parameter)}</span>
                  <span className="text-gray-500 dark:text-gray-400">{it.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[#5e6c84] dark:text-[#94a3b8]">
              Jam mulai dan durasi muncul di tabel setelah failure selesai (paling lambat sekitar 10 menit).
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-xl text-rose-600 dark:text-rose-400 text-xs sm:text-sm flex items-center gap-2 shrink-0">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. FAILURE TABLE (Internal Scroll, Sticky Header)         */}
      {/* ========================================================= */}
      {loading && !reportData ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <EnergyLoader text="Mengambil data Failure Report..." />
        </div>
      ) : (
        <div className="bg-white dark:bg-[#151521] rounded-xl sm:rounded-2xl border border-[#dfe1e6]/80 dark:border-white/10 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">

          {/* Table Header Count */}
          <div className="py-2.5 sm:py-3 px-4 sm:px-5 border-b border-[#dfe1e6]/80 dark:border-white/10 flex items-center justify-between bg-gray-50/60 dark:bg-white/[0.02] shrink-0">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#172b4d] dark:text-white">
              <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
              <span>Failure Log</span>
            </div>
            <span className="text-xs text-[#5e6c84] dark:text-[#94a3b8]">
              {searchQuery.trim() ? (
                <>Menampilkan <strong>{filteredRows.length}</strong> dari <strong>{allRows.length}</strong> Failure</>
              ) : (
                <>Total <strong>{allRows.length}</strong> Failure</>
              )}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-[#172b4d] dark:text-gray-200 border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50/95 dark:bg-[#1e1e2d]/95 backdrop-blur-xs border-b border-[#dfe1e6] dark:border-white/10 text-[11px] font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider whitespace-nowrap shadow-xs">
                <tr>
                  <th className="py-2.5 sm:py-3 px-4 sm:px-6">Waktu (WIB)</th>
                  <th className="py-2.5 sm:py-3 px-4 sm:px-6">Jenis</th>
                  <th className="py-2.5 sm:py-3 px-4 sm:px-6">Parameter</th>
                  <th className="py-2.5 sm:py-3 px-4 sm:px-6 text-right">Nilai</th>
                  <th className="py-2.5 sm:py-3 px-4 sm:px-6 text-right">Durasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 whitespace-nowrap font-medium">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs sm:text-sm text-gray-400 dark:text-gray-500">
                      {searchQuery ? `Tidak ada failure yang cocok dengan "${searchQuery}"` : 'Tidak ada failure pada periode ini'}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="py-2.5 sm:py-3 px-4 sm:px-6 font-semibold text-[#172b4d] dark:text-white border-r border-gray-100 dark:border-white/5">
                        {row.time}
                      </td>
                      <td className="py-2.5 sm:py-3 px-4 sm:px-6 border-r border-gray-100 dark:border-white/5">
                        <div className="flex items-center gap-2">
                          {BADGE[row.level] && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${BADGE[row.level]}`}>
                              {LEVEL_LABEL[row.level]}
                            </span>
                          )}
                          <span>{row.type}</span>
                        </div>
                      </td>
                      <td className="py-2.5 sm:py-3 px-4 sm:px-6 border-r border-gray-100 dark:border-white/5">
                        <span className="font-semibold">{row.parameter}</span>
                        {row.code && row.code !== row.parameter && (
                          <span className="ml-2 text-[10px] text-gray-400">{row.code}</span>
                        )}
                      </td>
                      <td className="py-2.5 sm:py-3 px-4 sm:px-6 text-right border-r border-gray-100 dark:border-white/5">
                        {row.value}
                      </td>
                      <td className="py-2.5 sm:py-3 px-4 sm:px-6 text-right font-bold text-indigo-600 dark:text-indigo-400">
                        {row.duration}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
};

export default FailureReport;
