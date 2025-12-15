/**
 * Global Test Setup
 * 
 * This file runs before all tests and sets up the test environment
 */

import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll } from 'vitest';
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder for jsdom/esbuild compatibility
// The instance check fails if output is Node's Buffer but expected is JSDOM's Uint8Array
global.TextEncoder = class TextEncoder extends NodeTextEncoder {
  encode(input?: string): Uint8Array {
    const result = super.encode(input);
    return new Uint8Array(result); // Convert to global Uint8Array
  }
} as any;

global.TextDecoder = NodeTextDecoder as any;

// ═══════════════════════════════════════════════════════════════════════════
// JSDOM MOCKS - Browser APIs not available in jsdom
// ═══════════════════════════════════════════════════════════════════════════

// Mock matchMedia (nie istnieje w jsdom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock scrollTo
window.scrollTo = vi.fn();

// ═══════════════════════════════════════════════════════════════════════════
// CONSOLE FILTERING
// ═══════════════════════════════════════════════════════════════════════════

// Mock console methods to reduce noise during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (message) => {
    if (typeof message === 'string' &&
      (message.includes('Warning:') ||
        message.includes('Deprecation') ||
        message.includes('act('))) {
      return; // Skip common warnings
    }
    originalConsoleError(message);
  };

  console.warn = (message) => {
    if (typeof message === 'string' &&
      (message.includes('Warning:') ||
        message.includes('Deprecation'))) {
      return; // Skip common warnings
    }
    originalConsoleWarn(message);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
globalThis.testUtils = {
  async waitFor(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  createMockFunction<T extends (...args: unknown[]) => unknown>(fn: T) {
    return vi.fn(fn);
  }
};

declare global {
  var testUtils: {
    waitFor: (ms: number) => Promise<void>;
    createMockFunction: <T extends (...args: unknown[]) => unknown>(fn: T) => ReturnType<typeof vi.fn>;
  };
}