/**
 * ExecutiveGate - Jedna Bramka Mowy (13/10 PIONEER ARCHITECTURE)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * KONTRAKT SYSTEMU:
 * "System może generować wiele myśli równolegle, ale tylko jedna 
 *  deterministyczna bramka wykonawcza decyduje, która myśl staje się mową;
 *  odpowiedź na użytkownika zawsze ma absolutny priorytet."
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ARCHITEKTURA:
 * 1. Reaktywna (user response) → TWARDE VETO, zawsze wygrywa
 * 2. Autonomiczne → konkurują między sobą (Competitive Inhibition)
 * 3. Zwycięzca → bramka voice_pressure (deterministyczna)
 * 4. Jeśli przejdzie → speech, jeśli nie → thought only
 * 
 * NEUROBIOLOGICZNY MODEL:
 * - Kora przedczołowa (PFC) jako arbiter
 * - Myśli konkurują, nie negocjują
 * - Jedna ścieżka wyjściowa do artykulacji
 * 
 * @module core/systems/ExecutiveGate
 * @author AK-FLOW Pioneer Architecture
 */

import type { LimbicState } from '../../types';
import type { SocialDynamics, KernelState } from '../kernel/types';
import { SYSTEM_CONFIG } from '../config/systemConfig';
import { clamp01 } from '../../utils/math';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Typ kandydata do mowy
 */
export type CandidateType = 'reactive' | 'autonomous' | 'goal_driven';

/**
 * Kandydat do mowy - każda myśl która chce stać się wypowiedzią
 */
export interface SpeechCandidate {
  /** Unikalny identyfikator */
  id: string;

  /** Typ kandydata */
  type: CandidateType;

  /** Treść do wypowiedzenia */
  speech_content: string;

  /** Wewnętrzna myśl (do logów) */
  internal_thought: string;

  /** Timestamp utworzenia */
  timestamp: number;

  /** Siła kandydata (dla Competitive Inhibition) */
  strength: number;

  /** Czy to odpowiedź na user input? */
  is_user_response: boolean;

  /** Metadata dla debugowania */
  metadata?: {
    source?: string;
    goal_id?: string;
    novelty?: number;
    salience?: number;
  };
}

/**
 * Wynik decyzji bramki
 */
export interface GateDecision {
  /** Czy publikować jako speech? */
  should_speak: boolean;

  /** Zwycięski kandydat (jeśli jest) */
  winner: SpeechCandidate | null;

  /** Powód decyzji */
  reason: GateReason;

  /** Kandydaci którzy przegrali (do logów) */
  losers: SpeechCandidate[];

  /** Debug info */
  debug?: {
    reactive_count: number;
    autonomous_count: number;
    voice_pressure: number;
    silence_window_ok: boolean;
    social_block_reason?: string;
  };
}

export type GateReason =
  | 'REACTIVE_VETO'           // Reaktywna wygrała (absolutny priorytet)
  | 'AUTONOMOUS_WON'          // Autonomiczna wygrała konkurencję
  | 'VOICE_PRESSURE_LOW'      // Autonomiczna przegrała z voice_pressure
  | 'SILENCE_WINDOW_VIOLATED' // Za wcześnie po user input
  | 'NO_CANDIDATES'           // Brak kandydatów
  | 'EMPTY_SPEECH'            // Kandydat ma pusty speech
  | 'SOCIAL_BUDGET_EXHAUSTED' // Autonomy budget wyczerpany
  | 'SOCIAL_COST_TOO_HIGH'    // Effective pressure below dynamic threshold
  | 'DOMAIN_MISMATCH';        // Tool domain check failed (v8.1.1)

/**
 * Kontekst dla bramki
 */
export interface GateContext {
  /** Aktualny stan limbiczny */
  limbic: LimbicState;

  /** Czas od ostatniego user input (ms) */
  time_since_user_input: number;

  /** Minimalne okno ciszy dla autonomicznych (ms) */
  silence_window: number;

  /** Próg voice_pressure dla autonomicznych */
  voice_pressure_threshold: number;

  /** Social dynamics state (optional, for unified gate) */
  socialDynamics?: SocialDynamics;

  /** v8.1.1: Trace is user facing (input or retry) */
  isUserFacing?: boolean;

  /** v8.1.1: Last tool state for domain verification */
  lastTool?: KernelState['lastTool'];
}

