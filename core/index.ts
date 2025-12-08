/**
 * Core Module - Main Barrel Export
 * 
 * Centralne eksporty dla Persona-Less Cortex Architecture.
 * 
 * @module core
 */

// === Types ===
export * from './types';

// === Config ===
export * from './config';

// === Services ===
export * from './services';

// === Builders ===
export * from './builders';

// === Inference ===
export * from './inference';

// === Prompts ===
export { 
  MINIMAL_CORTEX_SYSTEM_PROMPT,
  CORTEX_OUTPUT_SCHEMA,
  formatCortexStateForLLM 
} from './prompts/MinimalCortexPrompt';

// === Event Bus (existing) ===
export { eventBus } from './EventBus';
