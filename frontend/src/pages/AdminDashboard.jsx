import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Database, Table, Trash2, AlertTriangle, ChevronRight, 
  RefreshCw, Server, Search, Users, UserPlus, Edit2, X, 
  Eye, EyeOff, LayoutDashboard, Download, Menu, LogOut, CheckCircle2, XCircle, MessageCircle, ArrowLeft, ChevronDown, Settings, Sun, Moon
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
        className="w-full bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-left outline-none text-[#172b4d] dark:text-white flex justify-between items-center gap-3"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown size={16} className={`transition-transform text-gray-500 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 left-0 w-full top-full mt-2 bg-[#1a1a24] border border-gray-200 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] z-50 py-1 overflow-hidden">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${value === opt.value ? 'text-blue-400 font-bold bg-gray-50 dark:bg-gray-800' : 'text-gray-300'}`}
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


const SidebarItem = ({ icon: Icon, label, id, isCustomIcon, activeTab, setActiveTab }) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
      activeTab === id 
      ? 'bg-gray-100/50 dark:bg-gray-800 text-[#172b4d] dark:text-white shadow-sm' 
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
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

const BottomNavItem = ({ icon: Icon, label, id, isCustomIcon, activeTab, setActiveTab }) => (
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

const AdminDashboard = () => {
  const { apiUrl } = useApi();
  const { theme, toggleTheme } = useTheme();
  const { alert } = useDialog();

  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('admin_active_tab') || 'overview';
  });

  // States
  const [stats, setStats] = useState({ databases: 0, tables: 0, appUsers: 0, activeAdmins: 0 });
  const [databases, setDatabases] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [waStatus, setWaStatus] = useState({ ready: false, state: 'DISCONNECTED', qr: '', connectedSince: null, messagesSentToday: 0, connectedPhone: '' });
  const [currentTime, setCurrentTime] = useState(new Date());

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
  
  const [showAppUserModal, setShowAppUserModal] = useState(false);
  const [editingAppUser, setEditingAppUser] = useState(null);
  const [appUserForm, setAppUserForm] = useState({ username: '', password: '', role: '', nama_db: '', nomor_telpon: '', email: '' });
  const [appUserFormError, setAppUserFormError] = useState('');
  const [isSavingAppUser, setIsSavingAppUser] = useState(false);

  const [searchAdmin, setSearchAdmin] = useState('');
  const [searchAllUser, setSearchAllUser] = useState('');
  const [searchTermTableData, setSearchTermTableData] = useState('');
  const [roleFilterAllUser, setRoleFilterAllUser] = useState('all');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dbToDelete, setDbToDelete] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [showRenameDbModal, setShowRenameDbModal] = useState(false);
  const [dbToRename, setDbToRename] = useState('');
  const [newDbName, setNewDbName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  
  const [isLoggingOutWA, setIsLoggingOutWA] = useState(false);
  const [isReloadingWA, setIsReloadingWA] = useState(false);

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
    
    sessionStorage.setItem('admin_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    let interval;
    if (activeTab === 'whatsapp' || activeTab === 'overview') {
      interval = setInterval(fetchWAStatus, 10000);
    }
    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const axiosInstance = axios.create({
    baseURL: apiUrl,
    headers: { 
      'X-Super-Admin': 'true',
      'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
      'ngrok-skip-browser-warning': '69420'
    }
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

  const handleManualWAReload = async () => {
    setIsReloadingWA(true);
    try {
      await fetchWAStatus();
      await new Promise(resolve => setTimeout(resolve, 800));
    } finally {
      setIsReloadingWA(false);
    }
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
      if (selectedDb === dbToDelete) setSelectedDb(null);
      fetchDatabases();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete database');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenameDb = async () => {
    if (!newDbName.trim() || newDbName === dbToRename) return;
    setIsRenaming(true);
    try {
      await axiosInstance.put(`/api/admin/databases/${dbToRename}`, { newDbName });
      setDbToRename('');
      setNewDbName('');
      if (selectedDb === dbToRename) setSelectedDb(newDbName);
      fetchDatabases();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to rename database');
    } finally {
      setIsRenaming(false);
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

  const handleSaveAppUser = async (e) => {
    e.preventDefault();
    setAppUserFormError('');
    setIsSavingAppUser(true);
    try {
      if (editingAppUser) {
        await axiosInstance.put(`/api/admin/app-users/${editingAppUser.id}`, appUserForm);
      }
      setShowAppUserModal(false);
      fetchAllUsers();
    } catch (err) {
      setAppUserFormError(err.response?.data?.error || 'Failed to save app user');
    } finally {
      setIsSavingAppUser(false);
    }
  };

  const handleDeleteAppUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this app user?')) return;
    try {
      await axiosInstance.delete(`/api/admin/app-users/${id}`);
      fetchAllUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete app user');
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

  
  
  return (
    <div className={`flex h-screen overflow-hidden ${theme === 'dark' ? 'dark bg-[#f4f7fe] dark:bg-[#101014]' : 'bg-[#f4f7fe]'} text-[#172b4d] dark:text-white font-sans transition-colors duration-300`}>
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col inset-y-0 left-0 z-50 w-72 bg-white dark:bg-[#0b0c10] border-r border-gray-200 dark:border-white/5">
        <div className="p-6 flex items-center gap-3 border-b border-gray-200 dark:border-white/5">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-[#172b4d] dark:text-white p-1">
            <img src="/tmu-logo.png" alt="TMU Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight leading-tight">TMU</h1>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Transformer<br/>Monitoring Unit</p>
          </div>
        </div>
        
        <div className="px-6 py-5">
          <p className="text-xs font-bold text-blue-500 tracking-widest uppercase">Admin Control Panel</p>
        </div>

        <nav className="flex-1 px-4 space-y-6 overflow-y-auto custom-scrollbar pb-6">
          <div>
            <SidebarItem icon={LayoutDashboard} label="Overview" id="overview" activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          <div>
            <p className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Database</p>
            <SidebarItem icon={Database} label="Databases" id="databases" activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          <div>
            <p className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Access Management</p>
            <SidebarItem icon={Users} label="Admin Users" id="admins" activeTab={activeTab} setActiveTab={setActiveTab} />
            <SidebarItem icon={UserPlus} label="App Users" id="users" activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          <div>
            <p className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Services</p>
            <SidebarItem icon={null} label="Notifications" id="whatsapp" isCustomIcon={true} activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          <div>
            <p className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">System</p>
            <SidebarItem icon={Settings} label="Settings" id="settings" activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-white/5">
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-3 w-full">
              <div className="w-10 h-10 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center font-bold text-lg shrink-0">
                {(sessionStorage.getItem('username') || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <span className="font-bold text-sm block truncate">{sessionStorage.getItem('username') || 'admin'}</span>
                <span className="text-[10px] text-gray-500 block truncate capitalize">
                  {sessionStorage.getItem('role') === 'admin' ? 'Administrator' : sessionStorage.getItem('role') || 'Super Administrator'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0b0c10] pb-[72px] md:pb-0">
        
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#0b0c10]">
          <div className="flex items-center gap-4">
            <button className="text-gray-500 dark:text-gray-400 hover:text-[#172b4d] dark:text-white transition-colors"><Menu size={20} /></button>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={toggleTheme} className="text-gray-500 hover:text-[#172b4d] dark:text-gray-400 dark:hover:text-[#172b4d] dark:text-white transition-colors">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="text-right border-l border-gray-200 dark:border-white/10 pl-6">
              <p className="font-bold text-lg font-mono leading-tight">{currentTime.toLocaleTimeString('id-ID')}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">{currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-red-900/20 border border-red-500/20 text-red-400 hover:bg-red-900/30 hover:text-red-300 flex items-center gap-2 transition-colors">
              <LogOut size={16} />
              <span className="text-[11px] font-bold uppercase tracking-wider">Logout</span>
            </button>
          </div>
        </header>

        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-[#0b0c10] border-b border-gray-200 dark:border-white/5 shrink-0 z-20 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center text-[#172b4d] dark:text-white p-1">
              <img src="/tmu-logo.png" alt="TMU Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="font-bold text-base tracking-tight">TMU</h1>
          </div>
          <button onClick={handleLogout} className="p-2 text-red-400 hover:text-red-300 transition-colors rounded-lg bg-red-900/20 hover:bg-red-900/30" title="Logout">
            <LogOut size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar relative">
          
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 animate-[fadeIn_0.3s_ease-out]">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-3xl font-bold font-heading mb-1 md:mb-2">Overview</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">System summary and connection status.</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
                {[
                  { label: 'DATABASES', value: stats.databases, color: 'blue', icon: Database, sub: '1 online' },
                  { label: 'TOTAL TABLES', value: stats.tables, color: 'cyan', icon: Table, sub: '' },
                  { label: 'APP USERS', value: stats.appUsers, color: 'purple', icon: Users, sub: '' },
                  { label: 'ACTIVE ADMINS', value: stats.activeAdmins, color: 'green', icon: UserPlus, sub: 'Active' }
                ].map((stat, i) => (
                  <div key={i} className={`bg-[#f4f7fe] dark:bg-[#101014] border-t-2 ${
                    stat.color === 'blue' ? 'border-t-blue-500' :
                    stat.color === 'cyan' ? 'border-t-cyan-500' :
                    stat.color === 'purple' ? 'border-t-purple-500' :
                    'border-t-green-500'
                  } rounded-xl p-6 shadow-lg relative overflow-hidden group border-x border-b border-x-white/5 border-b-white/5`}>
                    <div className={`absolute -top-10 -right-10 w-32 h-32 ${
                      stat.color === 'blue' ? 'bg-blue-500/5' :
                      stat.color === 'cyan' ? 'bg-cyan-500/5' :
                      stat.color === 'purple' ? 'bg-purple-500/5' :
                      'bg-green-500/5'
                    } rounded-full blur-3xl transition-all group-hover:opacity-100 opacity-50`}></div>
                    
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        stat.color === 'blue' ? 'bg-blue-900/20 text-blue-400 border-blue-500/20' :
                        stat.color === 'cyan' ? 'bg-cyan-900/20 text-cyan-400 border-cyan-500/20' :
                        stat.color === 'purple' ? 'bg-purple-900/20 text-purple-400 border-purple-500/20' :
                        'bg-green-900/20 text-green-400 border-green-500/20'
                      } border`}>
                        <stat.icon size={20} />
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold tracking-widest uppercase mb-1">{stat.label}</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-3xl font-bold font-mono text-[#172b4d] dark:text-white leading-none">{isLoadingStats ? '-' : stat.value}</p>
                        </div>
                      </div>
                    </div>
                    {stat.sub && (
                      <div className="flex items-center gap-1.5 mt-2 relative z-10">
                        <div className={`w-1.5 h-1.5 rounded-full ${stat.color === 'green' || stat.color === 'blue' ? 'bg-green-500' : 'bg-transparent'}`}></div>
                        <span className="text-[10px] text-green-400 font-medium uppercase tracking-wider">{stat.sub}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Middle Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Databases Card */}
                <div className="bg-[#f4f7fe] dark:bg-[#101014] border border-gray-200 dark:border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl transition-all group-hover:bg-blue-500/10"></div>
                  <div className="flex justify-between items-center mb-6 relative z-10">
                    <h3 className="font-bold text-lg">Databases</h3>
                    <button onClick={() => setActiveTab('databases')} className="text-blue-500 hover:text-blue-400 text-sm font-semibold flex items-center gap-2 transition-colors">
                      View all <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="space-y-4 max-h-64 overflow-y-auto custom-scrollbar pr-2 relative z-10">
                    {isLoadingDbs ? <EnergyLoader size="small" /> : databases.map(db => (
                      <div key={db} className="bg-white dark:bg-[#151521] border border-gray-200 dark:border-white/5 rounded-xl p-4 flex items-center justify-between transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-900/20 border border-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center">
                            <Database size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-sm mb-1">{db}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Production database</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Table size={12} className="text-gray-500" />
                              <span className="text-[10px] text-gray-500 font-medium">TABLES • Last sync just now</span>
                            </div>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-green-900/20 border border-green-500/20 text-green-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">online</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* WhatsApp Card */}
                <div className="bg-[#f4f7fe] dark:bg-[#101014] border border-gray-200 dark:border-white/5 rounded-2xl p-6 relative overflow-hidden group flex flex-col justify-between">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl transition-all group-hover:bg-green-500/10"></div>
                  <div className="relative z-10">
                    <h3 className="font-bold text-lg mb-6">Notification Service</h3>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-green-900/20 border border-green-500/20 rounded-xl flex items-center justify-center shrink-0">
                        <img src="/wa.png" alt="WA" className="w-6 h-6 object-contain" style={{ filter: waStatus.ready ? 'brightness(1)' : 'grayscale(100%) opacity(0.7)' }} />
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">WhatsApp</h4>
                        {waStatus.ready ? (
                          <>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                              <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Connected</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-sm mb-2">
                              System is actively sending alerts to <strong className="text-[#172b4d] dark:text-white">{waStatus.connectedPhone || '+62 8XX-XXXX-XXXX'}</strong>.
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                              <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Not Connected</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-sm mb-2">
                              Receive transformer alerts and system notifications through WhatsApp.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={waStatus.ready ? handleLogoutWA : () => setActiveTab('whatsapp')} 
                    className={`w-full py-3 rounded-xl border font-bold transition-all mt-6 relative z-10 text-sm ${waStatus.ready ? 'border-red-900/50 text-red-400 hover:bg-red-900/20' : 'bg-white dark:bg-[#151521] border-blue-900/50 text-blue-400 hover:bg-blue-900/20 hover:border-blue-500/50 shadow-lg shadow-blue-900/10'}`}
                  >
                    {waStatus.ready ? 'Disconnect WhatsApp' : 'Connect WhatsApp'}
                  </button>
                  
                  {/* Decorative background phone wireframe */}
                  {!waStatus.ready && (
                    <div className="absolute -bottom-10 -right-10 opacity-30 pointer-events-none">
                       <svg width="180" height="200" viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="10" y="10" width="80" height="130" rx="12" stroke="white" strokeWidth="2" strokeOpacity="0.5"/>
                          <rect x="25" y="60" width="50" height="50" rx="4" stroke="#4ade80" strokeWidth="2"/>
                          <path d="M40 70H60M40 85H60M40 100H50" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"/>
                       </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* App Users Table */}
              <div className="bg-[#f4f7fe] dark:bg-[#101014] border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="font-bold text-lg mb-1">App Users</h3>
                    <p className="text-xs text-gray-500">{allUsers.length} registered users</p>
                  </div>
                  <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                      <input 
                        type="text" 
                        placeholder="Search users..."
                        value={searchAllUser}
                        onChange={e => setSearchAllUser(e.target.value)}
                        className="bg-white dark:bg-[#151521] border border-gray-200 dark:border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-white/30 text-[#172b4d] dark:text-white w-full md:w-64 transition-colors"
                      />
                    </div>
                    <button onClick={downloadAllUsersCSV} className="px-4 py-2 text-sm font-semibold border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2" title="Export CSV">
                      <Download size={16} /> Export
                    </button>
                    <button onClick={() => setActiveTab('users')} className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-[#172b4d] dark:text-white rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20">
                      <UserPlus size={16} /> Add User
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-white dark:bg-[#151521]/50 text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="py-4 px-6 font-medium text-xs tracking-widest uppercase">Username</th>
                        <th className="py-4 px-6 font-medium text-xs tracking-widest uppercase">Phone Number</th>
                        <th className="py-4 px-6 font-medium text-xs tracking-widest uppercase">Email</th>
                        <th className="py-4 px-6 font-medium text-xs tracking-widest uppercase">Role</th>
                        <th className="py-4 px-6 font-medium text-xs tracking-widest uppercase">Status</th>
                        <th className="py-4 px-6 font-medium text-xs tracking-widest uppercase text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {allUsers.filter(u => (u.username||'').toLowerCase().includes(searchAllUser.toLowerCase())).slice(0, 5).map(u => (
                        <tr key={u.id} className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                u.role === 'admin' ? 'bg-blue-900/30 text-blue-400' :
                                u.role === 'superuser' ? 'bg-purple-900/30 text-purple-400' :
                                'bg-gray-800 text-gray-300'
                              }`}>
                                {u.username.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-bold">{u.username}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-500 dark:text-gray-400">{u.nomor_telpon || '-'}</td>
                          <td className="py-4 px-6 text-gray-500 dark:text-gray-400">{u.email || '-'}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                              u.role === 'admin' ? 'bg-blue-900/20 text-blue-400 border border-blue-500/20' : 
                              u.role === 'superuser' ? 'bg-purple-900/20 text-purple-400 border border-purple-500/20' : 
                              'bg-gray-800/50 text-gray-500 dark:text-gray-400 border border-gray-600/30'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                              <span className="text-xs text-green-400 font-medium">Active</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <button className="p-2 text-gray-500 hover:text-[#172b4d] dark:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="More Actions">
                              <Menu size={16} className="rotate-90" />
                            </button>
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
                <div className="w-full md:w-72 border-r border-b md:border-b-0 border-gray-200 dark:border-white/5 bg-white dark:bg-[#151521] flex flex-col shrink-0 h-[250px] md:h-full">
                  <div className="p-4 border-b border-gray-200 dark:border-white/5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                      <input 
                        type="text" 
                        placeholder="Search databases..."
                        value={searchTermDb}
                        onChange={e => setSearchTermDb(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/5 text-sm focus:border-white/20 outline-none text-[#172b4d] dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {databases.filter(d => d.toLowerCase().includes(searchTermDb.toLowerCase())).map(db => (
                      <div key={db} className="bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-white/5">
                        <div className={`w-full text-left flex items-center justify-between transition-colors ${selectedDb === db ? 'bg-gray-50 dark:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                          {dbToRename === db ? (
                            <div className="flex-1 px-4 py-3 flex items-center">
                              <input 
                                type="text"
                                value={newDbName}
                                onChange={e => setNewDbName(e.target.value)}
                                className="w-full bg-gray-200 dark:bg-black/40 border border-white/20 rounded-lg px-3 py-1.5 text-sm font-bold outline-none text-[#172b4d] dark:text-white focus:border-blue-500/50 transition-colors"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleRenameDb(); else if (e.key === 'Escape') setDbToRename(''); }}
                              />
                            </div>
                          ) : (
                            <button 
                              onClick={() => fetchTables(db)}
                              className="flex-1 px-4 py-3 text-left"
                            >
                              <p className="font-bold text-sm">{db}</p>
                              <p className="text-xs text-gray-500">{selectedDb === db ? tables.length : '?'} tables</p>
                            </button>
                          )}
                          <div className="px-2 flex items-center gap-1 shrink-0">
                            {dbToRename === db ? (
                              <>
                                <button onClick={handleRenameDb} disabled={isRenaming || !newDbName.trim() || newDbName === db} className="p-2 text-green-400 hover:text-green-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors disabled:opacity-50" title="Save">
                                  {isRenaming ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                </button>
                                <button onClick={() => setDbToRename('')} disabled={isRenaming} className="p-2 text-gray-500 dark:text-gray-400 hover:text-[#172b4d] dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors disabled:opacity-50" title="Cancel">
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); setDbToRename(db); setNewDbName(db); }} className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors" title="Rename Database">
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setDbToDelete(db); setShowDeleteModal(true); }} className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors" title="Delete Database">
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {selectedDb === db && (
                          <div className="bg-gray-100 dark:bg-black/20 p-2 space-y-1 border-t border-gray-200 dark:border-white/5">
                            {isLoadingTables ? <EnergyLoader size="small" /> : tables.map(table => (
                              <button
                                key={table}
                                onClick={() => fetchTableData(db, table)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${selectedTable === table ? 'bg-gray-100 dark:bg-gray-800 font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-[#172b4d] dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`}
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
                      <div className="p-4 md:p-6 border-b border-gray-200 dark:border-white/5 flex flex-col md:flex-row items-start md:items-end justify-between shrink-0 gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-2xl md:text-3xl font-bold font-heading">{selectedTable}</h2>
                            <span className="px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 text-xs font-bold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-400" /> online</span>
                          </div>
                          <p className="text-gray-500 dark:text-gray-400 text-sm">Showing up to {dataLimit} rows</p>
                        </div>
                        <div className="flex flex-col md:flex-row items-end md:items-center gap-3 w-full md:w-auto">
                          <div className="relative w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                            <input 
                              type="text" 
                              placeholder="Search in table..."
                              value={searchTermTableData}
                              onChange={e => setSearchTermTableData(e.target.value)}
                              className="w-full md:w-48 pl-9 pr-4 py-2 rounded-lg bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-sm focus:border-white/20 outline-none text-[#172b4d] dark:text-white"
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
                                  <th key={key} className="px-4 py-2 text-blue-400 font-bold bg-blue-900/20 border border-gray-200 dark:border-white/5">{key}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tableData
                                .filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(searchTermTableData.toLowerCase())))
                                .map((row, i) => (
                                <tr key={i}>
                                  {Object.values(row).map((val, j) => (
                                    <td key={j} className="px-4 py-2 border border-gray-200 dark:border-white/5 truncate max-w-[200px]" title={String(val)}>{val === null ? '-' : String(val)}</td>
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
                    <h2 className="text-lg font-bold mb-3 text-gray-500 dark:text-gray-400">Databases</h2>
                    <div className="relative mb-5">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <input 
                        type="text" 
                        placeholder="Search databases..."
                        value={searchTermDb}
                        onChange={e => setSearchTermDb(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white dark:bg-[#151521] border border-gray-200 dark:border-white/5 text-sm focus:border-white/20 outline-none text-[#172b4d] dark:text-white shadow-sm"
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pb-20 custom-scrollbar">
                      {databases.filter(d => d.toLowerCase().includes(searchTermDb.toLowerCase())).map(db => (
                        <div 
                          key={db}
                          onClick={() => fetchTables(db)}
                          className="w-full bg-white dark:bg-[#151521] border-b border-gray-200 dark:border-white/5 last:border-0 rounded-2xl p-5 flex items-center justify-between transition-colors active:bg-gray-50 dark:bg-gray-800 cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#0a0a0f] border border-gray-200 dark:border-white/5 text-blue-400 rounded-xl flex items-center justify-center shadow-inner">
                              <Database size={22} />
                            </div>
                            <div className="text-left w-full pr-4">
                              {dbToRename === db ? (
                                <input 
                                  type="text"
                                  value={newDbName}
                                  onChange={e => setNewDbName(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-full bg-gray-200 dark:bg-black/40 border border-white/20 rounded-lg px-3 py-1.5 text-sm font-bold outline-none text-[#172b4d] dark:text-white focus:border-blue-500/50 mb-0.5 transition-colors"
                                  autoFocus
                                  onKeyDown={e => { if (e.key === 'Enter') handleRenameDb(); else if (e.key === 'Escape') setDbToRename(''); }}
                                />
                              ) : (
                                <p className="font-bold text-lg mb-0.5">{db}</p>
                              )}
                              <p className="text-gray-500 dark:text-gray-400 text-sm">Active database</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="flex items-center gap-2 mr-2">
                              {dbToRename === db ? (
                                <>
                                  <button onClick={(e) => { e.stopPropagation(); handleRenameDb(); }} disabled={isRenaming || !newDbName.trim() || newDbName === db} className="p-2 text-green-400 hover:text-green-300 bg-gray-50 dark:bg-gray-800 rounded-lg active:bg-gray-100 dark:bg-gray-800 transition-colors disabled:opacity-50">
                                    {isRenaming ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); setDbToRename(''); }} disabled={isRenaming} className="p-2 text-gray-500 dark:text-gray-400 hover:text-[#172b4d] dark:text-white bg-gray-50 dark:bg-gray-800 rounded-lg active:bg-gray-100 dark:bg-gray-800 transition-colors disabled:opacity-50">
                                    <X size={16} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={(e) => { e.stopPropagation(); setDbToRename(db); setNewDbName(db); }} className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-400 bg-gray-50 dark:bg-gray-800 rounded-lg active:bg-gray-100 dark:bg-gray-800 transition-colors">
                                    <Edit2 size={16} />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); setDbToDelete(db); setShowDeleteModal(true); }} className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-400 bg-gray-50 dark:bg-gray-800 rounded-lg active:bg-gray-100 dark:bg-gray-800 transition-colors">
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                            <ChevronRight size={18} className="text-gray-500" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* State 2: Table List */}
                {selectedDb && !selectedTable && (
                  <>
                    <div className="flex items-center gap-3 mb-6">
                      <button onClick={() => setSelectedDb(null)} className="p-2 -ml-2 text-gray-300 hover:text-[#172b4d] dark:text-white active:bg-gray-50 dark:bg-gray-800 rounded-xl transition-colors">
                        <ArrowLeft size={24} />
                      </button>
                      <div>
                        <h2 className="text-xl font-bold">{selectedDb}</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{tables.length} tables · connected</p>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pb-20 custom-scrollbar">
                      {isLoadingTables ? <div className="py-10"><EnergyLoader size="medium" /></div> : tables.map(table => (
                        <button 
                          key={table}
                          onClick={() => fetchTableData(selectedDb, table)}
                          className="w-full bg-white dark:bg-[#151521] border-b border-gray-200 dark:border-white/5 last:border-0 rounded-2xl p-5 flex items-center justify-between transition-colors active:bg-gray-50 dark:bg-gray-800"
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
                          <button onClick={() => setSelectedTable(null)} className="p-2 -ml-2 text-gray-300 hover:text-[#172b4d] dark:text-white active:bg-gray-50 dark:bg-gray-800 rounded-xl transition-colors">
                            <ArrowLeft size={24} />
                          </button>
                          <div>
                            <h2 className="text-xl font-bold capitalize">{selectedTable}</h2>
                            <p className="text-green-400 text-sm font-medium">{tableData.length > 0 ? 'online' : 'empty'} · {tableData.length} rows</p>
                          </div>
                        </div>
                        <button onClick={() => fetchTableData(selectedDb, selectedTable)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-[#172b4d] dark:text-white active:bg-gray-50 dark:bg-gray-800 rounded-xl transition-colors">
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
                          className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-[#151521] border border-gray-200 dark:border-white/5 text-sm focus:border-white/20 outline-none text-[#172b4d] dark:text-white shadow-sm"
                        />
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-4 pb-20 custom-scrollbar">
                      {isLoadingData ? <div className="py-20"><EnergyLoader size="medium" /></div> : tableData.length > 0 ? (
                        tableData
                          .filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(searchTermTableData.toLowerCase())))
                          .map((row, i) => (
                          <div key={i} className="bg-white dark:bg-[#151521] border border-gray-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-white/5">
                              <span className="font-bold text-lg">{row.username || row.name || row.id || `Row ${i+1}`}</span>
                              {row.role && <span className="px-3 py-1 bg-blue-900/30 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-full">{row.role}</span>}
                            </div>
                            <div className="space-y-3">
                              {Object.entries(row).map(([key, val]) => (
                                <div key={key} className="flex justify-between items-start gap-4">
                                  <span className="text-gray-500 dark:text-gray-400 text-sm">{key}</span>
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

              {/* DELETE DB MODAL */}
              {showDeleteModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-[#151521] border border-red-900/50 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-[0_0_40px_rgba(220,38,38,0.15)] animate-[slideUpFade_0.3s_ease-out]">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3 text-red-500">
                        <AlertTriangle size={28} />
                        <h3 className="text-xl font-bold">Delete Database</h3>
                      </div>
                      <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmation(''); }} className="text-gray-500 dark:text-gray-400 hover:text-[#172b4d] dark:text-white transition-colors"><X size={24} /></button>
                    </div>
                    <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                      You are about to permanently delete <span className="font-bold text-[#172b4d] dark:text-white bg-red-900/30 px-2 py-0.5 rounded">{dbToRename || dbToDelete}</span> and all its tables. This action cannot be undone.
                    </p>
                    <div className="mb-8">
                      <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Type the database name to confirm:</label>
                      <input 
                        type="text" 
                        value={deleteConfirmation}
                        onChange={e => setDeleteConfirmation(e.target.value)}
                        placeholder={dbToDelete}
                        className="w-full bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none text-[#172b4d] dark:text-white focus:border-red-500/50 transition-colors"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmation(''); }} className="flex-1 py-3 rounded-xl font-bold bg-gray-50 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-[#172b4d] dark:text-white">Cancel</button>
                      <button 
                        onClick={handleDeleteDb} 
                        disabled={isDeleting || deleteConfirmation !== dbToDelete}
                        className="flex-1 py-3 rounded-xl font-bold bg-red-600 hover:bg-red-700 transition-colors text-[#172b4d] dark:text-white disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isDeleting ? <RefreshCw className="animate-spin" size={18} /> : <Trash2 size={18} />} Delete Data
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB: ADMINS */}
          {activeTab === 'admins' && (
             <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out]">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div>
                    <h2 className="text-3xl font-bold font-heading mb-1">Admin Users</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Manage system administrator access.</p>
                 </div>
                 {!showAdminModal && (
                   <button onClick={() => { setEditingAdmin(null); setAdminForm({ username: '', password: '' }); setShowAdminModal(true); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-colors flex items-center gap-2">
                     <UserPlus size={16} /> Add Admin
                   </button>
                 )}
               </div>

               {showAdminModal && (
                 <div className="bg-white dark:bg-[#151521] border border-gray-200 dark:border-white/10 rounded-2xl p-6">
                   <h3 className="font-bold text-lg mb-4">{editingAdmin ? 'Edit Admin' : 'Add New Admin'}</h3>
                   <form onSubmit={handleSaveAdmin} className="space-y-4">
                     {adminFormError && <p className="text-red-400 text-sm">{adminFormError}</p>}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold mb-2">Username</label>
                          <input type="text" required value={adminForm.username} onChange={e => setAdminForm({...adminForm, username: e.target.value})} className="w-full bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-[#172b4d] dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-2">Password <span className="text-gray-500 dark:text-gray-400 font-normal">{editingAdmin && '(Leave blank to keep current)'}</span></label>
                          <input type="password" required={!editingAdmin} value={adminForm.password} onChange={e => setAdminForm({...adminForm, password: e.target.value})} className="w-full bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-[#172b4d] dark:text-white" />
                        </div>
                     </div>
                     <div className="flex justify-end gap-3 pt-4">
                       <button type="button" onClick={() => setShowAdminModal(false)} className="px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                       <button type="submit" disabled={isSavingAdmin} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors">Save</button>
                     </div>
                   </form>
                 </div>
               )}

               <div className="bg-white dark:bg-[#151521] border border-gray-200 dark:border-white/10 rounded-2xl p-4 md:p-6 flex flex-col max-h-[70vh]">
                 <div className="flex-1 overflow-auto custom-scrollbar">
                   <table className="w-full text-left text-sm relative whitespace-nowrap">
                     <thead className="sticky top-0 bg-white dark:bg-[#151521] z-10">
                       <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-white/5">
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
                           <td className="py-4 px-2 text-gray-500 dark:text-gray-400">{new Date(user.created_at).toLocaleString()}</td>
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
                    <p className="text-gray-500 dark:text-gray-400 text-sm">List of all TMU application users.</p>
                 </div>
                 <button onClick={downloadAllUsersCSV} className="px-4 py-2 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl font-bold transition-colors flex items-center gap-2">
                   <Download size={16} /> Export CSV
                 </button>
               </div>
               
               {showAppUserModal && (
                 <div className="bg-white dark:bg-[#151521] border border-gray-200 dark:border-white/10 rounded-2xl p-6">
                   <h3 className="font-bold text-lg mb-4">Edit App User</h3>
                   <form onSubmit={handleSaveAppUser} className="space-y-4">
                     {appUserFormError && <p className="text-red-400 text-sm">{appUserFormError}</p>}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold mb-2">Username</label>
                          <input type="text" required value={appUserForm.username} onChange={e => setAppUserForm({...appUserForm, username: e.target.value})} className="w-full bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-[#172b4d] dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-2">Password <span className="text-gray-500 dark:text-gray-400 font-normal">(Leave blank to keep current)</span></label>
                          <input type="password" value={appUserForm.password} onChange={e => setAppUserForm({...appUserForm, password: e.target.value})} className="w-full bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-[#172b4d] dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-2">Database Name</label>
                          <input type="text" value={appUserForm.nama_db} onChange={e => setAppUserForm({...appUserForm, nama_db: e.target.value})} className="w-full bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-[#172b4d] dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-2">Role</label>
                          <select value={appUserForm.role} onChange={e => setAppUserForm({...appUserForm, role: e.target.value})} className="w-full bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-[#172b4d] dark:text-white">
                            <option value="user">User</option>
                            <option value="superuser">Superuser</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-2">Phone Number</label>
                          <input type="tel" value={appUserForm.nomor_telpon} onChange={e => setAppUserForm({...appUserForm, nomor_telpon: e.target.value})} className="w-full bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-[#172b4d] dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-2">Email</label>
                          <input type="email" value={appUserForm.email} onChange={e => setAppUserForm({...appUserForm, email: e.target.value})} className="w-full bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-[#172b4d] dark:text-white" />
                        </div>
                     </div>
                     <div className="flex justify-end gap-3 pt-4">
                       <button type="button" onClick={() => setShowAppUserModal(false)} className="px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                       <button type="submit" disabled={isSavingAppUser} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors">Save</button>
                     </div>
                   </form>
                 </div>
               )}

               <div className="bg-white dark:bg-[#151521] border border-gray-200 dark:border-white/10 rounded-2xl p-4 md:p-6 flex flex-col h-[70vh]">
                 <div className="flex flex-col md:flex-row gap-3 mb-6 shrink-0">
                   <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <input 
                        type="text" 
                        placeholder="Search users by username, email, phone..."
                        value={searchAllUser}
                        onChange={e => setSearchAllUser(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-sm focus:border-white/20 outline-none text-[#172b4d] dark:text-white"
                      />
                   </div>
                   <CustomSelect 
                     value={roleFilterAllUser} 
                     onChange={val => setRoleFilterAllUser(val)}
                     options={[
                       { value: 'all', label: 'All Roles' },
                       { value: 'user', label: 'User' },
                       { value: 'superuser', label: 'Superuser' }
                     ]}
                     className="w-full md:w-40"
                   />
                 </div>
                 
                 <div className="flex-1 overflow-auto custom-scrollbar">
                   {/* DESKTOP TABLE */}
                   <table className="hidden md:table w-full text-left text-sm whitespace-nowrap relative">
                     <thead className="bg-[#1a1a24] sticky top-0 z-10">
                       <tr className="text-gray-500 dark:text-gray-400">
                         <th className="p-4 font-semibold border-b border-gray-200 dark:border-white/5">ID</th>
                         <th className="p-4 font-semibold border-b border-gray-200 dark:border-white/5">Username</th>
                         <th className="p-4 font-semibold border-b border-gray-200 dark:border-white/5">Database</th>
                         <th className="p-4 font-semibold border-b border-gray-200 dark:border-white/5">Phone Number</th>
                         <th className="p-4 font-semibold border-b border-gray-200 dark:border-white/5">Email</th>
                         <th className="p-4 font-semibold border-b border-gray-200 dark:border-white/5">Role</th>
                         <th className="p-4 font-semibold border-b border-gray-200 dark:border-white/5">Registered</th>
                         <th className="p-4 font-semibold border-b border-gray-200 dark:border-white/5 text-right">Actions</th>
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
                         <tr key={u.id} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                           <td className="p-4 text-gray-500">#{u.id}</td>
                           <td className="p-4 font-bold">{u.username}</td>
                           <td className="p-4 text-gray-300">{u.nama_db || '-'}</td>
                           <td className="p-4 text-gray-300">{u.nomor_telpon || '-'}</td>
                           <td className="p-4 text-gray-300">{u.email || '-'}</td>
                           <td className="p-4">
                             <span className={`px-2 py-1 rounded text-xs font-bold capitalize ${u.role === 'admin' ? 'bg-blue-900/30 text-blue-400' : u.role === 'superuser' ? 'bg-purple-900/30 text-purple-400' : 'bg-gray-800 text-gray-300'}`}>
                               {u.role}
                             </span>
                           </td>
                           <td className="p-4 text-gray-500 dark:text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                           <td className="p-4 flex justify-end gap-2">
                             <button onClick={() => { setEditingAppUser(u); setAppUserForm({ username: u.username, password: '', role: u.role, nama_db: u.nama_db || '', nomor_telpon: u.nomor_telpon || '', email: u.email || '' }); setShowAppUserModal(true); }} className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg" title="Edit"><Edit2 size={16} /></button>
                             <button onClick={() => handleDeleteAppUser(u.id)} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg" title="Delete"><Trash2 size={16} /></button>
                           </td>
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
                       <div key={u.id} className="bg-[#1a1a24] border border-gray-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
                         <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-white/5">
                           <span className="font-bold text-lg">{u.username}</span>
                           <div className="flex items-center gap-2">
                             <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${u.role === 'admin' ? 'bg-blue-900/30 border border-blue-500/30 text-blue-400' : u.role === 'superuser' ? 'bg-purple-900/30 border border-purple-500/30 text-purple-400' : 'bg-gray-800 border border-gray-600/30 text-gray-300'}`}>
                               {u.role}
                             </span>
                             <button onClick={() => { setEditingAppUser(u); setAppUserForm({ username: u.username, password: '', role: u.role, nama_db: u.nama_db || '', nomor_telpon: u.nomor_telpon || '', email: u.email || '' }); setShowAppUserModal(true); }} className="p-1.5 text-blue-400 hover:bg-blue-900/20 rounded-lg" title="Edit"><Edit2 size={14} /></button>
                             <button onClick={() => handleDeleteAppUser(u.id)} className="p-1.5 text-red-400 hover:bg-red-900/20 rounded-lg" title="Delete"><Trash2 size={14} /></button>
                           </div>
                         </div>
                         <div className="space-y-3">
                           <div className="flex justify-between items-start gap-4">
                             <span className="text-gray-500 dark:text-gray-400 text-sm">id</span>
                             <span className="font-semibold text-sm text-right break-all">{u.id}</span>
                           </div>
                           <div className="flex justify-between items-start gap-4">
                             <span className="text-gray-500 dark:text-gray-400 text-sm">database</span>
                             <span className="font-semibold text-sm text-right break-all">{u.nama_db || '-'}</span>
                           </div>
                           <div className="flex justify-between items-start gap-4">
                             <span className="text-gray-500 dark:text-gray-400 text-sm">nomor telpon</span>
                             <span className="font-semibold text-sm text-right break-all">{u.nomor_telpon || '-'}</span>
                           </div>
                           <div className="flex justify-between items-start gap-4">
                             <span className="text-gray-500 dark:text-gray-400 text-sm">email</span>
                             <span className="font-semibold text-sm text-right break-all">{u.email || '-'}</span>
                           </div>
                           <div className="flex justify-between items-start gap-4">
                             <span className="text-gray-500 dark:text-gray-400 text-sm">created_at</span>
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
                   <p className="text-gray-500 dark:text-gray-400 mb-8 md:mb-10 text-sm md:text-base">Open WhatsApp on your phone, go to Linked Devices, then scan the code below.</p>
                   
                   <div className="bg-white dark:bg-[#151521] border border-gray-200 dark:border-white/10 p-6 md:p-8 rounded-3xl flex items-center justify-center shadow-2xl mb-8 mx-auto w-64 h-64 md:w-80 md:h-80 relative overflow-hidden">
                      {isReloadingWA ? (
                        <div className="flex flex-col items-center justify-center text-gray-500 z-10 animate-[fadeIn_0.2s_ease-out]">
                          <RefreshCw className="animate-spin mb-4" size={32} />
                          <p>Generating new code...</p>
                        </div>
                      ) : waStatus.state === 'NEEDS_SCAN' && waStatus.qr ? (
                        <div className="bg-white p-4 rounded-2xl relative z-10 animate-[fadeIn_0.5s_ease-out]">
                          <QRCodeSVG value={waStatus.qr} size={220} className="w-full h-full max-w-[240px] max-h-[240px]" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-500 z-10">
                          <RefreshCw className="animate-spin mb-4" size={32} />
                          <p>Loading Client...</p>
                        </div>
                      )}
                    </div>

                    <button onClick={handleManualWAReload} disabled={isReloadingWA} className="px-6 py-3 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl font-bold flex items-center justify-center gap-2 w-full transition-colors disabled:opacity-50">
                      <RefreshCw size={18} className={isReloadingWA ? "animate-spin" : ""} /> {isReloadingWA ? 'Reloading...' : 'Reload code'}
                    </button>
                 </div>
               ) : (
                 <div className="text-center w-full max-w-lg">
                   <div className="flex items-center justify-center gap-2 mb-6">
                     <div className="w-2 h-2 rounded-full bg-green-500" />
                     <span className="text-green-400 font-bold text-sm">Connected</span>
                   </div>
                   <h2 className="text-3xl md:text-4xl font-bold mb-4 font-heading">WhatsApp settings</h2>
                   <p className="text-gray-500 dark:text-gray-400 mb-8 md:mb-10 text-sm md:text-base">Manage the WhatsApp Web session connected to the system.</p>
                   
                   <div className="bg-white dark:bg-[#151521] border border-gray-200 dark:border-white/10 p-6 md:p-8 rounded-3xl text-left shadow-2xl">
                     <div className="flex items-center gap-4 md:gap-5 mb-8">
                       <div className="w-14 h-14 md:w-16 md:h-16 bg-green-900/30 rounded-full flex items-center justify-center shrink-0">
                         <img src="/wa.png" alt="WA" className="w-7 h-7 md:w-8 md:h-8 object-contain" />
                       </div>
                       <div className="min-w-0">
                         <h3 className="text-lg md:text-xl font-bold truncate">TMU Notifikasi</h3>
                         <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg truncate">{waStatus.connectedPhone || '+62 8XX-XXXX-XXXX'}</p>
                       </div>
                     </div>

                     <div className="space-y-4 mb-8 md:mb-10 text-sm md:text-base">
                       <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-white/5">
                         <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2"><RefreshCw size={16}/> Connected since</span>
                         <span className="font-bold text-right">{waStatus.connectedSince ? new Date(waStatus.connectedSince).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '-'}</span>
                       </div>
                       <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-white/5">
                         <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2"><MessageCircle size={16}/> Messages sent today</span>
                         <span className="font-bold text-right">{waStatus.messagesSentToday || 0}</span>
                       </div>
                       <div className="flex justify-between items-center py-2">
                         <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2"><CheckCircle2 size={16}/> Connection status</span>
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#151521] border-t border-gray-200 dark:border-white/5 flex items-center justify-around p-2 z-50 pb-safe">
        <BottomNavItem icon={LayoutDashboard} label="Overview" id="overview" activeTab={activeTab} setActiveTab={setActiveTab} />
        <BottomNavItem icon={Database} label="DBs" id="databases" activeTab={activeTab} setActiveTab={setActiveTab} />
        <BottomNavItem icon={Users} label="Admins" id="admins" activeTab={activeTab} setActiveTab={setActiveTab} />
        <BottomNavItem icon={Users} label="Users" id="users" activeTab={activeTab} setActiveTab={setActiveTab} />
        <BottomNavItem icon={null} label="WA" id="whatsapp" isCustomIcon={true} activeTab={activeTab} setActiveTab={setActiveTab} />
      </nav>

    </div>
  );
};

export default AdminDashboard;
