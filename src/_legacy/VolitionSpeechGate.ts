/**
 * Legacy speech gate extracted from VolitionSystem.
 * Quarantined: ExecutiveGate is the single speech path.
 */

import { LimbicState } from '../types';
import { SPEECH_REFRACTORY_MS, SILENCE_BONUS_MAX, SILENCE_BONUS_FULL_SECONDS } from '../core/constants';
import { getVolitionConfig } from '../core/config/systemConfig';

export interface VolitionDecision {
  shouldSpeak: boolean;
  reason?: string;
}

export function calculatePoeticScore(text: string): number {
  const keywords = [
    'void', 'silence', 'quantum', 'cosmic', 'loom', 'crucible',
    'firmware', 'aether', 'nebula', 'fractal', 'resonance', 'shimmer'
  ];
  const lower = text.toLowerCase();
  return keywords.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0);
}

export const VolitionSpeechGate = {
  /**
   * Legacy speech gate. Do not add new callsites.
   */
  shouldSpeak(
    thought: string,
    voicePressure: number,
    silenceDuration: number,
    limbic: LimbicState,
    history: string[] = [],
    lastSpeakTimestamp?: number,
    currentTimestamp?: number,
    poeticMode: boolean = false,
    isSleeping: boolean = false
  ): VolitionDecision {
    if (isSleeping) {
      return { shouldSpeak: false, reason: 'SLEEPING' };
    }

    const trimmedContent = thought.trim();
    if (!trimmedContent) {
      return { shouldSpeak: false, reason: 'NO_CONTENT' };
    }

    const isRepetitive = history.some((oldThought) => {
      if (!oldThought || oldThought.length < 10) return false;
      const snippet = thought.substring(0, 20);
      const oldSnippet = oldThought.substring(0, 20);
      return oldThought.includes(snippet) || thought.includes(oldSnippet);
    });

    if (isRepetitive) {
      return { shouldSpeak: false, reason: 'GABA_INHIBITION_REPETITION' };
    }

    if (lastSpeakTimestamp && currentTimestamp &&
      currentTimestamp - lastSpeakTimestamp < SPEECH_REFRACTORY_MS) {
      return { shouldSpeak: false, reason: 'SPEECH_REFRACTORY' };
    }

    const config = getVolitionConfig();
    let threshold = config.baseVoicePressureThreshold;

    const poeticScore = calculatePoeticScore(thought);
    if (!poeticMode && poeticScore > 0) {
      const penalty = poeticScore * config.poeticPenaltyPerPoint;
      voicePressure = Math.max(0, voicePressure - penalty);
    }

    if (limbic.fear > config.fearInhibitionTrigger) threshold += config.fearInhibitionBonus;

    const silenceBonus = Math.min(SILENCE_BONUS_MAX, silenceDuration / SILENCE_BONUS_FULL_SECONDS);
    const effectivePressure = voicePressure + silenceBonus;

    if (effectivePressure > threshold) {
      return { shouldSpeak: true, reason: 'HIGH_PRESSURE' };
    }

    return { shouldSpeak: false, reason: 'LOW_PRESSURE' };
  },

  /**
   * Legacy simple gate. Do not add new callsites.
   */
  evaluateVolition(
    voicePressure: number,
    speechContent: string
  ): VolitionDecision {
    if (!speechContent.trim()) return { shouldSpeak: false, reason: 'NO_CONTENT' };
    if (voicePressure > 0.75) return { shouldSpeak: true, reason: 'HIGH_PRESSURE' };
    return { shouldSpeak: false, reason: 'LOW_PRESSURE' };
  }
};

export const evaluateVolition = VolitionSpeechGate.evaluateVolition;
