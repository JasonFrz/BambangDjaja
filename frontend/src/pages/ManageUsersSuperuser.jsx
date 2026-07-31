import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';
import { useDialog } from '../contexts/DialogContext';
import { Users, UserPlus, Key, ShieldAlert, X, CheckCircle2, Edit, Trash2, Phone, Search, Loader2, Mail, Eye, EyeOff } from 'lucide-react';
import EnergyLoader from '../components/EnergyLoader';

const ManageUsersSuperuser = () => {
  const { confirm } = useDialog();
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { apiUrl } = useApi();
  const navigate = useNavigate();
  const currentRole = sessionStorage.getItem('role');
  const dbName = sessionStorage.getItem('company_name');
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
      setError('Email harus menggunakan domain @gmail.com.');
      setIsLoading(false);
      return;
    }

    if (phone && !phone.startsWith('08')) {
      setError('Nomor telepon harus diawali dengan 08.');
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
        email: email
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
    setShowPassword(false);
    setShowCreateForm(false);
    setEditingUserId(null);
  };

  const handleEditClick = (u) => {
    setEditingUserId(u.id);
    setUsername(u.username || '');
    setPassword(''); // leave blank unless changing
    setPhone(u.nomor_telpon || '');
    setEmail(u.email || '');
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

  const filteredUsers = Array.isArray(users) ? users.filter(u => String(u.username || '').toLowerCase().includes(searchTerm.toLowerCase())) : [];

  return (
    <div className="max-w-5xl mx-auto w-full mt-4 md:mt-8 space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#172b4d] dark:text-white flex items-center gap-2">
            <Users size={24} className="text-indigo-600 dark:text-indigo-400" />
            Manage Users
          </h1>
          <p className="text-[#5e6c84] dark:text-[#94a3b8] text-sm mt-1">
            Create and manage users for client access.
          </p>
        </div>
        {!showCreateForm && (
          <button 
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg w-full sm:w-auto justify-center"
          >
            <UserPlus size={18} />
            Create User
          </button>
        )}
      </div>

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
        <div className="p-4 border-b border-[#dfe1e6] dark:border-white/10 flex items-center gap-3 bg-gray-50/50 dark:bg-white/[0.02]">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-black/20 border border-[#dfe1e6] dark:border-white/10 rounded-lg text-sm text-[#172b4d] dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
            />
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
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30">
                        {u.role}
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
      
    </div>
  );
};

export default ManageUsersSuperuser;
