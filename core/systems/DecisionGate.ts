/**
 * DecisionGate.ts - The Basal Ganglia of AK-FLOW
 * 
 * ARCHITEKTURA 3-WARSTWOWA:
 * 1. MINDSPACE (internal_thought) → planowanie, introspekcja
 * 2. DECISION GATE (ten moduł) → walidacja, polityka, przekierowanie
 * 3. EXPRESSION (speech_content) → jawne wykonanie narzędzi
 * 
 * Zgodne z: Kora przedczołowa → Jądra podstawy → Kora ruchowa
 * 
 * @module core/systems/DecisionGate
 */

import type { CortexOutput, ToolIntent } from '../types/CortexOutput';
import type { SomaState } from '../../types';
import { eventBus } from '../EventBus';
import { AgentType, PacketType } from '../../types';
import { generateUUID } from '../../utils/uuid';
import { createRng } from '../utils/rng';
import { SYSTEM_CONFIG } from '../config/systemConfig';

// Deterministic RNG for reproducible behavior
const rng = createRng(SYSTEM_CONFIG.rng.seed);

/**
 * Konfiguracja polityki narzędzi
 */
export interface ToolPolicyConfig {
  /** Minimalna energia do użycia SEARCH */
  minEnergyForSearch: number;
  /** Minimalna energia do użycia VISUALIZE */
  minEnergyForVisualize: number;
  /** Cooldown między użyciami tego samego narzędzia (ms) */
  toolCooldownMs: number;
  /** Maksymalna liczba narzędzi na turę */
  maxToolsPerTurn: number;
}

const DEFAULT_POLICY: ToolPolicyConfig = {
  minEnergyForSearch: 10,
  minEnergyForVisualize: 25,
  toolCooldownMs: 5000,
  maxToolsPerTurn: 1
};

/**
 * Stan Decision Gate
 */
interface GateState {
  lastToolUse: Record<string, number>;  // tool -> timestamp
  toolsUsedThisTurn: number;
}

const gateStateByAgent = new Map<string, GateState>();

function getGateState(agentId: string): GateState {
  const existing = gateStateByAgent.get(agentId);
  if (existing) return existing;
  const created: GateState = { lastToolUse: {}, toolsUsedThisTurn: 0 };
  gateStateByAgent.set(agentId, created);
  return created;
}

/**
 * Reset stanu na początku nowej tury
 */
export function resetTurnState(): void {
  // legacy no-op; kept for backward compatibility in non-agent-aware code paths
}

export function resetTurnStateForAgent(agentId: string): void {
  getGateState(agentId).toolsUsedThisTurn = 0;
}

/**
 * Pełny reset stanu (dla testów)
 */
export function resetFullState(): void {
  gateStateByAgent.clear();
}

export function resetFullStateForAgent(agentId: string): void {
  gateStateByAgent.delete(agentId);
}

/**
 * Wynik walidacji Decision Gate
 */
export interface GateDecision {
  /** Czy intencja została zatwierdzona */
  approved: boolean;
  /** Powód odrzucenia (jeśli nie zatwierdzona) */
  reason?: string;
  /** Zmodyfikowany output (z dodanym tagiem narzędzia jeśli potrzeba) */
  modifiedOutput: CortexOutput;
  /** Telemetria */
  telemetry: {
    intentDetected: boolean;
    intentExecuted: boolean;
    violation?: string;
  };
}

/**
 * Wykrywa naruszenie kognitywne: tagi narzędzi w myślach
 */
function detectCognitiveViolation(thought: string): string | null {
  const toolPattern = /\[(SEARCH|VISUALIZE):\s*[^\]]+\]/i;
  const match = thought.match(toolPattern);
  
  if (match) {
    return `Tool tag "${match[0]}" found in internal_thought. This is a cognitive violation.`;
  }
  
  return null;
}

/**
 * Sprawdza czy polityka pozwala na użycie narzędzia
 */
function checkPolicy(
  intent: ToolIntent,
  somaState: SomaState,
  policy: ToolPolicyConfig,
  gateState: GateState
): { allowed: boolean; reason?: string } {
  const now = Date.now();
  
  // 1. Sprawdź energię
  if (intent.tool === 'SEARCH' && somaState.energy < policy.minEnergyForSearch) {
    return { allowed: false, reason: `Insufficient energy for SEARCH (${somaState.energy} < ${policy.minEnergyForSearch})` };
  }
  
  if (intent.tool === 'VISUALIZE' && somaState.energy < policy.minEnergyForVisualize) {
    return { allowed: false, reason: `Insufficient energy for VISUALIZE (${somaState.energy} < ${policy.minEnergyForVisualize})` };
  }
  
  // 2. Sprawdź cooldown
  const lastUse = gateState.lastToolUse[intent.tool || ''] || 0;
  if (now - lastUse < policy.toolCooldownMs) {
    const remaining = Math.ceil((policy.toolCooldownMs - (now - lastUse)) / 1000);
    return { allowed: false, reason: `Tool ${intent.tool} on cooldown (${remaining}s remaining)` };
  }
  
  // 3. Sprawdź limit na turę
  if (gateState.toolsUsedThisTurn >= policy.maxToolsPerTurn) {
    return { allowed: false, reason: `Max tools per turn reached (${policy.maxToolsPerTurn})` };
  }
  
  return { allowed: true };
}

/**
 * Naturalne przekierowanie intencji do mowy
 * 
 * Jeśli LLM zadeklarował tool_intent, ale nie dodał tagu w speech,
 * Decision Gate dodaje go naturalnie.
 */
