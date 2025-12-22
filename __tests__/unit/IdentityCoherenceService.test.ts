/**
 * IdentityCoherenceService Tests
 * 
 * Testy dla sprawdzania spójno�:ci tożsamo�:ci.
 */

import { describe, it, expect } from 'vitest';
import {
  quickCoherenceCheck,
  buildCoherencePrompt,
  parseCoherenceResponse
} from '@core/services/IdentityCoherenceService';
import type { IdentityShardWithId } from '@core/types/IdentityShard';

describe('IdentityCoherenceService', () => {
  const existingShards: IdentityShardWithId[] = [
    {
      id: 'shard-1',
      kind: 'belief',
      content: 'I love minimalism and precision in my responses.',
      strength: 80,
      is_core: true
    },
    {
      id: 'shard-2',
      kind: 'preference',
      content: 'I prefer short, direct answers.',
      strength: 60,
      is_core: false
    },
    {
      id: 'shard-3',
      kind: 'constraint',
      content: 'I avoid verbose explanations.',
      strength: 50,
      is_core: false
    }
  ];

  describe('quickCoherenceCheck', () => {
    it('should reject duplicate shards', () => {
      const newShard = {
        kind: 'belief' as const,
        content: 'I love minimalism and precision in my responses.',
        is_core: false
      };
      
      const result = quickCoherenceCheck(newShard, existingShards);
      
      expect(result).not.toBeNull();
      expect(result!.action).toBe('reject');
      expect(result!.conflicting_shard_id).toBe('shard-1');
    });

    it('should return null for non-obvious cases', () => {
      const newShard = {
        kind: 'belief' as const,
        content: 'I value learning from mistakes.',
        is_core: false
      };
      
      const result = quickCoherenceCheck(newShard, existingShards);
      
      // No obvious conflict, needs LLM check
      expect(result).toBeNull();
    });

    it('should detect love/hate conflicts with soft plasticity', () => {
      const newShard = {
        kind: 'belief' as const,
        content: 'I hate minimalism and precision in responses.',
        is_core: false
      };
      
      const result = quickCoherenceCheck(newShard, existingShards);
      
      // SOFT PLASTICITY: Even core shard conflicts use erosion, not rejection
      // Needs 2+ word overlap (>3 chars) to detect conflict
      expect(result).not.toBeNull();
      expect(result!.action).toBe('weaken_old'); // Soft plasticity - erode, don't reject
      expect(result!.reason).toContain('Soft conflict with core shard');
    });
  });

  describe('buildCoherencePrompt', () => {
    it('should build valid prompt with shards', () => {
      const newShard = {
        kind: 'belief' as const,
        content: 'I value creativity.',
        is_core: false
      };
      
      const prompt = buildCoherencePrompt({
        newShard,
        existingShards
      });
      
      expect(prompt).toContain('EXISTING IDENTITY SHARDS');
      expect(prompt).toContain('I love minimalism');
      expect(prompt).toContain('I value creativity');
      expect(prompt).toContain('OUTPUT JSON');
    });

    it('should limit to top 10 shards', () => {
      const manyShards: IdentityShardWithId[] = Array(20).fill(null).map((_, i) => ({
        id: `shard-${i}`,
        kind: 'belief' as const,
        content: `Belief number ${i}`,
        strength: 100 - i,
        is_core: false
      }));
      
      const prompt = buildCoherencePrompt({
        newShard: { kind: 'belief', content: 'New belief', is_core: false },
        existingShards: manyShards
      });
      
      // Should only include top 10 by strength
      expect(prompt).toContain('Belief number 0');
      expect(prompt).toContain('Belief number 9');
      expect(prompt).not.toContain('Belief number 15');
    });
  });

  describe('parseCoherenceResponse', () => {
    it('should parse valid accept response', () => {
      const response = JSON.stringify({
        action: 'accept',
        conflicting_shard_index: null,
        reason: 'No conflict detected'
      });
      
      const result = parseCoherenceResponse(response, existingShards);
      
      expect(result.action).toBe('accept');
      expect(result.conflicting_shard_id).toBeUndefined();
      expect(result.reason).toBe('No conflict detected');
    });

    it('should parse valid reject response', () => {
      const response = JSON.stringify({
        action: 'reject',
        conflicting_shard_index: 1,
        reason: 'Conflicts with core belief'
      });
      
      const result = parseCoherenceResponse(response, existingShards);
      
      expect(result.action).toBe('reject');
      expect(result.conflicting_shard_id).toBe('shard-1');
    });

    it('should parse weaken_old response', () => {
      const response = JSON.stringify({
        action: 'weaken_old',
        conflicting_shard_index: 2,
        reason: 'New belief supersedes old preference'
      });
      
      const result = parseCoherenceResponse(response, existingShards);
      
      expect(result.action).toBe('weaken_old');
      expect(result.conflicting_shard_id).toBe('shard-2');
    });

    it('should handle malformed JSON', () => {
      const response = 'not valid json';
      
      const result = parseCoherenceResponse(response, existingShards);
      
      expect(result.action).toBe('reject');
      expect(result.reason).toContain('parse');
    });

    it('should extract JSON from markdown', () => {
      const response = `Here is my analysis:
\`\`\`json
{
  "action": "accept",
  "conflicting_shard_index": null,
  "reason": "Compatible"
}
\`\`\``;
      
      const result = parseCoherenceResponse(response, existingShards);
      
      expect(result.action).toBe('accept');
    });
  });
});
