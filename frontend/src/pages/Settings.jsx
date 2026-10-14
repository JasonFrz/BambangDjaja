import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useApi } from '../contexts/ApiContext';
import { useThresholds } from '../contexts/ThresholdContext';
import { Edit, Check, X, ShieldAlert } from 'lucide-react';
import EnergyLoader from '../components/EnergyLoader';

// Kolom transformer_settings per grup (nama kolom persis seperti DB; satuan persen = % dari rated).
const GROUPS = [
  { key: 'voltage', title: 'Line Voltage', unit: '% dari rated LV', trip: 'voltage',
    fields: [['voltageLowAlarmTreshold', 'Low Alarm'], ['voltageLowTripTreshold', 'Low Trip'], ['voltageHighAlarmTreshold', 'High Alarm'], ['voltageHighTripTreshold', 'High Trip']],
    computed: [['voltageLowAlarmValue', 'Low Alarm'], ['voltageLowTripValue', 'Low Trip'], ['voltageHighAlarmValue', 'High Alarm'], ['voltageHighTripValue', 'High Trip']] },
  { key: 'unbalance', title: 'Voltage Unbalance', unit: '%', trip: 'voltageUnbalance', fields: [['voltageUnbalanceHighAlarmTreshold', 'Alarm'], ['voltageUnbalanceHighTripTreshold', 'Trip']] },
  { key: 'frequency', title: 'Frequency', unit: '% dari nominal', trip: 'frequency', fields: [['frequencyLowAlarmTreshold', 'Low Alarm'], ['frequencyLowTripTreshold', 'Low Trip'], ['frequencyHighAlarmTreshold', 'High Alarm'], ['frequencyHighTripTreshold', 'High Trip']] },
  { key: 'current', title: 'Current', unit: '% dari rated In', trip: 'current', fields: [['currentHighAlarmTreshold', 'High Alarm'], ['currentHighTripTreshold', 'High Trip']] },
  { key: 'ineutral', title: 'Neutral Current', unit: '% dari rated In', trip: 'Ineutral', fields: [['IneutralHighAlarmTreshold', 'High Alarm'], ['IneutralHighTripTreshold', 'High Trip']] },
  { key: 'pf', title: 'Power Factor', unit: '', trip: 'powerFactor', fields: [['powerFactorLowAlarmTreshold', 'Low Alarm'], ['powerFactorLowTripTreshold', 'Low Trip']] },
  { key: 'topoil', title: 'Top Oil Temperature', unit: '°C', trip: 'topOilTemp', fields: [['topOilHighAlarmTreshold', 'High Alarm'], ['topOilHighTripTreshold', 'High Trip']] },
  { key: 'wti', title: 'Winding Temperature', unit: '°C', trip: 'WTITemp', fields: [['windTempHighAlarmTreshold', 'High Alarm'], ['windTempHighTripTreshold', 'High Trip']] },
  { key: 'bus', title: 'Busbar Temperature', unit: '°C', trip: 'busTemp', fields: [['busTempHighAlarmTreshold', 'High Alarm'], ['busTempHighTripTreshold', 'High Trip']] },
  { key: 'thdv', title: 'THD Voltage', unit: '%', trip: 'THDVoltage', fields: [['thdVoltageAlarmTreshold', 'Alarm'], ['thdVoltageTripTreshold', 'Trip']] },
  { key: 'thdi', title: 'THD Current', unit: '%', trip: 'THDCurrent', fields: [['thdCurrentAlarmTreshold', 'Alarm'], ['thdCurrentTripTreshold', 'Trip']] },
  { key: 'pressure', title: 'Tank Pressure', unit: 'Bar', trip: 'pressure', fields: [['tankPressureHighAlarmTreshold', 'High Alarm'], ['tankPressureHighTripTreshold', 'High Trip']] },
  { key: 'oillevel', title: 'Oil Level', unit: '', trip: 'oilLevel', fields: [] },
  { key: 'h2', title: 'Hydrogen (H2)', unit: 'ppm', trip: 'H2ppm', fields: [['H2ppmHighAlarmTreshold', 'High Alarm'], ['H2ppmHighTripTreshold', 'High Trip']] },
  { key: 'moisture', title: 'Moisture', unit: 'ppm', trip: 'Moistureppm', fields: [['MoistureppmHighAlarmTreshold', 'High Alarm'], ['MoistureppmHighTripTreshold', 'High Trip']] },
];

const show = (v, unit) => (v === null || v === undefined ? '-' : `${v}${unit ? ` ${unit.split(' ')[0]}` : ''}`);

