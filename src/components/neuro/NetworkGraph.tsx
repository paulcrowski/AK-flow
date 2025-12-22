import React from 'react';
import { AgentType, type ResonanceField } from '../../types';

const AGENT_LAYOUT: Record<string, { x: number; y: number; label: string; color: string }> = {
  [AgentType.CORTEX_FLOW]: { x: 50, y: 50, label: 'CORTEX', color: '#38bdf8' },
  [AgentType.CORTEX_CONFLICT]: { x: 75, y: 35, label: 'CONFLICT', color: '#fbbf24' },
  [AgentType.MEMORY_EPISODIC]: { x: 50, y: 15, label: 'EPISODIC', color: '#c084fc' },
  [AgentType.SENSORY_TEXT]: { x: 10, y: 40, label: 'TXT_IN', color: '#22c55e' },
  [AgentType.SENSORY_VISUAL]: { x: 10, y: 55, label: 'VIS_IN', color: '#10b981' },
  [AgentType.SENSORY_AUDIO]: { x: 10, y: 70, label: 'AUD_IN', color: '#34d399' },
  [AgentType.LIMBIC]: { x: 90, y: 50, label: 'EMOTION', color: '#ef4444' },
  [AgentType.SOMA]: { x: 90, y: 80, label: 'BIOMETRY', color: '#f97316' },
  [AgentType.MOTOR]: { x: 50, y: 90, label: 'MOTOR', color: '#94a3b8' },
  [AgentType.MORAL]: { x: 25, y: 25, label: 'MORAL', color: '#14b8a6' },
  [AgentType.VISUAL_CORTEX]: { x: 25, y: 75, label: 'VISION', color: '#f472b6' },
  [AgentType.NEUROCHEM]: { x: 75, y: 65, label: 'CHEMICAL', color: '#a855f7' },
  [AgentType.GLOBAL_FIELD]: { x: 50, y: 70, label: 'CEMI', color: '#22d3ee' }
};

export function NetworkGraph(props: {
  resonanceField?: ResonanceField;
  agentActivity: Record<string, number>;
}) {
  const { resonanceField, agentActivity } = props;

  return (
    <div className="h-full flex flex-col items-center justify-center relative bg-[#050608]">
      <div className="w-full h-full p-8 flex items-center justify-center">
        <svg viewBox="-5 -5 110 110" className="w-full h-full max-w-[500px] max-h-[500px]">
          <defs>
            <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {resonanceField && (
            <g>
              <circle
                cx="50"
                cy="50"
                r={40 + resonanceField.intensity * 15}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="0.5"
                opacity="0.3"
              >
                <animate
                  attributeName="r"
                  from={40}
                  to={55}
                  dur={`${4 * resonanceField.timeDilation}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.1;0.3;0.1"
                  dur={`${4 * resonanceField.timeDilation}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          )}

          {Object.entries(AGENT_LAYOUT).map(([key, pos]) => {
            if (key === AgentType.CORTEX_FLOW) return null;
            const center = AGENT_LAYOUT[AgentType.CORTEX_FLOW];
            const activityLevel = agentActivity[key] || 0;
            const isActive = activityLevel > 0.1;
            const strokeW = isActive ? 0.4 + activityLevel * 1.6 : 0.4;

            return (
              <line
                key={`conn-${key}`}
                x1={center.x}
                y1={center.y}
                x2={pos.x}
                y2={pos.y}
                stroke={isActive ? pos.color : '#334155'}
                strokeWidth={strokeW}
                strokeDasharray={isActive ? 'none' : '3 3'}
                opacity={isActive ? Math.max(0.4, activityLevel) : 0.25}
                className="transition-all duration-700"
              />
            );
          })}

          {Object.entries(AGENT_LAYOUT).map(([key, pos]) => {
            const rawActivity = agentActivity[key] || 0;
            const activityLevel = Math.min(1, rawActivity);
            const intensity = Math.min(2, rawActivity);
            const isActive = rawActivity > 0.1;

            return (
              <g key={key} className="transition-all duration-500">
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={key === AgentType.CORTEX_FLOW ? 10 : 6}
                  fill="#050608"
                  stroke={isActive ? pos.color : '#475569'}
                  strokeWidth={isActive ? 1.2 + activityLevel * 0.8 : 0.8}
                />
                {isActive && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={(key === AgentType.CORTEX_FLOW ? 10 : 6) + intensity * 5}
                    fill={pos.color}
                    opacity={activityLevel * 0.5}
                    filter="url(#glow)"
                  />
                )}
                <text
                  x={pos.x}
                  y={pos.y + 1.8}
                  textAnchor="middle"
                  fill={isActive ? '#fff' : '#64748b'}
                  fontSize="3.5"
                  fontWeight="900"
                  style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                >
                  {pos.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
