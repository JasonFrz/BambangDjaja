import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useApi } from '../contexts/ApiContext';
import { Edit, Check, Activity } from 'lucide-react';
import EnergyLoader from '../components/EnergyLoader';

const METRIC_LABELS = {
  v_phase: { label: 'Phase voltage', tab: 'Voltage', unit: 'V' },
  avg_phase_v: { label: 'Average phase voltage', tab: 'Voltage', unit: 'V' },
  v_line: { label: 'Line voltage', tab: 'Voltage', unit: 'V' },
  avg_line_v: { label: 'Average line voltage', tab: 'Voltage', unit: 'V' },
  
  current: { label: 'Phase current', tab: 'Current', unit: 'A' },
  avg_current: { label: 'Average phase current', tab: 'Current', unit: 'A' },
  current_n: { label: 'Neutral current', tab: 'Current', unit: 'A' },
  current_unbalance: { label: 'Current unbalance', tab: 'Current', unit: '%' },
  
  power_active_phase: { label: 'Active power per phase', tab: 'Power', unit: 'kW' },
  power_active_total_kw: { label: 'Total active power', tab: 'Power', unit: 'kW' },
  power_reactive_total_kvar: { label: 'Total reactive power', tab: 'Power', unit: 'kVAR' },
  power_apparent_total_kva: { label: 'Total apparent power', tab: 'Power', unit: 'kVA' },
  pf_total: { label: 'Total power factor', tab: 'Power', unit: '' },
  
  frequency: { label: 'Frequency', tab: 'Frequency', unit: 'Hz' },
  
  oil_temperature: { label: 'Oil temperature', tab: 'Oil and env', unit: '°C' },
  oil_pressure: { label: 'Oil pressure', tab: 'Oil and env', unit: 'Bar' },
};

const TABS = ['Voltage', 'Current', 'Power', 'Frequency', 'Oil and env'];

