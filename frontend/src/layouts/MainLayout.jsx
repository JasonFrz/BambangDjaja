import React, { useEffect, useState, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Moon, Sun, LogOut, LayoutDashboard, TrendingUp, Users, ChevronLeft, ChevronRight, Settings, Key, ShieldCheck, Activity, ClipboardList, User } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const MainLayout = () => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const username = sessionStorage.getItem('username') || 'User';
  const role = sessionStorage.getItem('role') || 'user';
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const dropdownRef = useRef(null);

  const isTransformerDashboard = ['/dashboard', '/temperature', '/transformer-data', '/performance-report', '/manage-users'].includes(location.pathname);
  const isAdminDashboard = role === 'admin' && (location.pathname === '/users' || location.pathname === '/provisioning' || location.pathname === '/manage-transformers');
  const isSuperuserDashboard = role === 'superuser' && (location.pathname === '/manage-users');
  const showSidebar = isTransformerDashboard || isAdminDashboard || isSuperuserDashboard;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('company_name');
    window.location.href = '/login';
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#f4f7fe] dark:bg-[#0b1120] transition-colors duration-300 overflow-hidden">

      <header className="h-[70px] px-6 md:px-8 flex justify-between items-center border-b border-[#dfe1e6] dark:border-white/10 bg-white/80 dark:bg-[#151521]/80 backdrop-blur-md z-30 shrink-0 relative">
        <Link to="/" className="flex items-center gap-3 group">
          <img src="/tmu-logo.png" alt="Logo" className="w-auto h-7 md:h-8 group-hover:opacity-80 transition-opacity" />
          <h1 className="text-lg md:text-xl font-bold tracking-tight font-heading text-[#172b4d] dark:text-white">
            TMU <span className="font-light opacity-80 hidden sm:inline">{isAdminDashboard ? 'Admin' : 'Dashboard'}</span>
          </h1>
        </Link>

        {isTransformerDashboard && (
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center w-[120px] sm:w-auto">
            <span className="text-[#172b4d] dark:text-white font-bold tracking-widest text-sm md:text-lg leading-none">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="hidden sm:block text-xs text-[#5e6c84] dark:text-[#94a3b8] font-medium mt-1">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 md:gap-6">
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-full bg-[#f4f5f7] dark:bg-white/5 text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white hover:bg-[#ebecf0] dark:hover:bg-white/10 transition-all"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          <div className="relative flex items-center gap-3 font-medium text-[#172b4d] dark:text-white pl-4 border-l border-[#dfe1e6] dark:border-white/10" ref={dropdownRef}>
            <span className="hidden md:inline">{username}</span>
            <div 
              className="relative group cursor-pointer"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className="absolute inset-0 -inset-0.5 bg-gradient-to-r from-[#4c9aff] via-[#0052cc] to-[#00a3ff] dark:from-[#0052cc] dark:via-[#00a3ff] dark:to-[#4c9aff] rounded-full blur-[6px] opacity-40 dark:opacity-60 group-hover:opacity-80 dark:group-hover:opacity-100 group-hover:blur-[8px] animate-pulse transition-all duration-300"></div>
              <div className="relative w-10 h-10 bg-gradient-to-br from-white to-[#f4f7fe] dark:from-[#1e1e2d] dark:to-[#151521] border border-[#0052cc]/20 dark:border-white/20 text-[#0052cc] dark:text-white rounded-full flex items-center justify-center font-bold text-lg shadow-inner uppercase overflow-hidden transition-transform duration-300 group-hover:scale-105">
                <span className="relative z-10 drop-shadow-sm dark:drop-shadow-md">{username.charAt(0)}</span>
                <div className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-[#0052cc]/10 dark:via-white/30 to-transparent group-hover:animate-shimmer skew-x-[30deg] z-0"></div>
              </div>
            </div>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-3 w-48 bg-white dark:bg-[#151521] border border-[#dfe1e6] dark:border-white/10 rounded-xl shadow-lg overflow-hidden animate-slide-up-fade z-50">
                <div className="p-3 border-b border-[#dfe1e6] dark:border-white/10 bg-gray-50 dark:bg-white/5">
                  <p className="text-sm font-semibold text-[#172b4d] dark:text-white truncate">{username}</p>
                  <p className="text-xs text-[#5e6c84] dark:text-[#94a3b8] capitalize mt-0.5">{role}</p>
                </div>
                <div className="p-2">
                  <Link 
                    to="/profile"
                    onClick={() => setIsDropdownOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#172b4d] dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors font-medium text-sm text-left mb-1"
                  >
                    <User size={16} />
                    Profile
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium text-sm text-left"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        
        {showSidebar && (
          <aside className={`border-r border-[#dfe1e6] dark:border-white/10 bg-white/80 dark:bg-[#151521]/80 backdrop-blur-md flex flex-col transition-all duration-300 z-20 hidden md:flex shrink-0 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
            <nav className="flex-1 py-6 px-4 flex flex-col gap-2 overflow-y-auto overflow-x-hidden">

              {isAdminDashboard && (
                <>
                  <Link 
                    to="/provisioning"
                    title={isSidebarCollapsed ? "Provisioning" : undefined}
                    className={`flex items-center py-3 rounded-xl font-medium transition-all ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
                      location.pathname === '/provisioning' 
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400' 
                        : 'text-[#5e6c84] dark:text-[#94a3b8] hover:bg-[#f4f5f7] dark:hover:bg-white/5 hover:text-[#172b4d] dark:hover:text-white'
                    }`}
                  >
                    <Key size={20} className="shrink-0" />
                    {!isSidebarCollapsed && <span className="truncate">Provisioning</span>}
                  </Link>
                  <Link 
                    to="/users"
                    title={isSidebarCollapsed ? "Manage Users" : undefined}
                    className={`flex items-center py-3 rounded-xl font-medium transition-all ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
                      location.pathname === '/users' 
                        ? 'bg-[#0052cc]/10 text-[#0052cc] dark:bg-[#4c9aff]/10 dark:text-[#4c9aff]' 
                        : 'text-[#5e6c84] dark:text-[#94a3b8] hover:bg-[#f4f5f7] dark:hover:bg-white/5 hover:text-[#172b4d] dark:hover:text-white'
                    }`}
                  >
                    <Users size={20} className="shrink-0" />
                    {!isSidebarCollapsed && <span className="truncate">Manage Users</span>}
                  </Link>
                  <Link 
                    to="/manage-transformers"
                    title={isSidebarCollapsed ? "Manage Trafo" : undefined}
                    className={`flex items-center py-3 rounded-xl font-medium transition-all ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
                      location.pathname === '/manage-transformers' 
                        ? 'bg-[#0052cc]/10 text-[#0052cc] dark:bg-[#4c9aff]/10 dark:text-[#4c9aff]' 
                        : 'text-[#5e6c84] dark:text-[#94a3b8] hover:bg-[#f4f5f7] dark:hover:bg-white/5 hover:text-[#172b4d] dark:hover:text-white'
                    }`}
                  >
                    <Activity size={20} className="shrink-0" />
                    {!isSidebarCollapsed && <span className="truncate">Manage Trafo</span>}
                  </Link>
                </>
              )}


              {isTransformerDashboard && (
                <>
                  <Link 
                    to="/dashboard"
                    title={isSidebarCollapsed ? "Dashboard Electrical" : undefined}
                    className={`flex items-center py-3 rounded-xl font-medium transition-all ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
                      location.pathname === '/dashboard' 
                        ? 'bg-[#0052cc]/10 text-[#0052cc] dark:bg-[#4c9aff]/10 dark:text-[#4c9aff]' 
                        : 'text-[#5e6c84] dark:text-[#94a3b8] hover:bg-[#f4f5f7] dark:hover:bg-white/5 hover:text-[#172b4d] dark:hover:text-white'
                    }`}
                  >
                    <LayoutDashboard size={20} className="shrink-0" />
                    {!isSidebarCollapsed && <span className="truncate">Dashboard Electrical</span>}
                  </Link>
                  <Link 
                    to="/temperature"
                    title={isSidebarCollapsed ? "Dashboard Physical" : undefined}
                    className={`flex items-center py-3 rounded-xl font-medium transition-all ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
                      location.pathname === '/temperature' 
                        ? 'bg-[#0052cc]/10 text-[#0052cc] dark:bg-[#4c9aff]/10 dark:text-[#4c9aff]' 
                        : 'text-[#5e6c84] dark:text-[#94a3b8] hover:bg-[#f4f5f7] dark:hover:bg-white/5 hover:text-[#172b4d] dark:hover:text-white'
                    }`}
                  >
                    <TrendingUp size={20} className="shrink-0" />
                    {!isSidebarCollapsed && <span className="truncate">Dashboard Physical</span>}
                  </Link>
                  <Link 
                    to="/transformer-data"
                    title={isSidebarCollapsed ? "Transformer Data" : undefined}
                    className={`flex items-center py-3 rounded-xl font-medium transition-all ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
                      location.pathname === '/transformer-data' 
                        ? 'bg-[#0052cc]/10 text-[#0052cc] dark:bg-[#4c9aff]/10 dark:text-[#4c9aff]' 
                        : 'text-[#5e6c84] dark:text-[#94a3b8] hover:bg-[#f4f5f7] dark:hover:bg-white/5 hover:text-[#172b4d] dark:hover:text-white'
                    }`}
                  >
                    <Settings size={20} className="shrink-0" />
                    {!isSidebarCollapsed && <span className="truncate">Transformer Data</span>}
                  </Link>
                  <Link 
                    to="/performance-report"
                    title={isSidebarCollapsed ? "Performance Report" : undefined}
                    className={`flex items-center py-3 rounded-xl font-medium transition-all ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
                      location.pathname === '/performance-report' 
                        ? 'bg-[#0052cc]/10 text-[#0052cc] dark:bg-[#4c9aff]/10 dark:text-[#4c9aff]' 
                        : 'text-[#5e6c84] dark:text-[#94a3b8] hover:bg-[#f4f5f7] dark:hover:bg-white/5 hover:text-[#172b4d] dark:hover:text-white'
                    }`}
                  >
                    <ClipboardList size={20} className="shrink-0" />
                    {!isSidebarCollapsed && <span className="truncate">Performance Report</span>}
                  </Link>
                  {role === 'superuser' && (
                    <Link 
                      to="/manage-users"
                      title={isSidebarCollapsed ? "Manage Users" : undefined}
                      className={`flex items-center py-3 rounded-xl font-medium transition-all ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
                        location.pathname === '/manage-users' 
                          ? 'bg-[#0052cc]/10 text-[#0052cc] dark:bg-[#4c9aff]/10 dark:text-[#4c9aff]' 
                          : 'text-[#5e6c84] dark:text-[#94a3b8] hover:bg-[#f4f5f7] dark:hover:bg-white/5 hover:text-[#172b4d] dark:hover:text-white'
                      }`}
                    >
                      <Users size={20} className="shrink-0" />
                      {!isSidebarCollapsed && <span className="truncate">Manage Users</span>}
                    </Link>
                  )}
                </>
              )}
            </nav>
            
            <div className="p-4 border-t border-[#dfe1e6] dark:border-white/10 shrink-0 flex justify-center">
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2 rounded-xl bg-[#f4f5f7] dark:bg-white/5 text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white hover:bg-[#ebecf0] dark:hover:bg-white/10 transition-all flex items-center justify-center w-full"
                title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              </button>
            </div>
          </aside>
        )}

        <div className="flex-1 overflow-y-auto flex flex-col relative pb-16 md:pb-0">
          <main className="flex-1 flex flex-col p-4 md:p-8">
            <Outlet />
          </main>
    
          <footer className="py-4 md:py-6 px-4 md:px-8 flex flex-col sm:flex-row justify-between items-center text-[#5e6c84] dark:text-[#94a3b8] text-xs sm:text-sm shrink-0 mt-auto gap-2 sm:gap-0 text-center sm:text-left">
            <p>&copy; {new Date().getFullYear()} PT. Bambang Djaja. All rights reserved.</p>
            <p>Transformer Monitoring Unit V1.0</p>
          </footer>
        </div>
      </div>

      {isTransformerDashboard && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#151521] border-t border-[#dfe1e6] dark:border-white/10 flex items-center justify-around z-40 pb-safe">
          <Link 
            to="/dashboard"
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              location.pathname === '/dashboard' 
                ? 'text-[#0052cc] dark:text-[#4c9aff]' 
                : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="text-[10px] font-medium">Electrical</span>
          </Link>
          <Link 
            to="/transformer-data"
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              location.pathname === '/transformer-data' 
                ? 'text-[#0052cc] dark:text-[#4c9aff]' 
                : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white'
            }`}
          >
            <Settings size={20} />
            <span className="text-[10px] font-medium">Data</span>
          </Link>
          <Link 
            to="/temperature"
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              location.pathname === '/temperature' 
                ? 'text-[#0052cc] dark:text-[#4c9aff]' 
                : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white'
            }`}
          >
            <TrendingUp size={20} />
            <span className="text-[10px] font-medium">Physical</span>
          </Link>
          <Link 
            to="/performance-report"
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              location.pathname === '/performance-report' 
                ? 'text-[#0052cc] dark:text-[#4c9aff]' 
                : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white'
            }`}
          >
            <ClipboardList size={20} />
            <span className="text-[10px] font-medium">Report</span>
          </Link>
          {role === 'superuser' && (
            <Link 
              to="/manage-users"
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                location.pathname === '/manage-users' 
                  ? 'text-indigo-700 dark:text-indigo-400' 
                  : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white'
              }`}
            >
              <Users size={20} />
              <span className="text-[10px] font-medium">Users</span>
            </Link>
          )}
        </nav>
      )}

      {isAdminDashboard && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#151521] border-t border-[#dfe1e6] dark:border-white/10 flex items-center justify-around z-40 pb-safe">
          <Link 
            to="/provisioning"
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              location.pathname === '/provisioning' 
                ? 'text-indigo-700 dark:text-indigo-400' 
                : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white'
            }`}
          >
            <Key size={20} />
            <span className="text-[10px] font-medium">Provisioning</span>
          </Link>
          <Link 
            to="/users"
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              location.pathname === '/users' 
                ? 'text-[#0052cc] dark:text-[#4c9aff]' 
                : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white'
            }`}
          >
            <Users size={20} />
            <span className="text-[10px] font-medium">Users</span>
          </Link>
          <Link 
            to="/manage-transformers"
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              location.pathname === '/manage-transformers' 
                ? 'text-[#0052cc] dark:text-[#4c9aff]' 
                : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white'
            }`}
          >
            <Activity size={20} />
            <span className="text-[10px] font-medium">Trafo</span>
          </Link>
        </nav>
      )}
    </div>
  );
};

export default MainLayout;
