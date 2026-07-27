import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';
import { Key, ShieldAlert, CheckCircle, Copy, Clock, Server, Edit, Trash2, Sparkles, X } from 'lucide-react';

const DeviceProvisioning = () => {
  const [companyCode, setCompanyCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [dbName, setDbName] = useState('');
  const [tmuUsername, setTmuUsername] = useState('');
  const [tmuPassword, setTmuPassword] = useState('');
  const [tmuPhone, setTmuPhone] = useState('');
  const [transformerName, setTransformerName] = useState('');
  const [tmuVersion, setTmuVersion] = useState(2);
  
  const [generatedToken, setGeneratedToken] = useState(null);
  const [editingTokenId, setEditingTokenId] = useState(null);
  
  const [tokens, setTokens] = useState([]);
  const [devices, setDevices] = useState([]);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  const { apiUrl } = useApi();
  const navigate = useNavigate();
  const currentRole = sessionStorage.getItem('role');
  const usernameHeader = sessionStorage.getItem('username');
  const companyNameHeader = sessionStorage.getItem('company_name');
  
  useEffect(() => {
    if (currentRole !== 'admin') {
      navigate('/');
      return;
    }
    fetchTokens();
    fetchDevices();
    
    // Auto refresh tokens and devices every 3 seconds
    const interval = setInterval(() => {
      fetchTokens();
      fetchDevices();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [currentRole, navigate, apiUrl]);

  const fetchTokens = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/provision/tokens`, {
        headers: { 
          'X-Username': usernameHeader,
          'X-Role': currentRole,
          'X-Company-Name': companyNameHeader
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTokens(data);
      }
    } catch (err) {
      console.error('Failed to fetch tokens', err);
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/provision/devices`, {
        headers: { 
          'X-Username': usernameHeader,
          'X-Role': currentRole,
          'X-Company-Name': companyNameHeader
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDevices(data);
      }
    } catch (err) {
      console.error('Failed to fetch devices', err);
    }
  };

  const handleGenerateCompanyCode = async () => {
    if (!companyName) {
      setError('Masukkan Company Name terlebih dahulu sebelum auto-generate kode.');
      return;
    }
    setIsGeneratingCode(true);
    setError('');
    
    try {
      const response = await fetch(`${apiUrl}/api/provision/generate-company-code?name=${encodeURIComponent(companyName)}`, {
        headers: { 
          'X-Username': usernameHeader,
          'X-Role': currentRole,
          'X-Company-Name': companyNameHeader
        }
      });
      const data = await response.json();
      if (response.ok) {
        setCompanyCode(data.company_code);
      } else {
        setError(data.error || 'Gagal membuat kode perusahaan otomatis');
      }
    } catch (err) {
      setError('Cannot connect to server');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const clearForm = () => {
    setCompanyCode('');
    setCompanyName('');
    setDbName('');
    setTmuUsername('');
    setTmuPassword('');
    setTmuPhone('');
    setTransformerName('');
    setTmuVersion(2);
    setEditingTokenId(null);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setGeneratedToken(null);
    setIsLoading(true);

    const payload = { 
      company_code: companyCode, 
      company_name: companyName,
      db_name: dbName,
      tmu_username: tmuUsername,
      tmu_password: tmuPassword,
      tmu_phone: tmuPhone,
      transformer_name: transformerName,
      tmu_version: Number(tmuVersion) 
    };

    try {
      if (editingTokenId) {
        // Edit Mode
        const response = await fetch(`${apiUrl}/api/provision/tokens/${editingTokenId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Username': usernameHeader,
            'X-Role': currentRole,
            'X-Company-Name': companyNameHeader
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
          setSuccess('Token berhasil diupdate!');
          clearForm();
          fetchTokens();
        } else {
          setError(data.error || 'Gagal update token');
        }
      } else {
        // Create Mode
        const response = await fetch(`${apiUrl}/api/provision/generate-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Username': usernameHeader,
            'X-Role': currentRole,
            'X-Company-Name': companyNameHeader
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
          setGeneratedToken(data);
          setSuccess('Token generated successfully!');
          clearForm();
          fetchTokens();
        } else {
          setError(data.error || 'Failed to generate token');
        }
      }
    } catch (err) {
      setError('Cannot connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus token ini?')) return;
    
    try {
      const response = await fetch(`${apiUrl}/api/provision/tokens/${id}`, {
        method: 'DELETE',
        headers: { 
          'X-Username': usernameHeader,
          'X-Role': currentRole,
          'X-Company-Name': companyNameHeader
        }
      });
      if (response.ok) {
        if (editingTokenId === id) clearForm();
        fetchTokens();
      } else {
        const data = await response.json();
        setError(data.error || 'Gagal menghapus token');
      }
    } catch (err) {
      setError('Koneksi bermasalah');
    }
  };

  const handleEditClick = (t) => {
    setEditingTokenId(t.id);
    setCompanyCode(t.company_code);
    setCompanyName(t.company_name || '');
    setDbName(t.db_name || '');
    setTmuUsername(t.tmu_username || '');
    setTmuPassword(t.tmu_password || '');
    setTmuPhone(t.tmu_phone || '');
    setTransformerName(t.transformer_name || '');
    setTmuVersion(t.tmu_version || 2);
    
    setError('');
    setSuccess('');
    setGeneratedToken(null);
    
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  if (currentRole !== 'admin') return null;

  return (
    <div className="max-w-6xl mx-auto w-full mt-8 space-y-8 relative">
      {/* Generate / Edit Token Section */}
      <div className="bg-white dark:bg-[#151521] rounded-2xl shadow-sm border border-[#dfe1e6] dark:border-white/10 overflow-hidden">
        <div className="p-6 border-b border-[#dfe1e6] dark:border-white/10 flex items-center justify-between bg-[#f4f5f7]/50 dark:bg-white/5">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${editingTokenId ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'bg-[#4c9aff]/10 text-[#0052cc] dark:text-[#4c9aff]'}`}>
              {editingTokenId ? <Edit size={24} /> : <Key size={24} />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#172b4d] dark:text-white font-heading">
                {editingTokenId ? 'Edit Provisioning Token' : 'Generate Provisioning Token'}
              </h2>
              <p className="text-[#5e6c84] dark:text-[#94a3b8] text-sm mt-1">
                {editingTokenId ? 'Update detail token yang belum dipakai.' : 'Create a single-use token for Raspberry Pi setup.'}
              </p>
            </div>
          </div>
          {editingTokenId && (
            <button 
              onClick={clearForm}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-white dark:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={16} /> Cancel Edit
            </button>
          )}
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                <ShieldAlert size={18} />
                {error}
              </div>
            )}
            {success && !generatedToken && (
              <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle size={18} />
                {success}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Company Name</label>
                  <input 
                    type="text" 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#4c9aff]/20 transition-all"
                    placeholder="e.g. PT. Bambang Djaja"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Company Code</label>
                    <button 
                      type="button" 
                      onClick={handleGenerateCompanyCode}
                      disabled={isGeneratingCode}
                      className="text-xs flex items-center gap-1 text-[#0052cc] hover:text-[#0047b3] disabled:opacity-50"
                    >
                      <Sparkles size={14} /> Auto
                    </button>
                  </div>
                  <input 
                    type="text" 
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#4c9aff]/20 transition-all uppercase"
                    placeholder="e.g. PT-ABC"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Database Name</label>
                <input 
                  type="text" 
                  value={dbName}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val.length > 0 && !val.startsWith('db_')) {
                      val = 'db_' + val.replace(/^db_/, '');
                    }
                    setDbName(val);
                  }}
                  className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#4c9aff]/20 transition-all"
                  placeholder="e.g. db_bnd"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[#172b4d] dark:text-white">TMU Username</label>
                  <input 
                    type="text" 
                    value={tmuUsername}
                    onChange={(e) => setTmuUsername(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#4c9aff]/20 transition-all"
                    placeholder="e.g. admin_bnd"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[#172b4d] dark:text-white">TMU Password</label>
                  <input 
                    type="text" 
                    value={tmuPassword}
                    onChange={(e) => setTmuPassword(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#4c9aff]/20 transition-all"
                    placeholder="password"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Phone Number (WhatsApp)</label>
                <input 
                  type="tel" 
                  value={tmuPhone}
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^0-9]/g, '');
                    if (val.startsWith('62')) val = '0' + val.substring(2);
                    if (val.length > 0 && !val.startsWith('0')) val = '0' + val;
                    setTmuPhone(val);
                  }}
                  className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#4c9aff]/20 transition-all"
                  placeholder="e.g. 08123456789"
                  required
                />
                <p className="text-xs text-[#5e6c84] dark:text-[#94a3b8] mt-1.5 ml-1">Gunakan format 08... (Contoh: 08123456789)</p>
              </div>

              <div className="space-y-3 md:col-span-2">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white flex justify-between items-center">
                  <span>Nama Trafo</span>
                </label>
                <div className="flex gap-2 items-center animate-fade-in">
                  <input 
                    type="text" 
                    value={transformerName}
                    onChange={(e) => setTransformerName(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] transition-all"
                    placeholder="Masukkan Nama Trafo (contoh: Trafo 1)"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">TMU Version</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-[#172b4d] dark:text-white">
                    <input 
                      type="radio" 
                      value={1} 
                      checked={tmuVersion == 1} 
                      onChange={(e) => setTmuVersion(e.target.value)} 
                      className="accent-[#0052cc]"
                    /> 
                    v1
                  </label>
                  <label className="flex items-center gap-2 text-[#172b4d] dark:text-white">
                    <input 
                      type="radio" 
                      value={2} 
                      checked={tmuVersion == 2} 
                      onChange={(e) => setTmuVersion(e.target.value)}
                      className="accent-[#0052cc]"
                    /> 
                    v2
                  </label>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className={`w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed ${
                  editingTokenId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-[#0052cc] hover:bg-[#0047b3]'
                }`}
              >
                {isLoading ? (editingTokenId ? 'Updating...' : 'Generating...') : (editingTokenId ? 'Update Token' : 'Generate Token')}
              </button>
            </form>
          </div>
          
          {/* Result Panel */}
          <div>
            {generatedToken ? (
              <div className="h-full bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30 p-6 flex flex-col justify-center items-center text-center">
                <CheckCircle className="text-emerald-500 mb-4" size={48} />
                <h3 className="text-lg font-bold text-[#172b4d] dark:text-white mb-2">Token Generated!</h3>
                
                <div className="bg-white dark:bg-[#070a13] border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-4 flex items-center justify-between w-full mb-4 shadow-sm">
                  <span className="text-3xl font-mono tracking-widest font-bold text-indigo-700 dark:text-indigo-400">
                    {generatedToken.token}
                  </span>
                  <div className="flex items-center gap-2">
                    {isCopied && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-fade-in">Copied!</span>}
                    <button 
                      onClick={() => copyToClipboard(generatedToken.token)}
                      className="p-2 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:hover:bg-indigo-800/60 text-indigo-700 dark:text-indigo-300 rounded-lg transition-colors"
                      title="Copy to clipboard"
                    >
                      <Copy size={20} />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-[#5e6c84] dark:text-[#94a3b8]">
                  <Clock size={16} />
                  Expires at: {new Date(generatedToken.expires_at).toLocaleString()}
                </div>
                <p className="mt-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-3 py-1.5 rounded-full">
                  Give this 6-digit token to the field technician.
                </p>
              </div>
            ) : (
              <div className="h-full bg-[#f4f5f7]/50 dark:bg-white/5 rounded-xl border border-dashed border-[#dfe1e6] dark:border-white/10 p-6 flex flex-col justify-center items-center text-center text-[#5e6c84] dark:text-[#94a3b8]">
                {editingTokenId ? (
                  <>
                    <Edit size={48} className="mb-4 opacity-50" />
                    <p>Edit parameter token pada form di samping, lalu tekan Update.</p>
                  </>
                ) : (
                  <>
                    <Key size={48} className="mb-4 opacity-50" />
                    <p>Fill the form to generate a new token</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Token History */}
        <div className="bg-white dark:bg-[#151521] rounded-2xl shadow-sm border border-[#dfe1e6] dark:border-white/10 overflow-hidden">
          <div className="p-4 border-b border-[#dfe1e6] dark:border-white/10 flex items-center gap-3 bg-[#f4f5f7]/50 dark:bg-white/5">
            <Clock size={20} className="text-[#0052cc]" />
            <h3 className="font-bold text-[#172b4d] dark:text-white font-heading">Token History</h3>
          </div>
          <div className="overflow-auto max-h-80">
            <table className="w-full text-left text-sm relative">
              <thead className="bg-[#f4f5f7] dark:bg-[#070a13] text-[#5e6c84] dark:text-[#94a3b8] sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3 font-semibold">Token</th>
                  <th className="p-3 font-semibold">Company</th>
                  <th className="p-3 font-semibold">Ver</th>
                  <th className="p-3 font-semibold">Created</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe1e6] dark:divide-white/10">
                {tokens.length === 0 ? (
                  <tr><td colSpan="6" className="p-4 text-center text-gray-500">No tokens found</td></tr>
                ) : tokens.map(t => {
                  const isExpired = new Date(t.expires_at) < new Date();
                  let statusStr = "🟡 Pending";
                  let statusClass = "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30";
                  if (t.is_used) {
                    statusStr = "✅ Used";
                    statusClass = "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30";
                  } else if (isExpired) {
                    statusStr = "⛔ Expired";
                    statusClass = "text-red-600 bg-red-100 dark:bg-red-900/30";
                  }

                  return (
                    <tr key={t.id} className={`hover:bg-gray-50 dark:hover:bg-white/5 text-[#172b4d] dark:text-gray-300 ${editingTokenId === t.id ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`}>
                      <td className="p-3 font-mono">{t.token}</td>
                      <td className="p-3">{t.company_code}</td>
                      <td className="p-3">v{t.tmu_version}</td>
                      <td className="p-3 text-xs text-[#5e6c84] dark:text-[#94a3b8]">{new Date(t.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusClass}`}>
                          {statusStr}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {!t.is_used && (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleEditClick(t)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg" title="Edit Token">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(t.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg" title="Delete Token">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Registered Devices */}
        <div className="bg-white dark:bg-[#151521] rounded-2xl shadow-sm border border-[#dfe1e6] dark:border-white/10 overflow-hidden">
          <div className="p-4 border-b border-[#dfe1e6] dark:border-white/10 flex items-center gap-3 bg-[#f4f5f7]/50 dark:bg-white/5">
            <Server size={20} className="text-[#0052cc]" />
            <h3 className="font-bold text-[#172b4d] dark:text-white font-heading">Registered Devices</h3>
          </div>
          <div className="overflow-auto max-h-80">
            <table className="w-full text-left text-sm relative">
              <thead className="bg-[#f4f5f7] dark:bg-[#070a13] text-[#5e6c84] dark:text-[#94a3b8] sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3 font-semibold">Serial No</th>
                  <th className="p-3 font-semibold">Company</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe1e6] dark:divide-white/10">
                {devices.length === 0 ? (
                  <tr><td colSpan="3" className="p-4 text-center text-gray-500">No devices found</td></tr>
                ) : devices.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-white/5 text-[#172b4d] dark:text-gray-300">
                    <td className="p-3 font-mono text-xs">{d.serial_number.substring(0, 12)}...</td>
                    <td className="p-3">{d.company_code} (v{d.tmu_version})</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        d.status === 'online' 
                          ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30'
                          : d.status === 'provisioned'
                          ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/30'
                          : 'text-gray-600 bg-gray-100 dark:bg-gray-800'
                      }`}>
                        {d.status === 'online' ? '🟢 Online' : d.status === 'provisioned' ? '🔵 Provisioned' : '🔴 Offline'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceProvisioning;
