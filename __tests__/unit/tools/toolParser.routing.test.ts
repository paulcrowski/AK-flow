import { describe, it, expect } from 'vitest';
import { routeDomain } from '@tools/toolParser';

describe('toolParser routing', () => {
  const artUuid = 'art-123e4567-e89b-12d3-a456-426614174000';

  it('path with slash goes to WORLD', () => {
    expect(routeDomain('/code/README.md', true)).toBe('WORLD');
  });

  it('README.md with world access and verb goes to WORLD', () => {
    expect(routeDomain('przeczytaj README.md', true)).toBe('WORLD');
  });

  it('book-like requests go to LIBRARY', () => {
    expect(routeDomain('przeczytaj ksiazke Reinforcement Learning', true)).toBe('LIBRARY');
  });

  it('art-uuid goes to ARTIFACT', () => {
    expect(routeDomain(`pokaz ${artUuid}`, true)).toBe('ARTIFACT');
  });

  it('art-123 in path still WORLD', () => {
    expect(routeDomain(`/code/${artUuid}/file.ts`, true)).toBe('WORLD');
  });
});
