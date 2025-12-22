/**
 * StyleGuard - Post-generation filter for style enforcement
 * 
 * Filters agent output based on user preferences (contract).
 * This is NOT censorship - it's enforcement of the UI contract.
 * 
 * Principle: Agent can THINK anything, but EXPRESSION follows user rules.
 * 
 * @module core/systems/StyleGuard
 */

import { eventBus } from '../EventBus';
import { AgentType, PacketType } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// USER PREFERENCES (Style Contract)
// ═══════════════════════════════════════════════════════════════════════════

export interface UserStylePrefs {
  noEmoji?: boolean;           // Strip all emojis
  maxLength?: number;          // Truncate to max characters
  noExclamation?: boolean;     // Remove excessive exclamation marks
  formalTone?: boolean;        // Enforce formal language patterns
  language?: string;           // Expected language (Polish, English, etc.)
}

// Default preferences (permissive)
export const DEFAULT_STYLE_PREFS: UserStylePrefs = {
  noEmoji: false,
  maxLength: undefined,
  noExclamation: false,
  formalTone: false,
  language: undefined
};

// ═══════════════════════════════════════════════════════════════════════════
// STYLE GUARD IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

export const StyleGuard = {
  /**
   * Apply style filters to generated text.
   * Returns filtered text and metadata about changes.
   */
  apply(text: string, prefs: UserStylePrefs = DEFAULT_STYLE_PREFS): {
    text: string;
    wasFiltered: boolean;
    filters: string[];
  } {
    if (!text || text.trim().length === 0) {
      return { text: '', wasFiltered: false, filters: [] };
    }

    let result = text;
    const filters: string[] = [];
    const originalLength = text.length;

    // 1. EMOJI FILTER
    if (prefs.noEmoji) {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
      const emojiCount = (result.match(emojiRegex) || []).length;
      if (emojiCount > 0) {
        result = result.replace(emojiRegex, '').replace(/\s+/g, ' ').trim();
        filters.push(`EMOJI_REMOVED:${emojiCount}`);
      }
    }

    // 2. EXCLAMATION FILTER (reduce !!! to !)
    if (prefs.noExclamation) {
      const exclMatch = result.match(/!+/g);
      if (exclMatch && exclMatch.some(m => m.length > 1)) {
        result = result.replace(/!+/g, '.');
        filters.push('EXCLAMATION_TONED_DOWN');
      }
    }

    // 3. LENGTH FILTER
    if (prefs.maxLength && result.length > prefs.maxLength) {
      // Smart truncation: try to end at sentence boundary
      let truncated = result.slice(0, prefs.maxLength);
      const lastSentence = truncated.lastIndexOf('. ');
      if (lastSentence > prefs.maxLength * 0.7) {
        truncated = truncated.slice(0, lastSentence + 1);
      } else {
        truncated = truncated.trim() + '...';
      }
      result = truncated;
      filters.push(`LENGTH_TRUNCATED:${originalLength}->${result.length}`);
    }

    // 4. FORMAL TONE FILTER (basic patterns)
    if (prefs.formalTone) {
      // Remove casual patterns
      const casualPatterns = [
        { pattern: /\bej\b/gi, replacement: '' },
        { pattern: /\bziom(ek|u|ie)?\b/gi, replacement: '' },
        { pattern: /\bkurwa\b/gi, replacement: '' },
        { pattern: /\bspoko\b/gi, replacement: 'dobrze' },
        { pattern: /\bluzik\b/gi, replacement: 'spokojnie' },
      ];
      
      let formalizedCount = 0;
      for (const { pattern, replacement } of casualPatterns) {
        if (pattern.test(result)) {
          result = result.replace(pattern, replacement);
          formalizedCount++;
        }
      }
      
      if (formalizedCount > 0) {
        result = result.replace(/\s+/g, ' ').trim();
        filters.push(`FORMALIZED:${formalizedCount}`);
      }
    }

    const wasFiltered = filters.length > 0;

    // Log if filtered
    if (wasFiltered) {
      eventBus.publish({
        id: `style-guard-${Date.now()}`,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.SYSTEM_ALERT,
        payload: {
          event: 'STYLE_GUARD_APPLIED',
          filters,
          originalLength,
          finalLength: result.length
        },
        priority: 0.3
      });
    }

    return { text: result, wasFiltered, filters };
  },

  /**
   * Check if text likely violates style preferences.
   * Useful for pre-check without modifying.
   */
  check(text: string, prefs: UserStylePrefs): {
    violations: string[];
    severity: number; // 0-1
  } {
    const violations: string[] = [];
    let severity = 0;

    if (prefs.noEmoji) {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]/gu;
      const emojiCount = (text.match(emojiRegex) || []).length;
      if (emojiCount > 0) {
        violations.push(`EMOJI:${emojiCount}`);
        severity += 0.1 * emojiCount;
      }
    }

    if (prefs.maxLength && text.length > prefs.maxLength) {
      violations.push(`LENGTH:${text.length}>${prefs.maxLength}`);
      severity += 0.2;
    }

    if (prefs.noExclamation && /!{2,}/.test(text)) {
      violations.push('EXCESSIVE_EXCLAMATION');
      severity += 0.1;
    }

    return {
      violations,
      severity: Math.min(1, severity)
    };
  }
};

export default StyleGuard;
