
import { createClient } from '@supabase/supabase-js';
import { MemoryTrace } from '../types';
import { CortexService } from './gemini';
import { RLSDiagnostics } from './RLSDiagnostics';
import { eventBus } from '../core/EventBus';
import { AgentType, PacketType } from '../types';
import { generateUUID } from '../utils/uuid';

const getEnv = (key: string) => typeof process !== 'undefined' ? process.env[key] : undefined;
const SUPABASE_URL = getEnv('SUPABASE_URL') || 'https://qgnpsfoauhvddbxsoikj.supabase.co';
const SUPABASE_KEY = getEnv('SUPABASE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbnBzZm9hdWh2ZGRieHNvaWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjY5NDEsImV4cCI6MjA3OTIwMjk0MX0.ZuCrnI6cFb_lD8U3th5zkMAXeEj-iohnmjq0pEEGEfI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

if (
  typeof window !== 'undefined' &&
  typeof import.meta !== 'undefined' &&
  Boolean((import.meta as any).env?.DEV)
) {
  (globalThis as any).__ak_supabase = supabase;
}

const sanitizeJson = (input: unknown): Record<string, any> => {
  if (!input || typeof input !== 'object') return {};
  try {
    return JSON.parse(JSON.stringify(input)) as Record<string, any>;
  } catch {
    return {};
  }
};

// Compression Utility
const compressNeuralImage = async (base64Str: string): Promise<string | null> => {
    return new Promise((resolve) => {
        if (typeof document === 'undefined') { resolve(null); return; }
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(null); return; }
            const MAX_WIDTH = 800;
            const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.5));
        };
        img.onerror = () => resolve(null);
    });
};

// Current agent context - set by SessionContext
let currentAgentId: string | null = null;

// Current owner context (auth.uid) - set by SessionContext
let currentOwnerId: string | null = null;

export const setCurrentAgentId = (agentId: string | null) => {
  currentAgentId = agentId;
  console.log('[MemoryService] Agent ID set to:', agentId);
};

export const getCurrentAgentId = () => currentAgentId;

export const setCurrentOwnerId = (ownerId: string | null) => {
  currentOwnerId = ownerId;
  console.log('[MemoryService] Owner ID set to:', ownerId);
};

export const getCurrentOwnerId = () => currentOwnerId;

