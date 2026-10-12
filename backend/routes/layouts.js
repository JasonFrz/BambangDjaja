const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getDbConnection } = require('../utils/db');

let isLayoutTableChecked = false;

const ensureTrafoIdColumn = async (masterDb) => {
  if (isLayoutTableChecked) return;
  try {
    const [cols] = await masterDb.execute("SHOW COLUMNS FROM user_layouts LIKE 'trafo_id'");
    if (cols.length === 0) {
      await masterDb.execute('ALTER TABLE user_layouts ADD COLUMN trafo_id VARCHAR(50)');
      console.log('Added trafo_id to user_layouts');
    }
    isLayoutTableChecked = true;
  } catch (error) {
    console.error('Error ensuring trafo_id column:', error);
  }
};

const getUserId = async (req, masterDb) => {
  if (req.user?.id) return req.user.id;
  const username = req.user?.username || req.headers['x-username'];
  if (username) {
    const [rows] = await masterDb.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (rows.length > 0) return rows[0].id;
  }
  return null;
};

const generateRandomLayoutId = async (masterDb) => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let isUnique = false;
  let newId = '';
  
  while (!isUnique) {
    let strPart = '';
    for (let i = 0; i < 4; i++) strPart += letters.charAt(Math.floor(Math.random() * letters.length));
    let numPart = '';
    for (let i = 0; i < 4; i++) numPart += numbers.charAt(Math.floor(Math.random() * numbers.length));
    
    newId = strPart + numPart;
    
    const [existing] = await masterDb.execute('SELECT id FROM user_layouts WHERE id = ?', [newId]);
    if (existing.length === 0) {
      isUnique = true;
    }
  }
  return newId;
};