/**
 * Social dynamics config (unified with gate)
 */
const SOCIAL_CONFIG = {
  /** Minimum budget to allow speech */
  MIN_BUDGET_TO_SPEAK: 0.1,
  /** Base threshold for voice pressure */
  BASE_THRESHOLD: 0.6,
  /** Max penalty from user absence */
  ABSENCE_PENALTY: 0.3
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG = {
  /** Minimalne okno ciszy (ms) - autonomiczne nie mówią jeśli user pisał niedawno */
  SILENCE_WINDOW_MS: 5000,

  /** Próg voice_pressure dla autonomicznych (0-1) */
  VOICE_PRESSURE_THRESHOLD: 0.6,

  /** Wagi dla Competitive Inhibition */
  WEIGHTS: {
    novelty: 0.3,
    salience: 0.4,
    goal_relevance: 0.2,
    recency: 0.1
  }
} as const;

const DEFAULT_GOAL_RELEVANCE = {
  goalDriven: 0.8,
  autonomous: 0.3
} as const;

const DEFAULT_RECENCY_DECAY_MS = 30_000;

const getGateConfig = () => {
  const cfg = (SYSTEM_CONFIG as any).executiveGate ?? {};
  const weights = cfg.goalRelevanceWeights ?? DEFAULT_GOAL_RELEVANCE;
  const goalDriven = Number.isFinite(weights.goalDriven) ? Number(weights.goalDriven) : DEFAULT_GOAL_RELEVANCE.goalDriven;
  const autonomous = Number.isFinite(weights.autonomous) ? Number(weights.autonomous) : DEFAULT_GOAL_RELEVANCE.autonomous;
  const recencyDecayMs = Number.isFinite(cfg.recencyDecayMs) ? Number(cfg.recencyDecayMs) : DEFAULT_RECENCY_DECAY_MS;
  return { goalRelevanceWeights: { goalDriven, autonomous }, recencyDecayMs };
};

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTIVE GATE
// ═══════════════════════════════════════════════════════════════════════════

export const ExecutiveGate = {

  /**
   * Główna funkcja decyzyjna - wybiera który kandydat (jeśli którykolwiek) 
   * ma prawo stać się mową.
   * 
   * KONTRAKT:
   * 1. Reaktywna ZAWSZE wygrywa (twarde veto)
   * 2. Autonomiczne konkurują tylko jeśli minęło okno ciszy
   * 3. Zwycięzca musi przejść przez bramkę voice_pressure
   */
  decide(
    candidates: SpeechCandidate[],
    context: GateContext
  ): GateDecision {
    const now = Date.now();

    // Separuj kandydatów
    const isUserFacing = Boolean(context.isUserFacing);
    // v8.1.1: If user facing, treat autonomous candidates (fallback) as reactive to bypass silence window
    const reactive = candidates.filter(c => c.type === 'reactive' || c.is_user_response || (isUserFacing && c.type !== 'goal_driven'));
    const autonomous = candidates.filter(c => c.type === 'autonomous' && !c.is_user_response && !isUserFacing);
    const goalDriven = candidates.filter(c => c.type === 'goal_driven' && !c.is_user_response);

    // Oblicz voice_pressure deterministycznie
    const voicePressure = this.computeVoicePressure(context.limbic);

    // Debug info
    const debug = {
      reactive_count: reactive.length,
      autonomous_count: autonomous.length + goalDriven.length,
      voice_pressure: voicePressure,
      silence_window_ok: context.time_since_user_input >= context.silence_window
    };

    // ═══════════════════════════════════════════════════════════════════════
    // RULE 1: Reaktywna ma TWARDE VETO
    // ═══════════════════════════════════════════════════════════════════════
    if (reactive.length > 0) {
      // Jeśli jest więcej niż jedna reaktywna, weź najnowszą
      const winner = reactive.sort((a, b) => b.timestamp - a.timestamp)[0];

      // v8.1.1: Domain Mismatch Check (Hard Block)
      if (isUserFacing && context.lastTool?.ok && context.lastTool.domainExpected && context.lastTool.domainActual) {
        if (context.lastTool.domainExpected !== context.lastTool.domainActual) {
          // Log anomaly
          console.warn('[GATE] DOMAIN_MISMATCH_BLOCKED_SPEECH', {
            expected: context.lastTool.domainExpected,
            actual: context.lastTool.domainActual
          });

          return {
            should_speak: false,
            winner: null,
            reason: 'DOMAIN_MISMATCH',
            losers: candidates,
            debug
          };
        }
      }

      // v8.1.1: Speech Required After Tool Success
      if (isUserFacing && context.lastTool?.ok) {
        // We MUST speak to acknowledge tool result
        // Log this enforcement
        if (debug) {
          console.log('[GATE] SPEECH_REQUIRED_AFTER_TOOL_SUCCESS', {
            tool: context.lastTool.tool,
            candidateId: winner.id
          });
        }
      }

      // Walidacja - pusty speech = nie publikuj
      if (!winner.speech_content.trim()) {
        return {
          should_speak: false,
          winner: null,
          reason: 'EMPTY_SPEECH',
          losers: candidates,
          debug
        };
      }

      return {
        should_speak: true,
        winner,
        reason: 'REACTIVE_VETO',
        losers: [...autonomous, ...goalDriven, ...reactive.filter(c => c.id !== winner.id)],
        debug
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RULE 2: Sprawdź okno ciszy
    // ═══════════════════════════════════════════════════════════════════════
    if (!isUserFacing && context.time_since_user_input < context.silence_window) {
      // User pisał niedawno - autonomiczne milczą
      return {
        should_speak: false,
        winner: null,
        reason: 'SILENCE_WINDOW_VIOLATED',
        losers: [...autonomous, ...goalDriven],
        debug
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RULE 3: Competitive Inhibition między autonomicznymi
    // ═══════════════════════════════════════════════════════════════════════
    const allAutonomous = [...autonomous, ...goalDriven];

    if (allAutonomous.length === 0) {
      return {
        should_speak: false,
        winner: null,
        reason: 'NO_CANDIDATES',
        losers: [],
        debug
      };
    }

    // Konkurencja - najsilniejszy wygrywa
    const ranked = allAutonomous.sort((a, b) => b.strength - a.strength);
    const winner = ranked[0];
    const losers = ranked.slice(1);

    // Walidacja - pusty speech = nie publikuj
    if (!winner.speech_content.trim()) {
      return {
        should_speak: false,
        winner: null,
        reason: 'EMPTY_SPEECH',
        losers: allAutonomous,
        debug
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RULE 4: Bramka voice_pressure
    // ═══════════════════════════════════════════════════════════════════════
    if (voicePressure < context.voice_pressure_threshold) {
      // Siła za niska - myśl idzie do logów, nie do speech
      return {
        should_speak: false,
        winner: winner, // Zwracamy zwycięzcę do logowania jako thought
        reason: 'VOICE_PRESSURE_LOW',
        losers,
        debug
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RULE 5: Social Dynamics (unified - no separate check needed)
    // ═══════════════════════════════════════════════════════════════════════
    const socialResult = this.checkSocialDynamics(context, voicePressure);
    if (!socialResult.allowed) {
      return {
        should_speak: false,
        winner: winner,
        reason: socialResult.reason as GateReason,
        losers,
        debug: { ...debug, social_block_reason: socialResult.reason }
      };
    }

    // Zwycięzca przeszedł wszystkie bramki
    return {
      should_speak: true,
      winner,
      reason: 'AUTONOMOUS_WON',
      losers,
      debug
    };
  },

  /**
   * Check social dynamics constraints.
   * UNIFIED: Called as part of gate decision, not separately.
   */
  checkSocialDynamics(
    context: GateContext,
    voicePressure: number
  ): { allowed: boolean; reason: string } {
    const sd = context.socialDynamics;

    // No social dynamics = allow (backwards compatibility)
    if (!sd) {
      return { allowed: true, reason: 'NO_SOCIAL_DYNAMICS' };
    }

    // Hard block: autonomy budget exhausted
    if (sd.autonomyBudget < SOCIAL_CONFIG.MIN_BUDGET_TO_SPEAK) {
      return { allowed: false, reason: 'SOCIAL_BUDGET_EXHAUSTED' };
    }

    // Compute effective pressure (reduced by social cost)
    const effectivePressure = Math.max(0, voicePressure - sd.socialCost);

    // Dynamic threshold: higher when user absent
    const dynamicThreshold = SOCIAL_CONFIG.BASE_THRESHOLD +
      (1 - sd.userPresenceScore) * SOCIAL_CONFIG.ABSENCE_PENALTY;

    if (effectivePressure < dynamicThreshold) {
      return { allowed: false, reason: 'SOCIAL_COST_TOO_HIGH' };
    }

    return { allowed: true, reason: 'SOCIAL_ALLOWED' };
  },

  /**
   * Oblicz voice_pressure deterministycznie z limbic state.
   * 
   * FORMUŁA:
   * voice_pressure = (curiosity + satisfaction - fear - frustration) / 2 + 0.5
   * 
   * Zakres: 0.0 - 1.0
   * - Wysoka curiosity/satisfaction → chce mówić
   * - Wysoki fear/frustration → hamuje mowę
   */
  computeVoicePressure(limbic: LimbicState): number {
    const raw = (limbic.curiosity + limbic.satisfaction - limbic.fear - limbic.frustration) / 2 + 0.5;
    return clamp01(raw);
  },

  /**
   * Oblicz siłę kandydata dla Competitive Inhibition.
   * 
   * FORMUŁA:
   * strength = novelty * W1 + salience * W2 + goal_relevance * W3 + recency * W4
   */
  computeCandidateStrength(
    candidate: Partial<SpeechCandidate>,
    now: number = Date.now()
  ): number {
    const weights = DEFAULT_CONFIG.WEIGHTS;
    const gateCfg = getGateConfig();

    const novelty = candidate.metadata?.novelty ?? 0.5;
    const salience = candidate.metadata?.salience ?? 0.5;
    const goalRelevance = candidate.type === 'goal_driven'
      ? gateCfg.goalRelevanceWeights.goalDriven
      : gateCfg.goalRelevanceWeights.autonomous;

    // Recency: nowsze = silniejsze (decay over 30s)
    const age = now - (candidate.timestamp ?? now);
    const recency = Math.max(0, 1 - age / gateCfg.recencyDecayMs);

    return (
      novelty * weights.novelty +
      salience * weights.salience +
      goalRelevance * weights.goal_relevance +
      recency * weights.recency
    );
  },

  /**
   * Stwórz kandydata reaktywnego (odpowiedź na usera).
   */
  createReactiveCandidate(
    speech_content: string,
    internal_thought: string,
    id: string = `reactive-${Date.now()}`
  ): SpeechCandidate {
    return {
      id,
      type: 'reactive',
      speech_content,
      internal_thought,
      timestamp: Date.now(),
      strength: 1.0, // Reaktywna zawsze ma max strength (choć nie używane w decyzji)
      is_user_response: true
    };
  },

  /**
   * Stwórz kandydata autonomicznego.
   */
  createAutonomousCandidate(
    speech_content: string,
    internal_thought: string,
    metadata?: SpeechCandidate['metadata'],
    id: string = `autonomous-${Date.now()}`
  ): SpeechCandidate {
    const candidate: SpeechCandidate = {
      id,
      type: 'autonomous',
      speech_content,
      internal_thought,
      timestamp: Date.now(),
      strength: 0, // Will be computed
      is_user_response: false,
      metadata
    };

    candidate.strength = this.computeCandidateStrength(candidate);
    return candidate;
  },

  /**
   * Stwórz kandydata goal-driven.
   */
  createGoalCandidate(
    speech_content: string,
    internal_thought: string,
    goal_id: string,
    metadata?: Omit<SpeechCandidate['metadata'], 'goal_id'>,
    id: string = `goal-${Date.now()}`
  ): SpeechCandidate {
    const candidate: SpeechCandidate = {
      id,
      type: 'goal_driven',
      speech_content,
      internal_thought,
      timestamp: Date.now(),
      strength: 0, // Will be computed
      is_user_response: false,
      metadata: { ...metadata, goal_id }
    };

    candidate.strength = this.computeCandidateStrength(candidate);
    return candidate;
  },

  /**
   * Pobierz domyślny kontekst.
   */
  getDefaultContext(
    limbic: LimbicState,
    time_since_user_input: number
  ): GateContext {
    return {
      limbic,
      time_since_user_input,
      silence_window: DEFAULT_CONFIG.SILENCE_WINDOW_MS,
      voice_pressure_threshold: DEFAULT_CONFIG.VOICE_PRESSURE_THRESHOLD
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { DEFAULT_CONFIG as EXECUTIVE_GATE_CONFIG };