export const MemoryService = {
  async storeMemory(memory: MemoryTrace): Promise<boolean> {
    try {
      if (!currentAgentId) {
        console.warn('[MemoryService] No agent selected, skipping memory store');
        return false;
      }

      if (memory.id) {
        try {
          const existing = await supabase
            .from('memories')
            .select('id')
            .eq('agent_id', currentAgentId)
            .eq('event_id', memory.id)
            .limit(1);

          if (!existing.error && Array.isArray(existing.data) && existing.data.length > 0) {
            return true;
          }
        } catch {
          // ignore dedupe errors (schema mismatch / missing column)
        }
      }

      const wantsEmbedding = !memory.skipEmbedding;

      const embedding = wantsEmbedding
        ? await CortexService.generateEmbedding(memory.content)
        : null;

      if (wantsEmbedding && !embedding) throw new Error("Embedding generation failed");

      // Compression
      let optimizedImage: string | null = null;
      if (memory.imageData) {
          optimizedImage = await compressNeuralImage(memory.imageData);
      }

      const basePayload = {
        agent_id: currentAgentId,
        raw_text: `${memory.content} [Emotion: ${JSON.stringify(memory.emotionalContext)}]`,
        created_at: new Date().toISOString(),
        embedding: embedding,
        neural_strength: memory.neuralStrength ?? 1,
        is_core_memory: memory.isCoreMemory ?? false,
        last_accessed_at: new Date().toISOString(),
        event_id: memory.id
      };

      const wantsMetadata = Boolean(memory.metadata && typeof memory.metadata === 'object' && Object.keys(memory.metadata as any).length > 0);
      const metadataSafe = wantsMetadata ? sanitizeJson(memory.metadata) : {};

      // V3.2 Extended Payload (metadata + optional image/dream)
      const extendedPayloadV32 = {
        ...basePayload,
        ...(currentOwnerId ? { owner_id: currentOwnerId } : {}),
        metadata: metadataSafe,
        image_data: optimizedImage || null,
        is_visual_dream: Boolean(memory.isVisualDream)
      };

      // ATTEMPT 1: Try Extended Insert (V3.2)
      const resultV32 = await supabase.from('memories').insert([extendedPayloadV32]);

      if (resultV32.error) {
        if (wantsMetadata) {
          eventBus.publish({
            id: generateUUID(),
            timestamp: Date.now(),
            source: AgentType.CORTEX_FLOW,
            type: PacketType.SYSTEM_ALERT,
            payload: {
              event: 'MEMORY_STORE_MODE',
              mode: 'v32_fail',
              error: resultV32.error.message
            },
            priority: 0.2
          });
        }
        console.warn(
          'Database Schema Mismatch (V3.2 columns may be missing). Attempting V3.1 Fallback. Error:',
          resultV32.error.message
        );

        // ATTEMPT 2: Fallback to Extended Payload (V3.1: image_data + is_visual_dream)
        const extendedPayloadV31 = {
          ...basePayload,
          ...(currentOwnerId ? { owner_id: currentOwnerId } : {}),
          image_data: optimizedImage || null,
          is_visual_dream: Boolean(memory.isVisualDream)
        };

        const resultV31 = await supabase.from('memories').insert([extendedPayloadV31]);

        if (resultV31.error) {
          if (wantsMetadata) {
            eventBus.publish({
              id: generateUUID(),
              timestamp: Date.now(),
              source: AgentType.CORTEX_FLOW,
              type: PacketType.SYSTEM_ALERT,
              payload: {
                event: 'MEMORY_STORE_MODE',
                mode: 'v31_fail',
                error: resultV31.error.message
              },
              priority: 0.2
            });
          }
          console.warn(
            'Database Schema Mismatch (V3.1 columns may be missing). Attempting V3.0 Fallback. Error:',
            resultV31.error.message
          );

          // ATTEMPT 3: Fallback to Base Payload (V3.0 Compatibility Mode)
          const fallbackResult = await supabase.from('memories').insert([basePayload]);

          if (fallbackResult.error) {
            console.error('Critical: Fallback Memory Insert also failed:', fallbackResult.error.message);
            return false;
          }

          console.log('Fallback Insert Successful (Legacy Mode)');
          if (wantsMetadata) {
            eventBus.publish({
              id: generateUUID(),
              timestamp: Date.now(),
              source: AgentType.CORTEX_FLOW,
              type: PacketType.SYSTEM_ALERT,
              payload: {
                event: 'MEMORY_STORE_MODE',
                mode: 'v30_ok'
              },
              priority: 0.2
            });
          }
          return true;
        }

        console.log('Fallback Insert Successful (V3.1 Mode)');
        if (wantsMetadata) {
          eventBus.publish({
            id: generateUUID(),
            timestamp: Date.now(),
            source: AgentType.CORTEX_FLOW,
            type: PacketType.SYSTEM_ALERT,
            payload: {
              event: 'MEMORY_STORE_MODE',
              mode: 'v31_ok'
            },
            priority: 0.2
          });
        }
        return true;
      }

      if (wantsMetadata) {
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.SYSTEM_ALERT,
          payload: {
            event: 'MEMORY_STORE_MODE',
            mode: 'v32_ok'
          },
          priority: 0.2
        });
      }
      return true;
      
    } catch (error: any) {
      // FIX: Robust error serialization and swallowing so app doesn't crash
      let errorMsg = "Unknown DB Error";
      try {
        errorMsg = (error instanceof Error) ? error.message : JSON.stringify(error);
      } catch { errorMsg = "Unserializable DB Error"; }
      
      console.error(`Memory Store Error (Handled): ${errorMsg}`);
      return false;
    }
  },

  async recallRecent(limit: number = 5) {
    try {
      if (!currentAgentId) {
        console.warn('[MemoryService] No agent selected, returning empty');
        return [];
      }
      
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .eq('agent_id', currentAgentId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
          console.warn("Recall Error (ignoring):", error.message);
          return [];
      }
      
      const result = { data, error };

      return (result.data || []).map(item => ({
        id: item.id,
        content: item.raw_text,
        timestamp: item.created_at,
        emotionalContext: { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 },
        neuralStrength: item.neural_strength || 1,
        isCoreMemory: item.is_core_memory || false,
        // Safe access for optional columns with robust fallbacks
        imageData: item.image_data || undefined,
        isVisualDream: item.is_visual_dream ? Boolean(item.is_visual_dream) : false
      }));
    } catch (error) {
      console.error("Recall Error", error);
      return [];
    }
  },

  async semanticSearch(query: string) {
    try {
      if (!currentAgentId) {
        console.warn('[MemoryService] No agent selected, returning empty');
        return [];
      }
      
      const embedding = await CortexService.generateEmbedding(query);
      if (!embedding) return [];

      // Use RLS diagnostics for RPC calls
      const result = await supabase.rpc('match_memories_for_agent', {
        query_embedding: embedding,
        p_agent_id: currentAgentId,
        match_threshold: 0.4,
        match_count: 4
      });
      
      // Apply RLS diagnostics to RPC result
      const diagnosedResult = RLSDiagnostics.diagnoseQuery(
        Promise.resolve(result),
        'semanticSearch'
      );
      
      const diagnosed = await diagnosedResult;
      
      if (diagnosed.error) {
           console.warn("Semantic Search Error (ignoring):", diagnosed.error.message);
           return [];
      }
      
      // Check for RLS issues
      if (diagnosed.isRLSIssue) {
          console.warn("RLS DIAGNOSTIC:", diagnosed.rlsMessage);
      }

      return (diagnosed.data || []).map((item: any) => ({
        id: item.id,
        content: item.raw_text,
        timestamp: new Date().toISOString(),
        emotionalContext: { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 },
        neuralStrength: item.neural_strength || 1,
        imageData: item.image_data || undefined,
        isVisualDream: item.is_visual_dream ? Boolean(item.is_visual_dream) : false
      }));
    } catch (error) {
        // Silent fail for search to not block chat
        return [];
    }
  }
};