const GEMINI_SYSTEM_PROMPT = `Anda adalah Agent Asisten Cerdas untuk Transformer Monitoring Unit (TMU) pada pemantauan transformator daya PT Bambang Djaja.
Tugas Anda adalah merespons permintaan pengguna secara interaktif layaknya seorang agent, merancang 3 OPSI REKOMENDASI PANEL yang berbeda untuk metrik/kebutuhan yang diminta, dan memberikan pilihan kepada pengguna.

DAFTAR METRICS VALID (Gunakan HANYA key ini):
- phaseA (Phase A Voltage, V)
- phaseB (Phase B Voltage, V)
- phaseC (Phase C Voltage, V)
- lineAB (Line AB Voltage, V)
- lineBC (Line BC Voltage, V)
- lineCA (Line CA Voltage, V)
- currentA (Current A, A)
- currentB (Current B, A)
- currentC (Current C, A)
- currentN (Current N, A)
- powerActiveTotal (Active Power, kW)
- powerReactiveTotal (Reactive Power, kVAR)
- powerApparentTotal (Apparent Power, kVA)
- pfTotal (Power Factor)
- frequency (Frequency, Hz)
- energyActiveTotal (Active Energy, kWh)
- energyReactiveTotal (Reactive Energy, kVARh)
- efficiency (Efficiency, %)
- oil_temperature (Oil Temperature, °C)
- oil_pressure (Oil Pressure, Bar)

DAFTAR TIPE PANEL VALID:
- areachart (Area Chart - grafik continuous time-series)
- linechart (Line Chart - grafik garis multi-fasa atau tren)
- stat (Stat Card - angka besar + tren sparkline, untuk KPI tunggal)
- gauge (Radial Gauge - speedometer dial, cocok untuk frekuensi, power factor, suhu)
- barchart (Bar Chart - grafik batang perbandingan fasa A/B/C)
- bargauge (Bar Gauge - horizontal progress bar)
- table (Table - tabel telemetry)
- piechart (Pie Chart - proporsi daya/energi)
- heatmap (Heatmap - matriks suhu & tekanan)
- candlestick (Candlestick - fluktuasi min/max)
- oilstatus (Oil Status - status trip/alarm oli, metrics=[])
- phasor (Phasor Diagram - diagram vektor kutub 3 fasa)
- sld (Single Line Diagram trafo)
- healthindex (Transformer Health Index composite score)
- eventstream (Event Stream logs)

PERILAKU SEBAGAI AGENT:
1. Pahami kebutuhan pengguna (panel apa dan metrik apa yang diminta).
2. Sediakan TEPAT 3 OPSI REKOMENDASI PANEL BERBEDA yang relevan dengan kebutuhan pengguna agar pengguna dapat memilih visualisasi yang paling cocok:
   - Rekomendasi 1: Opsi utama yang paling direkomendasikan / populer
   - Rekomendasi 2: Opsi visual gauge atau bar pembanding
   - Rekomendasi 3: Opsi grafik tren time-series atau analitik
3. Tuliskan pesan respons ('agentMessage') yang ramah dan to-the-point mengarahkan pengguna untuk memilih salah satu opsi.
4. Format kembalian HARUS JSON valid dengan struktur persis seperti ini:
{
  "agentMessage": "Saya telah menyiapkan 3 opsi panel terbaik untuk memantau Efisiensi Trafo. Silakan pilih salah satu panel yang Anda inginkan di bawah:",
  "recommendations": [
    {
      "id": "p_rec_1",
      "type": "stat",
      "title": "Efisiensi Trafo (KPI)",
      "metrics": ["efficiency"],
      "chartType": "line",
      "colorScheme": "spectral",
      "badge": "Paling Populer",
      "description": "Kartu KPI angka efisiensi (%) dengan indikator tren real-time"
    },
    {
      "id": "p_rec_2",
      "type": "bargauge",
      "title": "Bar Gauge Efisiensi",
      "metrics": ["efficiency"],
      "chartType": "line",
      "colorScheme": "spectral",
      "badge": "Visual Gauge",
      "description": "Progress bar horizontal untuk memantau batas aman efisiensi"
    },
    {
      "id": "p_rec_3",
      "type": "areachart",
      "title": "Tren Efisiensi Real-Time",
      "metrics": ["efficiency"],
      "chartType": "area",
      "colorScheme": "spectral",
      "badge": "Grafik Tren",
      "description": "Grafik continuous time-series untuk memantau performa dari waktu ke waktu"
    }
  ],
  "suggestedActions": [
    { "label": "+ Tambahkan ke Dashboard", "mode": "append" },
    { "label": "🔄 Ganti Seluruh Dashboard", "mode": "replace" }
  ]
}`;

