import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, ArrowRightLeft, Sparkles } from 'lucide-react';

const FailureReport = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-xl mx-auto animate-[fadeIn_0.4s_ease-out]">
      <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10 mb-5">
        <AlertTriangle size={32} />
      </div>

      <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-3 py-1 rounded-full mb-3">
        Under Development
      </span>

      <h1 className="text-2xl sm:text-3xl font-black text-[#172b4d] dark:text-white font-heading tracking-tight mb-2">
        Failure Report
      </h1>

      <p className="text-sm text-[#5e6c84] dark:text-[#94a3b8] mb-6">
        Modul Failure Report sedang dipersiapkan untuk analisa trip dan alarm failure history transformator. Saat ini Anda dapat melihat Instantaneous Report atau Performance Report.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => navigate('/instantaneous-report')}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold rounded-xl text-sm shadow-md transition-all"
        >
          Buka Instantaneous Report
        </button>
        <button
          onClick={() => navigate('/performance-report')}
          className="px-5 py-2.5 bg-white dark:bg-[#1e1e2d] border border-[#dfe1e6] dark:border-white/10 text-[#172b4d] dark:text-white font-semibold rounded-xl text-sm shadow-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
        >
          Buka Performance Report
        </button>
      </div>
    </div>
  );
};

export default FailureReport;
