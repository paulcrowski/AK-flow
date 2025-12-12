/**
 * Global Test Setup
 * 
 * This file runs before all tests and sets up the test environment
 */

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
  
  createMockFunction<T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> {
    return jest.fn(fn) as jest.MockedFunction<T>;
  }
};

declare global {
  var testUtils: {
    waitFor: (ms: number) => Promise<void>;
    createMockFunction: <T extends (...args: any[]) => any>(fn: T) => jest.MockedFunction<T>;
  };
}