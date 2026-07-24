import React from "react";
import { Thermometer, Settings, Zap, Wifi, WifiOff } from "lucide-react";
import { useTrendData } from "../contexts/TrendDataContext";
import TransformerMapCard from '../components/TransformerMapCard';

const SpecField = ({ label, value, unit }) => (
  <div className="flex flex-col gap-1.5 w-full">
    <label className="text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">{label}</label>
    <div className="flex rounded-lg overflow-hidden border border-[#dfe1e6] dark:border-white/10 shadow-sm transition-all focus-within:border-[#0052cc] focus-within:ring-1 focus-within:ring-[#0052cc]">
      <input 
        type="text" 
        value={value} 
        readOnly 
        className="flex-1 px-3 py-2 text-[#172b4d] dark:text-white bg-white dark:bg-[#151521] outline-none w-full"
      />
      <div className="px-3 py-2 bg-gray-50 dark:bg-white/5 text-[#5e6c84] dark:text-[#94a3b8] font-semibold border-l border-[#dfe1e6] dark:border-white/10 flex items-center justify-center min-w-[60px]">
        {unit}
      </div>
    </div>
  </div>
);

const TransformerData = () => {
  const { isLive } = useTrendData();

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.5s_ease-out] w-full max-w-7xl mx-auto pb-10">
      
      {/* Header Section */}
      <div className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#172b4d] dark:text-white font-heading mb-1 transition-colors flex items-center gap-4">
            Transformer Data
          </h2>
          <p className="text-[#5e6c84] dark:text-[#94a3b8] text-[0.95rem] transition-colors mt-1">
            Transformer Location & Specifications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${isLive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 animate-glow-pulse" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
            {isLive ? <Wifi size={16} /> : <WifiOff size={16} />}
            {isLive ? "Live" : "Offline"}
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="w-full">
        <TransformerMapCard />
      </div>

      {/* Specs Cards Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* General Specs */}
        <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 flex flex-col">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#dfe1e6] dark:border-white/10">
            <div className="text-teal-500">
              <Settings size={20} />
            </div>
            <h3 className="font-bold text-lg text-[#172b4d] dark:text-white">General Specifications</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <SpecField label="RATED POWER" value="100" unit="kVA" />
            <SpecField label="FREQUENCY" value="50" unit="Hz" />
            <SpecField label="IMPEDANCE" value="4" unit="%" />
          </div>
        </div>

        {/* Energy Loss & Temperature */}
        <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 flex flex-col">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#dfe1e6] dark:border-white/10">
            <div className="text-indigo-500">
              <Thermometer size={20} />
            </div>
            <h3 className="font-bold text-lg text-[#172b4d] dark:text-white">Energy Loss & Temperature</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <SpecField label="NO LOAD LOSS" value="150" unit="Watt" />
            <SpecField label="FULL LOAD LOSS" value="1200" unit="Watt" />
            <SpecField label="TOP OIL TEMP RISE LV" value="-" unit="°C" />
            <SpecField label="TOP OIL TEMP RISE HV" value="-" unit="°C" />
          </div>
        </div>

        {/* Voltage & Current */}
        <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 flex flex-col lg:col-span-2">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#dfe1e6] dark:border-white/10">
            <div className="text-amber-500">
              <Zap size={20} />
            </div>
            <h3 className="font-bold text-lg text-[#172b4d] dark:text-white">Voltage & Current</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <SpecField label="RATED VOLTAGE (LV)" value="400" unit="V" />
            <SpecField label="RATED VOLTAGE (HV)" value="20000" unit="V" />
            <SpecField label="RATED CURRENT (LV)" value="144" unit="A" />
            <SpecField label="RATED CURRENT (HV)" value="2.89" unit="A" />
          </div>
        </div>

      </div>
    </div>
  );
};

export default TransformerData;
