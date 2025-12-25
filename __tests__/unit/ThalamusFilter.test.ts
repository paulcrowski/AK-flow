import { describe, it, expect } from 'vitest';
import { thalamus } from '@core/systems/ThalamusFilter';

describe('ThalamusFilter', () => {
  it('filters very short inputs', () => {
    expect(thalamus('yo')).toEqual({ store: false, salience: 0, skipEmbedding: true });
  });

  it('keeps low-signal tokens with low salience', () => {
    expect(thalamus('ok')).toEqual({ store: true, salience: 0.1, skipEmbedding: true });
    expect(thalamus('xd')).toEqual({ store: true, salience: 0.1, skipEmbedding: true });
    expect(thalamus('dzięki')).toEqual({ store: true, salience: 0.1, skipEmbedding: true });
  });

  it('assigns salience based on length', () => {
    expect(thalamus('To krótkie zdanie')).toEqual({ store: true, salience: 0.3, skipEmbedding: false });
    expect(thalamus('To jest dłuższe zdanie, które powinno mieć wyższą salience.')).toEqual({
      store: true,
      salience: 0.6,
      skipEmbedding: false
    });
  });
});
