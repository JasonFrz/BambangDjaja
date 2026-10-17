import React, { useEffect, useState, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Moon, Sun, LogOut, LayoutDashboard, TrendingUp, Users, ChevronLeft, ChevronRight, 
  Settings, Key, ShieldCheck, Activity, ClipboardList, User, Server, Database,
  ChevronDown, ChevronUp, BarChart2, AlertTriangle, LineChart, Zap, X, Sparkles, Bot
} from 'lucide-react';
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isReportMenuOpen, setIsReportMenuOpen] = useState(true);
  const [isMobileReportDrawerOpen, setIsMobileReportDrawerOpen] = useState(false);
  const dropdownRef = useRef(null);

  const reportPaths = ['/transformer-data', '/status-report', '/analysis', '/performance-report', '/failure-report', '/instantaneous-report'];
  const isReportActive = reportPaths.includes(location.pathname);
  const isTransformerDashboard = ['/dashboard', '/ai-assistant', '/manage-users', '/settings', ...reportPaths].includes(location.pathname);
  const isAdminDashboard = role === 'admin' && (location.pathname === '/users' || location.pathname === '/provisioning' || location.pathname === '/manage-transformers');
  const isSuperuserDashboard = role === 'superuser' && (location.pathname === '/manage-users');
  const showSidebar = isTransformerDashboard || isAdminDashboard || isSuperuserDashboard;

  const reportMenuItems = [
    {
      name: 'Transformer Data',
      path: '/transformer-data',
      desc: 'Nameplate specifications, ratings & oil capacity',
      icon: Database,
    },
    {
      name: 'Instantaneous',
      path: '/instantaneous-report',
      desc: 'Real-time telemetry snapshots (PQ, Electrical, Physical)',
      icon: Zap,
    },
    {
      name: 'Analysis',
      path: '/status-report',
      desc: 'Transformer Health Index (THI) & parameter diagnostic matrix',
      icon: Activity,
    },
    {
      name: 'Failure',
      path: '/failure-report',
      desc: 'Fault anomalies, trip events & diagnostic records',
      icon: AlertTriangle,
    },
    {
      name: 'Performance',
      path: '/performance-report',
      desc: 'Transformer performance & loading health summary',
      icon: TrendingUp,
    },
  ];

  // Auto-buka accordion report jika pengguna mengakses salah satu halaman report
  useEffect(() => {
    if (isReportActive) {
      setIsReportMenuOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('company_name');
    sessionStorage.removeItem('selectedTrafoId');
    window.location.href = '/login';
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#f4f7fe] dark:bg-[#111217] transition-colors duration-300 overflow-hidden relative">
      
      {location.pathname === '/home' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/3 w-[120%] h-[60%] bg-[#00a3ff]/15 dark:bg-[#00a3ff]/20 blur-[120px] rounded-[100%]" />
        </div>
      )}

      {!isFullscreen && (
      <header className={`h-[70px] px-6 md:px-8 flex justify-between items-center bg-white/80 dark:bg-[#111217]/80 backdrop-blur-md z-30 shrink-0 relative ${location.pathname === '/home' ? '' : 'border-b border-gray-200 dark:border-[#22252b]'}`}>
        <Link to="/" className="flex items-center gap-3 group relative z-10">
          <img src="/tmu-logo.png" alt="Logo" className="w-auto h-7 md:h-8 group-hover:opacity-80 transition-opacity" />
          <div className="flex flex-col justify-center">
            <h1 className="text-xl md:text-2xl font-black tracking-tight font-heading text-[#172b4d] dark:text-white leading-none">
              TMU
            </h1>
            <span className="hidden sm:block text-[9px] md:text-[11px] font-bold tracking-[0.15em] text-[#5e6c84] dark:text-[#94a3b8] uppercase mt-1 leading-none">
              Transformer Monitoring Unit
            </span>
          </div>
        </Link>

        {(isTransformerDashboard || location.pathname === '/home') && (
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
      )}

      <div className="flex flex-1 overflow-hidden">
        
        {showSidebar && !isFullscreen && (
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
                    title={isSidebarCollapsed ? "Dashboard" : undefined}
                    className={`flex items-center py-3 rounded-xl font-medium transition-all ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
                      location.pathname === '/dashboard' 
                        ? 'bg-[#0052cc]/10 text-[#0052cc] dark:bg-[#4c9aff]/10 dark:text-[#4c9aff]' 
                        : 'text-[#5e6c84] dark:text-[#94a3b8] hover:bg-[#f4f5f7] dark:hover:bg-white/5 hover:text-[#172b4d] dark:hover:text-white'
                    }`}
                  >
                    <LayoutDashboard size={20} className="shrink-0" />
                    {!isSidebarCollapsed && <span className="truncate">Dashboard</span>}
                  </Link>
                  {!isSidebarCollapsed ? (
                    <div className="flex flex-col">
                      <button 
                        type="button"
                        onClick={() => setIsReportMenuOpen(!isReportMenuOpen)}
                        className={`w-full flex items-center justify-between py-3 px-4 rounded-xl font-medium transition-all ${
                          isReportActive 
                            ? 'bg-[#0052cc]/10 text-[#0052cc] dark:bg-[#4c9aff]/10 dark:text-[#4c9aff]' 
                            : 'text-[#5e6c84] dark:text-[#94a3b8] hover:bg-[#f4f5f7] dark:hover:bg-white/5 hover:text-[#172b4d] dark:hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <BarChart2 size={20} className="shrink-0" />
                          <span className="truncate">Reports & Data</span>
                        </div>
                        {isReportMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      {isReportMenuOpen && (
                        <div className="mt-1.5 ml-2 mr-1 py-1 px-1 flex flex-col gap-1 rounded-2xl bg-[#f8fafd] dark:bg-white/[0.03] border border-[#e2e8f0]/80 dark:border-white/5 shadow-inner">
                          {reportMenuItems.map((item) => {
                            const isCurrent = location.pathname === item.path;
                            return (
                              <Link
                                key={item.path}
                                to={item.path}
                                className={`relative flex items-center justify-between py-2 px-3 rounded-xl text-sm transition-all ${
                                  isCurrent
                                    ? 'bg-[#0052cc]/10 dark:bg-[#4c9aff]/15 text-[#0052cc] dark:text-[#4c9aff] font-bold shadow-xs'
                                    : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 font-medium'
                                }`}
                              >
                                {isCurrent && (
                                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1.5 bg-[#0052cc] dark:bg-[#4c9aff] rounded-r-md" />
                                )}
                                <span className="truncate pl-1">{item.name}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSidebarCollapsed(false);
                        setIsReportMenuOpen(true);
                      }}
                      title="Reports & Data"
                      className={`flex items-center justify-center py-3 rounded-xl font-medium transition-all ${
                        isReportActive 
                          ? 'bg-[#0052cc]/10 text-[#0052cc] dark:bg-[#4c9aff]/10 dark:text-[#4c9aff]' 
                          : 'text-[#5e6c84] dark:text-[#94a3b8] hover:bg-[#f4f5f7] dark:hover:bg-white/5 hover:text-[#172b4d] dark:hover:text-white'
                      }`}
                    >
                      <BarChart2 size={20} className="shrink-0" />
                    </button>
                  )}
                  <Link 
                    to="/ai-assistant"
                    title={isSidebarCollapsed ? "AI Assistant" : undefined}
                    className={`flex items-center py-3 rounded-xl font-medium transition-all ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
                      location.pathname === '/ai-assistant' 
                        ? 'bg-[#0052cc]/10 text-[#0052cc] dark:bg-[#4c9aff]/10 dark:text-[#4c9aff]' 
                        : 'text-[#5e6c84] dark:text-[#94a3b8] hover:bg-[#f4f5f7] dark:hover:bg-white/5 hover:text-[#172b4d] dark:hover:text-white'
                    }`}
                  >
                    <Sparkles size={20} className="shrink-0 text-indigo-500" />
                    {!isSidebarCollapsed && (
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <span className="truncate">AI Assistant</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs">
                          AI
                        </span>
                      </div>
                    )}
                  </Link>
                  {role === 'superuser' && (
                    <>
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

                    </>
                  )}
                  <Link 
                    to="/settings"
                    title={isSidebarCollapsed ? "Settings" : undefined}
                    className={`flex items-center py-3 rounded-xl font-medium transition-all ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
                      location.pathname === '/settings' 
                        ? 'bg-[#0052cc]/10 text-[#0052cc] dark:bg-[#4c9aff]/10 dark:text-[#4c9aff]' 
                        : 'text-[#5e6c84] dark:text-[#94a3b8] hover:bg-[#f4f5f7] dark:hover:bg-white/5 hover:text-[#172b4d] dark:hover:text-white'
                    }`}
                  >
                    <Settings size={20} className="shrink-0" />
                    {!isSidebarCollapsed && <span className="truncate">Settings</span>}
                  </Link>
                </>
              )}
            </nav>
            
            <div className="p-3 border-t border-[#dfe1e6] dark:border-white/10 shrink-0 flex flex-col gap-2.5">
              {!isSidebarCollapsed && (
                <div className="text-[11px] text-[#5e6c84] dark:text-[#94a3b8] text-center leading-tight select-none px-1">
                  <p>&copy; {new Date().getFullYear()} PT. Bambang Djaja.</p>
                  <p className="text-[10px] opacity-75 mt-0.5">All rights reserved.</p>
                </div>
              )}
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
          <main className="flex-1 flex flex-col p-2">
            <Outlet />
          </main>
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
            <span className="text-[10px] font-medium">Dashboard</span>
          </Link>
          <Link 
            to="/ai-assistant"
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              location.pathname === '/ai-assistant' 
                ? 'text-[#0052cc] dark:text-[#4c9aff]' 
                : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white'
            }`}
          >
            <Sparkles size={20} className="text-indigo-500" />
            <span className="text-[10px] font-medium">AI</span>
          </Link>

          <button 
            type="button"
            onClick={() => setIsMobileReportDrawerOpen(true)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative ${
              isReportActive 
                ? 'text-[#0052cc] dark:text-[#4c9aff]' 
                : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white'
            }`}
          >
            <div className="relative">
              <BarChart2 size={20} />
              {isReportActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#0052cc] dark:bg-[#4c9aff] animate-pulse" />
              )}
            </div>
            <span className="text-[10px] font-medium">Report</span>
          </button>
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
          <Link 
            to="/settings"
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              location.pathname === '/settings' 
                ? 'text-[#0052cc] dark:text-[#4c9aff]' 
                : 'text-[#5e6c84] dark:text-[#94a3b8] hover:text-[#172b4d] dark:hover:text-white'
            }`}
          >
            <Settings size={20} />
            <span className="text-[10px] font-medium">Settings</span>
          </Link>
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

      {/* Mobile Report Drawer / Bottom Sheet */}
      {isMobileReportDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-[fadeIn_0.2s_ease-out]"
            onClick={() => setIsMobileReportDrawerOpen(false)}
          />

          {/* Drawer Container */}
          <div className="relative z-10 bg-white dark:bg-[#151521] border-t border-[#dfe1e6] dark:border-white/10 rounded-t-3xl p-5 shadow-2xl animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)] max-h-[85vh] overflow-y-auto pb-8">
            {/* Grab Handle */}
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#dfe1e6]/60 dark:border-white/10">
              <div>
                <h3 className="text-base font-bold text-[#172b4d] dark:text-white font-heading">
                  Transformer Reports
                </h3>
                <p className="text-xs text-[#5e6c84] dark:text-[#94a3b8]">
                  Select telemetry & transformer analysis report module
                </p>
              </div>
              <button 
                onClick={() => setIsMobileReportDrawerOpen(false)}
                className="p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {reportMenuItems.map((item) => {
                const Icon = item.icon;
                const isCurrent = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      setIsMobileReportDrawerOpen(false);
                      navigate(item.path);
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                      isCurrent
                        ? 'border-[#0052cc] bg-[#0052cc]/5 dark:bg-[#4c9aff]/10 dark:border-[#4c9aff]'
                        : 'border-[#dfe1e6]/80 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isCurrent
                          ? 'bg-[#0052cc] text-white shadow-md shadow-[#0052cc]/30'
                          : 'bg-white dark:bg-white/10 text-[#5e6c84] dark:text-[#94a3b8] shadow-xs'
                      }`}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${
                            isCurrent ? 'text-[#0052cc] dark:text-[#4c9aff]' : 'text-[#172b4d] dark:text-white'
                          }`}>
                            {item.name}
                          </span>
                          {item.badge && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-600 text-white">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#5e6c84] dark:text-[#94a3b8] line-clamp-1 mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0052cc] dark:bg-[#4c9aff] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