const generateFallbackRecommendations = (prompt = '') => {
  const p = prompt.toLowerCase();
  const ts = Date.now();

  if (p.includes('efisiens') || p.includes('eff') || p.includes('rugi') || p.includes('hemat')) {
    return {
      agentMessage: 'Saya telah menyiapkan 3 opsi rekomendasi panel untuk memantau Efisiensi Trafo. Silakan pilih tampilan yang paling cocok untuk dashboard Anda:',
      recommendations: [
        {
          id: `p_eff_stat_${ts}`,
          type: 'stat',
          title: 'Efisiensi Trafo (KPI)',
          metrics: ['efficiency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Paling Populer',
          description: 'Kartu KPI angka efisiensi (%) dengan indikator tren real-time.'
        },
        {
          id: `p_eff_bargauge_${ts}`,
          type: 'bargauge',
          title: 'Bar Gauge Efisiensi',
          metrics: ['efficiency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Visual Gauge',
          description: 'Progress bar horizontal untuk memantau batas efisiensi operasi.'
        },
        {
          id: `p_eff_area_${ts}`,
          type: 'areachart',
          title: 'Tren Efisiensi Real-Time',
          metrics: ['efficiency'],
          chartType: 'area',
          colorScheme: 'spectral',
          badge: 'Grafik Tren',
          description: 'Grafik continuous time-series fluktuasi efisiensi trafo.'
        }
      ]
    };
  }

  if (p.includes('frekuensi') || p.includes('frequency') || p.includes('hz')) {
    return {
      agentMessage: 'Saya telah menyiapkan 3 opsi rekomendasi panel untuk memantau Frekuensi (Hz). Silakan pilih tampilan yang Anda inginkan:',
      recommendations: [
        {
          id: `p_freq_gauge_${ts}`,
          type: 'gauge',
          title: 'Frekuensi Trafo (Radial)',
          metrics: ['frequency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Direkomendasikan',
          description: 'Speedometer radial dial presisi tinggi batas toleransi 50 Hz.'
        },
        {
          id: `p_freq_stat_${ts}`,
          type: 'stat',
          title: 'KPI Frekuensi Grid',
          metrics: ['frequency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Angka Ringkas',
          description: 'Display nilai numerik presisi tinggi dengan sparkline fluktuasi.'
        },
        {
          id: `p_freq_line_${ts}`,
          type: 'linechart',
          title: 'Tren Stabilitas Frekuensi',
          metrics: ['frequency'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Grafik Garis',
          description: 'Grafik garis real-time untuk memantau stabilitas frekuensi sistem.'
        }
      ]
    };
  }

  if (p.includes('tegangan') || p.includes('volt') || p.includes('voltage') || p.includes('phase') || p.includes('fasa')) {
    return {
      agentMessage: 'Saya telah menyiapkan 3 opsi rekomendasi panel untuk memantau Tegangan Trafo. Silakan pilih tampilan yang Anda inginkan:',
      recommendations: [
        {
          id: `p_volt_line_${ts}`,
          type: 'linechart',
          title: 'Tegangan 3-Fasa (LN)',
          metrics: ['phaseA', 'phaseB', 'phaseC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Direkomendasikan',
          description: 'Grafik komparasi kontinyu fasa A, B, dan C secara bersamaan.'
        },
        {
          id: `p_volt_bar_${ts}`,
          type: 'barchart',
          title: 'Perbandingan Tegangan Fasa',
          metrics: ['phaseA', 'phaseB', 'phaseC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Grafik Batang',
          description: 'Bar chart perbandingan magnitudo tegangan untuk deteksi ketidakseimbangan.'
        },
        {
          id: `p_volt_phasor_${ts}`,
          type: 'phasor',
          title: 'Phasor Diagram Tegangan',
          metrics: ['phaseA', 'phaseB', 'phaseC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Vektor Polar',
          description: 'Diagram vektor kutub polar 3-fasa untuk analisa sudut fasa.'
        }
      ]
    };
  }

  if (p.includes('arus') || p.includes('current') || p.includes('ampere') || p.includes('beban') || p.includes('load')) {
    return {
      agentMessage: 'Saya telah menyiapkan 3 opsi rekomendasi panel untuk memantau Beban Arus Trafo. Silakan pilih tampilan yang Anda inginkan:',
      recommendations: [
        {
          id: `p_curr_bar_${ts}`,
          type: 'barchart',
          title: 'Arus 3-Fasa & Netral',
          metrics: ['currentA', 'currentB', 'currentC', 'currentN'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Direkomendasikan',
          description: 'Grafik batang beban arus fasa A, B, C dan arus netral.'
        },
        {
          id: `p_curr_line_${ts}`,
          type: 'linechart',
          title: 'Tren Fluktuasi Arus Beban',
          metrics: ['currentA', 'currentB', 'currentC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Grafik Tren',
          description: 'Grafik kontinu pembebanan arus trafo terhadap waktu.'
        },
        {
          id: `p_curr_stat_${ts}`,
          type: 'stat',
          title: 'Arus Beban Trafo (KPI)',
          metrics: ['currentA', 'currentB', 'currentC'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Angka Ringkas',
          description: 'Stat card nilai arus real-time dengan status beban.'
        }
      ]
    };
  }

  if (p.includes('suhu') || p.includes('temperatur') || p.includes('temp') || p.includes('oli') || p.includes('oil') || p.includes('minyak') || p.includes('tekanan') || p.includes('pressure')) {
    return {
      agentMessage: 'Saya telah menyiapkan 3 opsi rekomendasi panel untuk memantau Kondisi Minyak & Suhu Trafo. Silakan pilih tampilan yang Anda inginkan:',
      recommendations: [
        {
          id: `p_oil_stat_${ts}`,
          type: 'oilstatus',
          title: 'Status Proteksi Oli & Alarm',
          metrics: [],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Proteksi Kritis',
          description: 'Indikator visual level trip & alarm minyak isolasi transformator.'
        },
        {
          id: `p_oil_heat_${ts}`,
          type: 'heatmap',
          title: 'Matriks Suhu & Tekanan Oli',
          metrics: ['oil_temperature', 'oil_pressure'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Visual Matriks',
          description: 'Peta intensitas suhu (°C) dan tekanan minyak tangki trafo.'
        },
        {
          id: `p_oil_gauge_${ts}`,
          type: 'gauge',
          title: 'Gauge Temperatur Oli',
          metrics: ['oil_temperature'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Dial Meter',
          description: 'Radial dial gauge batas aman kenaikan suhu oli transformator.'
        }
      ]
    };
  }

  if (p.includes('daya') || p.includes('power') || p.includes('energi') || p.includes('energy') || p.includes('kw') || p.includes('kwh') || p.includes('kvar') || p.includes('kva') || p.includes('faktor')) {
    return {
      agentMessage: 'Saya telah menyiapkan 3 opsi rekomendasi panel untuk memantau Daya & Energi Trafo. Silakan pilih tampilan yang Anda inginkan:',
      recommendations: [
        {
          id: `p_pwr_stat_${ts}`,
          type: 'stat',
          title: 'Daya Aktif Total (kW)',
          metrics: ['powerActiveTotal'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'KPI Utama',
          description: 'Total output daya aktif transformator secara real-time.'
        },
        {
          id: `p_pwr_pie_${ts}`,
          type: 'piechart',
          title: 'Komposisi Daya (P, Q, S)',
          metrics: ['powerActiveTotal', 'powerReactiveTotal', 'powerApparentTotal'],
          chartType: 'line',
          colorScheme: 'spectral',
          badge: 'Proporsi Daya',
          description: 'Pie chart rasio daya aktif (kW), reaktif (kVAR), dan semu (kVA).'
        },
        {
          id: `p_pwr_area_${ts}`,
          type: 'areachart',
          title: 'Tren Akumulasi Energi (kWh)',
          metrics: ['energyActiveTotal', 'energyReactiveTotal'],
          chartType: 'area',
          colorScheme: 'spectral',
          badge: 'Grafik Tren',
          description: 'Grafik konsumsi energi transformator berkelanjutan.'
        }
      ]
    };
  }

  // Default fallback
  return {
    agentMessage: 'Saya telah menyiapkan 3 opsi rekomendasi panel monitoring terbaik untuk kebutuhan Anda. Silakan pilih tampilan yang diinginkan:',
    recommendations: [
      {
        id: `p_gen_stat_${ts}`,
        type: 'stat',
        title: 'Ringkasan Metrik (KPI Card)',
        metrics: ['powerActiveTotal'],
        chartType: 'line',
        colorScheme: 'spectral',
        badge: 'Angka Cepat',
        description: 'Tampilan metrik numerik ringkas dengan indikator tren real-time.'
      },
      {
        id: `p_gen_gauge_${ts}`,
        type: 'gauge',
        title: 'Radial Meter Dial',
        metrics: ['frequency'],
        chartType: 'line',
        colorScheme: 'spectral',
        badge: 'Gauge Dial',
        description: 'Speedometer dial visual untuk memantau batas aman toleransi metrik.'
      },
      {
        id: `p_gen_area_${ts}`,
        type: 'areachart',
        title: 'Grafik Tren Historis',
        metrics: ['powerActiveTotal'],
        chartType: 'area',
        colorScheme: 'spectral',
        badge: 'Grafik Tren',
        description: 'Grafik continuous area chart fluktuasi data terhadap waktu.'
      }
    ]
  };
};

router.post('/ai-generate', async (req, res) => {
  try {
    const { prompt, apiKey, existingLayouts, currentPanelsCount } = req.body;
    const finalApiKey = apiKey || process.env.GEMINI_API_KEY;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt instruksi tidak boleh kosong' });
    }

    let parsedResult = null;

    if (finalApiKey) {
      const models = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash'];
      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${finalApiKey}`;
          const response = await axios.post(
            url,
            {
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: `${GEMINI_SYSTEM_PROMPT}\n\nPermintaan pengguna: "${prompt.trim()}" (Status dashboard saat ini memiliki ${currentPanelsCount || 0} panel aktif).` }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json"
              }
            },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 15000
            }
          );

          if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            let rawText = response.data.candidates[0].content.parts[0].text;
            rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
            parsedResult = JSON.parse(rawText);
            break;
          }
        } catch (err) {
          console.warn(`Model ${model} failed, trying next or fallback:`, err.response?.data?.error?.message || err.message);
        }
      }
    }

    // Gunakan fallback cerdas jika Gemini tidak tersedia atau gagal
    if (!parsedResult || (!parsedResult.recommendations && !parsedResult.panels)) {
      parsedResult = generateFallbackRecommendations(prompt.trim());
    }

    const validPanelTypes = [
      'areachart', 'linechart', 'stat', 'gauge', 'barchart', 'bargauge',
      'table', 'piechart', 'heatmap', 'candlestick', 'oilstatus',
      'phasor', 'sld', 'healthindex', 'eventstream', 'statetimeline',
      'statushistory', 'histogram', 'news'
    ];

    const rawList = parsedResult.recommendations || parsedResult.panels || [];
    const sanitizedRecommendations = rawList.map((panel, idx) => {
      const pType = validPanelTypes.includes(panel.type) ? panel.type : 'linechart';
      const pid = panel.id && String(panel.id).startsWith('p_') ? String(panel.id) : `p_rec_${Date.now()}_${idx}`;
      return {
        id: pid,
        type: pType,
        title: panel.title || `Panel Opsi ${idx + 1}`,
        metrics: Array.isArray(panel.metrics) ? panel.metrics : [],
        chartType: panel.chartType === 'area' ? 'area' : 'line',
        colorScheme: panel.colorScheme || 'spectral',
        badge: panel.badge || (idx === 0 ? 'Paling Populer' : idx === 1 ? 'Visual Gauge' : 'Grafik Tren'),
        description: panel.description || 'Visualisasi pemantauan transformator TMU.'
      };
    });

    const isDashboardEmpty = !currentPanelsCount || currentPanelsCount === 0;
    const defaultActions = isDashboardEmpty
      ? [{ label: 'Pasang ke Dashboard', mode: 'replace' }]
      : [
          { label: '+ Tambahkan ke Dashboard', mode: 'append' },
          { label: '🔄 Ganti Seluruh Dashboard', mode: 'replace' }
        ];

    return res.json({
      success: true,
      agentMessage: parsedResult.agentMessage || 'Saya telah menyiapkan 3 rekomendasi panel terbaik. Silakan pilih salah satu:',
      recommendations: sanitizedRecommendations,
      panels: sanitizedRecommendations,
      suggestedActions: parsedResult.suggestedActions || defaultActions
    });

  } catch (error) {
    console.error('Error in ai-generate endpoint:', error);
    // Kembalikan fallback daripada 500
    const fallback = generateFallbackRecommendations(req.body?.prompt || '');
    res.json({
      success: true,
      agentMessage: fallback.agentMessage,
      recommendations: fallback.recommendations,
      panels: fallback.recommendations,
      suggestedActions: [
        { label: '+ Tambahkan ke Dashboard', mode: 'append' },
        { label: '🔄 Ganti Seluruh Dashboard', mode: 'replace' }
      ]
    });
  }
});

router.get('/export/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const masterDb = await getDbConnection('tmu_master');
    const [layouts] = await masterDb.execute('SELECT layout_name, layout_data FROM user_layouts WHERE id = ?', [id]);
    
    if (layouts.length === 0) {
      return res.status(404).json({ error: 'Layout not found' });
    }
    
    let layout = layouts[0];
    if (typeof layout.layout_data === 'string') {
      try {
        layout.layout_data = JSON.parse(layout.layout_data);
      } catch (e) {}
    }
    
    res.json(layout);
  } catch (error) {
    console.error('Error exporting layout:', error);
    res.status(500).json({ error: 'Server error exporting layout' });
  }
});

router.get('/', async (req, res) => {
  try {
    const dbName = req.headers['x-db-name'];
    const trafoId = req.headers['x-trafo-id'];
    
    if (!dbName) return res.status(400).json({ error: 'Company name is missing' });
    
    const masterDb = await getDbConnection('tmu_master');
    await ensureTrafoIdColumn(masterDb);
    
    const userId = await getUserId(req, masterDb);
    if (!userId) return res.status(403).json({ error: 'User ID missing or unauthorized' });
    
    let query = 'SELECT id, layout_name, layout_data, is_active FROM user_layouts WHERE user_id = ?';
    let params = [userId];
    
    if (trafoId) {
      query += ' AND trafo_id = ?';
      params.push(trafoId);
    } else {
      query += ' AND (trafo_id IS NULL OR trafo_id = "")';
    }
    
    const [layouts] = await masterDb.execute(query, params);
    
    const parsedLayouts = layouts.map(l => {
      let data = l.layout_data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {}
      }
      return { ...l, layout_data: data };
    });
    
    res.json(parsedLayouts);
  } catch (error) {
    console.error('Error fetching layouts:', error);
    res.status(500).json({ error: 'Server error fetching layouts' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { id, layout_name, layout_data, is_active } = req.body;
    
    if (!layout_name || !layout_data) {
      return res.status(400).json({ error: 'Missing required fields: layout_name, layout_data' });
    }
    
    const dbName = req.headers['x-db-name'];
    const trafoId = req.headers['x-trafo-id'];
    if (!dbName) return res.status(400).json({ error: 'Company name is missing' });
    
    const masterDb = await getDbConnection('tmu_master');
    await ensureTrafoIdColumn(masterDb);
    
    const userId = await getUserId(req, masterDb);
    if (!userId) return res.status(403).json({ error: 'User ID missing or unauthorized' });
    
    let existing = [];
    let isUpdate = false;
    let actualId = id;
    
    let baseQuery = 'SELECT id FROM user_layouts WHERE user_id = ?';
    let baseParams = [userId];
    
    if (trafoId) {
      baseQuery += ' AND trafo_id = ?';
      baseParams.push(trafoId);
    } else {
      baseQuery += ' AND (trafo_id IS NULL OR trafo_id = "")';
    }
    
    if (id && id !== 'default' && !id.startsWith('p_')) {
      [existing] = await masterDb.execute(baseQuery + ' AND id = ?', [...baseParams, id]);
      if (existing.length > 0) isUpdate = true;
    }
    
    if (!isUpdate) {
      [existing] = await masterDb.execute(baseQuery + ' AND layout_name = ?', [...baseParams, layout_name]);
      if (existing.length > 0) {
        isUpdate = true;
        actualId = existing[0].id;
      }
    }
    
    const finalTrafoId = trafoId || '';
    const finalData = typeof layout_data === 'string' ? layout_data : JSON.stringify(layout_data);
    
    if (isUpdate) {
      await masterDb.execute(
        'UPDATE user_layouts SET layout_name = ?, layout_data = ?, is_active = ? WHERE id = ? AND user_id = ?',
        [layout_name, finalData, is_active ? 1 : 0, actualId, userId]
      );
    } else {
      actualId = await generateRandomLayoutId(masterDb);
      await masterDb.execute(
        'INSERT INTO user_layouts (id, user_id, trafo_id, layout_name, layout_data, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        [actualId, userId, finalTrafoId, layout_name, finalData, is_active ? 1 : 0]
      );
    }
    
    res.json({ success: true, message: 'Layout saved successfully', id: actualId });
  } catch (error) {
    console.error('Error saving layout:', error);
    res.status(500).json({ error: 'Server error saving layout' });
  }
});

router.put('/active', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing layout id' });
    
    const dbName = req.headers['x-db-name'];
    const trafoId = req.headers['x-trafo-id'];
    if (!dbName) return res.status(400).json({ error: 'Company name is missing' });
    
    const masterDb = await getDbConnection('tmu_master');
    const userId = await getUserId(req, masterDb);
    if (!userId) return res.status(403).json({ error: 'User ID missing or unauthorized' });
    
    let deactivateQuery = 'UPDATE user_layouts SET is_active = 0 WHERE user_id = ?';
    let params = [userId];
    if (trafoId) {
      deactivateQuery += ' AND trafo_id = ?';
      params.push(trafoId);
    } else {
      deactivateQuery += ' AND (trafo_id IS NULL OR trafo_id = "")';
    }
    
    await masterDb.execute(deactivateQuery, params);
    
    let result = { affectedRows: 0 };
    if (id === 'default') {
      [result] = await masterDb.execute("UPDATE user_layouts SET is_active = 1 WHERE layout_name = 'Main Dashboard' AND user_id = ?", [userId]);
    } else {
      [result] = await masterDb.execute('UPDATE user_layouts SET is_active = 1 WHERE id = ? AND user_id = ?', [id, userId]);
    }
    
    res.json({ success: true, message: 'Active layout updated' });
  } catch (error) {
    console.error('Error setting active layout:', error);
    res.status(500).json({ error: 'Server error setting active layout' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { layout_name } = req.body;
    
    if (!layout_name) return res.status(400).json({ error: 'Missing layout_name' });
    
    const dbName = req.headers['x-db-name'];
    if (!dbName) return res.status(400).json({ error: 'Company name is missing' });
    
    const masterDb = await getDbConnection('tmu_master');
    const userId = await getUserId(req, masterDb);
    if (!userId) return res.status(403).json({ error: 'User ID missing or unauthorized' });
    
    if (id === 'default') {
      const [result] = await masterDb.execute("UPDATE user_layouts SET layout_name = ? WHERE layout_name = 'Main Dashboard' AND user_id = ?", [layout_name, userId]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Layout not found' });
    } else {
      const [result] = await masterDb.execute('UPDATE user_layouts SET layout_name = ? WHERE id = ? AND user_id = ?', [layout_name, id, userId]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Layout not found' });
    }
    
    res.json({ success: true, message: 'Layout renamed successfully' });
  } catch (error) {
    console.error('Error renaming layout:', error);
    res.status(500).json({ error: 'Server error renaming layout' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const dbName = req.headers['x-db-name'];
    if (!dbName) return res.status(400).json({ error: 'Company name is missing' });
    
    const masterDb = await getDbConnection('tmu_master');
    const userId = await getUserId(req, masterDb);
    if (!userId) return res.status(403).json({ error: 'User ID missing or unauthorized' });
    
    if (id === 'default') {
      await masterDb.execute("DELETE FROM user_layouts WHERE layout_name = 'Main Dashboard' AND user_id = ?", [userId]);
    } else {
      await masterDb.execute('DELETE FROM user_layouts WHERE id = ? AND user_id = ?', [id, userId]);
    }
    
    res.json({ success: true, message: 'Layout deleted successfully' });
  } catch (error) {
    console.error('Error deleting layout:', error);
    res.status(500).json({ error: 'Server error deleting layout' });
  }
});

module.exports = router;
