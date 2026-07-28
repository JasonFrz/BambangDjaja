import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

const LoadingScreen = ({ text = "INITIALIZING...", subtext = "" }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + (Math.random() * 8 + 2);
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070a13]/80 backdrop-blur-xl animate-[fadeIn_0.4s_ease-out] overflow-hidden">

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] animate-[pulse_4s_infinite]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-600/20 rounded-full blur-[80px] animate-[pulse_3s_infinite_0.5s]"></div>

      <div className="relative z-10 flex flex-col items-center justify-center">

        <div className="relative w-32 h-32 flex items-center justify-center mb-8">

          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#0052cc] via-[#6554c0] to-transparent p-[3px] animate-[spin_2s_linear_infinite]">
            <div className="w-full h-full bg-[#070a13] rounded-full"></div>
          </div>

          <div className="absolute inset-2 rounded-full border border-dashed border-white/30 animate-[spin_3s_linear_infinite_reverse]"></div>

          <div className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-br from-[#0052cc] to-[#4c9aff] rounded-full shadow-[0_0_30px_rgba(76,154,255,0.6)] animate-[pulse_1.5s_infinite]">
            <Zap size={28} className="text-white fill-white animate-[pulse_1s_infinite]" />
          </div>

          <div className="absolute top-0 right-4 w-2 h-2 bg-cyan-400 rounded-full blur-[1px] animate-[ping_2s_infinite]"></div>
          <div className="absolute bottom-2 left-2 w-1.5 h-1.5 bg-indigo-400 rounded-full blur-[1px] animate-[ping_2.5s_infinite_0.5s]"></div>
        </div>

        <h2 className="text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-white/70 font-black text-2xl tracking-[0.2em] mb-2 font-heading animate-[pulse_2s_infinite]">
          {text}
        </h2>
        
        {subtext && (
          <p className="text-[#8e9bb0] text-sm tracking-wider font-medium mb-10 max-w-[300px] text-center truncate">
            {subtext}
          </p>
        )}

        <div className="w-64 h-1.5 bg-[#1a2332] rounded-full overflow-hidden relative shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
          <div 
            className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-[#0052cc] via-[#4c9aff] to-[#00e676] shadow-[0_0_10px_rgba(76,154,255,0.8)] transition-all duration-150 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>

        <div className="mt-3 text-xs font-bold text-white/50 tracking-widest tabular-nums">
          {Math.floor(progress)}%
        </div>

      </div>
    </div>
  );
};

export default LoadingScreen;
