import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';
import { User, Phone, Key, ShieldAlert, CheckCircle2, Save, Loader2, ArrowLeft, Mail } from 'lucide-react';
import EnergyLoader from '../components/EnergyLoader';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const navigate = useNavigate();

  const { apiUrl } = useApi();
  const dbName = sessionStorage.getItem('company_name');
  const sessionUsername = sessionStorage.getItem('username');
  
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-DB-Name': dbName,
    'X-Username': sessionUsername
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/profile`, { headers: getHeaders() });
        const data = await res.json();
        if (res.ok) {
          setProfile(data);
          setUsername(data.username || '');
          setPhone(data.nomor_telpon || '');
          setEmail(data.email || '');
        } else {
          setError(data.error || 'Failed to fetch profile');
        }
      } catch (err) {
        setError('Cannot connect to server');
      }
    };
    fetchProfile();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const res = await fetch(`${apiUrl}/api/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ 
          username: username,
          nomor_telpon: phone,
          email: email,
          password: password || undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess('Profile updated successfully!');
        setPassword('');
        if (data.newToken) {
          sessionStorage.setItem('token', data.newToken);
        }
        if (data.newUsername) {
          sessionStorage.setItem('username', data.newUsername);
          setProfile(prev => ({ ...prev, username: data.newUsername }));
        }
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('Cannot connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  if (!profile && !error) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <EnergyLoader text="Loading data..." />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full mt-4 md:mt-8 space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2.5 rounded-xl bg-white dark:bg-[#151521] border border-[#dfe1e6] dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-sm"
          title="Go Back"
        >
          <ArrowLeft size={20} className="text-[#172b4d] dark:text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#172b4d] dark:text-white flex items-center gap-2">
            <User size={24} className="text-indigo-600 dark:text-indigo-400" />
            Profile
          </h1>
          <p className="text-[#5e6c84] dark:text-[#94a3b8] text-sm mt-1">
            Update your personal information and security settings.
          </p>
        </div>
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

      {profile && (
        <div className="bg-white dark:bg-[#151521] rounded-2xl shadow-sm border border-[#dfe1e6] dark:border-white/10 overflow-hidden">
          <div className="p-6">
            <form onSubmit={handleUpdate} className="space-y-6">
              
              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl font-bold uppercase shrink-0">
                  {profile.username ? String(profile.username).charAt(0) : '?'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#172b4d] dark:text-white">{profile.username}</h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 mt-1 capitalize">
                    {profile.role}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[#172b4d] dark:text-white flex items-center gap-2">
                    <User size={16} className="text-gray-400" />
                    Username
                  </label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="Enter your new username"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[#172b4d] dark:text-white flex items-center gap-2">
                    <Phone size={16} className="text-gray-400" />
                    Phone Number
                  </label>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[#172b4d] dark:text-white flex items-center gap-2">
                    <Mail size={16} className="text-gray-400" />
                    Email
                  </label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="your.email@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[#172b4d] dark:text-white flex items-center gap-2">
                    <Key size={16} className="text-gray-400" />
                    New Password
                  </label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#f4f5f7] dark:bg-[#070a13] border border-[#dfe1e6] dark:border-white/10 rounded-xl py-3 px-4 text-[#172b4d] dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="Leave blank to keep unchanged"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Fill this only if you want to change your current password.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#dfe1e6] dark:border-white/10 flex justify-end">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-70 flex items-center gap-2"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
