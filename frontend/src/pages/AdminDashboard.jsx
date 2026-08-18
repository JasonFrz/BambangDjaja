import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Database, Table, Trash2, AlertTriangle, ChevronRight, 
  RefreshCw, Server, Search, Users, UserPlus, Edit2, X, 
  Eye, EyeOff, LayoutDashboard, Download, Menu, LogOut, CheckCircle2, XCircle, MessageCircle, ArrowLeft, ChevronDown
} from 'lucide-react';
import { useApi } from '../contexts/ApiContext';
import { useTheme } from '../contexts/ThemeContext';
import { useDialog } from '../contexts/DialogContext';
import EnergyLoader from '../components/EnergyLoader';
import { QRCodeSVG } from 'qrcode.react';

const CustomSelect = ({ value, onChange, options, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className={`relative ${className}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-left outline-none text-white flex justify-between items-center gap-3"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown size={16} className={`transition-transform text-gray-500 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 left-0 w-full top-full mt-2 bg-[#1a1a24] border border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] z-50 py-1 overflow-hidden">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${value === opt.value ? 'text-blue-400 font-bold bg-white/5' : 'text-gray-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const AdminDashboard = () => {
  const { apiUrl } = useApi();
  const { isDarkMode } = useTheme();
  const { alert } = useDialog();

  const [activeTab, setActiveTab] = useState('overview'); // overview, databases, admins, users, whatsapp

  // States
  const [stats, setStats] = useState({ databases: 0, tables: 0, appUsers: 0, activeAdmins: 0 });
  const [databases, setDatabases] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [waStatus, setWaStatus] = useState({ ready: false, state: 'DISCONNECTED', qr: '', connectedSince: null, messagesSentToday: 0, connectedPhone: '' });

  // Database Tab States
  const [selectedDb, setSelectedDb] = useState(null);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [dataLimit, setDataLimit] = useState('100');
  const [dataSort, setDataSort] = useState('latest');
  const [searchTermDb, setSearchTermDb] = useState('');

  // Loading States
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingDbs, setIsLoadingDbs] = useState(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);
  const [isLoadingAllUsers, setIsLoadingAllUsers] = useState(false);

  // Modal & Form States
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminForm, setAdminForm] = useState({ username: '', password: '' });
  const [adminFormError, setAdminFormError] = useState('');
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [searchAdmin, setSearchAdmin] = useState('');
  const [searchAllUser, setSearchAllUser] = useState('');
  const [searchTermTableData, setSearchTermTableData] = useState('');
  const [roleFilterAllUser, setRoleFilterAllUser] = useState('all');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dbToDelete, setDbToDelete] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOutWA, setIsLoggingOutWA] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('admin') !== 'true') {
      window.location.href = '/login';
    } else {
      fetchWAStatus();
      if (activeTab === 'overview') {
        fetchStats();
        fetchDatabases();
        fetchAllUsers();
      } else if (activeTab === 'databases') {
        fetchDatabases();
      } else if (activeTab === 'admins') {
        fetchAdmins();
      } else if (activeTab === 'users') {
        fetchAllUsers();
      }
    }
  }, [activeTab]);

  useEffect(() => {
    let interval;
    if (activeTab === 'whatsapp' || activeTab === 'overview') {
      interval = setInterval(fetchWAStatus, 10000);
    }
    return () => clearInterval(interval);
  }, [activeTab]);

  const axiosInstance = axios.create({
    baseURL: apiUrl,
    headers: { 'X-Super-Admin': 'true' }
  });

  const handleLogout = () => {
    sessionStorage.removeItem('admin');
    window.location.href = '/login';
  };

  // API Calls
  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const res = await axiosInstance.get('/api/admin/stats');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const fetchDatabases = async () => {
    setIsLoadingDbs(true);
    try {
      const res = await axiosInstance.get('/api/admin/databases');
      setDatabases(res.data.databases || []);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
    } finally {
      setIsLoadingDbs(false);
    }
  };

  const fetchTables = async (dbName) => {
    setIsLoadingTables(true);
    setSelectedDb(dbName);
    setSelectedTable(null);
    setTableData([]);
    try {
      const res = await axiosInstance.get(`/api/admin/databases/${dbName}/tables`);
      setTables(res.data.tables || []);
    } catch (err) {} finally {
      setIsLoadingTables(false);
    }
  };

  const fetchTableData = async (dbName, tableName, limit = dataLimit, sort = dataSort) => {
    setIsLoadingData(true);
    setSelectedTable(tableName);
    setSearchTermTableData('');
    try {
      const res = await axiosInstance.get(`/api/admin/databases/${dbName}/tables/${tableName}?limit=${limit}&sort=${sort}`);
      setTableData(res.data.data || []);
    } catch (err) {
      setTableData([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchAdmins = async () => {
    setIsLoadingAdmins(true);
    try {
      const res = await axiosInstance.get('/api/admin/users');
      setAdminUsers(res.data.data || []);
    } catch (err) {} finally {
      setIsLoadingAdmins(false);
    }
  };

  const fetchAllUsers = async () => {
    setIsLoadingAllUsers(true);
    try {
      const res = await axiosInstance.get('/api/admin/all-users');
      setAllUsers(res.data.data || []);
    } catch (err) {} finally {
      setIsLoadingAllUsers(false);
    }
  };

  const fetchWAStatus = async () => {
    try {
      const res = await axiosInstance.get('/api/whatsapp/status');
      setWaStatus(res.data);
    } catch (err) {}
  };

  const handleLogoutWA = async () => {
    setIsLoggingOutWA(true);
    try {
      await axiosInstance.post('/api/whatsapp/logout');
      alert('Restarting WhatsApp service. Please wait a few seconds for a new QR Code.');
      setWaStatus({ ready: false, state: 'DISCONNECTED', qr: '', connectedSince: null, messagesSentToday: 0, connectedPhone: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to restart WhatsApp');
    } finally {
      setIsLoggingOutWA(false);
    }
  };

  const handleDeleteDb = async () => {
    if (deleteConfirmation !== dbToDelete) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/api/admin/databases/${dbToDelete}`);
      setShowDeleteModal(false);
      setDbToDelete('');
      setDeleteConfirmation('');
      setSelectedDb(null);
      fetchDatabases();
      if (activeTab === 'overview') fetchStats();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete database');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    setAdminFormError('');
    setIsSavingAdmin(true);
    try {
      if (editingAdmin) {
        await axiosInstance.put(`/api/admin/users/${editingAdmin.id}`, adminForm);
      } else {
        await axiosInstance.post('/api/admin/users', adminForm);
      }
      setShowAdminModal(false);
      fetchAdmins();
    } catch (err) {
      setAdminFormError(err.response?.data?.error || 'Failed to save admin user');
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (id) => {
    if (!window.confirm('Are you sure you want to delete this admin?')) return;
    try {
      await axiosInstance.delete(`/api/admin/users/${id}`);
      fetchAdmins();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete admin user');
    }
  };

  const downloadAllUsersCSV = () => {
    if (allUsers.length === 0) return;
    const headers = ['id', 'username', 'role', 'email', 'nomor_telpon', 'created_at'];
    const csvContent = [
      headers.join(','),
      ...allUsers.map(u => headers.map(h => `"${u[h] || ''}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `app_users_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const SidebarItem = ({ icon: Icon, label, id, isCustomIcon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
        activeTab === id 
        ? 'bg-gray-100/50 dark:bg-white/10 text-white shadow-sm' 
        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
      }`}
    >
      {isCustomIcon ? (
        <img src="/wa.png" alt="WA" className="w-5 h-5 object-contain" style={{ filter: activeTab === id ? 'brightness(1)' : 'grayscale(100%) opacity(0.7)' }} />
      ) : (
        <Icon size={20} />
      )}
      {label}
    </button>
  );

  const BottomNavItem = ({ icon: Icon, label, id, isCustomIcon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors flex-1 ${
        activeTab === id ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {isCustomIcon ? (
        <img src="/wa.png" alt="WA" className="w-5 h-5 object-contain mb-1" style={{ filter: activeTab === id ? 'brightness(1) sepia(1) hue-rotate(180deg) saturate(3)' : 'grayscale(100%) opacity(0.5)' }} />
      ) : (
        <Icon size={20} className="mb-1" />
      )}
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'dark' : ''} bg-[#101014] text-white font-sans`}>
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col inset-y-0 left-0 z-50 w-72 bg-[#151521] border-r border-white/5">
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
            <Server size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight leading-tight">Admin panel</h1>
            <p className="text-xs text-gray-400 font-medium">Control panel</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          <SidebarItem icon={LayoutDashboard} label="Overview" id="overview" />
          <SidebarItem icon={Database} label="Databases" id="databases" />
          <SidebarItem icon={Users} label="Admin users" id="admins" />
          <SidebarItem icon={Users} label="App users" id="users" />
          <SidebarItem icon={null} label="WhatsApp" id="whatsapp" isCustomIcon={true} />
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-900/50 text-blue-400 flex items-center justify-center font-bold text-sm">
                A
              </div>
              <span className="font-bold text-sm">admin</span>
            </div>
            <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#1a1a24] pb-[72px] md:pb-0">
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 animate-[fadeIn_0.3s_ease-out]">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-3xl font-bold font-heading mb-1 md:mb-2">Overview</h2>
                  <p className="text-gray-400 text-sm">System summary and connection status.</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {[
                  { label: 'Databases', value: stats.databases },
                  { label: 'Total tables', value: stats.tables },
                  { label: 'App users', value: stats.appUsers },
                  { label: 'Active admins', value: stats.activeAdmins }
                ].map((stat, i) => (
                  <div key={i} className="p-2 md:p-1">
                    <p className="text-gray-400 text-xs md:text-sm font-medium mb-1">{stat.label}</p>
                    <p className="text-2xl md:text-3xl font-bold">{isLoadingStats ? '-' : stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Middle Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Databases Card */}
                <div className="bg-[#151521] border border-white/10 rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg">Databases</h3>
                    <button onClick={() => setActiveTab('databases')} className="text-blue-400 hover:text-blue-300 text-sm font-semibold">View all</button>
                  </div>
                  <div className="space-y-4 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                    {isLoadingDbs ? <EnergyLoader size="small" /> : databases.map(db => (
                      <div key={db} className="flex items-center justify-between border-b border-white/5 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <Database size={20} className="text-gray-400" />
                          <div>
                            <p className="font-bold text-sm">{db}</p>
                            <p className="text-xs text-gray-500">Active database</p>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-green-900/20 text-green-400 text-xs font-bold rounded-lg uppercase">online</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* WhatsApp Card */}
                <div className="bg-[#151521] border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-lg mb-6">WhatsApp session</h3>
                    {waStatus.ready ? (
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-green-900/30 rounded-full flex items-center justify-center">
                          <img src="/wa.png" alt="WA" className="w-6 h-6 object-contain" />
                        </div>
                        <div>
                          <p className="font-bold">{waStatus.connectedPhone || '+62 8XX-XXXX-XXXX'}</p>
                          <p className="text-sm text-gray-400">Active since {new Date(waStatus.connectedSince).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 mb-6 opacity-50">
                        <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center">
                          <img src="/wa.png" alt="WA" className="w-6 h-6 object-contain grayscale" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-400">Not connected</p>
                          <p className="text-sm text-gray-500">Scan QR to connect</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={waStatus.ready ? handleLogoutWA : () => setActiveTab('whatsapp')} 
                    className={`w-full py-3 rounded-xl border font-bold transition-colors mt-4 md:mt-0 ${waStatus.ready ? 'border-red-900/50 text-red-400 hover:bg-red-900/20' : 'border-blue-900/50 text-blue-400 hover:bg-blue-900/20'}`}
                  >
                    {waStatus.ready ? 'Logout WhatsApp' : 'Connect WhatsApp'}
                  </button>
                </div>
              </div>

              {/* App Users Table */}
              <div className="bg-[#151521] border border-white/10 rounded-2xl p-4 md:p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <h3 className="font-bold text-lg">App users</h3>
                  <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                      <input 
                        type="text" 
                        placeholder="Search users..."
                        value={searchAllUser}
                        onChange={e => setSearchAllUser(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-white/30 text-white w-full md:w-64"
                      />
                    </div>
                    <button onClick={downloadAllUsersCSV} className="p-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors" title="Export CSV">
                      <Download size={18} />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm relative">
                    <thead className="sticky top-0 bg-[#151521] z-10">
                      <tr className="text-gray-400 border-b border-white/5">
                        <th className="pb-3 font-medium uppercase text-xs tracking-wider">username</th>
                        <th className="pb-3 font-medium uppercase text-xs tracking-wider">phone number</th>
                        <th className="pb-3 font-medium uppercase text-xs tracking-wider">email</th>
                        <th className="pb-3 font-medium uppercase text-xs tracking-wider">role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {allUsers.filter(u => u.username.toLowerCase().includes(searchAllUser.toLowerCase())).map(u => (
                        <tr key={u.id}>
                          <td className="py-4 font-bold">{u.username}</td>
                          <td className="py-4 text-gray-300">{u.nomor_telpon || '-'}</td>
                          <td className="py-4 text-gray-300">{u.email || '-'}</td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold capitalize ${u.role === 'admin' ? 'bg-blue-900/30 text-blue-400' : u.role === 'superuser' ? 'bg-purple-900/30 text-purple-400' : 'bg-gray-800 text-gray-300'}`}>
                              {u.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DATABASES */}
          {activeTab === 'databases' && (
            <>
              {/* DESKTOP VIEW */}
              <div className="hidden md:flex flex-col md:flex-row h-full animate-[fadeIn_0.3s_ease-out]">
                <div className="w-full md:w-72 border-r border-b md:border-b-0 border-white/5 bg-[#151521] flex flex-col shrink-0 h-[250px] md:h-full">
                  <div className="p-4 border-b border-white/5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                      <input 
                        type="text" 
                        placeholder="Search databases..."
                        value={searchTermDb}
                        onChange={e => setSearchTermDb(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-black/20 border border-white/5 text-sm focus:border-white/20 outline-none text-white"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {databases.filter(d => d.toLowerCase().includes(searchTermDb.toLowerCase())).map(db => (
                      <div key={db} className="bg-white/5 rounded-xl overflow-hidden border border-white/5">
                        <button 
                          onClick={() => fetchTables(db)}
                          className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${selectedDb === db ? 'bg-white/5' : 'hover:bg-white/5'}`}
                        >
                          <div>
                            <p className="font-bold text-sm">{db}</p>
                            <p className="text-xs text-gray-500">{selectedDb === db ? tables.length : '?'} tables</p>
                          </div>
                        </button>
                        {selectedDb === db && (
                          <div className="bg-black/20 p-2 space-y-1 border-t border-white/5">
                            {isLoadingTables ? <EnergyLoader size="small" /> : tables.map(table => (
                              <button
                                key={table}
                                onClick={() => fetchTableData(db, table)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${selectedTable === table ? 'bg-white/10 font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                              >
                                <div className="flex items-center gap-2">
                                  <Table size={14} /> {table}
                                </div>
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 opacity-50" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 flex flex-col bg-[#1a1a24] overflow-hidden">
                  {selectedTable ? (
                    <>
                      <div className="p-4 md:p-6 border-b border-white/5 flex flex-col md:flex-row items-start md:items-end justify-between shrink-0 gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-2xl md:text-3xl font-bold font-heading">{selectedTable}</h2>
                            <span className="px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 text-xs font-bold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-400" /> online</span>
                          </div>
                          <p className="text-gray-400 text-sm">Showing up to {dataLimit} rows</p>
                        </div>
                        <div className="flex flex-col md:flex-row items-end md:items-center gap-3 w-full md:w-auto">
                          <div className="relative w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                            <input 
                              type="text" 
                              placeholder="Search in table..."
                              value={searchTermTableData}
                              onChange={e => setSearchTermTableData(e.target.value)}
                              className="w-full md:w-48 pl-9 pr-4 py-2 rounded-lg bg-black/20 border border-white/10 text-sm focus:border-white/20 outline-none text-white"
                            />
                          </div>
                          <div className="flex gap-2 w-full md:w-auto">
                            <CustomSelect 
                              value={dataLimit} 
                              onChange={val => { setDataLimit(val); fetchTableData(selectedDb, selectedTable, val, dataSort); }} 
                              options={[
                                { value: '100', label: '100 rows' },
                                { value: '500', label: '500 rows' },
                                { value: 'all', label: 'All' }
                              ]}
                              className="flex-1 md:flex-none md:w-32"
                            />
                            <CustomSelect 
                              value={dataSort} 
                              onChange={val => { setDataSort(val); fetchTableData(selectedDb, selectedTable, dataLimit, val); }} 
                              options={[
                                { value: 'latest', label: 'Newest first' },
                                { value: 'oldest', label: 'Oldest first' }
                              ]}
                              className="flex-1 md:flex-none md:w-36"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 p-4 md:p-6 overflow-auto custom-scrollbar">
                        {isLoadingData ? <div className="py-20"><EnergyLoader size="medium" /></div> : tableData.length > 0 ? (
                          <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead>
                              <tr>
                                {Object.keys(tableData[0]).map(key => (
                                  <th key={key} className="px-4 py-2 text-blue-400 font-bold bg-blue-900/20 border border-white/5">{key}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tableData
                                .filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(searchTermTableData.toLowerCase())))
                                .map((row, i) => (
                                <tr key={i}>
                                  {Object.values(row).map((val, j) => (
                                    <td key={j} className="px-4 py-2 border border-white/5 truncate max-w-[200px]" title={String(val)}>{val === null ? '-' : String(val)}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : <p className="text-gray-500 text-center py-20">Table is empty</p>}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500 p-8 text-center">
                      <p>Select a table from the sidebar to view contents</p>
                    </div>
                  )}
                </div>
              </div>

              {/* MOBILE VIEW (Drill-down) */}
              <div className="md:hidden flex flex-col h-full animate-[fadeIn_0.2s_ease-out] p-4 bg-[#0a0a0f]">
                {/* State 1: DB List */}
                {!selectedDb && (
                  <>
                    <h2 className="text-lg font-bold mb-3 text-gray-400">Databases</h2>
                    <div className="relative mb-5">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <input 
                        type="text" 
                        placeholder="Search databases..."
                        value={searchTermDb}
                        onChange={e => setSearchTermDb(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#151521] border border-white/5 text-sm focus:border-white/20 outline-none text-white shadow-sm"
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pb-20 custom-scrollbar">
                      {databases.filter(d => d.toLowerCase().includes(searchTermDb.toLowerCase())).map(db => (
                        <button 
                          key={db}
                          onClick={() => fetchTables(db)}
                          className="w-full bg-[#151521] border-b border-white/5 last:border-0 rounded-2xl p-5 flex items-center justify-between transition-colors active:bg-white/5"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#0a0a0f] border border-white/5 text-blue-400 rounded-xl flex items-center justify-center shadow-inner">
                              <Database size={22} />
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-lg mb-0.5">{db}</p>
                              <p className="text-gray-400 text-sm">Active database</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                            <ChevronRight size={18} className="text-gray-500" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* State 2: Table List */}
                {selectedDb && !selectedTable && (
                  <>
                    <div className="flex items-center gap-3 mb-6">
                      <button onClick={() => setSelectedDb(null)} className="p-2 -ml-2 text-gray-300 hover:text-white active:bg-white/5 rounded-xl transition-colors">
                        <ArrowLeft size={24} />
                      </button>
                      <div>
                        <h2 className="text-xl font-bold">{selectedDb}</h2>
                        <p className="text-gray-400 text-sm">{tables.length} tables · connected</p>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pb-20 custom-scrollbar">
                      {isLoadingTables ? <div className="py-10"><EnergyLoader size="medium" /></div> : tables.map(table => (
                        <button 
                          key={table}
                          onClick={() => fetchTableData(selectedDb, table)}
                          className="w-full bg-[#151521] border-b border-white/5 last:border-0 rounded-2xl p-5 flex items-center justify-between transition-colors active:bg-white/5"
                        >
                          <div className="flex items-center gap-4">
                            <Table size={22} className="text-gray-300" />
                            <p className="font-bold text-base">{table}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-1 bg-green-900/20 text-green-400 text-xs font-bold rounded-lg border border-green-500/20">online</span>
                            <ChevronRight size={18} className="text-gray-500" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* State 3: Row Data (Cards) */}
                {selectedDb && selectedTable && (
                  <>
                    <div className="flex flex-col gap-4 mb-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button onClick={() => setSelectedTable(null)} className="p-2 -ml-2 text-gray-300 hover:text-white active:bg-white/5 rounded-xl transition-colors">
                            <ArrowLeft size={24} />
                          </button>
                          <div>
                            <h2 className="text-xl font-bold capitalize">{selectedTable}</h2>
                            <p className="text-green-400 text-sm font-medium">{tableData.length > 0 ? 'online' : 'empty'} · {tableData.length} rows</p>
                          </div>
                        </div>
                        <button onClick={() => fetchTableData(selectedDb, selectedTable)} className="p-2 text-gray-400 hover:text-white active:bg-white/5 rounded-xl transition-colors">
                          <RefreshCw size={22} />
                        </button>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                          type="text" 
                          placeholder="Search in table..."
                          value={searchTermTableData}
                          onChange={e => setSearchTermTableData(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#151521] border border-white/5 text-sm focus:border-white/20 outline-none text-white shadow-sm"
                        />
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-4 pb-20 custom-scrollbar">
                      {isLoadingData ? <div className="py-20"><EnergyLoader size="medium" /></div> : tableData.length > 0 ? (
                        tableData
                          .filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(searchTermTableData.toLowerCase())))
                          .map((row, i) => (
                          <div key={i} className="bg-[#151521] border border-white/5 rounded-2xl p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
                              <span className="font-bold text-lg">{row.username || row.name || row.id || `Row ${i+1}`}</span>
                              {row.role && <span className="px-3 py-1 bg-blue-900/30 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-full">{row.role}</span>}
                            </div>
                            <div className="space-y-3">
                              {Object.entries(row).map(([key, val]) => (
                                <div key={key} className="flex justify-between items-start gap-4">
                                  <span className="text-gray-400 text-sm">{key}</span>
                                  <span className="font-semibold text-sm text-right break-all">{val === null ? '-' : String(val)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : <p className="text-gray-500 text-center py-20">Table is empty</p>}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* TAB: ADMINS */}
          {activeTab === 'admins' && (
             <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out]">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div>
                    <h2 className="text-3xl font-bold font-heading mb-1">Admin Users</h2>
                    <p className="text-gray-400 text-sm">Manage system administrator access.</p>
                 </div>
                 {!showAdminModal && (
                   <button onClick={() => { setEditingAdmin(null); setAdminForm({ username: '', password: '' }); setShowAdminModal(true); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-colors flex items-center gap-2">
                     <UserPlus size={16} /> Add Admin
                   </button>
                 )}
               </div>

               {showAdminModal && (
                 <div className="bg-[#151521] border border-white/10 rounded-2xl p-6">
                   <h3 className="font-bold text-lg mb-4">{editingAdmin ? 'Edit Admin' : 'Add New Admin'}</h3>
                   <form onSubmit={handleSaveAdmin} className="space-y-4">
                     {adminFormError && <p className="text-red-400 text-sm">{adminFormError}</p>}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold mb-2">Username</label>
                          <input type="text" required value={adminForm.username} onChange={e => setAdminForm({...adminForm, username: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-white" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-2">Password <span className="text-gray-400 font-normal">{editingAdmin && '(Leave blank to keep current)'}</span></label>
                          <input type="password" required={!editingAdmin} value={adminForm.password} onChange={e => setAdminForm({...adminForm, password: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-white" />
                        </div>
                     </div>
                     <div className="flex justify-end gap-3 pt-4">
                       <button type="button" onClick={() => setShowAdminModal(false)} className="px-4 py-2 rounded-lg font-semibold hover:bg-white/5 transition-colors">Cancel</button>
                       <button type="submit" disabled={isSavingAdmin} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors">Save</button>
                     </div>
                   </form>
                 </div>
               )}

               <div className="bg-[#151521] border border-white/10 rounded-2xl p-4 md:p-6 flex flex-col max-h-[70vh]">
                 <div className="flex-1 overflow-auto custom-scrollbar">
                   <table className="w-full text-left text-sm relative whitespace-nowrap">
                     <thead className="sticky top-0 bg-[#151521] z-10">
                       <tr className="text-gray-400 border-b border-white/5">
                         <th className="pb-3 px-2">Username</th>
                         <th className="pb-3 px-2">Role</th>
                         <th className="pb-3 px-2">Created at</th>
                         <th className="pb-3 px-2 text-right">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {adminUsers.map(user => (
                         <tr key={user.id}>
                           <td className="py-4 px-2 font-bold">{user.username}</td>
                           <td className="py-4 px-2 capitalize">{user.role || 'Admin'}</td>
                           <td className="py-4 px-2 text-gray-400">{new Date(user.created_at).toLocaleString()}</td>
                           <td className="py-4 px-2 flex justify-end gap-2">
                             <button onClick={() => { setEditingAdmin(user); setAdminForm({ username: user.username, password: '' }); setShowAdminModal(true); }} className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg" title="Edit"><Edit2 size={16} /></button>
                             <button onClick={() => handleDeleteAdmin(user.id)} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg" title="Delete"><Trash2 size={16} /></button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>
          )}

          {/* TAB: APP USERS */}
          {activeTab === 'users' && (
             <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out]">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div>
                    <h2 className="text-3xl font-bold font-heading mb-1">App Users</h2>
                    <p className="text-gray-400 text-sm">List of all TMU application users.</p>
                 </div>
                 <button onClick={downloadAllUsersCSV} className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl font-bold transition-colors flex items-center gap-2">
                   <Download size={16} /> Export CSV
                 </button>
               </div>

               <div className="bg-[#151521] border border-white/10 rounded-2xl p-4 md:p-6 flex flex-col h-[70vh]">
                 <div className="flex flex-col md:flex-row gap-3 mb-6 shrink-0">
                   <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <input 
                        type="text" 
                        placeholder="Search users by username, email, phone..."
                        value={searchAllUser}
                        onChange={e => setSearchAllUser(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/20 border border-white/10 text-sm focus:border-white/20 outline-none text-white"
                      />
                   </div>
                   <CustomSelect 
                     value={roleFilterAllUser} 
                     onChange={val => setRoleFilterAllUser(val)}
                     options={[
                       { value: 'all', label: 'All Roles' },
                       { value: 'user', label: 'User' },
                       { value: 'superuser', label: 'Superuser' },
                       { value: 'admin', label: 'Admin' }
                     ]}
                     className="w-full md:w-40"
                   />
                 </div>
                 
                 <div className="flex-1 overflow-auto custom-scrollbar">
                   {/* DESKTOP TABLE */}
                   <table className="hidden md:table w-full text-left text-sm whitespace-nowrap relative">
                     <thead className="bg-[#1a1a24] sticky top-0 z-10">
                       <tr className="text-gray-400">
                         <th className="p-4 font-semibold border-b border-white/5">ID</th>
                         <th className="p-4 font-semibold border-b border-white/5">Username</th>
                         <th className="p-4 font-semibold border-b border-white/5">Phone Number</th>
                         <th className="p-4 font-semibold border-b border-white/5">Email</th>
                         <th className="p-4 font-semibold border-b border-white/5">Role</th>
                         <th className="p-4 font-semibold border-b border-white/5">Registered</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {allUsers.filter(u => {
                         const matchSearch = (u.username||'').toLowerCase().includes(searchAllUser.toLowerCase()) || 
                                             (u.email||'').toLowerCase().includes(searchAllUser.toLowerCase()) || 
                                             (u.nomor_telpon||'').toLowerCase().includes(searchAllUser.toLowerCase());
                         const matchRole = roleFilterAllUser === 'all' || u.role === roleFilterAllUser;
                         return matchSearch && matchRole;
                       }).map(u => (
                         <tr key={u.id} className="hover:bg-white/5">
                           <td className="p-4 text-gray-500">#{u.id}</td>
                           <td className="p-4 font-bold">{u.username}</td>
                           <td className="p-4 text-gray-300">{u.nomor_telpon || '-'}</td>
                           <td className="p-4 text-gray-300">{u.email || '-'}</td>
                           <td className="p-4">
                             <span className={`px-2 py-1 rounded text-xs font-bold capitalize ${u.role === 'admin' ? 'bg-blue-900/30 text-blue-400' : u.role === 'superuser' ? 'bg-purple-900/30 text-purple-400' : 'bg-gray-800 text-gray-300'}`}>
                               {u.role}
                             </span>
                           </td>
                           <td className="p-4 text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>

                   {/* MOBILE CARDS */}
                   <div className="md:hidden space-y-4 pb-16">
                     {allUsers.filter(u => {
                         const matchSearch = (u.username||'').toLowerCase().includes(searchAllUser.toLowerCase()) || 
                                             (u.email||'').toLowerCase().includes(searchAllUser.toLowerCase()) || 
                                             (u.nomor_telpon||'').toLowerCase().includes(searchAllUser.toLowerCase());
                         const matchRole = roleFilterAllUser === 'all' || u.role === roleFilterAllUser;
                         return matchSearch && matchRole;
                       }).map(u => (
                       <div key={u.id} className="bg-[#1a1a24] border border-white/5 rounded-2xl p-5 shadow-sm">
                         <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
                           <span className="font-bold text-lg">{u.username}</span>
                           <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${u.role === 'admin' ? 'bg-blue-900/30 border border-blue-500/30 text-blue-400' : u.role === 'superuser' ? 'bg-purple-900/30 border border-purple-500/30 text-purple-400' : 'bg-gray-800 border border-gray-600/30 text-gray-300'}`}>
                             {u.role}
                           </span>
                         </div>
                         <div className="space-y-3">
                           <div className="flex justify-between items-start gap-4">
                             <span className="text-gray-400 text-sm">id</span>
                             <span className="font-semibold text-sm text-right break-all">{u.id}</span>
                           </div>
                           <div className="flex justify-between items-start gap-4">
                             <span className="text-gray-400 text-sm">nomor telpon</span>
                             <span className="font-semibold text-sm text-right break-all">{u.nomor_telpon || '-'}</span>
                           </div>
                           <div className="flex justify-between items-start gap-4">
                             <span className="text-gray-400 text-sm">email</span>
                             <span className="font-semibold text-sm text-right break-all">{u.email || '-'}</span>
                           </div>
                           <div className="flex justify-between items-start gap-4">
                             <span className="text-gray-400 text-sm">created_at</span>
                             <span className="font-semibold text-sm text-right break-all">{new Date(u.created_at).toISOString()}</span>
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               </div>
             </div>
          )}

          {/* TAB: WHATSAPP */}
          {activeTab === 'whatsapp' && (
             <div className="p-4 md:p-8 max-w-4xl mx-auto animate-[fadeIn_0.3s_ease-out] flex flex-col items-center justify-center min-h-[70vh] md:min-h-[80vh]">
               {!waStatus.ready ? (
                 <div className="text-center w-full max-w-md">
                   <div className="flex items-center justify-center gap-2 mb-6">
                     <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                     <span className="text-red-400 font-bold text-sm">Not connected</span>
                   </div>
                   <h2 className="text-3xl md:text-4xl font-bold mb-4 font-heading">Connect WhatsApp</h2>
                   <p className="text-gray-400 mb-8 md:mb-10 text-sm md:text-base">Open WhatsApp on your phone, go to Linked Devices, then scan the code below.</p>
                   
                   <div className="bg-[#151521] border border-white/10 p-6 md:p-8 rounded-3xl flex items-center justify-center shadow-2xl mb-8 mx-auto w-64 h-64 md:w-80 md:h-80 relative overflow-hidden">
                     {waStatus.state === 'NEEDS_SCAN' && waStatus.qr ? (
                       <div className="bg-white p-4 rounded-2xl relative z-10">
                         <QRCodeSVG value={waStatus.qr} size={220} className="w-full h-full max-w-[240px] max-h-[240px]" />
                       </div>
                     ) : (
                       <div className="flex flex-col items-center justify-center text-gray-500 z-10">
                         <RefreshCw className="animate-spin mb-4" size={32} />
                         <p>Loading Client...</p>
                       </div>
                     )}
                   </div>

                   <button onClick={fetchWAStatus} className="px-6 py-3 border border-white/10 hover:bg-white/5 rounded-xl font-bold flex items-center justify-center gap-2 w-full transition-colors">
                     <RefreshCw size={18} /> Reload code
                   </button>
                 </div>
               ) : (
                 <div className="text-center w-full max-w-lg">
                   <div className="flex items-center justify-center gap-2 mb-6">
                     <div className="w-2 h-2 rounded-full bg-green-500" />
                     <span className="text-green-400 font-bold text-sm">Connected</span>
                   </div>
                   <h2 className="text-3xl md:text-4xl font-bold mb-4 font-heading">WhatsApp settings</h2>
                   <p className="text-gray-400 mb-8 md:mb-10 text-sm md:text-base">Manage the WhatsApp Web session connected to the system.</p>
                   
                   <div className="bg-[#151521] border border-white/10 p-6 md:p-8 rounded-3xl text-left shadow-2xl">
                     <div className="flex items-center gap-4 md:gap-5 mb-8">
                       <div className="w-14 h-14 md:w-16 md:h-16 bg-green-900/30 rounded-full flex items-center justify-center shrink-0">
                         <img src="/wa.png" alt="WA" className="w-7 h-7 md:w-8 md:h-8 object-contain" />
                       </div>
                       <div className="min-w-0">
                         <h3 className="text-lg md:text-xl font-bold truncate">TMU Notifikasi</h3>
                         <p className="text-gray-400 text-base md:text-lg truncate">{waStatus.connectedPhone || '+62 8XX-XXXX-XXXX'}</p>
                       </div>
                     </div>

                     <div className="space-y-4 mb-8 md:mb-10 text-sm md:text-base">
                       <div className="flex justify-between items-center py-2 border-b border-white/5">
                         <span className="text-gray-400 flex items-center gap-2"><RefreshCw size={16}/> Connected since</span>
                         <span className="font-bold text-right">{waStatus.connectedSince ? new Date(waStatus.connectedSince).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '-'}</span>
                       </div>
                       <div className="flex justify-between items-center py-2 border-b border-white/5">
                         <span className="text-gray-400 flex items-center gap-2"><MessageCircle size={16}/> Messages sent today</span>
                         <span className="font-bold text-right">{waStatus.messagesSentToday || 0}</span>
                       </div>
                       <div className="flex justify-between items-center py-2">
                         <span className="text-gray-400 flex items-center gap-2"><CheckCircle2 size={16}/> Connection status</span>
                         <span className="font-bold text-green-400 text-right">stable</span>
                       </div>
                     </div>

                     <button 
                        onClick={handleLogoutWA} 
                        disabled={isLoggingOutWA}
                        className="w-full py-3 md:py-4 border border-red-900/50 text-red-400 hover:bg-red-900/20 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                     >
                        {isLoggingOutWA ? <RefreshCw size={18} className="animate-spin" /> : <LogOut size={18} />}
                        Logout WhatsApp
                     </button>
                   </div>
                 </div>
               )}
             </div>
          )}

        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#151521] border-t border-white/5 flex items-center justify-around p-2 z-50 pb-safe">
        <BottomNavItem icon={LayoutDashboard} label="Overview" id="overview" />
        <BottomNavItem icon={Database} label="DBs" id="databases" />
        <BottomNavItem icon={Users} label="Admins" id="admins" />
        <BottomNavItem icon={Users} label="Users" id="users" />
        <BottomNavItem icon={null} label="WA" id="whatsapp" isCustomIcon={true} />
      </nav>

    </div>
  );
};

export default AdminDashboard;
