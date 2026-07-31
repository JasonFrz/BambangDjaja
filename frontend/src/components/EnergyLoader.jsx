import React from 'react';
import { Zap } from 'lucide-react';

const EnergyLoader = ({ text = "Loading data...", fullScreen = false, size = "default" }) => {
  const content = (
    <div className={`flex flex-col items-center justify-center p-8 ${size === 'small' ? 'scale-50' : 'scale-100'}`}>
      <div className="relative w-24 h-24 mb-6">
        {/* Outer rotating ring */}
        <div className="absolute inset-0 border-4 border-t-[#0052cc] border-r-transparent border-b-[#00a3ff] border-l-transparent rounded-full animate-[spin_2s_linear_infinite]"></div>
        
        {/* Inner rotating ring (reverse) */}
        <div className="absolute inset-2 border-4 border-t-[#00a3ff] border-r-transparent border-b-[#0052cc] border-l-transparent rounded-full animate-[spin_1.5s_linear_infinite_reverse]"></div>
        
        {/* Inner inner ring */}
        <div className="absolute inset-4 border-2 border-dashed border-[#4c9aff] rounded-full animate-[spin_3s_linear_infinite]"></div>
        
        {/* Glowing orb in the center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 bg-gradient-to-br from-[#0052cc]/40 to-[#00a3ff]/40 dark:from-[#0052cc]/60 dark:to-[#00a3ff]/60 rounded-full flex items-center justify-center animate-pulse blur-[4px]"></div>
        </div>
        
        {/* Zap Icon */}
        <div className="absolute inset-0 flex items-center justify-center text-[#0052cc] dark:text-[#00a3ff] drop-shadow-[0_0_8px_rgba(0,163,255,0.8)] z-10">
          <Zap size={28} className="fill-current animate-pulse" />
        </div>
      </div>
      
      {/* Loading Text */}
      <h3 className="text-[#172b4d] dark:text-white font-bold tracking-widest uppercase text-sm animate-pulse flex items-center gap-2">
        {text}
      </h3>
      <div className="flex gap-1.5 mt-3">
        <span className="w-2 h-2 bg-[#0052cc] dark:bg-[#00a3ff] rounded-full animate-[bounce_1s_infinite_0ms] shadow-[0_0_5px_#00a3ff]"></span>
        <span className="w-2 h-2 bg-[#0052cc] dark:bg-[#00a3ff] rounded-full animate-[bounce_1s_infinite_200ms] shadow-[0_0_5px_#00a3ff]"></span>
        <span className="w-2 h-2 bg-[#0052cc] dark:bg-[#00a3ff] rounded-full animate-[bounce_1s_infinite_400ms] shadow-[0_0_5px_#00a3ff]"></span>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-[#0b1120]/80 backdrop-blur-sm transition-all duration-300">
        {content}
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex items-center justify-center animate-[fadeIn_0.3s_ease-out] ${size === 'small' ? 'min-h-[100px]' : 'min-h-[300px]'}`}>
      {content}
    </div>
  );
};

export default EnergyLoader;
