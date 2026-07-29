import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, Calendar, Download, RefreshCw } from 'lucide-react';
import axios from 'axios';
import EnergyLoader from '../components/EnergyLoader';

const PerformanceReport = () => {
  const { apiUrl } = useApi();
  const [filterType, setFilterType] = useState('today');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    if (filterType === 'today') {
      fetchReportData();
    }
  }, [filterType]);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const dbName = sessionStorage.getItem('company_name');
      if (!dbName) throw new Error("Database name not found in session");

      let url = `${apiUrl}/api/trends/report`;
      
      let start = '';
      let end = '';
      
      if (filterType === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        start = today.toISOString().slice(0, 19).replace('T', ' ');
        end = tomorrow.toISOString().slice(0, 19).replace('T', ' ');
      } else {
        if (!startTime || !endTime) {
          setError("Please select both start and end dates.");
          setLoading(false);
          return;
        }
        if (new Date(startTime) >= new Date(endTime)) {
          setError("Start time must be before end time.");
          setLoading(false);
          return;
        }
        start = startTime.replace('T', ' ') + ':00';
        end = endTime.replace('T', ' ') + ':00';
      }

      url += `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;

      const res = await axios.get(url, { headers: { 'x-db-name': dbName } });
      setReportData(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to fetch report data");
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    fetchReportData();
  };

  const exportPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    const dbName = sessionStorage.getItem('company_name') || 'Company';
    
    // Add header
    doc.setFontSize(18);
    doc.setTextColor(23, 43, 77);
    doc.text("Transformer Performance Report", 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(94, 108, 132);
    doc.text(`Company: ${dbName}`, 14, 30);
    
    let dateRangeStr = "Date: Today";
    if (filterType === 'custom') {
      dateRangeStr = `Date Range: ${new Date(startTime).toLocaleString('id-ID')} - ${new Date(endTime).toLocaleString('id-ID')}`;
    } else {
      dateRangeStr = `Date: ${new Date().toLocaleDateString('id-ID')}`;
    }
    doc.text(dateRangeStr, 14, 36);

    const r2 = (val) => val !== null && val !== undefined ? (Math.round((parseFloat(val) || 0) * 100) / 100).toString() : '-';

    const tableColumn = ["Parameter", "Minimum", "Maximum", "Average"];
    const tableRows = [];

    const elec = reportData.electrical || {};
    const oil = reportData.oil || {};

    const formatVal = (val, unit) => {
      const v = r2(val);
      if (unit === '-') return v;
      return v === '-' ? '-' : `${v} ${unit}`;
    };

    const addRow = (name, unit, min, max, avg) => {
      tableRows.push([name, formatVal(min, unit), formatVal(max, unit), formatVal(avg, unit)]);
    };

    addRow("Phase A Voltage", "V", elec.min_phase_a, elec.max_phase_a, elec.avg_phase_a);
    addRow("Phase B Voltage", "V", elec.min_phase_b, elec.max_phase_b, elec.avg_phase_b);
    addRow("Phase C Voltage", "V", elec.min_phase_c, elec.max_phase_c, elec.avg_phase_c);
    addRow("Line AB Voltage", "V", elec.min_line_ab, elec.max_line_ab, elec.avg_line_ab);
    addRow("Line BC Voltage", "V", elec.min_line_bc, elec.max_line_bc, elec.avg_line_bc);
    addRow("Line CA Voltage", "V", elec.min_line_ca, elec.max_line_ca, elec.avg_line_ca);
    addRow("Current A", "A", elec.min_current_a, elec.max_current_a, elec.avg_current_a);
    addRow("Current B", "A", elec.min_current_b, elec.max_current_b, elec.avg_current_b);
    addRow("Current C", "A", elec.min_current_c, elec.max_current_c, elec.avg_current_c);
    addRow("Power Active Total", "kW", elec.min_power_active, elec.max_power_active, elec.avg_power_active);
    addRow("Power Reactive Total", "kVAR", elec.min_power_reactive, elec.max_power_reactive, elec.avg_power_reactive);
    addRow("Power Apparent Total", "kVA", elec.min_power_apparent, elec.max_power_apparent, elec.avg_power_apparent);
    addRow("Power Factor", "-", elec.min_pf, elec.max_pf, elec.avg_pf);
    addRow("Frequency", "Hz", elec.min_frequency, elec.max_frequency, elec.avg_frequency);
    addRow("Energy Active", "kWh", elec.min_energy_active, elec.max_energy_active, elec.avg_energy_active);
    addRow("Energy Reactive", "kVARh", elec.min_energy_reactive, elec.max_energy_reactive, elec.avg_energy_reactive);
    
    if (elec.avg_efficiency !== undefined) {
      tableRows.push(["Efficiency", "-", "-", formatVal(elec.avg_efficiency, "%")]);
    }

    addRow("Oil Temperature", "°C", oil.min_oil_temp, oil.max_oil_temp, oil.avg_oil_temp);
    addRow("Oil Pressure", "Bar", oil.min_oil_press, oil.max_oil_press, oil.avg_oil_press);
    
    if (oil.alarm_triggers !== undefined) {
      tableRows.push(["Oil Level Alarm (0)", "-", "-", `${oil.alarm_triggers} triggers`]);
    }
    if (oil.trip_triggers !== undefined) {
      tableRows.push(["Oil Level Trip (0)", "-", "-", `${oil.trip_triggers} triggers`]);
    }

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [0, 82, 204], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 245, 247] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
      doc.text(`Generated on ${new Date().toLocaleString('id-ID')}`, 14, doc.internal.pageSize.height - 10);
    }

    doc.save(`Performance_Report_${new Date().getTime()}.pdf`);
  };

  const r2 = (val) => val !== null && val !== undefined ? (Math.round((parseFloat(val) || 0) * 100) / 100).toString() : '-';

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.5s_ease-out] w-full max-w-7xl mx-auto">
      <div className="mb-2">
        <h2 className="text-3xl font-bold text-[#172b4d] dark:text-white font-heading mb-1 transition-colors flex items-center gap-4">
          Performance Report
        </h2>
        <p className="text-[#5e6c84] dark:text-[#94a3b8] text-[0.95rem] transition-colors mt-1">
          Generate min, max, and average statistics for transformer parameters.
        </p>
      </div>

      <div className="bg-white dark:bg-[#151521] p-5 rounded-2xl border border-[#dfe1e6] dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-2">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full md:w-auto">
            <label className="block text-sm font-semibold text-[#172b4d] dark:text-white mb-2 flex items-center gap-2">
              <Calendar size={16} className="text-[#0052cc]" /> Date Filter
            </label>
            <div className="flex gap-2">
              <button 
                onClick={() => setFilterType('today')}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-colors ${filterType === 'today' ? 'bg-[#0052cc] text-white shadow-md' : 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'}`}
              >
                Today
              </button>
              <button 
                onClick={() => setFilterType('custom')}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-colors ${filterType === 'custom' ? 'bg-[#0052cc] text-white shadow-md' : 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'}`}
              >
                Custom
              </button>
            </div>
          </div>
          
          {filterType === 'custom' && (
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-[2] animate-[fadeIn_0.3s_ease-out]">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none focus:border-[#0052cc]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none focus:border-[#0052cc]"
                />
              </div>
              <div className="flex items-end">
                <button 
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-2 bg-[#0052cc] hover:bg-[#0047b3] text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : 'Generate'}
                </button>
              </div>
            </div>
          )}
        </div>
        {error && (
          <p className="text-red-500 text-sm font-medium mt-3 animate-[fadeIn_0.3s_ease-out]">{error}</p>
        )}
      </div>

      {loading && !reportData && (
        <EnergyLoader text="Fetching report data..." />
      )}

      {reportData && (
        <div className="bg-white dark:bg-[#151521] rounded-2xl border border-[#dfe1e6] dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden animate-[slideUpFade_0.4s_ease-out]">
          <div className="p-5 border-b border-[#dfe1e6] dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
            <h3 className="font-semibold text-[#172b4d] dark:text-white flex items-center gap-2">
              <FileText size={18} className="text-[#0052cc]" /> Report Results
            </h3>
            <button 
              onClick={exportPDF}
              className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              <Download size={16} /> Export PDF
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#172b4d] dark:text-gray-300">
              <thead className="bg-[#f4f5f7] dark:bg-[#1a2133] text-[#5e6c84] dark:text-[#94a3b8] uppercase text-xs whitespace-nowrap">
                <tr>
                  <th className="px-6 py-4 font-bold border-b border-[#dfe1e6] dark:border-white/10">Parameter</th>
                  <th className="px-6 py-4 font-bold border-b border-[#dfe1e6] dark:border-white/10 text-right">Minimum</th>
                  <th className="px-6 py-4 font-bold border-b border-[#dfe1e6] dark:border-white/10 text-right">Maximum</th>
                  <th className="px-6 py-4 font-bold border-b border-[#dfe1e6] dark:border-white/10 text-right">Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe1e6] dark:divide-white/10 whitespace-nowrap">
                {[
                  { name: "Phase A Voltage", unit: "V", min: reportData.electrical?.min_phase_a, max: reportData.electrical?.max_phase_a, avg: reportData.electrical?.avg_phase_a },
                  { name: "Phase B Voltage", unit: "V", min: reportData.electrical?.min_phase_b, max: reportData.electrical?.max_phase_b, avg: reportData.electrical?.avg_phase_b },
                  { name: "Phase C Voltage", unit: "V", min: reportData.electrical?.min_phase_c, max: reportData.electrical?.max_phase_c, avg: reportData.electrical?.avg_phase_c },
                  { name: "Line AB Voltage", unit: "V", min: reportData.electrical?.min_line_ab, max: reportData.electrical?.max_line_ab, avg: reportData.electrical?.avg_line_ab },
                  { name: "Line BC Voltage", unit: "V", min: reportData.electrical?.min_line_bc, max: reportData.electrical?.max_line_bc, avg: reportData.electrical?.avg_line_bc },
                  { name: "Line CA Voltage", unit: "V", min: reportData.electrical?.min_line_ca, max: reportData.electrical?.max_line_ca, avg: reportData.electrical?.avg_line_ca },
                  { name: "Current A", unit: "A", min: reportData.electrical?.min_current_a, max: reportData.electrical?.max_current_a, avg: reportData.electrical?.avg_current_a },
                  { name: "Current B", unit: "A", min: reportData.electrical?.min_current_b, max: reportData.electrical?.max_current_b, avg: reportData.electrical?.avg_current_b },
                  { name: "Current C", unit: "A", min: reportData.electrical?.min_current_c, max: reportData.electrical?.max_current_c, avg: reportData.electrical?.avg_current_c },
                  { name: "Power Active Total", unit: "kW", min: reportData.electrical?.min_power_active, max: reportData.electrical?.max_power_active, avg: reportData.electrical?.avg_power_active },
                  { name: "Power Reactive Total", unit: "kVAR", min: reportData.electrical?.min_power_reactive, max: reportData.electrical?.max_power_reactive, avg: reportData.electrical?.avg_power_reactive },
                  { name: "Power Apparent Total", unit: "kVA", min: reportData.electrical?.min_power_apparent, max: reportData.electrical?.max_power_apparent, avg: reportData.electrical?.avg_power_apparent },
                  { name: "Power Factor", unit: "-", min: reportData.electrical?.min_pf, max: reportData.electrical?.max_pf, avg: reportData.electrical?.avg_pf },
                  { name: "Frequency", unit: "Hz", min: reportData.electrical?.min_frequency, max: reportData.electrical?.max_frequency, avg: reportData.electrical?.avg_frequency },
                  { name: "Energy Active", unit: "kWh", min: reportData.electrical?.min_energy_active, max: reportData.electrical?.max_energy_active, avg: reportData.electrical?.avg_energy_active },
                  { name: "Energy Reactive", unit: "kVARh", min: reportData.electrical?.min_energy_reactive, max: reportData.electrical?.max_energy_reactive, avg: reportData.electrical?.avg_energy_reactive },
                  { name: "Efficiency", unit: "%", min: null, max: null, avg: reportData.electrical?.avg_efficiency },
                  { name: "Oil Temperature", unit: "°C", min: reportData.oil?.min_oil_temp, max: reportData.oil?.max_oil_temp, avg: reportData.oil?.avg_oil_temp },
                  { name: "Oil Pressure", unit: "Bar", min: reportData.oil?.min_oil_press, max: reportData.oil?.max_oil_press, avg: reportData.oil?.avg_oil_press },
                  ...(reportData.oil?.alarm_triggers !== undefined ? [{ name: "Oil Level Alarm (0)", unit: "triggers", min: null, max: null, avg: reportData.oil.alarm_triggers }] : []),
                  ...(reportData.oil?.trip_triggers !== undefined ? [{ name: "Oil Level Trip (0)", unit: "triggers", min: null, max: null, avg: reportData.oil.trip_triggers }] : []),
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3.5 font-medium border-r border-[#dfe1e6]/50 dark:border-white/5">{row.name}</td>
                    <td className="px-6 py-3.5 text-right font-semibold border-r border-[#dfe1e6]/50 dark:border-white/5">{r2(row.min) !== '-' ? (row.unit !== '-' ? `${r2(row.min)} ${row.unit}` : r2(row.min)) : '-'}</td>
                    <td className="px-6 py-3.5 text-right font-semibold border-r border-[#dfe1e6]/50 dark:border-white/5">{r2(row.max) !== '-' ? (row.unit !== '-' ? `${r2(row.max)} ${row.unit}` : r2(row.max)) : '-'}</td>
                    <td className="px-6 py-3.5 text-right font-semibold text-[#0052cc] dark:text-[#4c9aff]">{r2(row.avg) !== '-' ? (row.unit !== '-' ? `${r2(row.avg)} ${row.unit}` : r2(row.avg)) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceReport;
