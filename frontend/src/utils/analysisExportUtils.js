import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';

// Format date helper
export const formatFullTime = (isoStr) => {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hour}:${min}`;
};

// ============================================================================
// 1. DEFINITION OF READING DATA COLUMNS (54 Parameters in exact requested order)
// ============================================================================
export const READING_DATA_COLUMNS = [
  { key: 'timestamp', label: 'timestamp', unit: '' },
  { key: 'Van', label: 'Van', unit: 'V', get: p => p.phaseA ?? p.Van },
  { key: 'Vbn', label: 'Vbn', unit: 'V', get: p => p.phaseB ?? p.Vbn },
  { key: 'Vcn', label: 'Vcn', unit: 'V', get: p => p.phaseC ?? p.Vcn },
  { key: 'Vab', label: 'Vab', unit: 'V', get: p => p.lineAB ?? p.Vab },
  { key: 'Vbc', label: 'Vbc', unit: 'V', get: p => p.lineBC ?? p.Vbc },
  { key: 'Vca', label: 'Vca', unit: 'V', get: p => p.lineCA ?? p.Vca },
  { key: 'Ia', label: 'Ia', unit: 'A', get: p => p.currentA ?? p.Ia },
  { key: 'Ib', label: 'Ib', unit: 'A', get: p => p.currentB ?? p.Ib },
  { key: 'Ic', label: 'Ic', unit: 'A', get: p => p.currentC ?? p.Ic },
  { key: 'Iavg', label: 'Iavg', unit: 'A', get: p => p.avgCurrent ?? p.Iavg },
  { key: 'Ineutral', label: 'Ineutral', unit: 'A', get: p => p.currentN ?? p.Ineutral },
  { key: 'THDV1', label: 'THDV1', unit: '%', get: p => p.thdVA ?? p.THDV1 },
  { key: 'THDV2', label: 'THDV2', unit: '%', get: p => p.thdVB ?? p.THDV2 },
  { key: 'THDV3', label: 'THDV3', unit: '%', get: p => p.thdVC ?? p.THDV3 },
  { key: 'THDI1', label: 'THDI1', unit: '%', get: p => p.thdIA ?? p.THDI1 },
  { key: 'THDI2', label: 'THDI2', unit: '%', get: p => p.thdIB ?? p.THDI2 },
  { key: 'THDI3', label: 'THDI3', unit: '%', get: p => p.thdIC ?? p.THDI3 },
  { key: 'Pa', label: 'Pa', unit: 'kW', get: p => p.powerActiveA ?? p.Pa },
  { key: 'Pb', label: 'Pb', unit: 'kW', get: p => p.powerActiveB ?? p.Pb },
  { key: 'Pc', label: 'Pc', unit: 'kW', get: p => p.powerActiveC ?? p.Pc },
  { key: 'Psig', label: 'Psig', unit: 'kW', get: p => p.powerActiveTotal ?? p.Psig },
  { key: 'Qa', label: 'Qa', unit: 'kVAR', get: p => p.powerReactiveA ?? p.Qa },
  { key: 'Qb', label: 'Qb', unit: 'kVAR', get: p => p.powerReactiveB ?? p.Qb },
  { key: 'Qc', label: 'Qc', unit: 'kVAR', get: p => p.powerReactiveC ?? p.Qc },
  { key: 'Qsig', label: 'Qsig', unit: 'kVAR', get: p => p.powerReactiveTotal ?? p.Qsig },
  { key: 'Sa', label: 'Sa', unit: 'kVA', get: p => p.powerApparentA ?? p.Sa },
  { key: 'Sb', label: 'Sb', unit: 'kVA', get: p => p.powerApparentB ?? p.Sb },
  { key: 'Sc', label: 'Sc', unit: 'kVA', get: p => p.powerApparentC ?? p.Sc },
  { key: 'Ssig', label: 'Ssig', unit: 'kVA', get: p => p.powerApparentTotal ?? p.Ssig },
  { key: 'PFa', label: 'PFa', unit: '', get: p => p.pfA ?? p.PFa },
  { key: 'PFb', label: 'PFb', unit: '', get: p => p.pfB ?? p.PFb },
  { key: 'PFc', label: 'PFc', unit: '', get: p => p.pfC ?? p.PFc },
  { key: 'PFsig', label: 'PFsig', unit: '', get: p => p.pfTotal ?? p.PFsig },
  { key: 'Freq', label: 'Freq', unit: 'Hz', get: p => p.frequency ?? p.Freq },
  { key: 'kWhInp', label: 'kWhInp', unit: 'kWh', get: p => p.energyActiveTotal ?? p.kWhInp ?? p.kWh },
  { key: 'kWhOut', label: 'kWhOut', unit: 'kWh', get: p => p.kWhOut ?? 0 },
  { key: 'kVARhInp', label: 'kVARhInp', unit: 'kVARh', get: p => p.energyReactiveTotal ?? p.kVARhInp ?? p.kVARh },
  { key: 'kVARhOut', label: 'kVARhOut', unit: 'kVARh', get: p => p.kVARhOut ?? 0 },
  { key: 'BusTemp1', label: 'BusTemp1', unit: '°C', get: p => p.busTempA ?? p.BusTemp1 },
  { key: 'BusTemp2', label: 'BusTemp2', unit: '°C', get: p => p.busTempB ?? p.BusTemp2 },
  { key: 'BusTemp3', label: 'BusTemp3', unit: '°C', get: p => p.busTempC ?? p.BusTemp3 },
  { key: 'OilTemp', label: 'OilTemp', unit: '°C', get: p => p.oil_temperature ?? p.OilTemp },
  { key: 'WTITemp1', label: 'WTITemp1', unit: '°C', get: p => p.wtiA ?? p.WTITemp1 },
  { key: 'WTITemp2', label: 'WTITemp2', unit: '°C', get: p => p.wtiB ?? p.WTITemp2 },
  { key: 'WTITemp3', label: 'WTITemp3', unit: '°C', get: p => p.wtiC ?? p.WTITemp3 },
  { key: 'Press', label: 'Press', unit: 'Bar', get: p => p.oil_pressure ?? p.Press },
  { key: 'Level', label: 'Level', unit: '', get: p => p.oilLevelRaw ?? p.Level },
  { key: 'KRateda', label: 'KRateda', unit: '', get: p => p.kRatedA ?? p.KRateda },
  { key: 'deRatinga', label: 'deRatinga', unit: '%', get: p => p.deRatingA ?? p.deRatinga },
  { key: 'KRatedb', label: 'KRatedb', unit: '', get: p => p.kRatedB ?? p.KRatedb },
  { key: 'deRatingb', label: 'deRatingb', unit: '%', get: p => p.deRatingB ?? p.deRatingb },
  { key: 'KRatedc', label: 'KRatedc', unit: '', get: p => p.kRatedC ?? p.KRatedc },
  { key: 'deRatingc', label: 'deRatingc', unit: '%', get: p => p.deRatingC ?? p.deRatingc }
];

// Groupings for elegant Landscape PDF/Docx/Text display
export const READING_DATA_GROUPS = [
  {
    title: '1. Voltage & Current (Tegangan & Arus)',
    keys: ['Van', 'Vbn', 'Vcn', 'Vab', 'Vbc', 'Vca', 'Ia', 'Ib', 'Ic', 'Iavg', 'Ineutral']
  },
  {
    title: '2. Active, Reactive & Apparent Power (Daya & PF)',
    keys: ['Pa', 'Pb', 'Pc', 'Psig', 'Qa', 'Qb', 'Qc', 'Qsig', 'Sa', 'Sb', 'Sc', 'Ssig', 'PFa', 'PFb', 'PFc', 'PFsig', 'Freq']
  },
  {
    title: '3. Harmonics & Energy Accumulation (Harmonisa & Energi)',
    keys: ['THDV1', 'THDV2', 'THDV3', 'THDI1', 'THDI2', 'THDI3', 'kWhInp', 'kWhOut', 'kVARhInp', 'kVARhOut']
  },
  {
    title: '4. Thermal & Physical Sensors (Suhu, Tekanan & Level)',
    keys: ['BusTemp1', 'BusTemp2', 'BusTemp3', 'OilTemp', 'WTITemp1', 'WTITemp2', 'WTITemp3', 'Press', 'Level']
  },
  {
    title: '5. K-Factor & Transformer Derating',
    keys: ['KRateda', 'deRatinga', 'KRatedb', 'deRatingb', 'KRatedc', 'deRatingc']
  }
];

// ============================================================================
// 2. DEFINITION OF RAW DATA LOG COLUMNS (55 Columns with empty 55th status column)
// ============================================================================
export const RAW_DATA_COLUMNS = [
  { key: 'timestamp', label: 'timestamp' },
  { key: 'OilTemp', label: 'OilTemp', get: p => p.oil_temperature ?? p.OilTemp },
  { key: 'BusTemp1', label: 'BusTemp1', get: p => p.busTempA ?? p.BusTemp1 },
  { key: 'BusTemp2', label: 'BusTemp2', get: p => p.busTempB ?? p.BusTemp2 },
  { key: 'BusTemp3', label: 'BusTemp3', get: p => p.busTempC ?? p.BusTemp3 },
  { key: 'Press', label: 'Press', get: p => p.oil_pressure ?? p.Press },
  { key: 'Level', label: 'Level', get: p => p.oilLevelRaw ?? p.Level },
  { key: 'Van', label: 'Van', get: p => p.phaseA ?? p.Van },
  { key: 'Vab', label: 'Vab', get: p => p.lineAB ?? p.Vab },
  { key: 'Ia', label: 'Ia', get: p => p.currentA ?? p.Ia },
  { key: 'PFa', label: 'PFa', get: p => p.pfA ?? p.PFa },
  { key: 'Pa', label: 'Pa', get: p => p.powerActiveA ?? p.Pa },
  { key: 'Qa', label: 'Qa', get: p => p.powerReactiveA ?? p.Qa },
  { key: 'Sa', label: 'Sa', get: p => p.powerApparentA ?? p.Sa },
  { key: 'THDV1', label: 'THDV1', get: p => p.thdVA ?? p.THDV1 },
  { key: 'THDI1', label: 'THDI1', get: p => p.thdIA ?? p.THDI1 },
  { key: 'Vbn', label: 'Vbn', get: p => p.phaseB ?? p.Vbn },
  { key: 'Vbc', label: 'Vbc', get: p => p.lineBC ?? p.Vbc },
  { key: 'Ib', label: 'Ib', get: p => p.currentB ?? p.Ib },
  { key: 'PFb', label: 'PFb', get: p => p.pfB ?? p.PFb },
  { key: 'Pb', label: 'Pb', get: p => p.powerActiveB ?? p.Pb },
  { key: 'Qb', label: 'Qb', get: p => p.powerReactiveB ?? p.Qb },
  { key: 'Sb', label: 'Sb', get: p => p.powerApparentB ?? p.Sb },
  { key: 'THDV2', label: 'THDV2', get: p => p.thdVB ?? p.THDV2 },
  { key: 'THDI2', label: 'THDI2', get: p => p.thdIB ?? p.THDI2 },
  { key: 'Vcn', label: 'Vcn', get: p => p.phaseC ?? p.Vcn },
  { key: 'Vca', label: 'Vca', get: p => p.lineCA ?? p.Vca },
  { key: 'Ic', label: 'Ic', get: p => p.currentC ?? p.Ic },
  { key: 'PFc', label: 'PFc', get: p => p.pfC ?? p.PFc },
  { key: 'Pc', label: 'Pc', get: p => p.powerActiveC ?? p.Pc },
  { key: 'Qc', label: 'Qc', get: p => p.powerReactiveC ?? p.Qc },
  { key: 'Sc', label: 'Sc', get: p => p.powerApparentC ?? p.Sc },
  { key: 'THDV3', label: 'THDV3', get: p => p.thdVC ?? p.THDV3 },
  { key: 'THDI3', label: 'THDI3', get: p => p.thdIC ?? p.THDI3 },
  { key: 'Itot', label: 'Itot', get: p => (Number(p.currentA || p.Ia || 0) + Number(p.currentB || p.Ib || 0) + Number(p.currentC || p.Ic || 0)) },
  { key: 'PFsyst', label: 'PFsyst', get: p => p.pfTotal ?? p.PFsig },
  { key: 'Psig', label: 'Psig', get: p => p.powerActiveTotal ?? p.Psig },
  { key: 'Qsig', label: 'Qsig', get: p => p.powerReactiveTotal ?? p.Qsig },
  { key: 'Ssig', label: 'Ssig', get: p => p.powerApparentTotal ?? p.Ssig },
  { key: 'Freq', label: 'Freq', get: p => p.frequency ?? p.Freq },
  { key: 'Ineutral', label: 'Ineutral', get: p => p.currentN ?? p.Ineutral },
  { key: 'kWhInp', label: 'kWhInp', get: p => p.energyActiveTotal ?? p.kWhInp ?? p.kWh },
  { key: 'kWhOut', label: 'kWhOut', get: p => p.kWhOut ?? 0 },
  { key: 'kVARhinp', label: 'kVARhinp', get: p => p.energyReactiveTotal ?? p.kVARhinp ?? p.kVARh },
  { key: 'kVARhOut', label: 'kVARhOut', get: p => p.kVARhOut ?? 0 },
  { key: 'KRateda', label: 'KRateda', get: p => p.kRatedA ?? p.KRateda },
  { key: 'deRatinga', label: 'deRatinga', get: p => p.deRatingA ?? p.deRatinga },
  { key: 'KRatedb', label: 'KRatedb', get: p => p.kRatedB ?? p.KRatedb },
  { key: 'deRatingb', label: 'deRatingb', get: p => p.deRatingB ?? p.deRatingb },
  { key: 'KRatedc', label: 'KRatedc', get: p => p.kRatedC ?? p.KRatedc },
  { key: 'deRatingc', label: 'deRatingc', get: p => p.deRatingC ?? p.deRatingc },
  { key: 'WTITemp1', label: 'WTITemp1', get: p => p.wtiA ?? p.WTITemp1 },
  { key: 'WTITemp2', label: 'WTITemp2', get: p => p.wtiB ?? p.WTITemp2 },
  { key: 'WTITemp3', label: 'WTITemp3', get: p => p.wtiC ?? p.WTITemp3 },
  { 
    key: 'status', 
    label: '', // [Tanpa Header / Kosong]
    get: p => {
      const temp = Number(p.oil_temperature ?? p.OilTemp ?? 0);
      const press = Number(p.oil_pressure ?? p.Press ?? 0);
      if (temp >= 100 || press >= 0.8) return 'Trip';
      if (temp >= 85 || press >= 0.5) return 'Alarm';
      return 'Safe';
    } 
  }
];

export const HARMONIC_ORDERS = [
  '1st', '3rd', '5th', '7th', '9th', '11th', '13th', '15th',
  '17th', '19th', '21st', '23rd', '25th', '27th', '29th', '31st'
];

const fmtNum = (v) => {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : String(v);
};

// ============================================================================
// EXPORT METHODS: READING DATA (PDF, EXCEL, TEXT, DOCX)
// ============================================================================

export const exportReadingDataExcel = async ({ seriesData, trafoDisplayName, companyName, startDate, endDate }) => {
  if (!seriesData || seriesData.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bambang Djaja TMU';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Reading_Data');

  // Freeze timestamp column
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  ws.columns = READING_DATA_COLUMNS.map(c => ({
    header: c.label,
    key: c.key,
    width: c.key === 'timestamp' ? 24 : 13
  }));

  // Header style
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  seriesData.forEach(p => {
    const rowObj = {};
    READING_DATA_COLUMNS.forEach(c => {
      if (c.key === 'timestamp') {
        rowObj[c.key] = formatFullTime(p.timestamp);
      } else {
        const raw = c.get(p);
        rowObj[c.key] = typeof raw === 'number' ? Math.round(raw * 100) / 100 : (raw ?? '-');
      }
    });
    ws.addRow(rowObj);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Reading_Data_${trafoDisplayName.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.xlsx`);
};

