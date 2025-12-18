/**
 * VitalsPanel - Biometric gauges and heart visualization
 * 
 * Extracted from NeuroMonitor.tsx for modularity.
 * 
 * @module components/neuro/VitalsPanel
 */

import React from 'react';
import { Activity, Zap, Scale, Waves } from 'lucide-react';
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

export const VitalsPanel: React.FC<VitalsPanelProps> = ({
  limbicState,
  somaState,
  neuroState
}) => {
  const computedBpm = 60 + (limbicState.fear * 60) + (somaState.energy * 20);
  const emotionalIntensity = (limbicState.fear + limbicState.curiosity + limbicState.frustration) / 3;

  return (
    <div className="p-4 space-y-4">
      {/* Heart */}
      <div className="flex justify-center">
        <CyberHeart bpm={computedBpm} intensity={emotionalIntensity} />
      </div>

      {/* Limbic Gauges */}
      <div className="grid grid-cols-4 gap-2">
        <CircularGauge value={limbicState.fear} color="#ef4444" label="Fear" icon={Activity} />
        <CircularGauge value={limbicState.curiosity} color="#38bdf8" label="Curious" icon={Zap} />
        <CircularGauge value={limbicState.satisfaction} color="#22c55e" label="Satisfy" icon={Scale} />
        <CircularGauge value={limbicState.frustration} color="#f97316" label="Frust" icon={Waves} />
      </div>

      {/* Energy/Load/Satisfaction Bars */}
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>ENERGY</span>
            <span>{Math.round(somaState.energy)}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${somaState.energy}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>COGNITIVE LOAD</span>
            <span>{Math.round(somaState.cognitiveLoad * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-500"
              style={{ width: `${somaState.cognitiveLoad * 100}%` }}
            />
          </div>
        </div>

        {neuroState && (
          <div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>DOPAMINE</span>
              <span>{Math.round(neuroState.dopamine)}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${neuroState.dopamine}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VitalsPanel;
