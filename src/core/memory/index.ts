/**
 * Memory Module - Unified Memory Layer for AK-FLOW
 * 
 * EXPORTS:
 * - ConversationStore: localStorage + Supabase conversation management
 * - MemorySpace: semantic search + TTL cache (re-export)
 * 
 * @module core/memory
 */

// Conversation Store (localStorage cache + Supabase fallback)
export {
  loadConversation,
  saveConversation,
  clearConversation,
  parseConversation,
  syncToLocalStorage,
  type ConversationTurn,
  type LoadResult
} from './ConversationStore';

// Memory Space (semantic search + cache) - re-export from systems
export {
  createMemorySpace,
  TTLCache,
  type MemorySpace,
  type SemanticSearchProvider
} from '../systems/MemorySpace';
