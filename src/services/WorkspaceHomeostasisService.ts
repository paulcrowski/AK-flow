import type { PostgrestResponse } from '@supabase/supabase-js';
import { supabase, getCurrentAgentId } from './supabase';
import { clampInt } from '../utils/math';

type ApplyHomeostasisResult =
  | {
      ok: true;
      agentId: string;
      maxWorkspaceMemories: number;
      totalBefore: number;
      deletedCount: number;
    }
  | {
      ok: false;
      agentId: string;
      error: string;
    };

function isWorkspaceRawText(rawText: string): boolean {
  const t = String(rawText || '').trimStart();
  return t.startsWith('WORKSPACE_DOC_SUMMARY') || t.startsWith('WORKSPACE_CHUNK_SUMMARY');
}

async function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

type WorkspaceMemoryRow = {
  id: string;
  raw_text: string | null;
  created_at: string;
};

export const WorkspaceHomeostasisService = {
  async applyForCurrentAgent(params?: {
    maxWorkspaceMemories?: number;
  }): Promise<ApplyHomeostasisResult> {
    const agentId = getCurrentAgentId();
    if (!agentId) {
      return { ok: false, agentId: 'NO_AGENT', error: 'No agent selected' };
    }

    return this.applyForAgent(agentId, params);
  },

  async applyForAgent(
    agentId: string,
    params?: {
      maxWorkspaceMemories?: number;
    }
  ): Promise<ApplyHomeostasisResult> {
    const maxWorkspaceMemories = clampInt(params?.maxWorkspaceMemories ?? 400, 50, 5000);
    const requestTimeoutMs = 3000;

    try {
      // v1: robust classification by raw_text prefix (works even if metadata column is missing)
      const pageSize = 500;
      let offset = 0;
      let totalBefore = 0;
      const toDeleteIds: string[] = [];

      while (true) {
        const selectQuery = supabase
          .from('memories')
          .select('id,raw_text,created_at')
          .eq('agent_id', agentId)
          .ilike('raw_text', 'WORKSPACE_%')
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        const res = await withTimeout(
          selectQuery as unknown as PromiseLike<PostgrestResponse<WorkspaceMemoryRow>>,
          requestTimeoutMs,
          'WorkspaceHomeostasisService.select'
        );

        if (res.error) {
          return { ok: false, agentId, error: res.error.message };
        }

        const rows = res.data || [];
        if (rows.length === 0) break;

        for (const row of rows) {
          if (!row?.id) continue;
          if (!isWorkspaceRawText(String(row.raw_text || ''))) continue;

          totalBefore += 1;
          if (totalBefore > maxWorkspaceMemories) {
            toDeleteIds.push(String(row.id));
          }
        }

        if (rows.length < pageSize) break;
        offset += pageSize;
      }

      if (toDeleteIds.length === 0) {
        return {
          ok: true,
          agentId,
          maxWorkspaceMemories,
          totalBefore,
          deletedCount: 0
        };
      }

      // Delete in safe batches (avoid oversized IN queries)
      const batchSize = 100;
      let deletedCount = 0;

      for (let i = 0; i < toDeleteIds.length; i += batchSize) {
        const batch = toDeleteIds.slice(i, i + batchSize);

        const deleteQuery = supabase
          .from('memories')
          .delete()
          .eq('agent_id', agentId)
          .in('id', batch);

        const del = await withTimeout(
          deleteQuery as unknown as PromiseLike<PostgrestResponse<null>>,
          requestTimeoutMs,
          'WorkspaceHomeostasisService.delete'
        );

        if (del.error) {
          return { ok: false, agentId, error: del.error.message };
        }

        deletedCount += batch.length;
      }

      return {
        ok: true,
        agentId,
        maxWorkspaceMemories,
        totalBefore,
        deletedCount
      };
    } catch (e: any) {
      return {
        ok: false,
        agentId,
        error: e?.message || String(e)
      };
    }
  }
};