const Settings = () => {
  const { apiUrl } = useApi();
  const { refreshThresholds } = useThresholds();
  const role = (sessionStorage.getItem('role') || '').toLowerCase();
  const canEdit = role === 'admin' || role === 'superuser';
  const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';

  const [settings, setSettings] = useState(null);
  const [trip, setTrip] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);      // key grup
  const [draft, setDraft] = useState({});            // { kolom: string }
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${apiUrl}/api/settings/thresholds`, { params: { trafo_id: trafoId } });
      setSettings(res.data.settings);
      setTrip(res.data.trip);
      setError(res.data.settings ? '' : 'Trafo ini belum punya transformer_settings (menunggu Raspi mendaftar).');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, trafoId]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (g) => {
    const d = {};
    for (const [col] of g.fields) d[col] = settings[col] === null || settings[col] === undefined ? '' : String(settings[col]);
    setDraft(d); setEditing(g.key); setNotice('');
  };

  const save = async (g) => {
    const body = {};
    for (const [col] of g.fields) {
      const raw = String(draft[col] ?? '').trim();
      const before = settings[col] === null || settings[col] === undefined ? '' : String(settings[col]);
      if (raw === before) continue;
      if (raw === '') { body[col] = null; continue; }
      const n = Number(raw);
      if (!Number.isFinite(n)) { setNotice(`Nilai ${col} bukan angka`); return; }
      body[col] = n;
    }
    if (Object.keys(body).length === 0) { setEditing(null); return; }
    try {
      setSaving(true);
      const res = await axios.put(`${apiUrl}/api/settings/thresholds/${trafoId}`, body);
      setSettings(res.data.settings);
      setNotice(res.data.message || 'Tersimpan');
      setEditing(null);
      await refreshThresholds();
      window.dispatchEvent(new Event('thresholdsUpdated'));
    } catch (err) {
      setNotice(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const toggleTrip = async (col) => {
    if (!canEdit || !trip) return;
    const next = !(Number(trip[col]) === 1);
    try {
      const res = await axios.put(`${apiUrl}/api/settings/trip/${trafoId}`, { [col]: next });
      setTrip(res.data.trip);
      setNotice(res.data.pushed ? 'Trip enable tersimpan dan dikirim ke Raspi' : 'Trip enable tersimpan (Raspi offline, akan sinkron saat terhubung)');
    } catch (err) {
      setNotice(err.response?.data?.error || 'Gagal mengubah trip enable');
    }
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center min-h-[40vh]"><EnergyLoader text="Loading Settings..." /></div>;

  return (
    <div className="flex flex-col gap-5 animate-[fadeIn_0.5s_ease-out] w-full pb-10">
      <div>
        <h2 className="text-3xl font-bold text-[#172b4d] dark:text-white font-heading mb-1">Threshold settings</h2>
        <p className="text-[#5e6c84] dark:text-[#94a3b8] text-[0.95rem]">Batas alarm dan trip per parameter untuk trafo {trafoId}. Nilai tegangan absolut dihitung server dari rated LV.{!canEdit && ' Anda hanya dapat melihat.'}</p>
      </div>
      {error && <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 px-4 py-3 text-sm flex items-center gap-2"><ShieldAlert size={16} /> {error}</div>}
      {notice && <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 px-4 py-2 text-sm">{notice}</div>}
      {settings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {GROUPS.map((g) => {
            const isEditing = editing === g.key;
            const tripOn = trip ? Number(trip[g.trip]) === 1 : false;
            return (
              <div key={g.key} className={`rounded-2xl border p-4 bg-white dark:bg-[#151521] ${isEditing ? 'border-blue-400 ring-2 ring-blue-500/20' : 'border-[#dfe1e6] dark:border-white/10'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold text-[#172b4d] dark:text-white">{g.title}</div>
                    {g.unit && <div className="text-[11px] text-gray-500">satuan: {g.unit}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className={`flex items-center gap-2 text-xs font-bold ${canEdit ? 'cursor-pointer' : 'opacity-70'}`} title="Trip enable: Raspi boleh memutus saat trip">
                      <span className="text-gray-500">Trip</span>
                      <button type="button" disabled={!canEdit || !trip} onClick={() => toggleTrip(g.trip)} className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${tripOn ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${tripOn ? 'translate-x-4' : ''}`} />
                      </button>
                    </label>
                    {canEdit && g.fields.length > 0 && (isEditing
                      ? <div className="flex gap-1">
                          <button disabled={saving} onClick={() => save(g)} className="px-2.5 py-1.5 rounded-lg bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 font-bold text-xs flex items-center gap-1"><Check size={14} /> Save</button>
                          <button onClick={() => setEditing(null)} className="px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs"><X size={14} /></button>
                        </div>
                      : <button onClick={() => startEdit(g)} className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-bold text-xs flex items-center gap-1"><Edit size={14} /> Edit</button>)}
                  </div>
                </div>
                {g.fields.length === 0 ? <div className="text-xs text-gray-500">Tidak ada nilai ambang; hanya trip enable.</div> : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {g.fields.map(([col, label]) => (
                      <div key={col} className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase text-gray-500">{label}</span>
                        {isEditing
                          ? <input type="number" step="any" value={draft[col] ?? ''} onChange={(e) => setDraft({ ...draft, [col]: e.target.value })} placeholder="kosong = tidak ada" className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm font-bold text-[#172b4d] dark:text-white outline-none focus:border-blue-500" />
                          : <span className="font-bold text-sm text-[#172b4d] dark:text-white">{show(settings[col], g.unit)}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {g.computed && (
                  <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {g.computed.map(([col, label]) => (
                      <div key={col} className="flex flex-col"><span className="text-[10px] uppercase text-gray-400">{label} (V)</span><span className="text-sm font-mono text-[#172b4d] dark:text-gray-200">{show(settings[col], '')}</span></div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Settings;
