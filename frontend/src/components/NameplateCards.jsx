import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Settings, Thermometer, Zap, Edit, Check, X, Cpu } from 'lucide-react';
import { useApi } from '../contexts/ApiContext';

const SECTIONS = [
  { title: 'General Specifications', icon: Settings, color: 'text-teal-500', fields: [
    ['trafoSerialNo', 'SERIAL NO', '', 'text'], ['ratedPower', 'RATED POWER', 'kVA'], ['frequency', 'FREQUENCY', 'Hz'], ['impedance', 'IMPEDANCE', '%'],
    ['vectorGroup', 'VECTOR GROUP', '', 'text'], ['phase', 'PHASE', ''], ['coolingMode', 'COOLING', '', 'text'], ['krated', 'K-RATED', ''],
  ] },
  { title: 'Energy Loss & Temperature', icon: Thermometer, color: 'text-indigo-500', fields: [
    ['noLoadLoss', 'NO LOAD LOSS', 'W'], ['fullLoadLoss', 'FULL LOAD LOSS', 'W'], ['topOilLv', 'TOP OIL RISE LV', '°C'], ['topOilHv', 'TOP OIL RISE HV', '°C'],
    ['windTempLv', 'WINDING RISE LV', '°C'], ['windTempHv', 'WINDING RISE HV', '°C'], ['gradientLv', 'GRADIENT LV', '°C'], ['gradientHv', 'GRADIENT HV', '°C'], ['hotspotFactor', 'HOTSPOT FACTOR', ''],
  ] },
  { title: 'Voltage, Current & Tap', icon: Zap, color: 'text-amber-500', wide: true, fields: [
    ['ratedLowVoltage', 'RATED VOLTAGE (LV)', 'V'], ['ratedHighVoltage', 'RATED VOLTAGE (HV)', 'kV'], ['ratedCurrentLowVoltage', 'RATED CURRENT (LV)', 'A'], ['ratedCurrentHighVoltage', 'RATED CURRENT (HV)', 'A'],
    ['tapType', 'TAP TYPE', '', 'text'], ['tapNumberPlus', 'TAP +', ''], ['tapNumberMinus', 'TAP -', ''], ['tapPercentagePlus', 'TAP STEP +', '%'], ['tapPercentageMinus', 'TAP STEP -', '%'], ['ctRatio', 'CT RATIO', ''],
  ] },
  { title: 'Device', icon: Cpu, color: 'text-slate-500', wide: true, readonly: true, fields: [
    ['raspiSerialNo', 'RASPI SERIAL', '', 'text'], ['version', 'TMU VERSION', '', 'text'], ['lastSyncTimestamp', 'LAST SYNC', '', 'time'], ['latitude', 'LATITUDE', ''], ['longitude', 'LONGITUDE', ''], ['intervalDelay', 'INTERVAL', 's'],
  ] },
];

const Field = ({ label, value, unit }) => (
  <div className="flex flex-col">
    <span className="text-[10px] font-bold text-gray-400 tracking-wider">{label}</span>
    <span className="font-bold text-[#172b4d] dark:text-white">{value === null || value === undefined || value === '' ? '-' : `${value}${unit ? ` ${unit}` : ''}`}</span>
  </div>
);

export default function NameplateCards({ trafoId }) {
  const { apiUrl } = useApi();
  const role = (sessionStorage.getItem('role') || '').toLowerCase();
  const canEdit = role === 'admin' || role === 'superuser';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!trafoId) return;
    try { const res = await axios.get(`${apiUrl}/api/trafo/${trafoId}/data`); setData(res.data.data || null); setError(res.data.data ? '' : 'Nameplate belum ada (menunggu Raspi mendaftar).'); }
    catch (err) { setError(err.response?.data?.error || err.message); }
  }, [apiUrl, trafoId]);
  useEffect(() => { load(); }, [load]);

  const fmt = (col, type) => {
    const v = data ? data[col] : null;
    if (type === 'time') return v ? new Date(v).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : null;
    return v;
  };

  const startEdit = () => {
    const d = {};
    for (const s of SECTIONS) if (!s.readonly) for (const [col] of s.fields) d[col] = data && data[col] !== null && data[col] !== undefined ? String(data[col]) : '';
    setDraft(d); setEditing(true); setNotice('');
  };

  const save = async () => {
    const body = {};
    for (const s of SECTIONS) if (!s.readonly) for (const [col, , , type] of s.fields) {
      const raw = String(draft[col] ?? '').trim();
      const before = data && data[col] !== null && data[col] !== undefined ? String(data[col]) : '';
      if (raw === before) continue;
      if (raw === '') { body[col] = null; continue; }
      if (type === 'text') { body[col] = raw; continue; }
      const n = Number(raw);
      if (!Number.isFinite(n)) { setNotice(`Nilai ${col} bukan angka`); return; }
      body[col] = n;
    }
    if (Object.keys(body).length === 0) { setEditing(false); return; }
    try {
      const res = await axios.put(`${apiUrl}/api/trafo/${trafoId}/data`, body);
      setData(res.data.data || res.data.transformerData || data);
      setNotice(res.data.pushed ? 'Nameplate tersimpan dan dikirim ke Raspi' : 'Nameplate tersimpan (Raspi offline, akan sinkron saat terhubung)');
      setEditing(false);
      await load();
      window.dispatchEvent(new Event('thresholdsUpdated')); // limits bergantung rated values
    } catch (err) { setNotice(err.response?.data?.error || 'Gagal menyimpan nameplate'); }
  };

  return (
    <>
      <div className="lg:col-span-2 flex items-center justify-between">
        <div className="text-sm text-gray-500">{error || notice}</div>
        {canEdit && data && (editing
          ? <div className="flex gap-2"><button onClick={save} className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 font-bold text-xs flex items-center gap-1"><Check size={14} /> Save</button><button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-xs"><X size={14} /></button></div>
          : <button onClick={startEdit} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-bold text-xs flex items-center gap-1"><Edit size={14} /> Edit Nameplate</button>)}
      </div>
      {SECTIONS.map((s) => (
        <div key={s.title} className={`bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 flex flex-col ${s.wide ? 'lg:col-span-2' : ''}`}>
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#dfe1e6] dark:border-white/10">
            <div className={s.color}><s.icon size={20} /></div>
            <h3 className="font-bold text-lg text-[#172b4d] dark:text-white">{s.title}</h3>
          </div>
          <div className={`grid grid-cols-2 ${s.wide ? 'lg:grid-cols-5' : 'sm:grid-cols-3'} gap-5`}>
            {s.fields.map(([col, label, unit, type]) => (editing && !s.readonly
              ? <div key={col} className="flex flex-col gap-1"><span className="text-[10px] font-bold text-gray-400 tracking-wider">{label}{unit ? ` (${unit})` : ''}</span>
                  <input type={type === 'text' ? 'text' : 'number'} step="any" value={draft[col] ?? ''} onChange={(e) => setDraft({ ...draft, [col]: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm font-bold text-[#172b4d] dark:text-white outline-none focus:border-blue-500" /></div>
              : <Field key={col} label={label} value={fmt(col, type)} unit={unit} />))}
          </div>
        </div>
      ))}
    </>
  );
}
