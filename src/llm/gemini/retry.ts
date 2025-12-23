import type { CognitiveError } from '../../types';

export const mapError = (e: any): CognitiveError => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      code: 'SYNAPTIC_DISCONNECT',
      message: 'Neural Link Severed',
      details: 'No internet connection detected.',
      retryable: true
    };
  }

  const msg = (e.message || '').toLowerCase();
  const status = (e.status || '').toString();

  if (msg.includes('429') || msg.includes('quota') || msg.includes('exhausted')) {
    return {
      code: 'NEURAL_OVERLOAD',
      message: 'Cognitive Quota Exceeded',
      details: 'Rate limit hit. Cooling down.',
      retryable: true
    };
  }
  if (msg.includes('503') || msg.includes('network') || msg.includes('fetch') || msg.includes('failed') || status === 'UNKNOWN') {
    return {
      code: 'SYNAPTIC_DISCONNECT',
      message: 'Neural Link Unstable',
      details: 'Transient network error (RPC/XHR).',
      retryable: true
    };
  }
  if (msg.includes('safety') || msg.includes('blocked')) {
    return {
      code: 'SAFETY_BLOCK',
      message: 'Invasive Thought Inhibited',
      details: 'Content filtered by safety protocols.',
      retryable: false
    };
  }
  return {
    code: 'UNKNOWN',
    message: 'Cognitive Dissonance',
    details: msg || 'Unknown Error',
    retryable: true
  };
};

export const withRetry = async <T>(operation: () => Promise<T>, retries = 2, delay = 1000): Promise<T> => {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Offline');
    }
    return await operation();
  } catch (e: any) {
    if (retries > 0) {
      const mapped = mapError(e);
      if (mapped.retryable) {
        console.warn(`Retrying operation... (${retries} left). Cause: ${mapped.details}`);
        await new Promise((res) => setTimeout(res, delay));
        return withRetry(operation, retries - 1, delay * 2);
      }
    }
    throw mapError(e);
  }
};
