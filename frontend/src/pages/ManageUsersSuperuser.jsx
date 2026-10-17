import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';
import { useDialog } from '../contexts/DialogContext';
import { Users, UserPlus, Key, ShieldAlert, X, CheckCircle2, Edit, Trash2, Phone, Search, Loader2, Mail, Eye, EyeOff, History } from 'lucide-react';
import EnergyLoader from '../components/EnergyLoader';
import UserActivityLog from '../components/UserActivityLog';

const ManageUsersSuperuser = () => {
  const { confirm } = useDialog();
  const [activeMainTab, setActiveMainTab] = useState('users'); // 'users' | 'activity'
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { apiUrl } = useApi();
  const navigate = useNavigate();
  const currentRole = sessionStorage.getItem('role');
  const dbName = sessionStorage.getItem('db_name');
  const sessionUsername = sessionStorage.getItem('username');
  
  useEffect(() => {
    if (currentRole !== 'superuser') {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [currentRole, navigate]);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-DB-Name': dbName,
    'X-Username': sessionUsername
  });

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch(`${apiUrl}/api/superuser-users`, {
        headers: getHeaders()
      });
      const data = await response.json();
      if (response.ok) {
        setUsers(data);
      } else {
        setError(data.error || 'Failed to fetch users');
      }
    } catch (err) {
      console.error("Failed to fetch users");
      setError('Cannot connect to server');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (email && !email.toLowerCase().endsWith('@gmail.com')) {
      setError('Email must use @gmail.com domain.');
      setIsLoading(false);
      return;
    }

    if (phone && !phone.startsWith('08')) {
      setError('Phone number must start with 08.');
      setIsLoading(false);
      return;
    }

    try {
      const url = editingUserId ? `${apiUrl}/api/superuser-users/${editingUserId}` : `${apiUrl}/api/superuser-users`;
      const method = editingUserId ? 'PUT' : 'POST';
      const body = JSON.stringify({ 
        username, 
        password: password || undefined, 
        nomor_telpon: phone,
        email: email,
        role: role
      });

      const response = await fetch(url, {
        method,
        headers: getHeaders(),
        body
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(editingUserId ? `User ${username} updated successfully!` : `User ${username} created successfully!`);
        resetForm();
        fetchUsers();
      } else {
        setError(data.error || `Failed to ${editingUserId ? 'update' : 'create'} user`);
      }
    } catch (err) {
      setError('Cannot connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setPhone('');
    setEmail('');
    setRole('user');
    setShowPassword(false);
    setShowCreateForm(false);
    setEditingUserId(null);
  };

  const handleEditClick = (u) => {
    setEditingUserId(u.id);
    setUsername(u.username || '');
    setPassword(''); 
    setPhone(u.nomor_telpon || '');
    setEmail(u.email || '');
    setRole(u.role || 'user');
    setShowPassword(false);
    setShowCreateForm(true);
    setError('');
    setSuccess('');
  };

  const handleDeleteUser = async (u) => {
    const isConfirmed = await confirm(`Are you sure you want to delete user '${u.username}'?`);
    if (!isConfirmed) return;
    
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/superuser-users/${u.id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (response.ok) {
        setSuccess(`User ${u.username} deleted successfully!`);
        if (editingUserId === u.id) {
          resetForm();
        }
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete user');
      }
    } catch (err) {
      setError('Cannot connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  if (currentRole !== 'superuser') return null;

  const filteredUsers = Array.isArray(users) ? users.filter(u => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    return String(u.username || '').toLowerCase().includes(q) ||
           String(u.email || '').toLowerCase().includes(q) ||
           String(u.nomor_telpon || u.phone || '').toLowerCase().includes(q) ||
           String(u.role || '').toLowerCase().includes(q);
  }) : [];

  return (
    <div className="flex flex-col gap-4 sm:gap-5 animate-[fadeIn_0.3s_ease-out] w-full pb-10">
      
      {/* ========================================================= */}
      {/* 1. HERO HEADER BANNER (Matching Performance / Instantaneous Report) */}
      {/* ========================================================= */}
      <div className="relative rounded-xl sm:rounded-2xl md:rounded-3xl bg-gradient-to-br from-white via-white to-indigo-50/40 dark:from-[#151521] dark:via-[#151521] dark:to-[#1a1b2e] border border-[#dfe1e6]/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.2)] p-3 sm:p-4 md:p-5 shrink-0 z-20">
        
        {/* Glow aksen latar belakang terisolasi */}
        <div className="absolute inset-0 overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl pointer-events-none">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 sm:w-64 h-48 sm:h-64 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 -mb-20 w-60 sm:w-80 h-32 sm:h-40 bg-blue-500/10 dark:blue-500/15 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          
          {/* Judul: Manage Users */}
          <div className="flex flex-col min-w-0">
            <h1 className="text-base sm:text-lg md:text-2xl font-black text-[#172b4d] dark:text-white font-heading tracking-tight truncate">
              Manage Users
            </h1>
            <p className="text-[11px] sm:text-xs md:text-sm text-[#5e6c84] dark:text-[#94a3b8] mt-0.5">
              Create, manage user accounts, and track all system activity logs.
            </p>
          </div>

          {/* Actions: Create User & Tab Switcher Pills */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto shrink-0">
            {!showCreateForm && (
              <button 
                onClick={() => {
                  setActiveMainTab('users');
                  setShowCreateForm(true);
                }}
                className="flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow-md active:scale-95 w-full sm:w-auto"
              >
                <UserPlus size={16} />
                <span>Create User</span>
              </button>
            )}

            {/* Tab Switcher Pills */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200/80 dark:border-white/10 w-full sm:w-auto">
              <button
                onClick={() => setActiveMainTab('users')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeMainTab === 'users'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm sm:shadow-md shadow-indigo-500/25'
                    : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/5'
                }`}
              >
                <Users size={15} />
                <span>User Accounts</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeMainTab === 'users' 
                    ? 'bg-white/20 text-white' 
                    : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                }`}>
                  {users.length}
                </span>
              </button>

              <button
                onClick={() => setActiveMainTab('activity')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeMainTab === 'activity'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm sm:shadow-md shadow-indigo-500/25'
                    : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/5'
                }`}
              >
                <History size={15} />
                <span>Activity Log</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {activeMainTab === 'users' ? (
        <>
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2 animate-slide-up-fade">
              <ShieldAlert size={18} />
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2 animate-slide-up-fade">
              <CheckCircle2 size={18} />
              {success}
            </div>
          )}

      {showCreateForm && (
        <div className="bg-white dark:bg-[#151521] rounded-2xl shadow-lg border border-[#dfe1e6] dark:border-white/10 overflow-hidden mb-6 animate-slide-up-fade">
          <div className="p-4 border-b border-[#dfe1e6] dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-white/5">
            <h2 className="text-lg font-bold text-[#172b4d] dark:text-white flex items-center gap-2">
              {editingUserId ? <Edit size={18} className="text-indigo-500" /> : <UserPlus size={18} className="text-indigo-500" />}
              {editingUserId ? `Edit User: ${username}` : 'Create New User'}
            </h2>
            <button onClick={resetForm} className="text-[#5e6c84] hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
              <X size={20} />
            </button>
          </div>
          <div className="p-6">
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  placeholder="Enter username"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">
                  Password {editingUserId && <span className="text-xs text-gray-400 font-normal">(Leave blank to keep unchanged)</span>}
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 px-4 pr-12 text-[#172b4d] dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="Enter password"
                    required={!editingUserId}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-500 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Role</label>
                <div className="relative">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none"
                  >
                    <option value="user">User</option>
                    <option value="superuser">Superuser</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Email</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Mail size={16} />
                  </div>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 pl-11 pr-4 text-[#172b4d] dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="your.email@example.com"
                  />
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Phone Number</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Phone size={16} />
                  </div>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 pl-11 pr-4 text-[#172b4d] dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 rounded-xl text-gray-600 dark:text-gray-300 font-semibold text-sm transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className={`px-6 py-2.5 rounded-xl text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70 flex items-center gap-2 ${editingUserId ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}`}
                >
                  {isLoading && <Loader2 size={16} className="animate-spin" />}
                  {isLoading ? (editingUserId ? 'Updating...' : 'Creating...') : (editingUserId ? 'Update User' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#151521] rounded-2xl shadow-sm border border-[#dfe1e6] dark:border-white/10 overflow-hidden flex flex-col">
        <div className="p-3 sm:p-4 border-b border-[#dfe1e6] dark:border-white/10 flex items-center bg-gray-50/50 dark:bg-white/[0.02]">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search users by username, email, phone, or role..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-gray-50/70 dark:bg-white/5 border border-[#dfe1e6] dark:border-white/10 rounded-xl text-xs sm:text-sm text-[#172b4d] dark:text-white placeholder-gray-400 outline-none focus:border-indigo-500 transition-colors h-[38px]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="overflow-auto max-h-[600px] custom-scrollbar">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 bg-white dark:bg-[#151521]">
              <tr className="bg-[#f4f5f7]/90 dark:bg-white/5 border-b border-[#dfe1e6] dark:border-white/10 backdrop-blur-sm">
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Username</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Role</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Email</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Phone</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfe1e6] dark:divide-white/10">
              {isLoadingUsers ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center">
                    <EnergyLoader text="Loading users..." />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-[#5e6c84] dark:text-[#94a3b8]">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-[#172b4d] dark:text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs uppercase">
                          {u.username ? String(u.username).charAt(0) : '?'}
                        </div>
                        {u.username || 'Unnamed'}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${u.role === 'superuser' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/30' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/30'} capitalize`}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-[#172b4d] dark:text-gray-300">
                      {u.email ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                          <Mail size={12} className="text-gray-400" />
                          {u.email}
                        </span>
                      ) : <span className="text-gray-400 italic">Not set</span>}
                    </td>
                    <td className="p-4 text-sm text-[#172b4d] dark:text-gray-300">
                      {u.nomor_telpon ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                          <Phone size={12} className="text-gray-400" />
                          {u.nomor_telpon}
                        </span>
                      ) : <span className="text-gray-400 italic">Not set</span>}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => handleEditClick(u)}
                          className="p-2 inline-flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 transition-colors"
                          title="Edit User"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u)}
                          className="p-2 inline-flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 transition-colors"
                          title="Delete User"
                        >
                          <Trash2 size={16} />
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
      </>
    ) : (
      <UserActivityLog />
    )}
      
    </div>
  );
};

export default ManageUsersSuperuser;
