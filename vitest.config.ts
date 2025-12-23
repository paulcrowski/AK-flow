import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment - jsdom for React components and hooks
    environment: 'jsdom',
    globals: true,
    setupFiles: './__tests__/setup.ts',
    
    // Test coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/core/**', 'src/services/**', 'src/utils/**', 'src/llm/**', 'src/tools/**', 'src/runtime/**'],
      exclude: ['**/*.d.ts', '**/index.ts', '**/types/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    
    // Test organization
    include: ['__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    
    // Test execution settings
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Reporters
    reporters: ['default'],
    outputFile: './test-results.json',
    
    // Performance settings
    isolate: true,
    fileParallelism: true,
    maxWorkers: 4
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@llm': path.resolve(__dirname, './src/llm'),
      '@tools': path.resolve(__dirname, './src/tools'),
      '@runtime': path.resolve(__dirname, './src/runtime'),
      '@tests': path.resolve(__dirname, '__tests__')
    }
  }
});