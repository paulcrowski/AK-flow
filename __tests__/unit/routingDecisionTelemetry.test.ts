import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventBus } from '@core/EventBus';
import { PacketType } from '@/types';
import { detectFileIntentForTesting } from '@core/systems/eventloop/ReactiveStep';
import { getWorldDirectorySelection } from '@tools/worldDirectoryAccess';

vi.mock('@services/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/supabase')>();
  return {
    ...actual,
    getCurrentAgentId: vi.fn().mockReturnValue('test-agent')
  };
});

vi.mock('@tools/worldDirectoryAccess', () => ({
  getWorldDirectorySelection: vi.fn().mockReturnValue({ mode: 'world', name: '_world' })
}));

describe('routing decision telemetry', () => {
  beforeEach(() => {
    eventBus.clear();
    vi.mocked(getWorldDirectorySelection).mockReturnValue({ mode: 'world', name: '_world' } as any);
  });

  it('emits ROUTING_DECISION for world reads', () => {
    const result = detectFileIntentForTesting('przeczytaj /code/README.md');

    expect(result).toBeNull();

    const history = eventBus.getHistory();
    const decision = history.find((p) => (p as any)?.payload?.event === 'ROUTING_DECISION');

    expect(decision).toBeTruthy();
    expect(decision?.type).toBe(PacketType.SYSTEM_ALERT);
    expect((decision as any)?.payload?.domain).toBe('WORLD');
    expect((decision as any)?.payload?.reason).toBe('world_path');
    expect((decision as any)?.payload?.parsedTarget).toBe('/code/README.md');
    expect((decision as any)?.payload?.tool).toBe('READ_FILE');
  });

  it('emits ROUTING_DECISION for library reads', () => {
    const result = detectFileIntentForTesting('przeczytaj ksiazke Reinforcement Learning');

    expect(result?.action).toBe('READ');
    expect((result as any)?.domain).toBe('LIBRARY');

    const history = eventBus.getHistory();
    const decision = history.find((p) => (p as any)?.payload?.event === 'ROUTING_DECISION');

    expect(decision).toBeTruthy();
    expect(decision?.type).toBe(PacketType.SYSTEM_ALERT);
    expect((decision as any)?.payload?.domain).toBe('LIBRARY');
    expect((decision as any)?.payload?.reason).toBe('library_keyword');
    expect((decision as any)?.payload?.parsedTarget).toBe('ksiazke Reinforcement Learning');
    expect((decision as any)?.payload?.tool).toBe('READ_LIBRARY_DOC');
  });

  it('emits ROUTING_DECISION for artifact reads', () => {
    const result = detectFileIntentForTesting('pokaz art-123');

    expect(result?.action).toBe('READ');

    const history = eventBus.getHistory();
    const decision = history.find((p) => (p as any)?.payload?.event === 'ROUTING_DECISION');

    expect(decision).toBeTruthy();
    expect(decision?.type).toBe(PacketType.SYSTEM_ALERT);
    expect((decision as any)?.payload?.domain).toBe('ARTIFACT');
    expect((decision as any)?.payload?.reason).toBe('artifact_ref');
    expect((decision as any)?.payload?.parsedTarget).toBe('art-123');
    expect((decision as any)?.payload?.tool).toBe('READ_ARTIFACT');
  });
});