function redirectIntentToSpeech(output: CortexOutput, intent: ToolIntent): CortexOutput {
  const toolTag = `[${intent.tool}: ${intent.query}]`;
  
  // Sprawdź czy tag już jest w speech
  if (output.speech_content.includes(`[${intent.tool}:`)) {
    return output;  // Już jest, nie duplikuj
  }
  
  // Naturalne przekierowanie z kontekstem
  const naturalPhrases: Record<string, string[]> = {
    SEARCH: [
      `Let me look that up. ${toolTag}`,
      `I'll search for that. ${toolTag}`,
      `Checking... ${toolTag}`
    ],
    VISUALIZE: [
      `Let me visualize this. ${toolTag}`,
      `I'll create an image. ${toolTag}`,
      `Generating visual... ${toolTag}`
    ]
  };
  
  const phrases = naturalPhrases[intent.tool || ''] || [`${toolTag}`];
  const phrase = phrases[Math.floor(rng() * phrases.length)];
  
  // Dodaj na końcu speech jeśli jest treść, lub zastąp jeśli pusty
  const newSpeech = output.speech_content.trim()
    ? `${output.speech_content.trim()} ${phrase}`
    : phrase;
  
  return {
    ...output,
    speech_content: newSpeech
  };
}

/**
 * Główna funkcja Decision Gate
 * 
 * Waliduje output z LLM i przekierowuje intencje do akcji.
 */
export function processDecisionGate(
  output: CortexOutput,
  somaState: SomaState,
  policy: ToolPolicyConfig = DEFAULT_POLICY,
  agentId: string
): GateDecision {
  let modifiedOutput = { ...output };
  const gateState = getGateState(agentId);
  const telemetry = {
    intentDetected: false,
    intentExecuted: false,
    violation: undefined as string | undefined
  };
  
  // 1. BEZPIECZNIK: Wykryj naruszenie kognitywne
  const violation = detectCognitiveViolation(output.internal_thought);
  if (violation) {
    telemetry.violation = violation;
    
    // Log violation
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        alert: 'COGNITIVE_VIOLATION',
        message: violation,
        thought_snippet: output.internal_thought.substring(0, 100)
      },
      priority: 0.9
    });
    
    // Usuń tag z myśli (napraw naruszenie)
    modifiedOutput.internal_thought = output.internal_thought
      .replace(/\[(SEARCH|VISUALIZE):\s*[^\]]+\]/gi, '[INTENT_REMOVED]');
    
    console.warn('[DecisionGate] COGNITIVE_VIOLATION:', violation);
  }
  
  // 2. Sprawdź czy jest tool_intent
  if (output.tool_intent && output.tool_intent.tool) {
    telemetry.intentDetected = true;
    
    // 3. Waliduj politykę
    const policyCheck = checkPolicy(output.tool_intent, somaState, policy, gateState);
    
    if (policyCheck.allowed) {
      // 4. Przekieruj intencję do speech (jeśli brak tagu)
      modifiedOutput = redirectIntentToSpeech(modifiedOutput, output.tool_intent);
      telemetry.intentExecuted = true;
      
      // Aktualizuj stan
      gateState.lastToolUse[output.tool_intent.tool] = Date.now();
      gateState.toolsUsedThisTurn++;
      
      // Log successful intent execution
      eventBus.publish({
        id: generateUUID(),
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.FIELD_UPDATE,
        payload: {
          action: 'TOOL_INTENT_EXECUTED',
          tool: output.tool_intent.tool,
          query: output.tool_intent.query,
          reason: output.tool_intent.reason
        },
        priority: 0.7
      });
    } else {
      // Intencja zablokowana przez politykę
      eventBus.publish({
        id: generateUUID(),
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.SYSTEM_ALERT,
        payload: {
          alert: 'INTENT_BLOCKED',
          tool: output.tool_intent.tool,
          reason: policyCheck.reason
        },
        priority: 0.5
      });
      
      console.log('[DecisionGate] Intent blocked:', policyCheck.reason);
    }
  } else {
    // 5. Sprawdź czy w myślach jest intencja, ale nie ma tool_intent
    // (INTENT_NOT_EXECUTED telemetry)
    const intentPatterns = [
      /I should (search|look up|find|visualize|imagine|picture)/i,
      /I need (to search|data|information|to visualize)/i,
      /Let me (search|check|visualize)/i,
      /powinienem (poszukać|wyszukać|zwizualizować)/i,
      /potrzebuję (danych|informacji)/i
    ];
    
    const hasImplicitIntent = intentPatterns.some(p => p.test(output.internal_thought));
    const hasToolInSpeech = /\[(SEARCH|VISUALIZE):/i.test(output.speech_content);
    
    if (hasImplicitIntent && !hasToolInSpeech && !output.tool_intent) {
      eventBus.publish({
        id: generateUUID(),
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.COGNITIVE_METRIC,
        payload: {
          metric: 'INTENT_NOT_EXECUTED',
          thought_snippet: output.internal_thought.substring(0, 100),
          message: 'Implicit intent detected in thought but no tool_intent or tool tag in speech'
        },
        priority: 0.3
      });
    }
  }
  
  return {
    approved: !violation,
    reason: violation || undefined,
    modifiedOutput,
    telemetry
  };
}

/**
 * Export policy config dla testów
 */
export { DEFAULT_POLICY };
