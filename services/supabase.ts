
import { createClient } from '@supabase/supabase-js';
import { MemoryTrace } from '../types';
import { CortexService } from './gemini';
import { RLSDiagnostics } from './RLSDiagnostics';

const getEnv = (key: string) => typeof process !== 'undefined' ? process.env[key] : undefined;
const SUPABASE_URL = getEnv('SUPABASE_URL') || 'https://qgnpsfoauhvddbxsoikj.supabase.co';
const SUPABASE_KEY = getEnv('SUPABASE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbnBzZm9hdWh2ZGRieHNvaWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjY5NDEsImV4cCI6MjA3OTIwMjk0MX0.ZuCrnI6cFb_lD8U3th5zkMAXeEj-iohnmjq0pEEGEfI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

export const setCurrentAgentId = (agentId: string | null) => {
  currentAgentId = agentId;
  console.log('[MemoryService] Agent ID set to:', agentId);
};

export const getCurrentAgentId = () => currentAgentId;

export const MemoryService = {
  async storeMemory(memory: MemoryTrace) {
    try {
      if (!currentAgentId) {
        console.warn('[MemoryService] No agent selected, skipping memory store');
        return;
      }
      
      const embedding = await CortexService.generateEmbedding(memory.content);
      
      if (!embedding) throw new Error("Embedding generation failed");

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

      // V3.1 Extended Payload
      const extendedPayload = {
          ...basePayload,
          image_data: optimizedImage || null,
          is_visual_dream: Boolean(memory.isVisualDream)
      };

      // ATTEMPT 1: Try Extended Insert (V3.1)
      // We explicitly ignore the error inside the query builder and handle it in the catch/check block
      const result = await supabase.from('memories').insert([extendedPayload]);
      
      if (result.error) {
          // Log but don't crash yet
          console.warn("Database Schema Mismatch (V3.1 columns may be missing). Attempting V3.0 Fallback. Error:", result.error.message);
          
          // ATTEMPT 2: Fallback to Base Payload (V3.0 Compatibility Mode)
          const fallbackResult = await supabase.from('memories').insert([basePayload]);
          
          if (fallbackResult.error) {
              console.error("Critical: Fallback Memory Insert also failed:", fallbackResult.error.message);
              // Swallow error to keep agent alive
          } else {
              console.log("Fallback Insert Successful (Legacy Mode)");
          }
      }
      
    } catch (error: any) {
      // FIX: Robust error serialization and swallowing so app doesn't crash
      let errorMsg = "Unknown DB Error";
      try {
        errorMsg = (error instanceof Error) ? error.message : JSON.stringify(error);
      } catch { errorMsg = "Unserializable DB Error"; }
      
      console.error(`Memory Store Error (Handled): ${errorMsg}`);
    }
  },

  async recallRecent(limit: number = 5) {
    try {
      if (!currentAgentId) {
        console.warn('[MemoryService] No agent selected, returning empty');
        return [];
      }
      
      // Use RLS diagnostics wrapper
      const result = await supabase
        .from('memories')
        .select('*')
        .eq('agent_id', currentAgentId)
        .order('created_at', { ascending: false })
        .limit(limit)
        .withRLSDiagnostics('recallRecent');
      
      if (result.error) {
          console.warn("Recall Error (ignoring):", result.error.message);
          return [];
      }
      
      // Check for RLS issues
      if (result.isRLSIssue) {
          console.warn("RLS DIAGNOSTIC:", result.rlsMessage);
          // You could add user feedback here or trigger a re-authentication flow
      }

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