export const exportReadingDataPDF = ({ seriesData, trafoDisplayName, companyName, startDate, endDate }) => {
  if (!seriesData || seriesData.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  
  doc.setFontSize(15);
  doc.setTextColor(23, 43, 77);
  doc.text(`Reading Data Report - ${trafoDisplayName}`, 14, 15);

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Company: ${companyName} | Periode: ${startDate} s/d ${endDate} | Total: 54 Parameter | Export: ${new Date().toLocaleString('id-ID')}`, 14, 21);

  let currentY = 27;

  READING_DATA_GROUPS.forEach((grp, idx) => {
    if (currentY > 170) {
      doc.addPage();
      currentY = 15;
    }

    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.setFont(undefined, 'bold');
    doc.text(grp.title, 14, currentY);
    currentY += 3.5;

    const groupCols = grp.keys.map(k => READING_DATA_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const head = ['Timestamp', ...groupCols.map(c => c.unit ? `${c.label}\n(${c.unit})` : c.label)];
    const body = seriesData.map(p => [
      formatFullTime(p.timestamp),
      ...groupCols.map(c => fmtNum(c.get(p)))
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [head],
      body: body,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, halign: 'right' },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 38, halign: 'left', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 8;
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 6, { align: 'center' });
  }

  doc.save(`Reading_Data_${trafoDisplayName.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.pdf`);
};

export const exportReadingDataText = ({ seriesData, trafoDisplayName, companyName, startDate, endDate }) => {
  if (!seriesData || seriesData.length === 0) return;

  let content = `========================================================================================\n`;
  content += `READING DATA REPORT - ${trafoDisplayName}\n`;
  content += `Company: ${companyName} | Periode: ${startDate} s/d ${endDate}\n`;
  content += `Total Parameter: 54 | Waktu Export: ${new Date().toLocaleString('id-ID')}\n`;
  content += `========================================================================================\n\n`;

  READING_DATA_GROUPS.forEach(grp => {
    content += `[${grp.title.toUpperCase()}]\n`;
    content += `${'-'.repeat(110)}\n`;
    const groupCols = grp.keys.map(k => READING_DATA_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const headers = ['TIMESTAMP'.padEnd(20), ...groupCols.map(c => c.label.padEnd(10))];
    content += headers.join(' | ') + '\n';
    content += `${'-'.repeat(110)}\n`;

    seriesData.forEach(p => {
      const timeStr = formatFullTime(p.timestamp).padEnd(20);
      const vals = groupCols.map(c => String(fmtNum(c.get(p))).padEnd(10));
      content += `${timeStr} | ${vals.join(' | ')}\n`;
    });
    content += '\n\n';
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `Reading_Data_${trafoDisplayName.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.txt`);
};

export const exportReadingDataDocx = ({ seriesData, trafoDisplayName, companyName, startDate, endDate }) => {
  if (!seriesData || seriesData.length === 0) return;

  const docxHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Reading Data Report</title>
      <style>
        @page { size: landscape; margin: 1.5cm; }
        body { font-family: Calibri, Arial, sans-serif; font-size: 8pt; }
        h2 { color: #1e1b4b; margin-bottom: 2px; }
        h3 { color: #4338ca; margin-top: 14px; margin-bottom: 4px; font-size: 9.5pt; }
        p.meta { color: #64748b; font-size: 8pt; margin-top: 0; margin-bottom: 10px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 14px; }
        th { background-color: #4f46e5; color: #ffffff; padding: 4px 6px; font-size: 7.5pt; border: 1px solid #cbd5e1; text-align: right; }
        td { padding: 3px 5px; font-size: 7pt; border: 1px solid #cbd5e1; text-align: right; }
        .left { text-align: left; }
      </style>
    </head>
    <body>
      <h2>Reading Data Report - ${trafoDisplayName}</h2>
      <p class="meta">Company: ${companyName} | Periode: ${startDate} s/d ${endDate} | Total Parameter: 54 | Export: ${new Date().toLocaleString('id-ID')}</p>
      ${READING_DATA_GROUPS.map(grp => {
        const groupCols = grp.keys.map(k => READING_DATA_COLUMNS.find(c => c.key === k)).filter(Boolean);
        return `
          <h3>${grp.title}</h3>
          <table>
            <thead>
              <tr>
                <th class="left">Timestamp</th>
                ${groupCols.map(c => `<th>${c.label}${c.unit ? ` (${c.unit})` : ''}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${seriesData.map(p => `
                <tr>
                  <td class="left" style="font-weight: bold;">${formatFullTime(p.timestamp)}</td>
                  ${groupCols.map(c => `<td>${fmtNum(c.get(p))}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }).join('')}
    </body>
    </html>
  `;
  const blob = new Blob([docxHtml], { type: 'application/msword;charset=utf-8' });
  saveAs(blob, `Reading_Data_${trafoDisplayName.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.doc`);
};


// ============================================================================
// EXPORT METHODS: RAW DATA LOG (EXCEL 4 SHEETS, PDF, TEXT, DOCX)
// ============================================================================

export const exportRawDataLogExcel = async ({ seriesData, harmonicsData, trafoDisplayName, companyName, startDate, endDate }) => {
  if (!seriesData || seriesData.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bambang Djaja TMU';
  workbook.created = new Date();

  // -------------------------------------------------------------
  // Sheet 1: Raw_data (55 columns)
  // -------------------------------------------------------------
  const ws1 = workbook.addWorksheet('Raw_data');
  ws1.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  ws1.columns = RAW_DATA_COLUMNS.map(c => ({
    header: c.label,
    key: c.key,
    width: c.key === 'timestamp' ? 24 : 13
  }));

  ws1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  ws1.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  seriesData.forEach(p => {
    const rowObj = {};
    RAW_DATA_COLUMNS.forEach(c => {
      if (c.key === 'timestamp') {
        rowObj[c.key] = formatFullTime(p.timestamp);
      } else {
        const raw = c.get(p);
        rowObj[c.key] = typeof raw === 'number' ? Math.round(raw * 100) / 100 : (raw ?? '-');
      }
    });
    ws1.addRow(rowObj);
  });

  // -------------------------------------------------------------
  // Sheets 2, 3, 4: Harmonic_phR, Harmonic_phS, Harmonic_phT (33 cols each)
  // -------------------------------------------------------------
  const vHarmonics = harmonicsData?.voltage || [];
  const iHarmonics = harmonicsData?.current || [];

  const addHarmonicSheet = (sheetName, phaseNum) => {
    const ws = workbook.addWorksheet(sheetName);
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

    const vHeaders = HARMONIC_ORDERS.map(o => `V ${o}`);
    const iHeaders = HARMONIC_ORDERS.map(o => `I ${o}`);
    const allHeaders = ['timestamp', ...vHeaders, ...iHeaders];

    ws.columns = allHeaders.map(h => ({
      header: h,
      key: h,
      width: h === 'timestamp' ? 24 : 11
    }));

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    const vPhase = vHarmonics.find(h => h.phase === phaseNum)?.orders || {};
    const iPhase = iHarmonics.find(h => h.phase === phaseNum)?.orders || {};

    seriesData.forEach(p => {
      const rowObj = { timestamp: formatFullTime(p.timestamp) };
      HARMONIC_ORDERS.forEach(o => {
        const alt = o.replace('st', 'th').replace('rd', 'th');
        rowObj[`V ${o}`] = Number(vPhase[o] ?? vPhase[alt] ?? 0);
        rowObj[`I ${o}`] = Number(iPhase[o] ?? iPhase[alt] ?? 0);
      });
      ws.addRow(rowObj);
    });
  };

  addHarmonicSheet('Harmonic_phR', 1);
  addHarmonicSheet('Harmonic_phS', 2);
  addHarmonicSheet('Harmonic_phT', 3);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Raw_Data_Log_${trafoDisplayName.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.xlsx`);
};

export const exportRawDataLogPDF = ({ seriesData, harmonicsData, trafoDisplayName, companyName, startDate, endDate }) => {
  if (!seriesData || seriesData.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(15);
  doc.setTextColor(23, 43, 77);
  doc.text(`Raw Data Log Report - ${trafoDisplayName}`, 14, 15);

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Company: ${companyName} | Periode: ${startDate} s/d ${endDate} | 4 Sections (Raw Data + Harmonics R/S/T) | Export: ${new Date().toLocaleString('id-ID')}`, 14, 21);

  let currentY = 27;

  // 1. Raw Data Core Columns
  const coreCols = ['OilTemp', 'Press', 'Level', 'Van', 'Vbn', 'Vcn', 'Ia', 'Ib', 'Ic', 'Pa', 'Pb', 'Pc', 'Psig', 'Freq', 'status'];
  const rawCols = coreCols.map(k => RAW_DATA_COLUMNS.find(c => c.key === k)).filter(Boolean);
  
  doc.setFontSize(10);
  doc.setTextColor(79, 70, 229);
  doc.setFont(undefined, 'bold');
  doc.text('1. Raw Data Log - Primary Telemetry & Status', 14, currentY);
  currentY += 3.5;

  autoTable(doc, {
    startY: currentY,
    head: [['Timestamp', ...rawCols.map(c => c.label || 'Status')]],
    body: seriesData.map(p => [
      formatFullTime(p.timestamp),
      ...rawCols.map(c => fmtNum(c.get(p)))
    ]),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, halign: 'right' },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 38, halign: 'left', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  const vHarmonics = harmonicsData?.voltage || [];
  const iHarmonics = harmonicsData?.current || [];

  const phases = [
    { name: 'Phase R', num: 1 },
    { name: 'Phase S', num: 2 },
    { name: 'Phase T', num: 3 }
  ];

  phases.forEach((ph, idx) => {
    doc.addPage();
    currentY = 15;

    doc.setFontSize(10);
    doc.setTextColor(49, 46, 129);
    doc.setFont(undefined, 'bold');
    doc.text(`${idx + 2}. Harmonic Spectrum - ${ph.name} (Orders 1st - 31st)`, 14, currentY);
    currentY += 4;

    const vPhase = vHarmonics.find(h => h.phase === ph.num)?.orders || {};
    const iPhase = iHarmonics.find(h => h.phase === ph.num)?.orders || {};

    const head = ['Timestamp', ...HARMONIC_ORDERS.map(o => `V ${o}`), ...HARMONIC_ORDERS.map(o => `I ${o}`)];
    const body = seriesData.map(p => [
      formatFullTime(p.timestamp),
      ...HARMONIC_ORDERS.map(o => fmtNum(vPhase[o] ?? vPhase[o.replace('st', 'th').replace('rd', 'th')] ?? 0)),
      ...HARMONIC_ORDERS.map(o => fmtNum(iPhase[o] ?? iPhase[o.replace('st', 'th').replace('rd', 'th')] ?? 0))
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [head],
      body: body,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.2, halign: 'right' },
      headStyles: { fillColor: [49, 46, 129], textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 32, halign: 'left', fontStyle: 'bold' }
      },
      margin: { left: 10, right: 10 }
    });
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 6, { align: 'center' });
  }

  doc.save(`Raw_Data_Log_${trafoDisplayName.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.pdf`);
};

export const exportRawDataLogText = ({ seriesData, harmonicsData, trafoDisplayName, companyName, startDate, endDate }) => {
  if (!seriesData || seriesData.length === 0) return;

  let content = `========================================================================================\n`;
  content += `RAW DATA LOG REPORT - ${trafoDisplayName}\n`;
  content += `Company: ${companyName} | Periode: ${startDate} s/d ${endDate}\n`;
  content += `4 Sheets (Raw_data, Harmonic_phR, Harmonic_phS, Harmonic_phT) | Export: ${new Date().toLocaleString('id-ID')}\n`;
  content += `========================================================================================\n\n`;

  // Sheet 1: Raw_data
  content += `[SHEET 1: RAW_DATA (55 PARAMETERS)]\n`;
  content += `${'-'.repeat(120)}\n`;
  const headers = RAW_DATA_COLUMNS.map(c => (c.label || 'status').padEnd(11));
  content += headers.join(' | ') + '\n';
  content += `${'-'.repeat(120)}\n`;

  seriesData.forEach(p => {
    const rowVals = RAW_DATA_COLUMNS.map(c => {
      if (c.key === 'timestamp') return formatFullTime(p.timestamp).padEnd(11);
      return String(fmtNum(c.get(p))).padEnd(11);
    });
    content += rowVals.join(' | ') + '\n';
  });
  content += '\n\n';

  // Sheets 2, 3, 4: Harmonics
  const vHarmonics = harmonicsData?.voltage || [];
  const iHarmonics = harmonicsData?.current || [];
  const phases = [
    { name: 'Harmonic_phR', num: 1 },
    { name: 'Harmonic_phS', num: 2 },
    { name: 'Harmonic_phT', num: 3 }
  ];

  phases.forEach(ph => {
    content += `[SHEET: ${ph.name.toUpperCase()} (33 COLUMNS)]\n`;
    content += `${'-'.repeat(120)}\n`;
    const hCols = ['TIMESTAMP'.padEnd(20), ...HARMONIC_ORDERS.map(o => `V_${o}`.padEnd(8)), ...HARMONIC_ORDERS.map(o => `I_${o}`.padEnd(8))];
    content += hCols.join(' | ') + '\n';
    content += `${'-'.repeat(120)}\n`;

    const vPhase = vHarmonics.find(h => h.phase === ph.num)?.orders || {};
    const iPhase = iHarmonics.find(h => h.phase === ph.num)?.orders || {};

    seriesData.forEach(p => {
      const timeStr = formatFullTime(p.timestamp).padEnd(20);
      const vVals = HARMONIC_ORDERS.map(o => String(fmtNum(vPhase[o] ?? vPhase[o.replace('st', 'th').replace('rd', 'th')] ?? 0)).padEnd(8));
      const iVals = HARMONIC_ORDERS.map(o => String(fmtNum(iPhase[o] ?? iPhase[o.replace('st', 'th').replace('rd', 'th')] ?? 0)).padEnd(8));
      content += `${timeStr} | ${[...vVals, ...iVals].join(' | ')}\n`;
    });
    content += '\n\n';
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `Raw_Data_Log_${trafoDisplayName.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.txt`);
};

export const exportRawDataLogDocx = ({ seriesData, harmonicsData, trafoDisplayName, companyName, startDate, endDate }) => {
  if (!seriesData || seriesData.length === 0) return;

  const vHarmonics = harmonicsData?.voltage || [];
  const iHarmonics = harmonicsData?.current || [];
  const phases = [
    { name: 'Phase R (phR)', num: 1 },
    { name: 'Phase S (phS)', num: 2 },
    { name: 'Phase T (phT)', num: 3 }
  ];

  const docxHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Raw Data Log Report</title>
      <style>
        @page { size: landscape; margin: 1.5cm; }
        body { font-family: Calibri, Arial, sans-serif; font-size: 8pt; }
        h2 { color: #1e1b4b; margin-bottom: 2px; }
        h3 { color: #4338ca; margin-top: 14px; margin-bottom: 4px; font-size: 9pt; }
        p.meta { color: #64748b; font-size: 8pt; margin-top: 0; margin-bottom: 10px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 14px; }
        th { background-color: #4f46e5; color: #ffffff; padding: 4px 5px; font-size: 7pt; border: 1px solid #cbd5e1; text-align: right; }
        td { padding: 3px 4px; font-size: 6.5pt; border: 1px solid #cbd5e1; text-align: right; }
        .left { text-align: left; }
      </style>
    </head>
    <body>
      <h2>Raw Data Log Report - ${trafoDisplayName}</h2>
      <p class="meta">Company: ${companyName} | Periode: ${startDate} s/d ${endDate} | 4 Sheets | Export: ${new Date().toLocaleString('id-ID')}</p>
      
      <h3>1. Raw Data Log (Primary 55 Columns)</h3>
      <table>
        <thead>
          <tr>
            <th class="left">Timestamp</th>
            ${RAW_DATA_COLUMNS.filter(c => c.key !== 'timestamp').map(c => `<th>${c.label || 'Status'}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${seriesData.map(p => `
            <tr>
              <td class="left" style="font-weight: bold;">${formatFullTime(p.timestamp)}</td>
              ${RAW_DATA_COLUMNS.filter(c => c.key !== 'timestamp').map(c => `<td>${fmtNum(c.get(p))}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${phases.map(ph => {
        const vPhase = vHarmonics.find(h => h.phase === ph.num)?.orders || {};
        const iPhase = iHarmonics.find(h => h.phase === ph.num)?.orders || {};
        return `
          <h3>Harmonic Spectrum - ${ph.name} (33 Columns)</h3>
          <table>
            <thead>
              <tr>
                <th class="left">Timestamp</th>
                ${HARMONIC_ORDERS.map(o => `<th>V ${o}</th>`).join('')}
                ${HARMONIC_ORDERS.map(o => `<th>I ${o}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${seriesData.map(p => `
                <tr>
                  <td class="left" style="font-weight: bold;">${formatFullTime(p.timestamp)}</td>
                  ${HARMONIC_ORDERS.map(o => `<td>${fmtNum(vPhase[o] ?? vPhase[o.replace('st', 'th').replace('rd', 'th')] ?? 0)}</td>`).join('')}
                  ${HARMONIC_ORDERS.map(o => `<td>${fmtNum(iPhase[o] ?? iPhase[o.replace('st', 'th').replace('rd', 'th')] ?? 0)}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }).join('')}
    </body>
    </html>
  `;
  const blob = new Blob([docxHtml], { type: 'application/msword;charset=utf-8' });
  saveAs(blob, `Raw_Data_Log_${trafoDisplayName.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.doc`);
};
