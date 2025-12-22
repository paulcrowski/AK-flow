/**
 * VitalsPanel - Biometric gauges and heart visualization
 * 
 * Extracted from NeuroMonitor.tsx for modularity.
 * 
 * @module components/neuro/VitalsPanel
 */

import React from 'react';
import { Activity, Zap, ShieldAlert, Moon } from 'lucide-react';
import type { LimbicState, SomaState, NeurotransmitterState } from '../../types';

interface VitalsPanelProps {
  limbicState: LimbicState;
  somaState: SomaState;
  neuroState?: NeurotransmitterState;
}

export const CircularGauge = ({ 
  value, 
  color, 
  label, 
  icon: Icon 
}: { 
  value: number; 
  color: string; 
  label: string; 
  icon: any;
}) => {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value * circumference);
  
  return (
    <div className="flex flex-col items-center justify-center relative group">
      <div className="relative w-12 h-12 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="24" cy="24" r={radius} stroke="#1e293b" strokeWidth="4" fill="transparent" />
          <circle
            cx="24" cy="24" r={radius}
            stroke={color}
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-200">
          {Math.round(value * 100)}%
        </div>
      </div>
      <span className="text-[9px] uppercase tracking-wider text-gray-500 mt-1 flex items-center gap-1">
        <Icon size={8} /> {label}
      </span>
    </div>
  );
};

export const CyberHeart = ({ bpm, intensity }: { bpm: number; intensity: number }) => {
  const duration = 60 / bpm;
  const color = intensity < 0.3 ? '#38bdf8' : intensity < 0.7 ? '#eab308' : '#ef4444';
  
  return (
    <div className="relative flex items-center justify-center w-32 h-32 group cursor-help">
      <div className="absolute inset-0 border-2 border-dashed border-gray-700 rounded-full opacity-30 animate-[spin_10s_linear_infinite]" />
      <svg 
        viewBox="0 0 24 24" 
        className="w-14 h-14 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-colors duration-500" 
        style={{ fill: color, animation: `pulseHeart ${duration}s ease-in-out infinite` }}
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
      <div className="absolute -bottom-2 text-[11px] font-mono font-bold text-gray-400 bg-gray-950 px-3 py-1 rounded-full border border-gray-800 shadow-xl">
        {Math.round(bpm)} BPM
      </div>
      <style>{`@keyframes pulseHeart { 0% { transform: scale(1); opacity: 0.8; } 15% { transform: scale(1.35); opacity: 1; } 100% { transform: scale(1); opacity: 0.8; } }`}</style>
    </div>
  );
};

export const VitalsPanel: React.FC<VitalsPanelProps> = (props) => {
  const { limbicState, somaState } = props;
  return (
    <>
      <div className="grid grid-cols-5 gap-4 mb-4 items-center">
        <CircularGauge value={limbicState.fear} color="#ef4444" label="FEAR" icon={ShieldAlert} />
        <CircularGauge value={limbicState.curiosity} color="#38bdf8" label="CURIOSITY" icon={Activity} />
        <div className="flex justify-center">
          <CyberHeart bpm={60 + (limbicState.fear * 80) + (somaState?.cognitiveLoad || 0 * 0.5)} intensity={limbicState.fear} />
        </div>
        <CircularGauge value={somaState.energy / 100} color="#f97316" label="ENERGY" icon={Zap} />
        <CircularGauge value={limbicState.satisfaction} color="#22c55e" label="SATISFACTION" icon={Activity} />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {somaState.isSleeping && <Moon size={12} className="text-purple-400 animate-pulse" />}
          <div className="flex justify-between items-end mb-0.5 w-full">
            <span className="text-[9px] text-gray-500 uppercase tracking-wider">ENERGY</span>
            <span className="text-[10px] font-bold text-orange-400">{somaState.energy.toFixed(0)}%</span>
          </div>
        </div>
        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-500" style={{ width: `${somaState.energy}%` }} />
        </div>
        <div className="w-full">
          <div className="flex justify-between items-end mb-0.5">
            <span className="text-[9px] text-gray-500 uppercase tracking-wider">COG LOAD</span>
            <span className="text-[10px] font-bold text-cyan-400">{(somaState?.cognitiveLoad || 0).toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-500" style={{ width: `${somaState?.cognitiveLoad || 0}%` }} />
          </div>
        </div>
        <div className="w-full">
          <div className="flex justify-between items-end mb-0.5">
            <span className="text-[9px] text-gray-500 uppercase tracking-wider">SATISFACTION</span>
            <span className="text-[10px] font-bold text-green-400">{(limbicState.satisfaction * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-500" style={{ width: `${limbicState.satisfaction * 100}%` }} />
          </div>
        </div>
      </div>
    </>
  );
};

export default VitalsPanel;
