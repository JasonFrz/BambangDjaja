import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';
import { Activity, ShieldAlert, X, CheckCircle2, Edit, Trash2, Plus, Zap } from 'lucide-react';

const ManageTransformers = () => {
  const [transformers, setTransformers] = useState([]);
  const [isLoadingTransformers, setIsLoadingTransformers] = useState(true);
  const [users, setUsers] = useState([]);
  
  // Create/Edit Form State
  const [showForm, setShowForm] = useState(false);
  const [editingTrafoId, setEditingTrafoId] = useState(null);
  
  const [name, setName] = useState('');
  const [powerCapacity, setPowerCapacity] = useState('1000');
  const [type, setType] = useState('DyN');
  const [status, setStatus] = useState('Offline');
  const [companyName, setCompanyName] = useState('');
  const [username, setUsername] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { apiUrl } = useApi();
  const navigate = useNavigate();
  const currentRole = sessionStorage.getItem('role');
  const token = sessionStorage.getItem('token');
  
  useEffect(() => {
    if (currentRole !== 'admin') {
      navigate('/');
      return;
    }
    fetchTransformers();
    fetchUsers();
  }, [currentRole, navigate]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch users");
    }
  };

  const fetchTransformers = async () => {
    setIsLoadingTransformers(true);
    try {
      const response = await fetch(`${apiUrl}/api/transformers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setTransformers(data);
      }
    } catch (err) {
      console.error("Failed to fetch transformers");
    } finally {
      setIsLoadingTransformers(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (!editingTrafoId) {
       setError("Cannot create transformer manually.");
       setIsLoading(false);
       return;
    }

    try {
      const url = `${apiUrl}/api/transformers/${editingTrafoId}`;
      const method = 'PUT';
      const body = JSON.stringify({ 
        name, 
        power_capacity: `${powerCapacity}kVA`, 
        type, 
        status, 
        company_name: companyName, 
        username 
      });

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Transformer updated successfully!`);
        resetForm();
        fetchTransformers();
      } else {
        setError(data.error || `Failed to update transformer`);
      }
    } catch (err) {
      setError('Cannot connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (t) => {
    setEditingTrafoId(t.id);
    setName(t.name);
    // Remove "kVA" for the number input
    setPowerCapacity(t.power_capacity.replace('kVA', ''));
    setType(t.type);
    setStatus(t.status);
    setCompanyName(t.company_name || '');
    setUsername(t.username || '');
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const resetForm = () => {
    setName('');
    setPowerCapacity('1000');
    setType('DyN');
    setStatus('Offline');
    setCompanyName('');
    setUsername('');
    setShowForm(false);
    setEditingTrafoId(null);
  };

  if (currentRole !== 'admin') return null;

  return (
    <div className="max-w-6xl mx-auto w-full mt-8 space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#151521] p-6 rounded-2xl shadow-sm border border-[#dfe1e6] dark:border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-[#172b4d] dark:text-white flex items-center gap-2">
            <Activity className="text-[#0052cc] dark:text-[#4c9aff]" />
            Manage Transformers
          </h1>
          <p className="text-[#5e6c84] dark:text-[#94a3b8] text-sm mt-1">
            Edit and manage transformers
          </p>
        </div>
        
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
          <ShieldAlert size={18} />
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      {/* CREATE/EDIT FORM */}
      {showForm && (
        <div className="bg-white dark:bg-[#151521] rounded-2xl shadow-sm border border-[#dfe1e6] dark:border-white/10 overflow-hidden mb-6 animate-slide-up-fade">
          <div className="p-4 border-b border-[#dfe1e6] dark:border-white/10 flex justify-between items-center bg-[#f4f5f7]/50 dark:bg-white/5">
            <h2 className="text-lg font-bold text-[#172b4d] dark:text-white">
              {editingTrafoId ? `Edit Transformer` : 'Add New Transformer'}
            </h2>
            <button onClick={resetForm} className="text-[#5e6c84] hover:text-red-500 transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="p-6">
            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Transformer Name / SN</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-2.5 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] transition-all"
                  placeholder="e.g. 1800004519 (Trafo Mech)"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Status</label>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-2.5 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] transition-all"
                >
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Company Name</label>
                <select 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-2.5 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] transition-all"
                >
                  <option value="">Select Company</option>
                  {[...new Set(users.map(u => u.company_name).filter(Boolean))].map(company => (
                    <option key={company} value={company}>{company}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Username</label>
                <select 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-2.5 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] transition-all"
                >
                  <option value="">Select Username</option>
                  {[...new Set(users.map(u => u.username).filter(Boolean))].map(uname => (
                    <option key={uname} value={uname}>{uname}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Power Capacity (kVA)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={powerCapacity}
                    onChange={(e) => setPowerCapacity(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-2.5 pl-4 pr-12 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] transition-all"
                    placeholder="e.g. 1000"
                    min="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#5e6c84] dark:text-[#94a3b8] font-medium pointer-events-none">
                    kVA
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Type</label>
                <input 
                  type="text" 
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-2.5 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] transition-all"
                  placeholder="e.g. DyN"
                />
              </div>
              <div className="lg:col-span-3 flex justify-end">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className={`px-6 py-2.5 rounded-xl text-white font-semibold text-sm transition-colors disabled:opacity-70 ${editingTrafoId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-[#0052cc] hover:bg-[#0047b3]'}`}
                >
                  {isLoading ? 'Updating...' : 'Update Transformer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white dark:bg-[#151521] rounded-2xl shadow-sm border border-[#dfe1e6] dark:border-white/10 overflow-hidden">
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 bg-white dark:bg-[#151521]">
              <tr className="bg-[#f4f5f7]/90 dark:bg-white/5 border-b border-[#dfe1e6] dark:border-white/10 backdrop-blur-sm">
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">ID</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Transformer Name</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Company</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Username</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Specs</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfe1e6] dark:divide-white/10">
              {isLoadingTransformers ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-[#5e6c84] dark:text-[#94a3b8]">
                    Loading transformers...
                  </td>
                </tr>
              ) : transformers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-[#5e6c84] dark:text-[#94a3b8]">
                    No transformers found.
                  </td>
                </tr>
              ) : (
                transformers.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 text-sm text-[#5e6c84] dark:text-gray-400">
                      #{t.id}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-[#172b4d] dark:text-white">{t.name}</div>
                    </td>
                    <td className="p-4 text-sm font-medium text-[#172b4d] dark:text-gray-300">
                      {t.company_name || '-'}
                    </td>
                    <td className="p-4 text-sm font-medium text-[#172b4d] dark:text-gray-300">
                      {t.username || '-'}
                    </td>
                    <td className="p-4 text-sm text-[#5e6c84] dark:text-[#94a3b8]">
                      {t.power_capacity} | {t.type}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.status === 'Online' 
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                          : t.status === 'Maintenance'
                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${t.status === 'Online' ? 'bg-emerald-500' : t.status === 'Maintenance' ? 'bg-orange-500' : 'bg-gray-400'}`}></div>
                        {t.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => handleEditClick(t)}
                          className="p-2 inline-flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 transition-colors"
                          title="Edit Transformer"
                        >
                          <Edit size={16} />
                        </button>
                        
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManageTransformers;
