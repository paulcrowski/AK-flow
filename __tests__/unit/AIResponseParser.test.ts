import { describe, it, expect } from 'vitest';
import { parseJsonFromLLM, extractJsonBlock, repairJsonMinimal } from '../../utils/AIResponseParser';

describe('AIResponseParser - robustness', () => {
  describe('parseJsonFromLLM', () => {
    it('parses clean JSON', () => {
      const res = parseJsonFromLLM<{ foo: number }>('{"foo": 1}');
      expect(res.ok).toBe(true);
      expect(res.value).toEqual({ foo: 1 });
    });

    it('parses JSON wrapped in text (noise prefix/suffix)', () => {
      const res = parseJsonFromLLM<{ foo: string }>('Here is the JSON {"foo":"bar"} thanks!');
      expect(res.ok).toBe(true);
      expect(res.value).toEqual({ foo: 'bar' });
    });

    it('handles "Here at {}" without throwing (empty object)', () => {
      const res = parseJsonFromLLM<Record<string, unknown>>('Here at {}');
      expect(res.ok).toBe(true);
      expect(res.value).toEqual({});
    });

    it('returns NO_JSON when there is no structured data', () => {
      const res = parseJsonFromLLM<Record<string, unknown>>('nothing to parse here');
      expect(res.ok).toBe(false);
      expect(res.reason).toBe('NO_JSON');
    });

    it('repairs common issues (single quotes, trailing comma)', () => {
      const res = parseJsonFromLLM<{ foo: string }>(`{'foo': 'bar',}`, { allowRepair: true });
      expect(res.ok).toBe(true);
      expect(res.value).toEqual({ foo: 'bar' });
      expect(res.repaired).toBe(true);
    });

    it('parses JSON from fenced block', () => {
      const res = parseJsonFromLLM<{ foo: number }>('```json\n{"foo":2}\n```');
      expect(res.ok).toBe(true);
      expect(res.value).toEqual({ foo: 2 });
    });

    it('fails validation when validator rejects shape', () => {
      const res = parseJsonFromLLM<{ required: string }>('{"extra": true}', {
        validator: (v): v is { required: string } => typeof (v as any)?.required === 'string'
      });
      expect(res.ok).toBe(false);
      expect(res.reason).toBe('PARSE_ERROR');
    });
  });

  describe('extractJsonBlock and repairJsonMinimal helpers', () => {
    it('extracts balanced block from text with multiple braces', () => {
      const block = extractJsonBlock('pre { "a": 1 } mid { "b": 2 } post');
      expect(block).toBe('{ "a": 1 }');
    });

    it('repairs malformed quotes and trailing commas', () => {
      const repaired = repairJsonMinimal("{'a': 'x',}");
      expect(() => JSON.parse(repaired)).not.toThrow();
      expect(JSON.parse(repaired)).toEqual({ a: 'x' });
    });
  });
});
