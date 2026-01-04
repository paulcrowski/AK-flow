import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { buildWitnessFrame } from '@core/systems/WitnessSystem';
import { detectBeliefViolation } from '@core/systems/CoreBeliefs';
import { selectAction } from '@core/systems/ActionSelector';
import { createSchemaFromObservation } from '@core/memory/SchemaBuilder';
import { SchemaStore } from '@core/memory/SchemaStore';
import { performSleepCycle } from '@core/systems/SleepSystem';
import { TensionRegistry } from '@core/systems/TensionRegistry';
import { executeWorldTool } from '@tools/workspaceTools';
import { DEFAULT_AGENT_ID, getAgentWorldRoot } from '@core/systems/WorldAccess';

describe('SiliconBeing core systems', () => {
  it('clamps witness frame chunks to max 5', () => {
    const chunkCandidates = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      summary: `chunk-${i}`,
      relevance: 1 - i * 0.1,
      type: 'observation' as const
    }));

    const frame = buildWitnessFrame({
      energyBudget: 80,
      contextPressure: 0.2,
      beliefViolation: null,
      tensions: [],
      evidenceCount: 1,
      chunkCandidates
    });

    expect(frame.activeChunks.length).toBe(5);
  });

  it('detects truth violation when evidence is missing', () => {
    const violation = detectBeliefViolation({
      memoryCoherence: 1,
      evidenceCount: 0,
      learningOpportunity: false,
      taskPending: false
    });

    expect(violation?.belief).toBe('truth');
    expect(violation?.severity ?? 0).toBeGreaterThanOrEqual(0.8);
  });

  it('readiness drops when context pressure increases', () => {
    const lowPressure = buildWitnessFrame({
      energyBudget: 80,
      contextPressure: 0.1,
      beliefViolation: null,
      tensions: [],
      evidenceCount: 2,
      chunkCandidates: []
    });

    const highPressure = buildWitnessFrame({
      energyBudget: 80,
      contextPressure: 0.9,
      beliefViolation: null,
      tensions: [],
      evidenceCount: 2,
      chunkCandidates: []
    });

    expect(highPressure.readinessToAct).toBeLessThan(lowPressure.readinessToAct);
  });

  it('caps schema attributes at 3', () => {
    const schema = createSchemaFromObservation({
      concept: 'TestSchema',
      observation: 'has_alpha is_beta uses_gamma contains_delta sizeLimit maxCount',
      evidenceRef: 'ev_1'
    });

    expect(schema?.attributes.length ?? 0).toBeLessThanOrEqual(3);
  });

  it('saves schema and writes history on update', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'akflow-schema-'));
    const store = new SchemaStore(tempRoot);
    const now = Date.now();
    const schema = {
      id: 'test_schema',
      concept: 'Test',
      attributes: [],
      relations: [],
      confidence: 0.5,
      usageCount: 0,
      revision: 1,
      evidenceRefs: ['ev_1'],
      createdAt: now,
      updatedAt: now
    };

    await store.save(schema);

    const filePath = path.join(tempRoot, 'knowledge', 'schemas', 'test_schema.json');
    const raw = await fs.readFile(filePath, 'utf8');
    expect(raw).toContain('"id": "test_schema"');

    schema.usageCount = 1;
    await store.save(schema);

    const historyDir = path.join(tempRoot, 'knowledge', 'schemas', '_history', 'test_schema');
    const historyFiles = await fs.readdir(historyDir);
    expect(historyFiles.length).toBeGreaterThan(0);
  });

  it('sleep cycle selects tension and writes a log', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'akflow-sleep-'));
    const store = new SchemaStore(tempRoot);
    const registry = new TensionRegistry();
    registry.upsert('memory_coherence_low', 'continuity', 0.7);

    const result = await performSleepCycle({
      store,
      usedSchemaIds: [],
      tensionRegistry: registry,
      errors: []
    });

    expect(result.selectedTensionForTomorrow).toBe('memory_coherence_low');

    const logDir = path.join(tempRoot, 'experiments', 'sleep_logs');
    const logs = await fs.readdir(logDir);
    expect(logs.length).toBeGreaterThan(0);
  });

  it('selects observe when evidence is missing', () => {
    const result = selectAction({
      intention: null,
      drive: 'truth',
      readiness: 0.8,
      energy: 80,
      evidenceCount: 0
    });

    expect(result.action).toBe('observe');
  });

  it('rejects notes without claim/evidence/next', async () => {
    const noteDir = path.join(getAgentWorldRoot(DEFAULT_AGENT_ID), 'notes');
    await fs.mkdir(noteDir, { recursive: true });
    const notePath = path.join(noteDir, `test_${Date.now()}.md`);

    const bad = await executeWorldTool({
      tool: 'WRITE_FILE',
      path: notePath,
      content: 'random thoughts',
      agentId: DEFAULT_AGENT_ID
    });

    expect(bad.ok).toBe(false);
    expect(bad.error).toBe('INVALID_NOTE_FORMAT');

    const good = await executeWorldTool({
      tool: 'WRITE_FILE',
      path: notePath,
      content: 'claim: X\nevidence: ev_1\nnext: Y',
      agentId: DEFAULT_AGENT_ID
    });

    expect(good.ok).toBe(true);
  });
});
