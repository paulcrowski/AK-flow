import { describe, it, expect } from 'vitest';
import { detectIntent, getRetrievalLimit } from '@core/systems/IntentDetector';

describe('IntentDetector', () => {
  const intentOf = (input: string) => detectIntent(input).intent;

  it('detects recall intent phrases', () => {
    expect(intentOf('Przypomnij sobie wszystko o projekcie')).toBe('RECALL');
    expect(intentOf('Co wiesz o historii agentow?')).toBe('RECALL');
  });

  it('detects history intent with diacritics', () => {
    expect(intentOf('Pamietasz ostatnio o czym rozmawialismy?')).toBe('HISTORY');
  });

  it('detects opinion and work intents', () => {
    expect(intentOf('Co sadzisz o tej zmianie?')).toBe('OPINION');
    expect(intentOf('Wdroz patch do SQL i schema')).toBe('WORK');
  });

  it('returns expected retrieval limits', () => {
    expect(getRetrievalLimit('RECALL')).toBe(40);
    expect(getRetrievalLimit('HISTORY')).toBe(30);
    expect(getRetrievalLimit('WORK')).toBe(25);
    expect(getRetrievalLimit('OPINION')).toBe(20);
    expect(getRetrievalLimit('NOW')).toBe(12);
  });
});
