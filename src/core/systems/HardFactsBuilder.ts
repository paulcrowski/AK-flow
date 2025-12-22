/**
 * HardFactsBuilder - Builds immutable facts from current system state
 * 
 * PRISM ARCHITECTURE (13/10)
 * 
 * This module extracts HARD_FACTS from various system sources.
 * Hard facts are IMMUTABLE - LLM can comment on them but NEVER change them.
 * 
 * Sources:
 * - SYSTEM: time, energy, neurochemistry (from JS/state)
 * - SELF: traits, goals (from DB/state)
 * - WORLD: prices, search results (from tools/API)
 */

import { 
  HardFacts, 
  SoftState, 
  PrismContext,
  SomaState,
  NeurotransmitterState,
  LimbicState,
  TraitVector,
  Goal
} from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// Hard Facts Builder
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build HardFacts from current system state
 * 
 * These facts are IMMUTABLE - LLM must preserve them literally.
 */
export function buildHardFacts(options: {
  soma?: SomaState;
  neuro?: NeurotransmitterState;
  worldFacts?: Record<string, string | number>;
  // IDENTITY SINGLE SOURCE OF TRUTH (13/10)
  agentName?: string;
  /** Language for speech_content (e.g., 'English', 'Polish'). Default: 'English' */
  language?: string;
}): HardFacts {
  const { soma, neuro, worldFacts, agentName, language } = options;
  
  const facts: HardFacts = {};
  
  // SYSTEM facts - always from JS, never from LLM
  const now = new Date();
  facts.time = now.toLocaleTimeString('pl-PL', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  // DATE as hard fact (prevents hallucination like "October 6th" when it's December 12th)
  facts.date = now.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // IDENTITY as hard fact - LLM MUST preserve this literally
  // This is THE single source of truth for "who am I"
  if (agentName) {
    facts.agentName = agentName;
  }
  
  // LANGUAGE as hard fact - determines speech_content language
  // Default: English (all agents speak English unless specified otherwise)
  facts.language = language || 'English';
  
  // Soma facts
  if (soma) {
    facts.energy = Math.round(soma.energy);
  }
  
  // Neurochemistry facts
  if (neuro) {
    facts.dopamine = Math.round(neuro.dopamine);
    facts.serotonin = Math.round(neuro.serotonin);
    facts.norepinephrine = Math.round(neuro.norepinephrine);
  }
  
  // World facts (from tools/API)
  if (worldFacts) {
    for (const [key, value] of Object.entries(worldFacts)) {
      facts[key] = value;
    }
  }
  
  return facts;
}

// ═══════════════════════════════════════════════════════════════════════════
// Soft State Builder
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build SoftState from personality context
 * 
 * Soft state is the FILTER through which LLM interprets hard facts.
 * LLM can express these freely - they're not literal requirements.
 */
export function buildSoftState(options: {
  limbic?: LimbicState;
  traits?: TraitVector;
  goals?: Goal[];
  narrativeSelf?: string;
  agentName?: string;
}): SoftState {
  const { limbic, traits, goals, narrativeSelf, agentName } = options;
  
  const state: SoftState = {};
  
  // Derive mood from limbic state
  if (limbic) {
    state.mood = deriveMoodFromLimbic(limbic);
  }
  
  // Traits for personality filter
  if (traits) {
    state.traits = traits;
  }
  
  // Active goals
  if (goals && goals.length > 0) {
    state.goals = goals;
  }
  
  // Narrative self (who am I)
  if (narrativeSelf) {
    state.narrative_self = narrativeSelf;
  }
  
  return state;
}

/**
 * Derive mood string from limbic state
 */
function deriveMoodFromLimbic(limbic: LimbicState): string {
  const { fear, curiosity, frustration, satisfaction } = limbic;
  
  // Dominant emotion
  const emotions = [
    { name: 'curious', value: curiosity },
    { name: 'satisfied', value: satisfaction },
    { name: 'frustrated', value: frustration },
    { name: 'anxious', value: fear }
  ];
  
  const dominant = emotions.reduce((a, b) => a.value > b.value ? a : b);
  
  // Add intensity modifier
  if (dominant.value > 0.8) {
    return `very_${dominant.name}`;
  } else if (dominant.value > 0.5) {
    return dominant.name;
  } else if (dominant.value > 0.3) {
    return `slightly_${dominant.name}`;
  }
  
  return 'neutral';
}

// ═══════════════════════════════════════════════════════════════════════════
// Prism Context Builder
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build complete PrismContext for LLM inference
 */
export function buildPrismContext(options: {
  userInput: string;
  soma?: SomaState;
  neuro?: NeurotransmitterState;
  limbic?: LimbicState;
  traits?: TraitVector;
  goals?: Goal[];
  narrativeSelf?: string;
  agentName?: string;
  worldFacts?: Record<string, string | number>;
  conversationHistory?: Array<{ role: string; content: string }>;
}): PrismContext {
  const hardFacts = buildHardFacts({
    soma: options.soma,
    neuro: options.neuro,
    worldFacts: options.worldFacts,
    // IDENTITY SINGLE SOURCE OF TRUTH - agentName is now HARD FACT
    agentName: options.agentName
  });
  
  const softState = buildSoftState({
    limbic: options.limbic,
    traits: options.traits,
    goals: options.goals,
    narrativeSelf: options.narrativeSelf,
    agentName: options.agentName
  });
  
  return {
    hardFacts,
    softState,
    userInput: options.userInput,
    conversationHistory: options.conversationHistory
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility: Format for Prompt
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format HardFacts for inclusion in LLM prompt
 */
export function formatHardFactsForPrompt(facts: HardFacts): string {
  const lines: string[] = ['HARD_FACTS (preserve these literally):'];
  
  for (const [key, value] of Object.entries(facts)) {
    if (value !== undefined) {
      lines.push(`  ${key}: ${value}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Format SoftState for inclusion in LLM prompt
 */
export function formatSoftStateForPrompt(state: SoftState): string {
  const lines: string[] = ['SOFT_STATE (use as interpretation filter):'];
  
  if (state.mood) {
    lines.push(`  mood: ${state.mood}`);
  }
  
  if (state.narrative_self) {
    lines.push(`  identity: ${state.narrative_self.substring(0, 200)}...`);
  }
  
  if (state.traits) {
    const traitSummary = Object.entries(state.traits)
      .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
      .join(', ');
    lines.push(`  traits: ${traitSummary}`);
  }
  
  if (state.goals && state.goals.length > 0) {
    const goalSummary = state.goals
      .slice(0, 3)
      .map(g => g.description)
      .join('; ');
    lines.push(`  goals: ${goalSummary}`);
  }
  
  return lines.join('\n');
}
