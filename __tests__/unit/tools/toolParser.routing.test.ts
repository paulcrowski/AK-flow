import { describe, it, expect } from 'vitest';
import { routeDomain } from '@tools/toolParser';

describe('toolParser routing', () => {
  it('path with slash goes to WORLD', () => {
    expect(routeDomain('/code/README.md', true)).toBe('WORLD');
  });

  it('README.md with world access and verb goes to WORLD', () => {
    expect(routeDomain('przeczytaj README.md', true)).toBe('WORLD');
  });

  it('art-123 goes to ARTIFACT', () => {
    expect(routeDomain('pokaz art-123', true)).toBe('ARTIFACT');
  });

  it('art-123 in path still WORLD', () => {
    expect(routeDomain('/code/art-123/file.ts', true)).toBe('WORLD');
  });
});
