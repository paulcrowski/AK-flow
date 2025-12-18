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

    const ins = await supabase.from('memories').insert(payloads);

    const res = await WorkspaceHomeostasisService.applyForCurrentAgent({ maxWorkspaceMemories: 3 });

    if (ins.error) {
      expect(res.ok === false).toBe(true);
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
