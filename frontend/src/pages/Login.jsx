import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';
import { Cpu, User, Lock, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState(localStorage.getItem('savedUsername') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('savedUsername'));
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { apiUrl } = useApi();
  
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  
  const navigate = useNavigate();

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

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
        if (rememberMe) {
          localStorage.setItem('savedUsername', username);
        } else {
          localStorage.removeItem('savedUsername');
        }
        if (data.role === 'admin') {
          sessionStorage.setItem('admin', 'true');
          window.location.href = '/admin';
        } else {
          sessionStorage.setItem('username', data.username);
          sessionStorage.setItem('role', data.role);
          sessionStorage.setItem('phone', data.phone || '');
          sessionStorage.setItem('company_name', data.company_name || '');
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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#070a13] relative overflow-hidden font-sans">

      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#0052cc]/10 blur-[120px] animate-float-soft"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#6554c0]/10 blur-[150px] animate-float-soft" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-[#4c9aff]/20 to-transparent -rotate-45 blur-sm"></div>

      <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-12 p-6 relative z-10">

        <div className="hidden lg:flex flex-col flex-1 text-white/90 animate-slide-up-fade">
          <div className="flex items-center gap-4 mb-10">
            <img 
              src="/logo-bnd.png" 
              alt="B&D Logo" 
              className="h-20 w-auto object-contain rounded-xl shadow-[0_0_30px_rgba(0,163,255,0.6)] bg-white/5 backdrop-blur-sm p-1"
            />
            <h1 className="text-3xl font-bold tracking-tight font-heading">
              PT. Bambang Djaja
            </h1>
          </div>
          
          <h2 className="text-5xl lg:text-6xl font-black font-heading leading-tight mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-[#8e9bb0]">
            Transformer <br /> Monitoring Unit
          </h2>
          
          <p className="text-[#8e9bb0] text-lg max-w-md leading-relaxed mb-8">
            Access real-time power analytics, monitor phase voltages, and ensure optimal energy distribution with our advanced AI-driven infrastructure.
          </p>

          <div className="flex items-center gap-4 text-sm font-medium text-emerald-400 bg-emerald-900/20 px-4 py-2.5 rounded-full border border-emerald-500/20 w-fit backdrop-blur-md">
            <ShieldCheck size={18} />
            Secure Enterprise Connection
          </div>
        </div>

        <div className="w-full max-w-[420px] animate-slide-up-fade" style={{ animationDelay: '200ms' }}>
          <div 
            className="bg-[#151521]/80 backdrop-blur-2xl p-10 rounded-3xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] relative overflow-hidden group"
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >

            <div 
              className="absolute pointer-events-none transition-opacity duration-300 ease-in-out"
              style={{
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: isHovering ? 1 : 0,
                background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(0, 163, 255, 0.15), transparent 40%)`,
                zIndex: 0
              }}
            ></div>

            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#0052cc]/20 rounded-full blur-[50px] transition-all duration-700 group-hover:bg-[#4c9aff]/30"></div>

            <div className="relative z-10">
              <div className="mb-10">
                
                <div className="flex lg:hidden items-center gap-3 mb-6">
                  <img 
                    src="/logo-bnd.png" 
                    alt="B&D Logo" 
                    className="h-10 w-auto object-contain rounded-lg shadow-[0_0_15px_rgba(0,163,255,0.4)] bg-white/5 backdrop-blur-sm p-0.5"
                  />
                  <h1 className="text-xl font-bold tracking-tight font-heading text-white">
                    PT. Bambang Djaja
                  </h1>
                </div>

                <h3 className="text-2xl font-bold text-white font-heading mb-2">Welcome Back</h3>
                <p className="text-[#8e9bb0] text-sm">Enter your credentials to access the portal.</p>
                {error && (
                  <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-5">

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#8e9bb0] uppercase tracking-wider pl-1">
                    Username or Email
                  </label>
                  <div className={`relative flex items-center bg-[#070a13] rounded-xl border transition-all duration-300 ${isFocused === 'username' ? 'border-[#4c9aff] shadow-[0_0_15px_rgba(76,154,255,0.2)]' : 'border-white/10 hover:border-white/20'}`}>
                    <div className={`pl-4 transition-colors duration-300 ${isFocused === 'username' ? 'text-[#4c9aff]' : 'text-[#5e6c84]'}`}>
                      <User size={18} />
                    </div>
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onFocus={() => setIsFocused('username')}
                      onBlur={() => setIsFocused(null)}
                      className="w-full bg-transparent border-none py-3.5 px-3 text-white text-sm outline-none placeholder:text-[#5e6c84]"
                      placeholder="admin / admin@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center pl-1">
                    <label className="text-xs font-semibold text-[#8e9bb0] uppercase tracking-wider">
                      Password
                    </label>
                  </div>
                  <div className={`relative flex items-center bg-[#070a13] rounded-xl border transition-all duration-300 ${isFocused === 'password' ? 'border-[#4c9aff] shadow-[0_0_15px_rgba(76,154,255,0.2)]' : 'border-white/10 hover:border-white/20'}`}>
                    <div className={`pl-4 transition-colors duration-300 ${isFocused === 'password' ? 'text-[#4c9aff]' : 'text-[#5e6c84]'}`}>
                      <Lock size={18} />
                    </div>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setIsFocused('password')}
                      onBlur={() => setIsFocused(null)}
                      className="w-full bg-transparent border-none py-3.5 px-3 text-white text-sm outline-none placeholder:text-[#5e6c84]"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="pr-4 text-[#5e6c84] hover:text-[#4c9aff] transition-colors focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center pl-1 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative flex items-center justify-center w-4 h-4 rounded border border-white/20 bg-[#070a13] group-hover:border-[#4c9aff] transition-colors">
                      <input 
                        type="checkbox" 
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="peer absolute opacity-0 w-full h-full cursor-pointer"
                      />
                      <svg className="w-3 h-3 text-transparent peer-checked:text-[#4c9aff] transition-colors pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-[#8e9bb0] group-hover:text-white transition-colors select-none">
                      Remember me
                    </span>
                  </label>
                </div>

                <button 
                  type="submit" 
                  className="relative group mt-6 flex items-center justify-center gap-3 w-full py-4 rounded-xl overflow-hidden bg-[#070a13] border border-[#0052cc]/50 hover:border-[#00a3ff] hover:shadow-[0_0_30px_rgba(0,163,255,0.4)] active:scale-[0.98] transition-all duration-500"
                >
                  
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0052cc] via-[#00a3ff] to-[#4c9aff] opacity-70 group-hover:opacity-100 transition-opacity duration-500 z-0"></div>

                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent z-10"></div>

                  <div className="absolute inset-0 -translate-x-[150%] skew-x-[45deg] bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer z-10"></div>

                  <span className="relative z-20 text-white font-bold text-[15px] tracking-wide flex items-center gap-2">
                    {isLoading ? 'Signing In...' : 'Sign In to Dashboard'}
                    
                    {!isLoading && <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform duration-300" />}
                  </span>
                </button>
              </form>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
