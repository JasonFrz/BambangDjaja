import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';
import { User, Lock, ArrowRight, ShieldCheck, Eye, EyeOff, Activity } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState(localStorage.getItem('savedUsername') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('savedUsername'));
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { apiUrl } = useApi();
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        if (data.token) sessionStorage.setItem('token', data.token);
        
        if (rememberMe) {
          localStorage.setItem('savedUsername', username);
        } else {
          localStorage.removeItem('savedUsername');
        }
        
        sessionStorage.setItem('username', data.username);
        sessionStorage.setItem('role', data.role);
        sessionStorage.setItem('phone', data.phone || '');
        sessionStorage.setItem('company_name', data.company_name || '');
        
        if (data.role === 'admin') {
          sessionStorage.setItem('admin', 'true');
          window.location.href = '/admin';
        } else {
          window.location.href = '/';
        }
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Cannot connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#050B14] relative overflow-hidden font-sans">
      
      {/* Background Image with Gradient Fade */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'url(/background.png)',
          backgroundPosition: 'left bottom',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,1) 30%, rgba(0,0,0,0.3) 100%)',
          maskImage: 'linear-gradient(to right, rgba(0,0,0,1) 30%, rgba(0,0,0,0.3) 100%)'
        }}
      />

      <div className="w-full max-w-[1200px] mx-auto flex flex-col lg:flex-row items-center lg:items-center justify-between gap-8 md:gap-12 p-6 lg:p-12 relative z-10">

        {/* Mobile/Tablet Branding (Hidden on Desktop) */}
        <div className="flex flex-col items-center justify-center lg:hidden w-full mb-4 md:mb-8 animate-slide-up-fade">
          <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
            <img 
              src="/logo-bnd.png" 
              alt="B&D Logo" 
              className="h-14 md:h-16 w-auto object-contain drop-shadow-[0_0_15px_rgba(0,163,255,0.4)]"
            />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-none font-sans text-white text-center">
              PT. Bambang Djaja
            </h1>
          </div>
        </div>

        {/* Left Section (Desktop Only) */}
        <div className="hidden lg:flex flex-col flex-1 text-white/90 w-full animate-slide-up-fade lg:pr-10">
          <div className="flex items-center gap-4 mb-16 lg:mb-24">
            <img 
              src="/logo-bnd.png" 
              alt="B&D Logo" 
              className="h-16 w-auto object-contain drop-shadow-[0_0_15px_rgba(0,163,255,0.4)]"
            />
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight leading-none font-sans text-white">
              PT. Bambang Djaja
            </h1>
          </div>
          
          <h2 
            className="text-5xl lg:text-[4rem] font-bold leading-[1.1] mb-8 text-[#e2e8f0]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Transformer <br /> <span className="text-[#94a3b8]">Monitoring Unit</span>
          </h2>
          
          <div className="w-12 h-1 bg-[#0052cc] mb-8" />

          <p className="text-[#8e9bb0] text-lg lg:text-xl max-w-lg leading-relaxed mb-12 font-sans">
            Monitor, analyze, and visualize transformer data in real time — with the flexibility to focus on the metrics that matter to you.
          </p>

          <div className="flex items-center gap-3 text-sm font-medium text-emerald-400 bg-transparent px-4 py-2.5 rounded-full border border-emerald-500/30 w-fit backdrop-blur-md">
            <ShieldCheck size={18} />
            Secure Monitoring Environment
          </div>
        </div>

        {/* Right Section: Login Card */}
        <div className="w-full max-w-[460px] animate-slide-up-fade relative mx-auto lg:mx-0" style={{ animationDelay: '200ms' }}>
          
          {/* Ambient Glow behind the card */}
          <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[#0052cc]/15 blur-[80px] rounded-full pointer-events-none -z-10" />

          <div className="bg-transparent md:bg-[#0b101e]/80 md:backdrop-blur-2xl p-0 md:p-8 lg:p-10 rounded-none md:rounded-[24px] border-none md:border-solid md:border-white/5 md:shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden z-10 w-full">
            

            <div className="mb-8">
              <p className="text-[#00a3ff] text-xs font-bold tracking-widest uppercase mb-3 font-sans">
                TMU Portal
              </p>
              <h3 className="text-3xl font-semibold text-white mb-2 font-sans tracking-tight">Welcome Back</h3>
              <p className="text-[#8e9bb0] text-sm font-sans">Enter your credentials to access the monitoring system.</p>
              
              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="flex flex-col gap-6">

              {/* Username */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#8e9bb0] uppercase tracking-wider">
                  Username or Email
                </label>
                <div className={`relative flex items-center bg-[#13192b] rounded-xl border transition-all duration-300 ${isFocused === 'username' ? 'border-[#0052cc]' : 'border-white/5 hover:border-white/10'}`}>
                  <div className="pl-4 text-[#5e6c84]">
                    <User size={18} strokeWidth={2} />
                  </div>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setIsFocused('username')}
                    onBlur={() => setIsFocused(null)}
                    className="w-full bg-transparent border-none py-3.5 px-3 text-white text-[15px] outline-none placeholder:text-[#475569] font-sans"
                    placeholder="test"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#8e9bb0] uppercase tracking-wider">
                  Password
                </label>
                <div className={`relative flex items-center bg-[#13192b] rounded-xl border transition-all duration-300 ${isFocused === 'password' ? 'border-[#0052cc]' : 'border-white/5 hover:border-white/10'}`}>
                  <div className="pl-4 text-[#5e6c84]">
                    <Lock size={18} strokeWidth={2} />
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setIsFocused('password')}
                    onBlur={() => setIsFocused(null)}
                    className="w-full bg-transparent border-none py-3.5 px-3 text-white text-[15px] outline-none placeholder:text-[#475569] tracking-widest font-sans"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="pr-4 text-[#5e6c84] hover:text-white transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center mt-1">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center w-5 h-5 rounded border border-white/10 bg-[#13192b] group-hover:border-[#0052cc] transition-colors">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer absolute opacity-0 w-full h-full cursor-pointer"
                    />
                    <svg className="w-3.5 h-3.5 text-transparent peer-checked:text-[#00a3ff] transition-colors pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-[15px] text-[#8e9bb0] group-hover:text-white transition-colors select-none font-sans">
                    Remember me
                  </span>
                </label>
              </div>

              {/* Submit */}
              <button 
                type="submit" 
                className="mt-4 flex items-center justify-center gap-3 w-full py-3.5 rounded-xl bg-[#0052cc] hover:bg-[#0065ff] active:bg-[#0047b3] transition-colors duration-200"
              >
                <span className="text-white font-medium text-[15px] flex items-center gap-2 font-sans">
                  {isLoading ? 'Signing In...' : 'Sign In to Dashboard'}
                  {!isLoading && <ArrowRight size={18} />}
                </span>
              </button>
            </form>

            {/* System Status Footer */}
            <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-between">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                  <span className="text-emerald-500 text-[11px] font-bold tracking-widest uppercase font-mono">
                    System Operational
                  </span>
                </div>
                <span className="text-[#64748b] text-[13px] font-sans">
                  All monitoring services are running normally.
                </span>
              </div>
              <Activity className="text-emerald-500/50" size={28} strokeWidth={1.5} />
            </div>

          </div>
        </div>

      </div>
      
      {/* Copyright Footer */}
      <div className="absolute bottom-6 left-0 w-full text-center lg:text-left lg:left-12 z-10">
        <p className="text-[#8e9bb0] text-xs font-sans">
          &copy; {new Date().getFullYear()} PT. Bambang Djaja. All rights reserved.
        </p>
      </div>

    </div>
  );
};

export default Login;
