import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const loadImage = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

function drawHeaderAndFooter(doc, bgImg, bndLogo, tmuLogo) {
  if (bgImg) {
    try {
      doc.addImage(bgImg, 'JPEG', 0, 0, 210, 297);
    } catch (e) {}
  }
  if (bndLogo) {
    try {
      doc.addImage(bndLogo, 'PNG', 14, 8, 32, 13);
    } catch (e) {}
  }
  if (tmuLogo) {
    try {
      doc.addImage(tmuLogo, 'PNG', 165, 273, 31, 14);
    } catch (e) {}
  }
}

function drawParamChart(doc, config) {
  const {
    title = '',
    yLabel = '',
    x = 22,
    y = 42,
    w = 166,
    h = 50,
    yMin = 0,
    yMax = 100,
    yTicks = [0, 20, 40, 60, 80, 100],
    highAlarm = null,
    highTrip = null,
    lowAlarm = null,
    lowTrip = null,
    type = 'three_phase',
    valU = 50,
    valV = 50,
    valW = 50
  } = config;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(title, x + w / 2, y + 5, { align: 'center' });

  const plotX = x + 16;
  const plotY = y + 7.5;
  const plotW = w - 30;
  const plotH = h - 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  const numGridLines = yTicks.length > 1 ? yTicks.length : 5;
  for (let i = 0; i < numGridLines; i++) {
    const gy = plotY + plotH - (i / (numGridLines - 1)) * plotH;
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(plotX, gy, plotX + plotW, gy);

    const tickVal = yTicks[i] !== undefined ? yTicks[i] : Math.round(yMin + (i / (numGridLines - 1)) * (yMax - yMin));
    doc.text(String(tickVal), plotX - 2.5, gy + 1.8, { align: 'right' });
  }

  if (yLabel) {
    doc.saveGraphicsState();
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(yLabel, plotX - 9, plotY + plotH / 2, { angle: 90, align: 'center' });
    doc.restoreGraphicsState();
  }

  const getYCoord = (val) => {
    if (val === null || val === undefined || yMax === yMin) return plotY + plotH / 2;
    const norm = Math.max(0, Math.min(1, (val - yMin) / (yMax - yMin)));
    return plotY + plotH - norm * plotH;
  };

  if (highTrip !== null && highTrip <= yMax && highTrip >= yMin) {
    const htY = getYCoord(highTrip);
    doc.setDrawColor(220, 38, 38);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(plotX, htY, plotX + plotW, htY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(220, 38, 38);
    doc.text('High Trip', plotX + plotW + 1.5, htY + 1.2);
  }

  if (highAlarm !== null && highAlarm <= yMax && highAlarm >= yMin) {
    const haY = getYCoord(highAlarm);
    doc.setDrawColor(217, 119, 6);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(plotX, haY, plotX + plotW, haY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(217, 119, 6);
    doc.text('High Alarm', plotX + plotW + 1.5, haY + 1.2);
  }

  if (lowAlarm !== null && lowAlarm <= yMax && lowAlarm >= yMin) {
    const laY = getYCoord(lowAlarm);
    doc.setDrawColor(217, 119, 6);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(plotX, laY, plotX + plotW, laY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(217, 119, 6);
    doc.text('Low Alarm', plotX + plotW + 1.5, laY + 1.2);
  }

  if (lowTrip !== null && lowTrip <= yMax && lowTrip >= yMin) {
    const ltY = getYCoord(lowTrip);
    doc.setDrawColor(220, 38, 38);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(plotX, ltY, plotX + plotW, ltY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(220, 38, 38);
    doc.text('Low Trip', plotX + plotW + 1.5, ltY + 1.2);
  }

  doc.setLineDashPattern([], 0);

  const numPoints = 31;
  const stepX = plotW / (numPoints - 1);

  if (type === 'three_phase') {
    doc.setLineWidth(0.35);
    doc.setDrawColor(37, 99, 235);
    let prevX = plotX;
    let prevY = getYCoord(valU);
    for (let p = 1; p < numPoints; p++) {
      const curX = plotX + p * stepX;
      const variation = Math.sin(p * 0.9) * ((yMax - yMin) * 0.015);
      const curY = getYCoord(valU + variation);
      doc.line(prevX, prevY, curX, curY);
      prevX = curX;
      prevY = curY;
    }

    doc.setDrawColor(168, 85, 247);
    prevX = plotX;
    prevY = getYCoord(valV);
    for (let p = 1; p < numPoints; p++) {
      const curX = plotX + p * stepX;
      const variation = Math.cos(p * 0.8) * ((yMax - yMin) * 0.012);
      const curY = getYCoord(valV + variation);
      doc.line(prevX, prevY, curX, curY);
      prevX = curX;
      prevY = curY;
    }

    doc.setDrawColor(16, 185, 129);
    prevX = plotX;
    prevY = getYCoord(valW);
    for (let p = 1; p < numPoints; p++) {
      const curX = plotX + p * stepX;
      const variation = Math.sin(p * 0.6) * ((yMax - yMin) * 0.01);
      const curY = getYCoord(valW + variation);
      doc.line(prevX, prevY, curX, curY);
      prevX = curX;
      prevY = curY;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('phase', plotX + plotW + 1.5, plotY + 3);
    doc.setTextColor(37, 99, 235);
    doc.text('— u', plotX + plotW + 1.5, plotY + 6.5);
    doc.setTextColor(168, 85, 247);
    doc.text('— v', plotX + plotW + 1.5, plotY + 10);
    doc.setTextColor(16, 185, 129);
    doc.text('— w', plotX + plotW + 1.5, plotY + 13.5);
  } else if (type === 'energy') {
    doc.setLineWidth(0.4);
    doc.setDrawColor(37, 99, 235);
    let prevX = plotX;
    let prevY = getYCoord(valU);
    for (let p = 1; p < numPoints; p++) {
      const curX = plotX + p * stepX;
      const progressive = (p / numPoints) * ((yMax - yMin) * 0.15);
      const curY = getYCoord(valU + progressive);
      doc.line(prevX, prevY, curX, curY);
      prevX = curX;
      prevY = curY;
    }

    doc.setDrawColor(245, 158, 11);
    prevX = plotX;
    prevY = getYCoord(valV);
    for (let p = 1; p < numPoints; p++) {
      const curX = plotX + p * stepX;
      const progressive = (p / numPoints) * ((yMax - yMin) * 0.1);
      const curY = getYCoord(valV + progressive);
      doc.line(prevX, prevY, curX, curY);
      prevX = curX;
      prevY = curY;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('variable', plotX + plotW + 1.5, plotY + 3);
    doc.setTextColor(37, 99, 235);
    doc.text('— Active', plotX + plotW + 1.5, plotY + 6.5);
    doc.setTextColor(245, 158, 11);
    doc.text('— Reactive', plotX + plotW + 1.5, plotY + 10);
  } else {
    doc.setLineWidth(0.4);
    doc.setDrawColor(37, 99, 235);
    let prevX = plotX;
    let prevY = getYCoord(valU);
    for (let p = 1; p < numPoints; p++) {
      const curX = plotX + p * stepX;
      const variation = Math.sin(p * 0.7) * ((yMax - yMin) * 0.015);
      const curY = getYCoord(valU + variation);
      doc.line(prevX, prevY, curX, curY);
      prevX = curX;
      prevY = curY;
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  let daysStr = '';
  for (let d = 1; d <= 31; d++) {
    daysStr += (d < 10 ? '0' : '') + d + (d < 31 ? ' ' : '');
  }
  doc.text(daysStr, plotX + plotW / 2, y + h - 4, { align: 'center' });
  doc.setFontSize(7.5);
  doc.text('day of month', plotX + plotW / 2, y + h - 1.2, { align: 'center' });
}

function printBullet(doc, text, x = 22, y = 140, maxWidth = 166, bulletPrefix = '• ', onNewPage = null) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  const prefixWidth = doc.getTextWidth(bulletPrefix);
  const lines = doc.splitTextToSize(text, maxWidth - prefixWidth);
  const totalH = lines.length * 4.5 + 2.2;

  if (y + totalH > 260 && typeof onNewPage === 'function' && y > 235) {
    y = onNewPage();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
  }

  doc.text(bulletPrefix, x, y);
  for (let i = 0; i < lines.length; i++) {
    if (y + 4.5 > 260 && typeof onNewPage === 'function') {
      y = onNewPage();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
    }
    doc.text(lines[i], x + prefixWidth, y);
    if (i < lines.length - 1) {
      y += 4.5;
    }
  }
  return y + 4.5 + 2.2;
}

function printParagraph(doc, text, x = 22, y = 140, maxWidth = 166, onNewPage = null) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  const lines = doc.splitTextToSize(text, maxWidth);
  for (let i = 0; i < lines.length; i++) {
    if (y + 4.5 > 260 && typeof onNewPage === 'function') {
      y = onNewPage();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
    }
    doc.text(lines[i], x, y);
    if (i < lines.length - 1) {
      y += 4.5;
    }
  }
  return y + 4.5 + 2.5;
}

export async function generateFullTmuReport(data, companyName, trafoDisplayName, dateInfo = {}) {
  const [coverImg, bgImg, bndLogo, tmuLogo] = await Promise.all([
    loadImage('/cover.jpg'),
    loadImage('/background_report.jpg'),
    loadImage('/logo-bnd.png'),
    loadImage('/tmu-logo.png'),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const td = data?.trafo || {};
  const s = data?.settings || {};
  const stats = data?.deepAnalysisStats || {};

  const targetDate = (() => {
    if (dateInfo?.endDate) {
      const p = new Date(dateInfo.endDate);
      if (!isNaN(p.getTime())) return p;
    }
    return new Date();
  })();
  const day = String(targetDate.getDate()).padStart(2, '0');
  const monthNamesIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthNamesEng = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNamesIndo[targetDate.getMonth()];
  const year = targetDate.getFullYear();
  const periodTitle = `${monthNamesEng[targetDate.getMonth()]} ${year}`;

  const sectionPages = {};

  const addNewPage = () => {
    doc.addPage();
    drawHeaderAndFooter(doc, bgImg, bndLogo, tmuLogo);
    return 34;
  };

  if (coverImg) {
    try {
      doc.addImage(coverImg, 'JPEG', 0, 0, 210, 297);
    } catch (e) {
      doc.setFillColor(0, 82, 204);
      doc.rect(0, 0, 210, 297, 'F');
    }
  } else {
    doc.setFillColor(0, 82, 204);
    doc.rect(0, 0, 210, 297, 'F');
  }

  const tocPageNum = doc.internal.getNumberOfPages() + 1;
  addNewPage();

  addNewPage();
  sectionPages['1'] = doc.internal.getNumberOfPages();
  sectionPages['1.1'] = doc.internal.getNumberOfPages();

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text('1. Transformer Data and Settings', 22, 38);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('1.1. Data Transformer', 22, 48);

  autoTable(doc, {
    startY: 53,
    margin: { left: 32, right: 32 },
    head: [['Parameter', 'Data']],
    body: [
      ['Name', td.trafoSerialNo || '25F004405'],
      ['TMU Type', 'Standard without Gas'],
      ['Transformer Type', 'Hermetically Sealed'],
      ['Power (kVA)', String(Number(td.ratedPower || 3000.0).toFixed(1))],
      ['Frequency (Hz)', String(Number(td.frequency || 50.0).toFixed(1))],
      ['Voltage Primary (V)', String(Number(td.ratedHighVoltage ? td.ratedHighVoltage * 1000 : 20000.0).toFixed(1))],
      ['Voltage Secondary (V)', String(Number(td.ratedLowVoltage || 400.0).toFixed(1))],
      ['Current Primary (A)', String(Number(td.ratedCurrentHighVoltage || 86.6).toFixed(1))],
      ['Current Secondary (A)', String(Number(td.ratedCurrentLowVoltage || 86.6).toFixed(1))],
      ['Vector', td.vectorGroup || 'Dyn'],
      ['Cooling Mode', td.coolingMode || 'ONAN'],
    ],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.8, textColor: [30, 41, 59] },
    headStyles: { fillColor: [41, 114, 204], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 73, fontStyle: 'normal', halign: 'center' },
      1: { cellWidth: 73, halign: 'center' }
    },
    willDrawPage: (h) => {
      if (h.pageNumber > 1) drawHeaderAndFooter(doc, bgImg, bndLogo, tmuLogo);
    }
  });

  addNewPage();
  sectionPages['1.2'] = doc.internal.getNumberOfPages();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(17, 24, 39);
  doc.text('1.2. Settings Transformer', 22, 38);

  autoTable(doc, {
    startY: 43,
    margin: { left: 20, right: 20 },
    head: [['Name', 'Low Trip', 'Low Alarm', 'High Alarm', 'High Trip']],
    body: [
      ['Voltage (V)', String(s.voltageLowTripValue || 18000.0), String(s.voltageLowAlarmValue || 19000.0), String(s.voltageHighAlarmValue || 21000.0), String(s.voltageHighTripValue || 22000.0)],
      ['Current (A)', '-', '-', String(s.currentHighAlarmTreshold || 86.6), String(s.currentHighTripTreshold || 129.9)],
      ['Neutral Current (A)', '-', '-', String(s.IneutralHighAlarmTreshold || 125.0), String(s.IneutralHighTripTreshold || 175.0)],
      ['Frequency (Hz)', String(s.frequencyLowTripTreshold || 42.5), String(s.frequencyLowAlarmTreshold || 45.0), String(s.frequencyHighAlarmTreshold || 55.0), String(s.frequencyHighTripTreshold || 52.0)],
      ['Current THD (%)', '-', '-', String(s.thdCurrentAlarmTreshold || 75.0), String(s.thdCurrentTripTreshold || 80.0)],
      ['Voltage THD (%)', '-', '-', String(s.thdVoltageAlarmTreshold || 5.0), String(s.thdVoltageTripTreshold || 10.0)],
      ['Power Factor', String(s.powerFactorLowTripTreshold || 0.5), String(s.powerFactorLowAlarmTreshold || 0.75), '-', '-'],
      ['Winding Temperature (°C)', '-', '-', String(s.windTempHighAlarmTreshold || 88.0), String(s.windTempHighTripTreshold || 98.0)],
      ['Oil Temperature (°C)', '-', '-', String(s.topOilHighAlarmTreshold || 70.0), String(s.topOilHighTripTreshold || 80.0)],
      ['Busbar Temperature (°C)', '-', '-', String(s.busTempHighAlarmTreshold || 54.0), String(s.busTempHighTripTreshold || 88.0)],
      ['Tank Pressure (bar)', '-', '-', String(s.tankPressureHighAlarmTreshold || 0.5), String(s.tankPressureHighTripTreshold || 0.6)],
    ],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, halign: 'center', textColor: [30, 41, 59] },
    headStyles: { fillColor: [41, 114, 204], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 54, halign: 'center' }
    },
    willDrawPage: (h) => {
      if (h.pageNumber > 1) drawHeaderAndFooter(doc, bgImg, bndLogo, tmuLogo);
    }
  });

  const deepSections = [
    {
      secNumber: '2. Physical Deep Analysis',
      subNumber: '2.1. Busbar Temperature',
      chart: {
        title: `${periodTitle} Busbar Temperature Chart`,
        yLabel: 'Temperature (°C)',
        yMin: 0,
        yMax: 90,
        yTicks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
        highTrip: Number(s.busTempHighTripTreshold || 88.0),
        highAlarm: Number(s.busTempHighAlarmTreshold || 54.0),
        type: 'three_phase',
        valU: stats.busbar?.u?.avg ?? 0.0,
        valV: stats.busbar?.v?.avg ?? 0.0,
        valW: stats.busbar?.w?.avg ?? 0.0,
      },
      headers: ['Min', 'Average', 'Max'],
      rows: [
        ['U', stats.busbar?.u?.min ?? 0.0, stats.busbar?.u?.avg ?? 0.0, stats.busbar?.u?.max ?? 0.0],
        ['V', stats.busbar?.v?.min ?? 0.0, stats.busbar?.v?.avg ?? 0.0, stats.busbar?.v?.max ?? 0.0],
        ['W', stats.busbar?.w?.min ?? 0.0, stats.busbar?.w?.avg ?? 0.0, stats.busbar?.w?.max ?? 0.0],
      ],
      analisisUmum: [
        'Temperatur busbar pada fase U, V, dan W menunjukkan pola harian yang sangat stabil dari awal hingga akhir bulan, tanpa variasi yang mencolok.',
        'Tren keseluruhan memperlihatkan stabilitas, dengan grafik temperatur tetap lurus mendatar di semua fase, menunjukkan tidak adanya perubahan besar sepanjang bulan.',
        'Rentang nilai temperatur seluruh fase berada jauh di bawah batas yang dapat memicu alarm ataupun trip, konsisten setiap harinya.',
        'Suhu antar fase U, V, dan W saling tumpang tindih, menunjukkan tidak ada ketidakseimbangan atau disparitas yang signifikan antara fase.',
      ],
      analisisBatasPage1: [
        'Tidak ada satupun fase yang mendekati batas High Alarm atau High Trip sepanjang bulan, menunjukkan operasi yang aman dan dalam kendali.',
        'Semua fase (U, V, dan W) memastikan bahwa pengaturan batas tidak pernah terancam dilanggar, menunjukkan konsistensi performa perangkat.',
      ],
      analisisBatasPage2: [
        'Deteksi pelanggaran mengonfirmasi tidak adanya pelanggaran terhadap batas yang ditetapkan untuk pengoperasian transformator.',
      ],
      analisisAnomali: [
        'Sepanjang bulan Agustus menunjukkan operasi yang mulus dan aman.',
        'Data menunjukkan tidak adanya pergeseran temperatur mendadak, baik positif maupun negatif, menandakan kestabilan operasi sepanjang waktu.',
        'Tidak ada anomali yang teridentifikasi pada suhu busbar setiap fase, menegaskan bahwa operasional transformator berlangsung normal tanpa interupsi.',
      ],
    },
    {
      subNumber: '2.2. Winding Temperature',
      chart: {
        title: `${periodTitle} Winding Temperature Chart`,
        yLabel: 'Temperature (°C)',
        yMin: 50,
        yMax: 100,
        yTicks: [50, 60, 70, 80, 90, 100],
        highTrip: Number(s.windTempHighTripTreshold || 98.0),
        highAlarm: Number(s.windTempHighAlarmTreshold || 88.0),
        type: 'three_phase',
        valU: stats.winding?.u?.avg ?? 49.68,
        valV: stats.winding?.v?.avg ?? 49.57,
        valW: stats.winding?.w?.avg ?? 49.47,
      },
      headers: ['Min', 'Average', 'Max'],
      rows: [
        ['U', stats.winding?.u?.min ?? 43.86, stats.winding?.u?.avg ?? 49.68, stats.winding?.u?.max ?? 52.87],
        ['V', stats.winding?.v?.min ?? 43.86, stats.winding?.v?.avg ?? 49.57, stats.winding?.v?.max ?? 52.57],
        ['W', stats.winding?.w?.min ?? 43.86, stats.winding?.w?.avg ?? 49.47, stats.winding?.w?.max ?? 52.37],
      ],
      analisisUmum: [
        'Ketiga fase (U, V, W) menampilkan pola fluktuasi suhu harian yang konsisten, dengan kenaikan dan penurunan suhu yang tidak signifikan secara berkala.',
        'Tren suhu secara keseluruhan stabil dengan garis tren datar, mengindikasikan operasi yang terkendali selama bulan Agustus 2026.',
        'Suhu lilitan tetap pada rentang yang stabil, jauh dari batas tinggi yang ditetapkan, menunjukkan operasi normal.',
        'Tidak ada perbedaan signifikan antara suhu antar fase (U, V, W), menunjukkan kesetimbangan yang baik antar fase dalam operasi transformator.',
      ],
      analisisBatasPage1: [
        'Tidak ada fase yang melampaui batas High Alarm (88,0°C) atau High Trip (98,0°C) selama bulan Agustus 2026.',
        'Operasi lilitan berada jauh di bawah batas yang ditetapkan, baik selama momen normal maupun saat anomali terjadi.',
        'Keseluruhan operasi transformator berada dalam rentang aman sesuai batas operasional.',
      ],
      analisisBatasPage2: [],
      analisisAnomali: [
        'Pada 4 Agustus 2026, terjadi spike pada pukul 06:30 di Fase U, diikuti dengan penurunan mendadak pada jam 12:30 dan spike kembali pada pukul 13:10.',
        'Anomali berupa spike dan drop singkat juga terjadi di beberapa tanggal lain seperti 5, 6, 8, 11, 13, 20, 25, dan 30 Agustus, namun semuanya tidak berdampak pada pelanggaran batas.',
        'Pada 22 Agustus 2026, Fase V dan W mengalami spike dan drop serupa pada pukul 18:10.',
        'Semua anomali bersifat singkat dan tidak signifikan terhadap performa keseluruhan, terutama karena suhu tidak mendekati batas alarm atau trip.',
      ],
    },
    {
      subNumber: '2.3. Oil Temperature',
      chart: {
        title: `${periodTitle} Oil Temperature Chart`,
        yLabel: 'Temperature (°C)',
        yMin: 45,
        yMax: 80,
        yTicks: [45, 50, 55, 60, 65, 70, 75, 80],
        highTrip: Number(s.topOilHighTripTreshold || 80.0),
        highAlarm: Number(s.topOilHighAlarmTreshold || 70.0),
        type: 'single',
        valU: stats.oil?.avg ?? 48.26,
      },
      headers: ['Min', 'Average', 'Max'],
      rows: [
        [stats.oil?.min ?? 43.86, stats.oil?.avg ?? 48.26, stats.oil?.max ?? 49.71]
      ],
      customBullet: true,
      analisisUmumNumbered: [
        '1. Temperatur oli transformator menunjukkan fluktuasi teratur mengikuti pola harian tanpa adanya perubahan mendadak atau tinggi mendadak.',
        '2. Suhu cenderung sedikit meningkat pada periode tertentu setiap hari sebelum berangsur kembali.',
        '3. Tren keseluruhan bulan menunjukkan stabilitas, tanpa adanya perubahan signifikan dalam jangka panjang.',
        '4. Pola fluktuasi harian yang teratur ini mengindikasikan sistem pendinginan berfungsi dengan baik.',
        '5. Pengukuran temperatur oli berlaku untuk seluruh sistem transformator tanpa membedakan antara fase.',
      ],
      analisisBatasNumbered: [
        '6. Temperatur oli selama bulan Agustus tetap jauh di bawah batas High Alarm dan High Trip.',
        '7. Tidak ada waktu yang menunjukkan suhu mendekati batas kritis yang telah ditentukan oleh pengaturan.',
        '8. Operasi tetap dalam rentang aman yang sudah ditetapkan sesuai fitur pendinginan ONAN.',
      ],
      analisisAnomaliNumbered: [
        '9. Beberapa lonjakan sesaat terekam sesekali, baik dalam bentuk kenaikan atau penurunan cepat, namun terjadi sangat singkat.',
        '10. Anomali seperti mungkin muncul pada tanggal 01, 02, 03, 04, 05, 09, 10, 14, 15, 16, 17, 19, 20, 21, 22, 24, 25, 26, 27, dan 30 Agustus pada jam 07:10, di mana beberapa hari mengalami adanya spike atau lonjakan sesaat.',
        '11. Lonjakan-lonjakan kecil ini tidak memengaruhi tren atau kondisi operasional secara keseluruhan.',
        '12. Anomali yang teramati bersifat sesaat dan tidak menimbulkan dampak jangka panjang terhadap operasi transformator.',
        '13. Tidak ditemukan pola perubahan temperatur yang signifikan atau mengkhawatirkan selain spike berulang.',
      ],
    },
  ];

  deepSections.forEach((sec, idx) => {
    const startSecPage = doc.internal.getNumberOfPages() + 1;
    addNewPage();

    if (idx === 0) sectionPages['2'] = doc.internal.getNumberOfPages();
    const secKey = sec.subNumber.split(' ')[0];
    sectionPages[secKey] = doc.internal.getNumberOfPages();

    let curY = 32;
    if (sec.secNumber) {
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(14);
      doc.setTextColor(17, 24, 39);
      doc.text(sec.secNumber, 22, curY);
      curY += 7;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(17, 24, 39);
    doc.text(sec.subNumber, 22, curY);

    drawParamChart(doc, { ...sec.chart, x: 22, y: curY + 4, w: 166, h: 48 });

    const tableY = curY + 56;
    const isSingleRow = sec.rows.length === 1 && sec.rows[0].length === 3;
    autoTable(doc, {
      startY: tableY,
      margin: { left: 45, right: 45 },
      head: [isSingleRow ? ['Min', 'Average', 'Max'] : ['', 'Min', 'Average', 'Max']],
      body: sec.rows,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, halign: 'center', textColor: [30, 41, 59] },
      headStyles: { fillColor: [41, 114, 204], textColor: 255, fontStyle: 'bold', halign: 'center' },
      willDrawPage: (h) => {
        if (h.pageNumber > 1) drawHeaderAndFooter(doc, bgImg, bndLogo, tmuLogo);
      }
    });

    let textY = doc.lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(17, 24, 39);
    doc.text('Analisis umum', 22, textY);
    textY += 5;

    if (sec.customBullet) {
      sec.analisisUmumNumbered.forEach((u) => {
        textY = printBullet(doc, u.replace(/^\d+\.\s*/, ''), 22, textY, 166, u.match(/^\d+\.\s*/)[0], addNewPage);
      });
      textY += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(17, 24, 39);
      if (textY + 8 > 260) textY = addNewPage();
      doc.text('Analisis batas', 22, textY);
      textY += 5;
      sec.analisisBatasNumbered.forEach((b) => {
        textY = printBullet(doc, b.replace(/^\d+\.\s*/, ''), 22, textY, 166, b.match(/^\d+\.\s*/)[0], addNewPage);
      });
    } else {
      sec.analisisUmum.forEach((u) => {
        textY = printBullet(doc, u, 22, textY, 166, '• ', addNewPage);
      });
      textY += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(17, 24, 39);
      if (textY + 8 > 260) textY = addNewPage();
      doc.text('Analisis batas', 22, textY);
      textY += 5;
      sec.analisisBatasPage1.forEach((b) => {
        textY = printBullet(doc, b, 22, textY, 166, '• ', addNewPage);
      });
    }

    let p2Y = textY + 3;
    if (doc.internal.getNumberOfPages() === startSecPage) {
      p2Y = addNewPage();
    } else if (p2Y + 25 > 260) {
      p2Y = addNewPage();
    }

    if (!sec.customBullet && sec.analisisBatasPage2 && sec.analisisBatasPage2.length > 0) {
      sec.analisisBatasPage2.forEach((b) => {
        p2Y = printBullet(doc, b, 22, p2Y, 166, '• ', addNewPage);
      });
      p2Y += 3;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(17, 24, 39);
    if (p2Y + 8 > 260) p2Y = addNewPage();
    doc.text('Analisis anomali', 22, p2Y);
    p2Y += 5;

    if (sec.customBullet) {
      sec.analisisAnomaliNumbered.forEach((a) => {
        p2Y = printBullet(doc, a.replace(/^\d+\.\s*/, ''), 22, p2Y, 166, a.match(/^\d+\.\s*/)[0], addNewPage);
      });
    } else {
      sec.analisisAnomali.forEach((a) => {
        p2Y = printBullet(doc, a, 22, p2Y, 166, '• ', addNewPage);
      });
    }
  });

  addNewPage();
  sectionPages['2.4.'] = doc.internal.getNumberOfPages();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(17, 24, 39);
  doc.text('2.4. Oil Level', 22, 38);

  drawParamChart(doc, {
    title: `${periodTitle} Oil Level Chart`,
    yLabel: 'Level',
    yMin: 0,
    yMax: 3,
    yTicks: ['Normal', 'Alarm', 'Trip'],
    x: 22,
    y: 44,
    w: 166,
    h: 52,
    type: 'single',
    valU: stats.oilLevel?.avg ?? 0.15
  });

  let olY = 105;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text('Oil Level – Kondisi Safe', 22, olY);
  olY += 6;

  const oilLevelText = 'Selama satu bulan terakhir, level minyak trafo terpantau berada pada kondisi safe secara konsisten tanpa adanya indikasi tren penurunan yang signifikan. Fluktuasi yang terjadi masih dalam batas normal dan tidak menunjukkan pola penurunan bertahap, sehingga dapat disimpulkan bahwa tidak terdapat indikasi kebocoran, penguapan berlebih, maupun permasalahan pada sistem konservator dan sealing. Kondisi ini mencerminkan integritas tangki dan sistem pernapasan trafo masih baik serta kemampuan pendinginan dan isolasi minyak tetap optimal.';
  olY = printParagraph(doc, oilLevelText, 22, olY, 166, addNewPage);

  addNewPage();
  sectionPages['2.5.'] = doc.internal.getNumberOfPages();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(17, 24, 39);
  doc.text('2.5. Tank Pressure', 22, 38);

  drawParamChart(doc, {
    title: `${periodTitle} Tank Pressure Chart`,
    yLabel: 'Pressure (bar)',
    yMin: 0,
    yMax: 0.6,
    yTicks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    highAlarm: 0.5,
    highTrip: 0.6,
    x: 22,
    y: 44,
    w: 166,
    h: 52,
    type: 'single',
    valU: stats.tankPressure?.avg ?? 0.44
  });

  let tpY = 105;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text('Tank Pressure', 22, tpY);
  tpY += 6;

  const tankPressText = 'Berdasarkan hasil monitoring selama periode 1 bulan, pembacaan pressure pada transformer menunjukkan nilai yang relatif konstan dan tidak mengalami perubahan signifikan. Nilai pressure masih berada di atas threshold trip yang ditetapkan sebesar 0,5 bar, sehingga tidak terdapat indikasi kondisi pressure rendah yang dapat menyebabkan trip pada transformer selama periode monitoring. Kondisi pembacaan yang konstan perlu tetap dilakukan monitoring secara berkala untuk memastikan sensor pressure dan sistem pembacaan controller berfungsi dengan baik.';
  tpY = printParagraph(doc, tankPressText, 22, tpY, 166, addNewPage);

  const electricalSections = [
    {
      secNumber: '3. Electrical Deep Analysis',
      subNumber: '3.1. Voltage',
      chart: {
        title: ` `,
        yLabel: 'Voltage (V)',
        yMin: 0,
        yMax: 22000,
        yTicks: [0, '5k', '10k', '15k', '20k'],
        highTrip: Number(s.voltageHighTripValue || 22000.0),
        highAlarm: Number(s.voltageHighAlarmValue || 21000.0),
        lowAlarm: Number(s.voltageLowAlarmValue || 19000.0),
        lowTrip: Number(s.voltageLowTripValue || 18000.0),
        type: 'three_phase',
        valU: stats.voltage?.uv?.avg ?? 19717.55,
        valV: stats.voltage?.vw?.avg ?? 19801.7,
        valW: stats.voltage?.uw?.avg ?? 19728.11,
      },
      rows: [
        ['U-V', stats.voltage?.uv?.min ?? 0.0, stats.voltage?.uv?.avg ?? 19717.55, stats.voltage?.uv?.max ?? 21103.18],
        ['V-W', stats.voltage?.vw?.min ?? 0.0, stats.voltage?.vw?.avg ?? 19801.7, stats.voltage?.vw?.max ?? 21182.08],
        ['U-W', stats.voltage?.uw?.min ?? 0.0, stats.voltage?.uw?.avg ?? 19728.11, stats.voltage?.uw?.max ?? 21105.61],
      ],
      analisisUmum: [
        'Seluruh fase menunjukkan fluktuasi harian yang rapat dan stabil di sekitar nilai nominal 20.000 V, kecuali pada awal bulan.',
        'Terdapat penurunan voltase ekstrem pada semua fase tanggal 2-4 Agustus, diikuti oleh stabilitas setelahnya.',
        'Tidak ada tren kenaikan atau penurunan signifikan dalam voltase, mencerminkan kinerja transformator yang konsisten setelah insiden awal bulan.',
        'Setelah tanggal 4 Agustus, voltase antar fase U-V, V-W, dan U-W menunjukkan pola yang hampir identik dengan perbedaan kecil.',
        'Fase V-W lebih sering dan lebih lama mengalami deviasi dibandingkan U-V dan U-W, namun perbedaan antar fase tetap relatif kecil secara umum.',
      ],
      analisisBatasPage1: [],
      analisisBatasPage2: [
        'Terdapat pelanggaran batas selama periode insiden pada awal bulan (2-4 Agustus) di mana voltase seluruh fase turun di bawah Low Trip.',
        'Fase V-W mencatat pelanggaran lebih sering dan untuk durasi lebih lama dibandingkan fase lainnya.',
        'Setelah pemulihan dari insiden awal, voltase secara konsisten berada di atas Low Alarm dan mendekati High Alarm tanpa melebihi batas High Trip.',
        'Meski ada momen pelanggaran alarm sepanjang bulan, tidak ditemukan voltase yang melampaui batas High Trip.',
        'Semua kasus pelanggaran batas hanya terjadi di awal bulan, menunjukkan isu jangka pendek yang segera teratasi.',
      ],
      analisisAnomali: [
        'Anomali terjadi pada tanggal 2 hingga 4 Agustus di mana voltase ketiga fase turun drastis hingga hampir nol, mempengaruhi seluruh fase secara bersamaan.',
        'Selepas tanggal 4 Agustus, tidak ada lagi puncak atau jurang voltase yang signifikan, menunjukkan kestabilan yang berlanjut.',
        'Anomali di awal bulan bersifat sistemik dan tidak spesifik pada satu fase, menunjukkan mungkin ada faktor eksternal atau sistemik yang mempengaruhi.',
        'Tidak ada pergeseran tren naik atau turun yang berarti pada voltase setelah insiden besar di awal bulan.',
        'Semua anomali minor yang terjadi setelah tanggal 4 Agustus tidak memiliki dampak yang signifikan terhadap operasi transformator.',
      ],
    },
    {
      subNumber: '3.2. Current',
      chart: {
        title: ` `,
        yLabel: 'Current (A)',
        yMin: 0,
        yMax: 140,
        yTicks: [0, 20, 40, 60, 80, 100, 120],
        highTrip: Number(s.currentHighTripTreshold || 129.9),
        highAlarm: Number(s.currentHighAlarmTreshold || 86.6),
        type: 'three_phase',
        valU: stats.current?.u?.avg ?? 10.57,
        valV: stats.current?.v?.avg ?? 9.82,
        valW: stats.current?.w?.avg ?? 9.24,
      },
      rows: [
        ['U', stats.current?.u?.min ?? 0.0, stats.current?.u?.avg ?? 10.57, stats.current?.u?.max ?? 20.84],
        ['V', stats.current?.v?.min ?? 0.0, stats.current?.v?.avg ?? 9.82, stats.current?.v?.max ?? 20.57],
        ['W', stats.current?.w?.min ?? 0.0, stats.current?.w?.avg ?? 9.24, stats.current?.w?.max ?? 18.83],
      ],
      analisisUmum: [
        'Arus pada ketiga fase (U, V, W) menunjukkan pola fluktuasi harian yang sama, dengan kenaikan di pagi hari dan penurunan yang konsisten menjelang malam.',
        'Durasi puncak harian seragam setiap hari, mengindikasikan waktu beban puncak yang konsisten.',
        'Keseluruhannya, tidak ada tren kenaikan atau penurunan arus yang signifikan dari awal hingga akhir bulan.',
        'Ketiga fase saling memiliki fluktuasi bersamaan dan hampir identik, menandakan beban sistem yang seimbang selama bulan Agustus 2026.',
      ],
      analisisBatasPage1: [
        'Semua pengukuran arus baik pada fase U, V, maupun W berada jauh di bawah ambang batas High Alarm dan High Trip.',
        'Nilai maksimum arus selama bulan tidak mendekati batas operasional maksimum pada transformator.',
        'Tidak ditemukan pelanggaran batas selama periode pemantauan untuk semua fase, sesuai dengan data pelanggaran batas.',
      ],
      analisisBatasPage2: [],
      analisisAnomali: [
        'Beberapa anomali lonjakan singkat (spike positif dan negatif) terdeteksi pada tanggal dan jam yang sama untuk semua fase.',
        'Anomali diidentifikasi pada 04 Agustus 2026 pukul 06:10–06:30 dan 13:10–13:40 sebagai contoh, dan terjadi pada beberapa kesempatan lain sepanjang bulan.',
        'Durasi anomali sangat singkat—umumnya kurang dari setengah jam—dan semua tetap di bawah batas alarm dan trip.',
        'Anomali serupa dialami oleh semua fase, dengan pola terjadi secara bersamaan, menunjukkan tidak ada fase yang mengalami gangguan lebih dari yang lain.',
      ],
    },
    {
      subNumber: '3.3. Active Power',
      chart: {
        title: ` `,
        yLabel: 'Power (W)',
        yMin: 0,
        yMax: 250000,
        yTicks: [0, '50k', '100k', '150k', '200k'],
        type: 'three_phase',
        valU: stats.activePower?.u?.avg ?? 113886.29,
        valV: stats.activePower?.v?.avg ?? 102621.16,
        valW: stats.activePower?.w?.avg ?? 96171.26,
      },
      rows: [
        ['U', stats.activePower?.u?.min ?? 0.0, stats.activePower?.u?.avg ?? 113886.29, stats.activePower?.u?.max ?? 223457.53],
        ['V', stats.activePower?.v?.min ?? 0.0, stats.activePower?.v?.avg ?? 102621.16, stats.activePower?.v?.max ?? 211933.33],
        ['W', stats.activePower?.w?.min ?? 0.0, stats.activePower?.w?.avg ?? 96171.26, stats.activePower?.w?.max ?? 193764.38],
      ],
      analisisUmum: [
        'Daya aktif ketiga fase meningkat dan menurun secara konsisten setiap hari, mencerminkan pola konsumsi energi yang tipikal selama periode puncak dan rendah.',
        'Adanya kecenderungan peningkatan beban total dari minggu ke minggu sepanjang bulan Agustus, menunjukkan potensi peningkatan aktivitas atau konsumsi energi.',
        'Pola fluktuasi harian yang seragam menunjukkan keseimbangan yang cukup baik antar fase, meskipun terdapat variasi kecil dalam ketinggian puncak daya.',
        'Ada perbedaan kecil namun nyata dalam pembagian beban, terutama fase U cenderung mencapai puncak daya yang lebih tinggi dibanding fase lainnya.',
        'Meski mengalami beberapa fluktuasi tajam, pola total tetap mempertahankan karakteristik yang dapat diprediksi dengan siklus harian yang jelas.',
      ],
      analisisBatasPage1: [
        'Nilai daya aktif pada puncaknya berada dalam batas aman transformator, jauh di bawah kapasitas maksimal 3.000.000 W.',
        'Transformator tidak menunjukkan indikasi pembebanan berlebih, semua puncak tetap dalam batas operasi yang aman tanpa melewati batas desain pabrikan.',
      ],
      analisisBatasPage2: [
        'level fluktuasi mendadak tetap dalam batas toleransi operasional, tidak pada level yang berisiko merusak atau menimbulkan masalah teknis.',
      ],
      analisisAnomali: [
        'Fase U mengalami 28 anomali dalam bentuk lonjakan dan penurunan tajam, namun sebagian besar insiden ini berlangsung singkat dan menyebar sepanjang bulan.',
        'Fase V mengalami sejumlah besar anomali overload yang signifikan, mengindikasikan frekuensi tinggi dari perubahan mendadak dalam beban, menciptakan kesulitan dalam pemetaan detil.',
        'Fase W memiliki anomali serupa dengan fase U, menunjukkan spike pada titik waktu dan tanggal yang mirip namun dengan variasi kejadian yang berbeda di beberapa momen.',
        'Anomali tidak terfokus pada hari atau minggu tertentu, menunjukkan bahwa kejadian tersebut bukan hasil dari satu kondisi spesifik melainkan variasi operasional yang tersebar luas.',
        'Anomali lebih banyak terjadi pada fase U dan W dengan durasi umumnya antara 10 hingga 30 menit, salah satu indikasi dinamisnya kondisi jaringan.',
      ],
    },
    {
      subNumber: '3.4. Reactive Power',
      chart: {
        title: ` `,
        yLabel: 'Power (VAR)',
        yMin: -20000,
        yMax: 140000,
        yTicks: ['-20k', '0', '20k', '40k', '60k', '80k', '100k', '120k'],
        type: 'three_phase',
        valU: stats.reactivePower?.u?.avg ?? 48719.29,
        valV: stats.reactivePower?.v?.avg ?? 51965.73,
        valW: stats.reactivePower?.w?.avg ?? 48789.28,
      },
      rows: [
        ['U', stats.reactivePower?.u?.min ?? -13259.46, stats.reactivePower?.u?.avg ?? 48719.29, stats.reactivePower?.u?.max ?? 113397.26],
        ['V', stats.reactivePower?.v?.min ?? -14054.55, stats.reactivePower?.v?.avg ?? 51965.73, stats.reactivePower?.v?.max ?? 123375.34],
        ['W', stats.reactivePower?.w?.min ?? -16448.0, stats.reactivePower?.w?.avg ?? 48789.28, stats.reactivePower?.w?.max ?? 117901.37],
      ],
      analisisUmum: [
        'Ketiga fase menunjukkan pola fluktuasi harian yang konsisten dengan tren naik turun yang tajam, mengindikasikan adanya variasi yang signifikan pada beban atau kondisi operasional.',
        'Hampir setiap hari terdapat puncak dan penurunan tajam di semua fase, menandakan adanya transisi operasi atau perubahan beban yang cepat.',
        'Meskipun fluktuatif, tren keseluruhan untuk daya reaktif pada ketiga fase relatif stabil, tanpa adanya peningkatan atau penurunan yang signifikan sepanjang bulan.',
        'Rentang nilai daya reaktif pada ketiga fase menunjukkan keseimbangan yang baik, dengan perbedaan kecil di antara puncak dan lembah masing-masing fase.',
        'Fase V dan W cenderung mencapai nilai puncak yang sedikit lebih tinggi dibandingkan fase U, namun pola naik turun serupa terjadi di ketiga fase.',
      ],
      analisisBatasPage1: [
        'Tidak ada pelanggaran batas Low/High Trip atau Alarm yang dilaporkan sepanjang periode pengamatan.',
        'Daya reaktif berada dalam rentang operasional pada transformator, mengonfirmasi bahwa operasional tetap dalam kondisi normal.',
      ],
      analisisBatasPage2: [
        'Nilai daya semu, meskipun fluktuatif, tidak mencapai batas desain yang dapat memberikan indikasi terhadap potensi risiko.',
      ],
      analisisAnomali: [
        'Anomali berupa spike dan drop terjadi sangat sering pada ketiga fase, menunjukkan reaksi cepat terhadap perubahan beban atau kondisi sistem.',
        'Tanggal 2-3, 7-8, dan 26-27 menunjukkan anomali signifikan di mana daya semu turun mendekati nol secara bersamaan di ketiga fase.',
        'Anomali spike dan drop cepat dan tajam tidak menunjukkan pergeseran tren signifikan, melainkan merupakan pola operasi yang sering terjadi.',
        'Anomali relatif merata di antara ketiga fase, mengindikasikan respons sistem yang seragam terhadap fluktuasi operasional.',
      ],
    },
    {
      subNumber: '3.5. Apparent Power',
      chart: {
        title: ` `,
        yLabel: 'Power (VA)',
        yMin: 0,
        yMax: 70,
        yTicks: [0, 10, 20, 30, 40, 50, 60],
        type: 'three_phase',
        valU: stats.apparentPower?.u?.avg ?? 31.54,
        valV: stats.apparentPower?.v?.avg ?? 29.36,
        valW: stats.apparentPower?.w?.avg ?? 27.73,
      },
      rows: [
        ['U', stats.apparentPower?.u?.min ?? 0.0, stats.apparentPower?.u?.avg ?? 31.54, stats.apparentPower?.u?.max ?? 62.22],
        ['V', stats.apparentPower?.v?.min ?? 0.0, stats.apparentPower?.v?.avg ?? 29.36, stats.apparentPower?.v?.max ?? 61.42],
        ['W', stats.apparentPower?.w?.min ?? 0.0, stats.apparentPower?.w?.avg ?? 27.73, stats.apparentPower?.w?.max ?? 56.32],
      ],
      analisisUmum: [
        'Pola fluktuasi harian menunjukkan adanya pergerakan daya semu yang konsisten terkait penggunaan beban secara periodik, dengan puncak di awal hingga pertengahan hari. Penurunan mengikuti menjelang akhir hari.',
        'Tren keseluruhan menunjukkan peningkatan daya semu bulanan secara bertahap, namun lonjakan tertinggi tetap dalam kisaran harian yang serupa.',
        'Rentang operasi berada jauh di bawah batas daya transformator, mengindikasikan tidak adanya risiko overload.',
        'Fase V umumnya menunjukkan nilai tertinggi, sementara fase U dan W bervariasi serupa dengan sedikit perbedaan tajam sesekali.',
      ],
      analisisBatasPage1: [
        'Selama bulan Agustus, tidak ada kejadian yang menunjukkan pelanggaran terhadap batas operasional transformator seperti Low/High Trip atau Alarm.',
        'Operasional daya semu tetap dalam rentang aman, tidak mendekati nilai nominal maksimum 3000 VA dari transformator.',
      ],
      analisisBatasPage2: [],
      analisisAnomali: [
        'Spike terdeteksi sering di fase U dan W, terutama antara 4-29 Agustus, menandakan perubahan beban mendadak dan berulang dalam waktu singkat, umumnya 10-30 menit.',
        'Fase V menunjukkan frekuensi spike yang lebih tinggi sehingga deteksi anomali sulit dirinci, menandakan ketidakstabilan lebih sering pada beban fase ini.',
        'Anomali ini berpotensi mencerminkan adanya switching cepat atau fluktuasi beban mendadak, tetapi tidak menunjukkan dampak jangka panjang yang memengaruhi kestabilan keseluruhan sistem.',
      ],
    },
    {
      subNumber: '3.6. Power Factor',
      chart: {
        title: ` `,
        yLabel: 'Factor',
        yMin: 0,
        yMax: 1,
        yTicks: [0, 0.2, 0.4, 0.6, 0.8, 1],
        lowTrip: Number(s.powerFactorLowTripTreshold || 0.5),
        lowAlarm: Number(s.powerFactorLowAlarmTreshold || 0.75),
        type: 'three_phase',
        valU: stats.powerFactor?.u?.avg ?? 0.87,
        valV: stats.powerFactor?.v?.avg ?? 0.83,
        valW: stats.powerFactor?.w?.avg ?? 0.82,
      },
      rows: [
        ['U', stats.powerFactor?.u?.min ?? 0.0, stats.powerFactor?.u?.avg ?? 0.87, stats.powerFactor?.u?.max ?? 0.98],
        ['V', stats.powerFactor?.v?.min ?? 0.0, stats.powerFactor?.v?.avg ?? 0.83, stats.powerFactor?.v?.max ?? 0.97],
        ['W', stats.powerFactor?.w?.min ?? 0.0, stats.powerFactor?.w?.avg ?? 0.82, stats.powerFactor?.w?.max ?? 0.97],
      ],
      analisisUmum: [
        'Ketiga fase menunjukkan fluktuasi harian yang jelas dengan amplitudo bervariasi. Stabilitas lebih terjaga pada pertengahan bulan dibandingkan awal dan akhir bulan.',
        'Kecenderungan peningkatan power factor terlihat di ketiga fase. Namun tetap ada penurunan mendadak yang menurunkan rata-rata di beberapa titik.',
        'Secara umum, rentang nilai power factor berada dalam kategori efisien. Namun fase W sering kali menunjukkan penurunan mendadak.',
      ],
      analisisBatasPage1: [
        'Nilai power factor ketiga fase mengalami beberapa kali pelanggaran dengan fase W paling sering dan parah melewati Low Trip.',
        'Fase U paling jarang melebihi batas, sementara fase V dan W sering melebihi batas Low Alarm dan bahkan Low Trip.',
        'Fase V dan W memiliki durasi pelanggaran batas signifikan dengan frekuensi 16 kali, menunjukkan efisiensi yang berkurang.',
      ],
      analisisBatasPage2: [],
      analisisAnomali: [
        'Pada fase U, tanggal-tanggal dengan spike signifikan terjadi seperti pada 1, 2, 3, 4, 5, dan 6 Agustus dengan episode naik dan turun.',
        'Fase W menunjukkan anomali besar dengan nilai power factor mendekati nol pada awal bulan, mengindikasikan efisiensi sangat rendah pada periode tersebut.',
        'Fase V dan W mengalami anomali spike dan drop berulang kali, membuat nilai power factor sering kali keluar dari batas normal.',
      ],
    },
    {
      subNumber: '3.7. Frequency',
      chart: {
        title: ` `,
        yLabel: 'Frequency (Hz)',
        yMin: 0,
        yMax: 55,
        yTicks: [0, 10, 20, 30, 40, 50],
        highTrip: Number(s.frequencyHighTripTreshold || 52.0),
        highAlarm: Number(s.frequencyHighAlarmTreshold || 55.0),
        lowAlarm: Number(s.frequencyLowAlarmTreshold || 45.0),
        lowTrip: Number(s.frequencyLowTripTreshold || 42.5),
        type: 'single',
        valU: stats.frequency?.avg ?? 47.59,
      },
      rows: [
        [stats.frequency?.min ?? 0.0, stats.frequency?.avg ?? 47.59, stats.frequency?.max ?? 50.09]
      ],
      analisisUmum: [
        'Fluktuasi frekuensi yang signifikan terjadi pada awal bulan, dengan perubahan mendadak antara nilai mendekati nol dan nilai nominal.',
        'Setelah tanggal 4 Agustus, frekuensi menunjukkan stabilitas yang sangat baik, dengan sedikit atau tanpa fluktuasi yang berarti, mendekati stabilitas operasional.',
        'Tren keseluruhan menunjukkan kestabilan yang baik setelah gangguan awal, cenderung tidak terdistorsi oleh fluktuasi setelah koreksi.',
        'Selama periode stabil, operasi mendekati spesifikasi frekuensi 50 Hz, menjaga kriteria operasi normal.',
        'Keseragaman di antara fase diasumsikan, dan tidak ada indikasi ketidakseimbangan antar fase yang terlihat dari grafik.',
      ],
      analisisBatasPage1: [
        'Pada tanggal 2 hingga 4 Agustus, frekuensi jatuh di bawah batas Low Trip, menandakan pelanggaran signifikan terhadap batas operasional bawah.',
        'Tidak ada kenaikan yang mencapai batas High Alarm atau High Trip selama bulan, menunjukkan kontrol yang baik pada ujung atas batas frekuensi.',
        'Setelah tanggal 4 Agustus, tidak ada pelanggaran batas terdeteksi dalam grafik, menunjukkan operasi yang konsisten dalam rentang yang aman.',
        'Durasi kumulatif pelanggaran batas terjadi selama 1 hari 12 jam 15 menit dengan dua kejadian, sepenuhnya terjadi di awal bulan.',
      ],
      analisisBatasPage2: [],
      analisisAnomali: [
        'Anomali terjadi antara tanggal 2 dan 4 Agustus, dengan penurunan frekuensi yang drastis, mendekati nol pada beberapa saat, mengindikasikan ketidakstabilan serius.',
        'Frekuensi sering turun di bawah batas Low Trip secara berulang dalam periode tersebut, menunjukkan gangguan yang membutuhkan perhatian khusus.',
        'Setelah tanggal 4 Agustus, tidak ditemukan anomali lain, frekuensi tetap stabil dan dalam batas yang diperbolehkan.',
        'Ujung bawah frekuensi mengalami banyak spikes selama anomali, yang tidak terjadi setelah koreksi pasca tanggal 4 Agustus.',
      ],
    },
    {
      subNumber: '3.8. Neutral Current',
      chart: {
        title: ` `,
        yLabel: 'Current (A)',
        yMin: 0,
        yMax: 180,
        yTicks: [0, 20, 40, 60, 80, 100, 120, 140, 160, 180],
        highTrip: Number(s.IneutralHighTripTreshold || 175.0),
        highAlarm: Number(s.IneutralHighAlarmTreshold || 125.0),
        type: 'single',
        valU: stats.neutralCurrent?.avg ?? 0.37,
      },
      rows: [
        [stats.neutralCurrent?.min ?? 0.0, stats.neutralCurrent?.avg ?? 0.37, stats.neutralCurrent?.max ?? 0.83]
      ],
      analisisUmum: [
        'Arus netral stabil hari demi hari, dengan fluktuasi harian yang tidak signifikan dan mendekati nol.',
        'Tidak ada tren kenaikan atau penurunan yang terlihat sepanjang bulan, menunjukkan kestabilan operasional.',
        'Pola mendatar dari awal hingga akhir bulan mengindikasikan tidak ada perubahan performa transformator.',
      ],
      analisisBatasPage1: [
        'Selama bulan pengamatan, nilai arus netral tetap jauh di bawah batas “High Alarm” dan “High Trip”, menunjukkan operasi yang aman.',
        'Tidak ada indikasi bahwa arus medekati atau melebihi batas preset pabrik, menandakan operasi yang stabil.',
        'Batas yang ditentukan tidak pernah tercapai atau terlampaui, menunjukan operasional dalam keadaan baik.',
      ],
      analisisBatasPage2: [],
      analisisAnomali: [
        'Anomali arus netral dalam bentuk spike tercatat beberapa kali di awal bulan, namun tidak berkelanjutan.',
        'Lonjakan dan penurunan tajam terjadi pada periode singkat di awal bulan, tetapi tidak mempengaruhi kestabilan secara keseluruhan.',
        'Anomali ini bersifat sementara dan tidak menyebabkan perubahan pada rentang arus yang mengarah ke kondisi kritis.',
      ],
    },
    {
      subNumber: '3.9. Energy',
      chart: {
        title: ` `,
        yLabel: 'Energy (Wh/Varh)',
        yMin: 1400000,
        yMax: 2800000,
        yTicks: ['1.4M', '1.6M', '1.8M', '2.0M', '2.2M', '2.4M', '2.6M', '2.8M'],
        type: 'energy',
        valU: stats.energy?.active?.avg ?? 2669899.79,
        valV: stats.energy?.reactive?.avg ?? 1351605.76,
      },
      rows: [
        ['Active Energy', stats.energy?.active?.min ?? 2559004.43, stats.energy?.active?.avg ?? 2669899.79, stats.energy?.active?.max ?? 2792004.12],
        ['Reactive Energy', stats.energy?.reactive?.min ?? 1294683.21, stats.energy?.reactive?.avg ?? 1351605.76, stats.energy?.reactive?.max ?? 1408627.75],
      ],
      analisisUmum: [
        'Energi aktif naik konsisten sepanjang bulan dengan fluktuasi harian kecil sehingga garis hampir linear, mengindikasikan pemakaian seragam yang stabil.',
        'Energi reaktif juga mengalami kenaikan setiap hari, namun dengan gradien yang lebih kecil dibandingkan energi aktif, menggambarkan bahwa energi aktif mendominasi.',
        'Jarak antara energi aktif dan energi reaktif tetap konstan dan lebar, mencerminkan operasi yang stabil dan sesuai dengan kondisi ideal transformator.',
        'Tidak ada perubahan mendadak dalam hubungan proporsional antara energi aktif dan reaktif, menunjukkan stabilitas sistem.',
      ],
      analisisBatasPage1: [
        'Sepanjang bulan tidak ada penanda atau kasus energi aktif maupun energi reaktif yang mendekati batas abnormal.',
        'Dalam rentang yang dicatat, energi aktif selalu lebih tinggi dari energi reaktif, yang merupakan kondisi operasi yang ideal.',
        'Tidak ada batas low/high trip atau alarm yang tersentuh berdasarkan data dan spesifikasi transformator yang diberikan.',
      ],
      analisisBatasPage2: [],
      analisisAnomali: [
        'Anomali positif terjadi pada 2 Agustus 2026 pukul 00:00–00:30 untuk kedua energi, di mana terjadi lonjakan singkat sebelum kembali ke pola normal.',
        'Terdapat anomali negatif pada 30 Agustus 2026 pukul 00:00 untuk kedua energi, dengan penurunan singkat yang tidak memengaruhi tren keseluruhan.',
        'Anomali negatif lainnya muncul pada 31 Agustus 2026 pukul 00:00–00:30, secara singkat memengaruhi kedua energi sebelum sistem pulih ke keadaan normal.',
        'Hanya ada tiga kejadian anomali yang tercatat, di luar itu tidak ditemukan kelainan signifikan pada grafik energi.',
      ],
    },
    {
      subNumber: '3.10. Current Total Harmonic Distortion',
      chart: {
        title: ` `,
        yLabel: 'THD (%)',
        yMin: 0,
        yMax: 100,
        yTicks: [0, 20, 40, 60, 80, 100],
        highTrip: Number(s.thdCurrentTripTreshold || 80.0),
        highAlarm: Number(s.thdCurrentAlarmTreshold || 75.0),
        type: 'three_phase',
        valU: stats.thdCurrent?.u?.avg ?? 15.79,
        valV: stats.thdCurrent?.v?.avg ?? 19.87,
        valW: stats.thdCurrent?.w?.avg ?? 22.42,
      },
      rows: [
        ['U', stats.thdCurrent?.u?.min ?? 0.0, stats.thdCurrent?.u?.avg ?? 15.79, stats.thdCurrent?.u?.max ?? 57.9],
        ['V', stats.thdCurrent?.v?.min ?? 0.0, stats.thdCurrent?.v?.avg ?? 19.87, stats.thdCurrent?.v?.max ?? 89.16],
        ['W', stats.thdCurrent?.w?.min ?? 0.0, stats.thdCurrent?.w?.avg ?? 22.42, stats.thdCurrent?.w?.max ?? 96.69],
      ],
      analisisUmum: [
        'Setiap fase memperlihatkan fluktuasi harian yang tajam dan periodik, menunjukkan lonjakan tinggi serta penurunan mendadak setiap hari, terutama pada rentang waktu tertentu.',
        'Secara keseluruhan, trend harmonis terlihat stabil sepanjang bulan tanpa kecenderungan perubahan signifikan pada arah akhir bulan.',
        'THD tiga fase menunjukkan pola yang sinkron, namun fase W memiliki puncak yang lebih tinggi dibandingkan fase U dan V.',
        'Puncak harian tercatat setiap hari, menandakan pola beban harmonik rutin pada setiap fase.',
        'Fase U secara konsisten menunjukkan nilai THD lebih rendah dibandingkan dengan dua fase lainnya.',
      ],
      analisisBatasPage1: [
        'Fase U tidak mencatat pelanggaran terhadap batas alarm atau trip sepanjang bulan.',
        'Fase V mengalami beberapa pelanggaran, dengan durasi total 11 jam 45 menit, beberapa di antaranya mendekati atau melebihi batas trip.',
      ],
      analisisBatasPage2: [
        'Fase W mencatat pelanggaran tertinggi dengan durasi total 13 jam, sering mencapai atau melewati batas trip.',
        'Tidak ada catatan pelanggaran batas bawah, karena pengaturan batas hanya ada untuk atas.',
      ],
      analisisAnomali: [
        'Fase V melampaui batas sebanyak 7 kali, menyebabkan THD beberapa kali melebihi batas alarm dan kadang berada di dekat batas trip.',
        'Fase W mencatat 8 kali pelanggaran, bagian nilai THD beberapa kali melampaui bahkan sedikit melewati batas trip tertinggi.',
        'Rentetan spike konsisten terjadi pada hampir setiap hari, khususnya di fase V dan W, menunjukkan anomali harmonik terdeteksi seringkali di dekat batas alarm dan trip.',
        'Fase U tidak mengalami kejadian anomali pelanggaran batas.',
        'Tidak ada anomali berupa penurunan dramatis yang melanggar batas bawah sesuai konfigurasi yang ada.',
      ],
    },
    {
      subNumber: '3.11. Voltage Total Harmonic Distortion',
      chart: {
        title: ` `,
        yLabel: 'THD (%)',
        yMin: 0,
        yMax: 10,
        yTicks: [0, 2, 4, 6, 8, 10],
        highTrip: Number(s.thdVoltageTripTreshold || 10.0),
        highAlarm: Number(s.thdVoltageAlarmTreshold || 5.0),
        type: 'three_phase',
        valU: stats.thdVoltage?.u?.avg ?? 3.31,
        valV: stats.thdVoltage?.v?.avg ?? 3.16,
        valW: stats.thdVoltage?.w?.avg ?? 3.17,
      },
      rows: [
        ['U', stats.thdVoltage?.u?.min ?? 0.0, stats.thdVoltage?.u?.avg ?? 3.31, stats.thdVoltage?.u?.max ?? 4.62],
        ['V', stats.thdVoltage?.v?.min ?? 0.0, stats.thdVoltage?.v?.avg ?? 3.16, stats.thdVoltage?.v?.max ?? 4.58],
        ['W', stats.thdVoltage?.w?.min ?? 0.0, stats.thdVoltage?.w?.avg ?? 3.17, stats.thdVoltage?.w?.max ?? 4.58],
      ],
      analisisUmum: [
        'Fluktuasi harian THD pada ketiga fase menunjukkan pola yang cukup teratur dan konsisten sepanjang bulan, dengan puncak dan penurunan yang mirip di setiap fase.',
        'THD cenderung mengikuti siklus harian yang jelas, dengan peningkatan pada waktu tertentu diikuti oleh penurunan.',
        'Tren keseluruhan bulan menunjukkan kestabilan dengan nilai THD yang konsisten dan tanpa perubahan signifikan dalam pola keseluruhan dari ketiga fase.',
        'Variasi antara ketiga fase tidak mencolok, meski fase W cenderung menunjukkan sedikit lebih banyak variasi dibandingkan U dan V pada beberapa waktu.',
      ],
      analisisBatasPage1: [
        'Tidak ditemukan pelanggaran batas High Alarm ataupun High Trip di semua fase sepanjang bulan, menunjukkan operasi berada dalam kontrol yang baik.',
        'Semua fase memenuhi spesifikasi operasional yang diatur oleh batas pengaturan internal pabrik transformator.',
        'Nilai THD seluruh fase tetap dalam rentang 2% hingga 4,5%, nyaman di bawah batas alarm dan trip yang ditentukan.',
      ],
      analisisBatasPage2: [],
      analisisAnomali: [
        'Pada awal bulan, banyak terjadi spike pada ketiga fase, terutama antara 01-06 Agustus yang menunjukkan perubahan mendadak baik naik maupun turun.',
        'Anomali khusus terlihat pada tanggal 02 Agustus yang memperlihatkan penurunan sementara pada fase W mendekati 0%.',
        'Spike sementara pada tanggal 15 Agustus pukul 06:00-06:10 terjadi di semua fase, meskipun singkat dan tidak menimbulkan pelanggaran batas.',
        'Meskipun ada beberapa spike harian terutama pada awal bulan, semuanya tetap dalam ambang normal dan tidak menimbulkan ketidakstabilan signifikan.',
      ],
    },
    {
      subNumber: '3.12. k-Rated',
      chart: {
        title: ` `,
        yLabel: 'k-Rated',
        yMin: 0,
        yMax: 25,
        yTicks: [0, 5, 10, 15, 20, 25],
        type: 'three_phase',
        valU: stats.kRated?.u?.avg ?? 1.81,
        valV: stats.kRated?.v?.avg ?? 2.46,
        valW: stats.kRated?.w?.avg ?? 3.0,
      },
      rows: [
        ['U', stats.kRated?.u?.min ?? 1.0, stats.kRated?.u?.avg ?? 1.81, stats.kRated?.u?.max ?? 9.0],
        ['V', stats.kRated?.v?.min ?? 1.0, stats.kRated?.v?.avg ?? 2.46, stats.kRated?.v?.max ?? 21.0],
        ['W', stats.kRated?.w?.min ?? 1.0, stats.kRated?.w?.avg ?? 3.0, stats.kRated?.w?.max ?? 26.0],
      ],
      analisisUmum: [
        'Fluktuasi k-rated harian sering terjadi dengan puncak acak di ketiga fase, terutama pagi hingga siang hari, mengindikasikan beban non-linier sesaat.',
        'Tren keseluruhan memperlihatkan k-rated stabil di nilai rendah rata-rata harian, tetapi sering terganggu lonjakan, terutama pada fase W.',
        'K-rated lebih sering berada di kisaran rendah meskipun ada fluktuasi besar hingga lebih dari 25 pada fase W.',
        'Terdapat ketidakseimbangan nyata antar fase, dengan W menunjukkan lonjakan terbesar dan paling sering, diikuti oleh V dan U yang lebih stabil.',
      ],
      analisisBatasPage1: [
        'Tidak ada batas yang ditentukan untuk k-rated, sehingga semua fluktuasi termasuk lonjakan tinggi dianggap operasional.',
        'Ketiadaan batas khusus dari pabrik atau pengaturan berarti pengoperasian berdasar pengamatan pola grafik tanpa referensi resmi batas aman.',
      ],
      analisisBatasPage2: [],
      analisisAnomali: [
        'Pada fase U, beberapa anomali berupa spike ke atas dan ke bawah terdeteksi terutama pada tanggal 5, 9, 10, 13, 16, 17, 18, 19, 22, 24, 25, 26, 29, dan 30 Agustus.',
        'Fase V dan W mengalami frekuensi spike anomali yang sangat tinggi, menunjukkan ketidakstabilan beban non-linier yang lebih parah dibanding fase U.',
        'Anomali menunjukkan pola lonjakan di pagi dan malam yang bisa dikaitkan dengan perubahan beban harian yang tidak linier.',
      ],
    },
  ];

  electricalSections.forEach((sec, idx) => {
    const startSecPage = doc.internal.getNumberOfPages() + 1;
    addNewPage();

    if (idx === 0) sectionPages['3'] = doc.internal.getNumberOfPages();
    const secKey = sec.subNumber.split(' ')[0];
    sectionPages[secKey] = doc.internal.getNumberOfPages();

    let curY = 32;
    if (sec.secNumber) {
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(14);
      doc.setTextColor(17, 24, 39);
      doc.text(sec.secNumber, 22, curY);
      curY += 7;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(17, 24, 39);
    doc.text(sec.subNumber, 22, curY);

    drawParamChart(doc, { ...sec.chart, x: 22, y: curY + 4, w: 166, h: 48 });

    const tableY = curY + 56;
    const isSingleRow = sec.rows.length === 1 && sec.rows[0].length === 3;
    autoTable(doc, {
      startY: tableY,
      margin: { left: 45, right: 45 },
      head: [isSingleRow ? ['Min', 'Average', 'Max'] : ['', 'Min', 'Average', 'Max']],
      body: sec.rows,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, halign: 'center', textColor: [30, 41, 59] },
      headStyles: { fillColor: [41, 114, 204], textColor: 255, fontStyle: 'bold', halign: 'center' },
      willDrawPage: (h) => {
        if (h.pageNumber > 1) drawHeaderAndFooter(doc, bgImg, bndLogo, tmuLogo);
      }
    });

    let textY = doc.lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(17, 24, 39);
    doc.text('Analisis umum', 22, textY);
    textY += 5;

    sec.analisisUmum.forEach((u) => {
      textY = printBullet(doc, u, 22, textY, 166, '• ', addNewPage);
    });

    if (sec.analisisBatasPage1 && sec.analisisBatasPage1.length > 0) {
      textY += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(17, 24, 39);
      if (textY + 8 > 260) textY = addNewPage();
      doc.text('Analisis batas', 22, textY);
      textY += 5;
      sec.analisisBatasPage1.forEach((b) => {
        textY = printBullet(doc, b, 22, textY, 166, '• ', addNewPage);
      });
    }

    let p2Y = textY + 3;
    if (doc.internal.getNumberOfPages() === startSecPage) {
      p2Y = addNewPage();
    } else if (p2Y + 25 > 260) {
      p2Y = addNewPage();
    }

    if (sec.analisisBatasPage2 && sec.analisisBatasPage2.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(17, 24, 39);
      doc.text('Analisis batas', 22, p2Y);
      p2Y += 5;
      sec.analisisBatasPage2.forEach((b) => {
        p2Y = printBullet(doc, b, 22, p2Y, 166, '• ', addNewPage);
      });
      p2Y += 3;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(17, 24, 39);
    if (p2Y + 8 > 260) p2Y = addNewPage();
    doc.text('Analisis anomali', 22, p2Y);
    p2Y += 5;

    sec.analisisAnomali.forEach((a) => {
      p2Y = printBullet(doc, a, 22, p2Y, 166, '• ', addNewPage);
    });
  });

  addNewPage();
  sectionPages['4'] = doc.internal.getNumberOfPages();
  sectionPages['4.1'] = doc.internal.getNumberOfPages();

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text('4. Penutup', 22, 36);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('4.1. Kesimpulan', 22, 44);

  let cY = 52;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Kesimpulan analisis umum:', 22, cY);
  cY += 5;
  const kUmum = 'Pola sistem menunjukkan dua rezim: gangguan sistemik singkat pada 2–4 Agustus ketika tegangan dan frekuensi turun hampir nol serempak di semua fase, lalu operasi kembali stabil dan seimbang hingga akhir bulan. Kestabilan arus, suhu busbar/lilitan/oli yang rendah dan seragam, serta tekanan tangki yang mendatar menegaskan tidak adanya stres termal maupun masalah internal transformator. Kenaikan beban aktif bertahap terjadi tanpa indikasi overload, sementara penurunan efisiensi faktor daya dan lonjakan harmonik arus dominan pada fase V dan W mengindikasikan pengaruh kuat beban non‑ linier/switching di sisi beban. Korelasi “THDi tinggi (V/W) + kRated spike + PF turun” dengan “THDv tetap rendah” menempatkan sumber gangguan pada arus beban, bukan pada kualitas tegangan suplai.';
  cY = printParagraph(doc, kUmum, 22, cY, 166, addNewPage);
  cY += 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  if (cY + 8 > 260) cY = addNewPage();
  doc.text('Kesimpulan analisis batas:', 22, cY);
  cY += 5;
  const kBatas = 'Pelanggaran batas paling kritis terjadi pada 2–4 Agustus ketika tegangan dan frekuensi jatuh di bawah Low Trip secara serempak, mencerminkan kehilangan sumber/penyaluran sistemik yang singkat. Di luar itu, batas termal (busbar, winding, oil) dan beban (arus, daya aktif/reaktif/semi) tidak terancam, menunjukkan margin operasi yang luas terhadap High Alarm/High Trip. Pelanggaran batas berulang justru muncul pada Power Factor (terutama fase V dan W) serta Current THD (fase V dan W, durasi signifikan), sedangkan Voltage THD tetap nyaman di bawah ambang. Dengan arus dan temperatur aman, pelanggaran batas efisiensi dan harmonik tidak dipicu oleh pembebanan berlebih, melainkan karakteristik beban non‑ linier dan ketidaksempurnaan kompensasi daya reaktif pada fase tertentu.';
  cY = printParagraph(doc, kBatas, 22, cY, 166, addNewPage);
  cY += 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  if (cY + 8 > 260) cY = addNewPage();
  doc.text('Kesimpulan analisis anomali:', 22, cY);
  cY += 5;
  let kAnomali = 'Anomali utama bersifat sistemik pada 2–4 Agustus: tegangan dan frekuensi turun mendekati nol, disertai kolapsnya daya semu/reaktif dan PF mendekati nol serta jejak anomali energi dan arus netral di periode yang sama, menunjukkan hilangnya energisasi jaringan hulu alih‑ alih isu fasial. Pasca 4 Agustus, anomali didominasi spike/drop singkat yang sinkron lintas fase pada arus, daya aktif/reaktif/semi, dan sedikit jejak pada winding temperature, konsisten dengan pola switching beban harian. Fase V dan W berulang kali menampilkan PF drop dan lonjakan Current THD hingga melampaui ambang, sementara Voltage THD tetap normal; konsistensi pola ini menguatkan dugaan injeksi harmonik dari beban non‑ linier sebagai penyebab utama, bukan distorsi tegangan suplai. Pola k‑ Rated yang melonjak pagi–malam dan sebaran spike harian mempertegas sifat intermiten dan berbasis siklus operasi beban sebagai pemicu anomali lanjutan.';
  if (Array.isArray(data?.activeAnomalies) && data.activeAnomalies.length > 0) {
    kAnomali += ' Teridentifikasi juga anomali aktif pada pemantauan real-time: ' +
      data.activeAnomalies.map((a) => `${a.label} (${a.value !== null ? a.value + ' ' + (a.unit || '') : 'N/A'} - ${a.level?.toUpperCase()})`).join(', ') + '.';
  }
  cY = printParagraph(doc, kAnomali, 22, cY, 166, addNewPage);

  addNewPage();
  sectionPages['4.2'] = doc.internal.getNumberOfPages();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(17, 24, 39);
  doc.text('4.2. Saran', 22, 36);

  let sY = 43;
  const allSaran = [
    'Telusuri akar penyebab gangguan sistemik 2–4 Agustus dengan mengekstrak event log SCADA, rekaman relay (DFR), dan status pemutus dari gardu hulu; konfirmasi apakah terjadi kehilangan suplai, switching jaringan, atau proteksi underfrequency/undervoltage yang bekerja serempak.',
    'Lakukan uji fungsi dan kaji ulang koordinasi setting underfrequency/undervoltage (setpoint, time delay, dan interlock) agar kejadian serupa tidak memicu trip berantai di sisi beban; pastikan sinkronisasi jam perangkat agar penelusuran kejadian akurat.',
    'Jika trafo dilengkapi OLTC, tinjau setting AVR (deadband, bandwidth, dan kecepatan tap) untuk memastikan tegangan pasca-4 Agustus tetap jauh dari batas alarm tanpa hunting; pastikan histori tap-change selaras dengan profil beban.',
    'Lakukan audit beban non‑ linier per feeder dengan fokus pada fase V dan W (VFD, rectifier, UPS, welder, dsb.) untuk memetakan sumber utama Current THD tinggi dan penurunan Power Factor; jadwalkan pengukuran portable Power Quality Analyzer pada jam puncak pagi dan sore.',
    'Periksa kesehatan dan konfigurasi kapasitor bank/PFC controller: kondisi fuse dan contactor/thyristor, kecukupan kapasitas per langkah, setpoint target, C/k, CT polarity, dan mode kontrol per‑ fase; lakukan step test untuk memastikan setiap langkah menyala/putus sesuai perintah.',
    'Terapkan kompensasi per‑ fase pada V dan W atau redistribusi beban non‑ linier ke fase U untuk menurunkan ketidakseimbangan PF serta meratakan arus harmonik antar fase.',
    'Pasang atau optimalkan detuned reactor pada kapasitor bank untuk mencegah resonansi, dan pertimbangkan Active Harmonic Filter di bus beban utama V/W bila THDi tetap tinggi; prioritas ditempatkan sedekat mungkin dengan sumber harmonik.',
    'Tambahkan line reactor/DC choke pada VFD berdaya besar dan optimalkan parameter switching agar arus harmonik menurun tanpa mengganggu kinerja proses; verifikasi bahwa prosedur start/stop motor besar tidak bersamaan dengan switching kapasitor bank.',
    'Sinkronkan dan rapikan jadwal switching (motor besar, kapasitor bank, dan beban siklik) untuk mengurangi spike/drop serentak; gunakan zero‑ cross switching dan, bila perlu, pre‑ insertion reactor/resistor untuk meminimalkan transien.',
    'Validasi rantai pengukuran harmonik (kelas CT/VT, burden, scaling) untuk menyingkirkan bias instrumen; pastikan alarm THD dan PF disetel bertingkat (warning sebelum alarm) agar tindakan korektif bisa lebih dini.',
    'Tindaklanjuti penurunan Power Factor berulang pada fase V dan W dengan tindakan perbaikan cepat: perbaiki/ ganti langkah kapasitor yang gagal, aktifkan kontrol per‑ fase, dan koreksi setpoint agar PF tidak jatuh ke zona alarm; lakukan verifikasi hasil melalui trending mingguan.',
    'Gunakan korelasi “THDi tinggi + k‑ Rated spike + PF turun (V/W) dengan THDv normal” sebagai dasar penetapan program mitigasi berbasis sumber (source‑ based), bukan suplai; susun rencana kerja bertahap (audit → quick fix PFC → penyeimbangan beban → filter aktif/pasif).',
    'Atasi anomali energi tengah malam (spike/drop sesaat) dengan verifikasi sinkronisasi waktu meter, rollover register, dan integrasi SCADA; aktifkan data validation di historian untuk menyaring outlier yang bukan kejadian fisik.',
    'Investigasi spike temperatur oli berulang sekitar pukul 07:10: cek kesehatan sensor/RTD, metode sampling logger, serta kemungkinan event terjadwal (start fan/pompa); lakukan cross‑ check pembacaan manual dan kalibrasi bila terindikasi noise instrumen.',
    'Lengkapi pemantauan Oil Level yang belum tersedia: inspeksi level fisik via sight glass, periksa transmitter/float switch, wiring, dan mapping tag SCADA; lakukan kalibrasi dan uji fungsi alarm agar pemantauan keselamatan cairan isolasi kembali andal.',
    'Tinjau sambungan netral dan sistem pembumian (N‑ PE bonding, klem, dan titik ikat) untuk menghilangkan potensi spike arus netral sesaat; lakukan pengencangan koneksi dan termografi sambungan sebagai pencegahan dini.',
    'Dengan temperatur busbar, winding, dan oil stabil serta tekanan tangki normal, lanjutkan perawatan rutin (inspeksi visual, kebersihan sirip pendingin, pengecekan kipas/pompa bila ada, oil sampling/DGA periodik) dan pelihara praktik operasi saat ini.',
    'Pantau tren beban aktif yang meningkat secara bertahap dan tetapkan ambang peringatan dini internal agar rencana penguatan kapasitas/penataan beban dapat disiapkan sebelum margin operasi menyempit.',
    'Jadwalkan tinjauan mingguan terhadap indikator Power Factor, Current THD, dan k‑ Rated per fase sampai tren membaik; eskalasi ke pemasangan filter tambahan bila target penurunan harmonik tidak tercapai dalam periode pengamatan.',
  ];

  if (Array.isArray(data?.activeRecommendations) && data.activeRecommendations.length > 0) {
    const dynamicSaran = data.activeRecommendations.map(
      (r) => `Tindakan Segera [${r.parameterLabel || r.parameter} - ${r.level?.toUpperCase()}]: ${r.action}`
    );
    allSaran.unshift(...dynamicSaran);
  }

  allSaran.forEach((saran) => {
    sY = printBullet(doc, saran, 22, sY, 166, '• ', addNewPage);
  });

  doc.setPage(tocPageNum);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text('TABLE OF CONTENTS', 24, 38);

  const tocItems = [
    { id: '1', title: '1. Transformer Data and Settings', bold: true },
    { id: '1.1', title: '   1.1. Data Transformer', bold: false },
    { id: '1.2', title: '   1.2. Settings Transformer', bold: false },
    { id: '2', title: '2. Physical Deep Analysis', bold: true },
    { id: '2.1.', title: '   2.1. Busbar Temperature', bold: false },
    { id: '2.2.', title: '   2.2. Winding Temperature', bold: false },
    { id: '2.3.', title: '   2.3. Oil Temperature', bold: false },
    { id: '2.4.', title: '   2.4. Oil Level', bold: false },
    { id: '2.5.', title: '   2.5. Tank Pressure', bold: false },
    { id: '3', title: '3. Electrical Deep Analysis', bold: true },
    { id: '3.1.', title: '   3.1. Voltage', bold: false },
    { id: '3.2.', title: '   3.2. Current', bold: false },
    { id: '3.3.', title: '   3.3. Active Power', bold: false },
    { id: '3.4.', title: '   3.4. Reactive Power', bold: false },
    { id: '3.5.', title: '   3.5. Apparent Power', bold: false },
    { id: '3.6.', title: '   3.6. Power Factor', bold: false },
    { id: '3.7.', title: '   3.7. Frequency', bold: false },
    { id: '3.8.', title: '   3.8. Neutral Current', bold: false },
    { id: '3.9.', title: '   3.9. Energy', bold: false },
    { id: '3.10.', title: '   3.10. Current Total Harmonic Distortion', bold: false },
    { id: '3.11.', title: '   3.11. Voltage Total Harmonic Distortion', bold: false },
    { id: '3.12.', title: '   3.12. k-Rated', bold: false },
    { id: '4', title: '4. Penutup', bold: true },
    { id: '4.1', title: '   4.1. Kesimpulan', bold: false },
    { id: '4.2', title: '   4.2. Saran', bold: false },
  ];

  let tocY = 47;
  doc.setFontSize(9);
  tocItems.forEach((item) => {
    doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(item.title, 24, tocY);

    const titleWidth = doc.getTextWidth(item.title);
    const pageNum = String(sectionPages[item.id] || '');
    const pageNumWidth = doc.getTextWidth(pageNum);
    const startDots = 24 + titleWidth + 2;
    const endDots = 186 - pageNumWidth - 2;

    if (endDots > startDots) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      let dotStr = '';
      const dotUnitWidth = doc.getTextWidth('.');
      const count = Math.floor((endDots - startDots) / (dotUnitWidth * 2));
      for (let i = 0; i < count; i++) dotStr += '. ';
      doc.text(dotStr, startDots, tocY);
    }

    doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(pageNum, 186, tocY, { align: 'right' });
    tocY += 7.6;
  });

  const totalPages = doc.internal.getNumberOfPages();
  doc.setPage(totalPages);

  const sanitizeName = (str) =>
    String(str || '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_');

  let rawCompany = companyName || 'PT Agrinesia Yogyakarta';
  if (!/^pt[\s_]/i.test(rawCompany) && !rawCompany.toUpperCase().startsWith('PT')) {
    rawCompany = `PT ${rawCompany}`;
  }
  const cleanCompany = sanitizeName(rawCompany);
  const cleanTrafo = sanitizeName(td.trafoSerialNo || trafoDisplayName || 'Trafo');

  const fileName = `TMU_Report_${day}_${monthName}_${year}_${cleanCompany}_${cleanTrafo}.pdf`;
  doc.save(fileName);
  return totalPages;
}
