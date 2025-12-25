import { describe, it, expect } from 'vitest';
import { detectIntent, getRetrievalLimit } from '@core/systems/IntentDetector';

describe('IntentDetector', () => {
  it('detects recall intent phrases', () => {
    expect(detectIntent('Przypomnij sobie wszystko o projekcie')).toBe('RECALL');
    expect(detectIntent('Co wiesz o historii agentow?')).toBe('RECALL');
  });

  it('detects history intent with diacritics', () => {
    expect(detectIntent('Pamiętasz ostatnio o czym rozmawialiśmy?')).toBe('HISTORY');
  });

  it('detects opinion and work intents', () => {
    expect(detectIntent('Co sądzisz o tej zmianie?')).toBe('OPINION');
    expect(detectIntent('Wdroż patch do SQL i schema')).toBe('WORK');
  });

  it('returns expected retrieval limits', () => {
    expect(getRetrievalLimit('RECALL')).toBe(40);
    expect(getRetrievalLimit('HISTORY')).toBe(30);
    expect(getRetrievalLimit('WORK')).toBe(25);
    expect(getRetrievalLimit('OPINION')).toBe(20);
    expect(getRetrievalLimit('NOW')).toBe(12);
  });
});