const Settings = () => {
  const { apiUrl } = useApi();
  const dbName = sessionStorage.getItem('tenant_db');
  const selectedTrafoId = sessionStorage.getItem('selectedTrafoId');
  
  const [thresholds, setThresholds] = useState([]);
  const [activeTab, setActiveTab] = useState('Voltage');
  const [isLoading, setIsLoading] = useState(true);
  
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ min_value: '', max_value: '', is_active: 1 });

  useEffect(() => {
    if (selectedTrafoId) {
      fetchThresholds();
    }
  }, [selectedTrafoId, dbName]);

  const fetchThresholds = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${apiUrl}/api/settings/thresholds?trafo_id=${selectedTrafoId}`, {
        headers: { 'X-DB-Name': dbName }
      });
      if (res.data.success) {
        const formattedData = res.data.data.map(t => ({
          ...t,
          min_value: t.min_value !== null ? Number(parseFloat(t.min_value).toFixed(4)) : null,
          max_value: t.max_value !== null ? Number(parseFloat(t.max_value).toFixed(4)) : null,
        }));
        setThresholds(formattedData);
      }
    } catch (err) {
      console.error('Failed to fetch thresholds:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (threshold) => {
    setEditingId(threshold.id);
    setEditValues({
      min_value: threshold.min_value !== null ? threshold.min_value : '',
      max_value: threshold.max_value !== null ? threshold.max_value : '',
      is_active: threshold.is_active
    });
  };

  const handleSaveClick = async (id) => {
    try {
      await axios.put(`${apiUrl}/api/settings/thresholds/${id}`, {
        min_value: editValues.min_value === '' ? null : editValues.min_value,
        max_value: editValues.max_value === '' ? null : editValues.max_value,
        is_active: editValues.is_active ? 1 : 0
      }, {
        headers: { 'X-DB-Name': dbName }
      });
      
      // Update local state
      setThresholds(prev => prev.map(t => 
        t.id === id ? { 
          ...t, 
          min_value: editValues.min_value === '' ? null : parseFloat(editValues.min_value),
          max_value: editValues.max_value === '' ? null : parseFloat(editValues.max_value),
          is_active: editValues.is_active ? 1 : 0
        } : t
      ));
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update threshold:', err);
      alert('Failed to update setting');
    }
  };

  const filteredThresholds = thresholds.filter(t => {
    const meta = METRIC_LABELS[t.metric_key];
    return meta && meta.tab === activeTab;
  });

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.5s_ease-out] w-full pb-10">
      <div className="mb-2">
        <h2 className="text-3xl font-bold text-[#172b4d] dark:text-white font-heading mb-1 transition-colors">
          Threshold settings
        </h2>
        <p className="text-[#5e6c84] dark:text-[#94a3b8] text-[0.95rem] transition-colors mt-1 mb-4">
          Set safety limits per metric for Safe, Warning, and Trip status.
        </p>
      </div>

      {/* TABS */}
      <div className="flex overflow-x-auto custom-scrollbar gap-2 pb-2">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
              activeTab === tab
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white dark:bg-[#1a1a24] border border-[#dfe1e6] dark:border-white/10 text-[#5e6c84] dark:text-[#94a3b8] hover:bg-gray-50 dark:hover:bg-white/5 hover:text-blue-500'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] animate-[fadeIn_0.3s_ease-out]">
          <EnergyLoader text="Loading Settings..." />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredThresholds.map((t) => {
            const meta = METRIC_LABELS[t.metric_key];
            const isEditing = editingId === t.id;

            return (
              <div 
                key={t.id} 
                className={`flex flex-col md:flex-row md:items-center justify-between p-4 md:p-5 rounded-2xl border transition-all ${
                  isEditing 
                    ? 'bg-white dark:bg-[#181824] border-blue-400 ring-2 ring-blue-500/20 shadow-lg' 
                    : 'bg-white dark:bg-[#151521] border-[#dfe1e6] dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 shadow-sm'
                }`}
              >
                {/* Info Section */}
                <div className="flex flex-col mb-4 md:mb-0 md:w-1/3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[#172b4d] dark:text-white text-base md:text-lg">
                      {meta.label}
                    </span>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${
                      t.scope === 'global' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' 
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400'
                    }`}>
                      {t.scope}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-[#5e6c84] dark:text-gray-500">
                    {t.metric_key}
                  </span>
                </div>

                {/* Values Section */}
                <div className="flex items-end md:items-center gap-4 md:gap-8 flex-1 justify-start md:justify-center">
                  <div className="flex flex-col gap-1 w-24">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Min</label>
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={editValues.min_value}
                        onChange={(e) => setEditValues({...editValues, min_value: e.target.value})}
                        placeholder="null"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm font-bold text-[#172b4d] dark:text-white outline-none focus:border-blue-500"
                      />
                    ) : (
                      <div className="font-bold text-sm md:text-base text-[#172b4d] dark:text-white">
                        {t.min_value !== null ? `${t.min_value} ${meta.unit}` : '-'}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 w-24">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Max</label>
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={editValues.max_value}
                        onChange={(e) => setEditValues({...editValues, max_value: e.target.value})}
                        placeholder="null"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm font-bold text-[#172b4d] dark:text-white outline-none focus:border-blue-500"
                      />
                    ) : (
                      <div className="font-bold text-sm md:text-base text-[#172b4d] dark:text-white">
                        {t.max_value !== null ? `${t.max_value} ${meta.unit}` : '-'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Section */}
                <div className="flex items-center justify-end gap-4 mt-4 md:mt-0 md:w-1/4">
                  {/* Toggle */}
                  <button 
                    onClick={() => {
                      if (isEditing) {
                        setEditValues({...editValues, is_active: !editValues.is_active});
                      } else {
                        // Optimistic quick toggle if not in edit mode
                        axios.put(`${apiUrl}/api/settings/thresholds/${t.id}`, { is_active: !t.is_active ? 1 : 0 }, { headers: { 'X-DB-Name': dbName } });
                        setThresholds(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !t.is_active ? 1 : 0 } : x));
                      }
                    }}
                    className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                      (isEditing ? editValues.is_active : t.is_active) 
                        ? 'bg-green-500' 
                        : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${
                      (isEditing ? editValues.is_active : t.is_active) ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>

                  {/* Edit/Save Button */}
                  {isEditing ? (
                    <button 
                      onClick={() => handleSaveClick(t.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 font-bold rounded-lg hover:bg-green-200 dark:hover:bg-green-500/30 transition-colors"
                    >
                      <Check size={16} /> <span className="text-sm">Save</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleEditClick(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300 font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                    >
                      <Edit size={16} /> <span className="text-sm md:hidden">Edit</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Settings;
