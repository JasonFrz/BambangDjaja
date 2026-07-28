import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, Table, Trash2, ShieldAlert, LogIn, ChevronRight, RefreshCw, Server, Search, AlertTriangle } from 'lucide-react';
import { useApi } from '../contexts/ApiContext';
import { useTheme } from '../contexts/ThemeContext';

const SuperAdminDashboard = () => {
  const { apiUrl } = useApi();
  const { isDarkMode } = useTheme();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState(null);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState([]);
  
  const [dataLimit, setDataLimit] = useState('100');
  const [dataSort, setDataSort] = useState('latest');

  const [isLoadingDbs, setIsLoadingDbs] = useState(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dbToDelete, setDbToDelete] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('superadmin') === 'true') {
      setIsLoggedIn(true);
      fetchDatabases();
    }
  }, []);

  const axiosInstance = axios.create({
    baseURL: apiUrl,
    headers: { 'X-Super-Admin': 'true' }
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await axiosInstance.post('/api/superadmin/login', { username, password });
      if (res.data.success) {
        setIsLoggedIn(true);
        sessionStorage.setItem('superadmin', 'true');
        fetchDatabases();
      }
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('superadmin');
    setIsLoggedIn(false);
    setSelectedDb(null);
    setSelectedTable(null);
  };

  const fetchDatabases = async () => {
    setIsLoadingDbs(true);
    try {
      const res = await axiosInstance.get('/api/superadmin/databases');
      setDatabases(res.data.databases || []);
    } catch (err) {
      console.error(err);
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
      const res = await axiosInstance.get(`/api/superadmin/databases/${dbName}/tables`);
      setTables(res.data.tables || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingTables(false);
    }
  };

  const fetchTableData = async (dbName, tableName, limit = dataLimit, sort = dataSort) => {
    setIsLoadingData(true);
    setSelectedTable(tableName);
    try {
      const res = await axiosInstance.get(`/api/superadmin/databases/${dbName}/tables/${tableName}?limit=${limit}&sort=${sort}`);
      setTableData(res.data.data || []);
    } catch (err) {
      console.error(err);
      setTableData([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleDeleteDb = async () => {
    if (deleteConfirmation !== dbToDelete) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/api/superadmin/databases/${dbToDelete}`);
      setShowDeleteModal(false);
      setDbToDelete('');
      setDeleteConfirmation('');
      setSelectedDb(null);
      fetchDatabases();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete database');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#0a0a0f] dark:to-[#151521]`}>
        <div className="w-full max-w-md bg-white dark:bg-[#1a1a24] rounded-2xl shadow-xl overflow-hidden animate-[slideUpFade_0.3s_ease-out]">
          <div className="p-8">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <ShieldAlert size={32} />
              </div>
            </div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 font-heading tracking-tight">Super Admin</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">System Database Management</p>
            </div>
            
            {loginError && (
              <div className="mb-6 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm font-medium text-center border border-red-200 dark:border-red-500/20">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="admin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="••••"
                />
              </div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/40 disabled:opacity-70 flex items-center justify-center gap-2 mt-4"
              >
                {isLoggingIn ? <RefreshCw size={20} className="animate-spin" /> : <LogIn size={20} />}
                Enter Admin Portal
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const filteredDbs = databases.filter(db => db.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${isDarkMode ? 'dark' : ''} bg-gray-50 dark:bg-[#0a0a0f] text-gray-900 dark:text-white`}>
      
      <header className="h-16 border-b border-gray-200 dark:border-white/10 bg-white/80 dark:bg-[#151521]/80 backdrop-blur-md flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Server size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg font-heading tracking-tight leading-tight">Database Administrator</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">AIVEN MySQL Server</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-400 transition-colors font-semibold text-sm"
        >
          Exit Admin
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        <div className="w-72 md:w-80 border-r border-gray-200 dark:border-white/10 bg-white dark:bg-[#151521] flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-200 dark:border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search databases..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-100 dark:bg-black/20 border-none text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-gray-900 dark:text-white"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
            {isLoadingDbs ? (
              <div className="flex justify-center p-6"><RefreshCw className="animate-spin text-gray-400" size={24} /></div>
            ) : filteredDbs.length > 0 ? (
              filteredDbs.map(db => (
                <button
                  key={db}
                  onClick={() => fetchTables(db)}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all ${selectedDb === db ? 'bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 shadow-sm' : 'hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent'}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Database size={18} className={selectedDb === db ? 'text-blue-500' : 'text-gray-400'} />
                    <span className={`font-medium truncate text-sm ${selectedDb === db ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {db}
                    </span>
                  </div>
                  <ChevronRight size={16} className={selectedDb === db ? 'text-blue-500 opacity-100' : 'text-gray-300 opacity-0'} />
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                No databases found
              </div>
            )}
          </div>
        </div>

        <div className="w-64 md:w-72 border-r border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#1a1a24] flex flex-col shrink-0">
          {selectedDb ? (
            <>
              <div className="p-4 border-b border-gray-200 dark:border-white/10 bg-white/50 dark:bg-black/10 backdrop-blur-sm">
                <h3 className="font-bold text-gray-900 dark:text-white truncate" title={selectedDb}>{selectedDb}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tables.length} Tables</p>
                
                <button 
                  onClick={() => { setDbToDelete(selectedDb); setShowDeleteModal(true); }}
                  className="mt-3 w-full py-2 px-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-red-200 dark:border-red-800/50"
                >
                  <Trash2 size={14} />
                  Drop Database
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                {isLoadingTables ? (
                  <div className="flex justify-center p-6"><RefreshCw className="animate-spin text-gray-400" size={24} /></div>
                ) : tables.length > 0 ? (
                  tables.map(table => (
                    <button
                      key={table}
                      onClick={() => fetchTableData(selectedDb, table)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${selectedTable === table ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300'}`}
                    >
                      <Table size={16} className={selectedTable === table ? 'text-indigo-500' : 'text-gray-400'} />
                      <span className="font-medium text-sm truncate">{table}</span>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                    No tables in database
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Database size={48} className="text-gray-300 dark:text-gray-700 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">Select a database to view tables</p>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col bg-white dark:bg-[#151521] overflow-hidden">
          {selectedTable ? (
            <>
              <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#151521] z-10 shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                    <Table size={20} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white truncate">{selectedTable}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Showing {dataLimit === 'all' ? 'All' : `up to ${dataLimit}`} records</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select 
                    value={dataSort} 
                    onChange={(e) => {
                      setDataSort(e.target.value);
                      fetchTableData(selectedDb, selectedTable, dataLimit, e.target.value);
                    }}
                    className="text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="none">Default Order</option>
                    <option value="latest">Latest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                  <select 
                    value={dataLimit} 
                    onChange={(e) => {
                      setDataLimit(e.target.value);
                      fetchTableData(selectedDb, selectedTable, e.target.value, dataSort);
                    }}
                    className="text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="100">100 Rows</option>
                    <option value="500">500 Rows</option>
                    <option value="1000">1000 Rows</option>
                    <option value="all">All Data</option>
                  </select>
                  <button 
                    onClick={() => fetchTableData(selectedDb, selectedTable, dataLimit, dataSort)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 transition-colors"
                  >
                    <RefreshCw size={16} className={isLoadingData ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                {isLoadingData ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                    <RefreshCw className="animate-spin" size={32} />
                    <p className="text-sm font-medium">Loading data...</p>
                  </div>
                ) : tableData.length > 0 ? (
                  <div className="bg-white dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-white/10">
                          <tr>
                            {Object.keys(tableData[0]).map((key) => (
                              <th key={key} className="px-4 py-3 font-semibold tracking-wider text-xs uppercase">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                          {tableData.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors text-gray-700 dark:text-gray-300">
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="px-4 py-2.5 max-w-[200px] truncate" title={String(val)}>
                                  {val === null ? <span className="text-gray-400 italic">NULL</span> : String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Table size={48} className="text-gray-300 dark:text-gray-700 mb-4" />
                    <p className="font-medium">Table is empty</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gray-50/30 dark:bg-[#1a1a24]/30">
              <Table size={64} className="text-gray-200 dark:text-gray-800 mb-5" />
              <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2 font-heading">Data Explorer</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm">Select a table from the panel to view its contents directly from the MySQL server.</p>
            </div>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-[#1a1a24] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Drop Database?</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">
                This action is <strong>EXTREMELY DANGEROUS</strong> and irreversible. It will permanently delete the database <strong className="text-red-500">`{dbToDelete}`</strong> and all of its tables and data.
              </p>
              
              <div className="mb-6 p-4 bg-gray-50 dark:bg-black/30 rounded-xl border border-gray-200 dark:border-white/10">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                  Type <span className="text-red-500 select-none">{dbToDelete}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-[#151521] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder={dbToDelete}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirmation(''); }}
                  className="px-4 py-2 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteDb}
                  disabled={deleteConfirmation !== dbToDelete || isDeleting}
                  className="px-4 py-2 rounded-lg font-bold bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDeleting ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Drop Database
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
