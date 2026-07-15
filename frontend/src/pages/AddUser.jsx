import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';
import { Users, UserPlus, Key, ShieldAlert, X, CheckCircle2, Edit, Trash2, Phone } from 'lucide-react';

const AddUser = () => {
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  
  // Create User Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [companyName, setCompanyName] = useState('');
  const [dbName, setDbName] = useState('');
  const [phone, setPhone] = useState('+62');
  const [editingUser, setEditingUser] = useState(null);
  
  // Change Password State
  const [changingPasswordUser, setChangingPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

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
    fetchUsers();
  }, [currentRole, navigate]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
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
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const url = editingUser ? `${apiUrl}/api/users/${editingUser}` : `${apiUrl}/api/users`;
      const method = editingUser ? 'PUT' : 'POST';
      const body = editingUser 
        ? JSON.stringify({ role, company_name: companyName, db_name: dbName, phone })
        : JSON.stringify({ username, password, role, company_name: companyName, db_name: dbName, phone });

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
        setSuccess(editingUser ? `User ${editingUser} updated successfully!` : `User ${username} created successfully!`);
        setUsername('');
        setPassword('');
        setRole('user');
        setCompanyName('');
        setDbName('');
        setPhone('+62');
        setShowCreateForm(false);
        setEditingUser(null);
        fetchUsers();
      } else {
        setError(data.error || `Failed to ${editingUser ? 'update' : 'create'} user`);
      }
    } catch (err) {
      setError('Cannot connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (u) => {
    setEditingUser(u.username);
    setUsername(u.username);
    setPassword('');
    setRole(u.role);
    setCompanyName(u.company_name === '-' ? '' : u.company_name);
    setDbName(u.db_name === '-' ? '' : u.db_name);
    setPhone(u.phone || '+62');
    setShowCreateForm(true);
    setChangingPasswordUser(null);
    setError('');
    setSuccess('');
  };

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`Are you sure you want to delete user '${username}'?`)) return;
    
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/users/${username}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setSuccess(`User ${username} deleted successfully!`);
        if (editingUser === username) {
          setShowCreateForm(false);
          setEditingUser(null);
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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/users/${changingPasswordUser}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Password for ${changingPasswordUser} updated successfully!`);
        setChangingPasswordUser(null);
        setNewPassword('');
      } else {
        setError(data.error || 'Failed to update password');
      }
    } catch (err) {
      setError('Cannot connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  if (currentRole !== 'admin') return null;

  return (
    <div className="max-w-6xl mx-auto w-full mt-4 md:mt-8 space-y-6">
      
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-[#172b4d] dark:text-white flex items-center gap-2">
            <Users size={24} className="text-[#0052cc] dark:text-[#4c9aff]" />
            Manage Users
          </h1>
          <p className="text-[#5e6c84] dark:text-[#94a3b8] text-sm mt-1">
            View users, mapped company data, and manage credentials.
          </p>
        </div>
        {!showCreateForm && !changingPasswordUser && (
          <button 
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0052cc] hover:bg-[#0047b3] text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <UserPlus size={16} />
            Create User
          </button>
        )}
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

      {/* CREATE USER FORM */}
      {showCreateForm && (
        <div className="bg-white dark:bg-[#151521] rounded-2xl shadow-sm border border-[#dfe1e6] dark:border-white/10 overflow-hidden mb-6 animate-slide-up-fade">
          <div className="p-4 border-b border-[#dfe1e6] dark:border-white/10 flex justify-between items-center bg-[#f4f5f7]/50 dark:bg-white/5">
            <h2 className="text-lg font-bold text-[#172b4d] dark:text-white">
              {editingUser ? `Edit User: ${editingUser}` : 'Create New User'}
            </h2>
            <button onClick={() => { setShowCreateForm(false); setEditingUser(null); }} className="text-[#5e6c84] hover:text-red-500 transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="p-6">
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-2.5 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] transition-all disabled:opacity-50"
                  placeholder="Enter username"
                  required
                  disabled={editingUser !== null}
                />
              </div>
              {!editingUser && (
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-2.5 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] transition-all"
                    placeholder="Enter password"
                    required
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Role</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-2.5 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] transition-all"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">Company Name</label>
                <input 
                  type="text" 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-2.5 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] transition-all"
                  placeholder="e.g. PT Example"
                />
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
                  className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-2.5 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] transition-all"
                  placeholder="e.g. db_example"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">No. Telepon (WhatsApp)</label>
                <div className="relative">
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (!val.startsWith('+62')) {
                        val = '+62';
                      }
                      setPhone(val);
                    }}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-2.5 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-[#4c9aff] transition-all"
                    placeholder="+628xxxxxxxxxx"
                  />
                </div>
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className={`px-6 py-2.5 rounded-xl text-white font-semibold text-sm transition-colors disabled:opacity-70 ${editingUser ? 'bg-orange-600 hover:bg-orange-700' : 'bg-[#0052cc] hover:bg-[#0047b3]'}`}
                >
                  {isLoading ? (editingUser ? 'Updating...' : 'Creating...') : (editingUser ? 'Update User' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD FORM */}
      {changingPasswordUser && (
        <div className="bg-white dark:bg-[#151521] rounded-2xl shadow-sm border border-orange-200 dark:border-orange-800/50 overflow-hidden mb-6 animate-slide-up-fade">
          <div className="p-4 border-b border-orange-200 dark:border-orange-800/50 flex justify-between items-center bg-orange-50 dark:bg-orange-900/10">
            <h2 className="text-lg font-bold text-orange-700 dark:text-orange-400 flex items-center gap-2">
              <Key size={18} />
              Change Password for <span className="font-mono bg-white dark:bg-black/20 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-800/30">{changingPasswordUser}</span>
            </h2>
            <button onClick={() => setChangingPasswordUser(null)} className="text-[#5e6c84] hover:text-red-500 transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="p-6">
            <form onSubmit={handleChangePassword} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="space-y-1.5 flex-1 w-full">
                <label className="text-sm font-semibold text-[#172b4d] dark:text-white">New Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-2.5 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:border-orange-400 transition-all"
                  placeholder="Enter new password"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors disabled:opacity-70"
              >
                {isLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* USERS TABLE */}
      <div className="bg-white dark:bg-[#151521] rounded-2xl shadow-sm border border-[#dfe1e6] dark:border-white/10 overflow-hidden">
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 bg-white dark:bg-[#151521]">
              <tr className="bg-[#f4f5f7]/90 dark:bg-white/5 border-b border-[#dfe1e6] dark:border-white/10 backdrop-blur-sm">
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Username</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Role</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">PT Name</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Database</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Phone</th>
                <th className="p-4 text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfe1e6] dark:divide-white/10">
              {isLoadingUsers ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-[#5e6c84] dark:text-[#94a3b8]">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-[#5e6c84] dark:text-[#94a3b8]">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-[#172b4d] dark:text-white">{u.username}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'admin' 
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' 
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-[#172b4d] dark:text-gray-300">
                      {u.company_name}
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-xs text-[#5e6c84] dark:text-[#94a3b8]">
                        {u.db_name}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-[#172b4d] dark:text-gray-300">
                      {u.phone ? (
                        <a 
                          href={`https://wa.me/${u.phone.replace('+', '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline"
                        >
                          <Phone size={12} />
                          {u.phone}
                        </a>
                      ) : '-'}
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
                          onClick={() => {
                            setChangingPasswordUser(u.username);
                            setShowCreateForm(false);
                            setEditingUser(null);
                            setNewPassword('');
                            setError('');
                            setSuccess('');
                          }}
                          className="p-2 inline-flex items-center justify-center rounded-lg bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 text-orange-600 dark:text-orange-400 transition-colors"
                          title="Change Password"
                        >
                          <Key size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u.username)}
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

export default AddUser;
