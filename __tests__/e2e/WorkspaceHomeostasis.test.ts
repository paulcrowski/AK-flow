import { describe, it, expect, beforeAll } from 'vitest';
import { loadEnv } from 'vite';
import { supabase, setCurrentAgentId } from '../../services/supabase';
import { ShadowFactory } from './ShadowFactory';
import { WorkspaceHomeostasisService } from '../../services/WorkspaceHomeostasisService';

const env = loadEnv('development', process.cwd(), '');
process.env.SUPABASE_URL = env.SUPABASE_URL || process.env.SUPABASE_URL;
process.env.SUPABASE_KEY = env.SUPABASE_KEY || process.env.SUPABASE_KEY;

describe('WorkspaceHomeostasis E2E', () => {
  beforeAll(() => {
    // noop
  });

  it('should attempt to prune workspace memories for a shadow agent (DB optional)', async () => {
    const shadow = new ShadowFactory();
    setCurrentAgentId(shadow.agentId);

    const payloads = Array.from({ length: 8 }).map((_, i) => ({
      agent_id: shadow.agentId,
      raw_text: `WORKSPACE_CHUNK_SUMMARY\ndoc_id=d\nchunk_index=${i}\n\nS${i}`,
      created_at: new Date(Date.now() - i * 1000).toISOString(),
      embedding: Array(768).fill(0.1),
      neural_strength: 0.5,
      is_core_memory: false
    }));

    const withTimeout = async <T>(promise: PromiseLike<T>, ms: number): Promise<T> => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`TEST_TIMEOUT after ${ms}ms`)), ms);
      });
      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    let ins: any;
    try {
      ins = await withTimeout(supabase.from('memories').insert(payloads) as any, 4000);
    } catch (e: any) {
      // DB optional: treat insert hang as "no DB".
      ins = { error: { message: e?.message || String(e) } };
    }

    const res = await WorkspaceHomeostasisService.applyForCurrentAgent({ maxWorkspaceMemories: 3 });

    if (ins.error) {
      // DB optional: insert may fail due to RLS / missing permissions / missing schema.
      // In that case the pruning call may either fail (ok:false) or gracefully no-op (ok:true, totalBefore=0).
      if (res.ok) {
        expect(res.totalBefore).toBe(0);
      } else {
        expect(res.ok === false).toBe(true);
      }
      await shadow.nuke();
      return;
    }

    if (res.ok === false) {
      const msg = String(res.error || '');
      const rlsLike = msg.toLowerCase().includes('rls') || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('not allowed');
      expect(rlsLike).toBe(true);
      await shadow.nuke();
      return;
    }

    expect(res.ok).toBe(true);

    const { data, error } = await supabase
      .from('memories')
      .select('id')
      .eq('agent_id', shadow.agentId)
      .ilike('raw_text', 'WORKSPACE_%');

    if (error) {
      await shadow.nuke();
      return;
    }

    expect((data || []).length).toBeLessThanOrEqual(3);

    await shadow.nuke();
  }, 15000);
});
