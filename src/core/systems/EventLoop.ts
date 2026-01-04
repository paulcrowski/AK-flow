/**
 * EventLoop.ts - The Central Cognitive Cycle
 * 
 * Responsibility: Orchestrates the cognitive loop, managing state transitions,
 * input processing, and autonomous behavior with safety limits.
 */

import { LimbicState, SomaState, NeurotransmitterState, AgentType, PacketType, GoalState, Goal, TraitVector } from '../../types';
import type { SocialDynamics } from '../kernel/types';
import { LimbicSystem } from './LimbicSystem';
import { CortexSystem, ConversationTurn } from './CortexSystem';
import type { CortexSystem as CortexSystemNS } from './CortexSystem';
import { CortexService } from '../../llm/gemini';
import { eventBus } from '../EventBus';
import * as GoalSystem from './GoalSystem';
import { GoalContext } from './GoalSystem';
import { ExecutiveGate } from './ExecutiveGate';
import { UserStylePrefs } from './StyleGuard';
import { TraceContext, generateTraceId, pushTraceId, popTraceId } from '../trace/TraceContext';
import { getCurrentAgentId } from '../../services/supabase';
import { createMemorySpace } from './MemorySpace';
import { TickCommitter } from './TickCommitter';
import { publishTickStart, publishTickSkipped, publishThinkModeSelected, publishTickEnd, p0MetricStartTick, publishP0Metric } from './TickLifecycleTelemetry';
import { isMainFeatureEnabled } from '../config/featureFlags';
import { SYSTEM_CONFIG } from '../config/systemConfig';
import { ThinkModeSelector, createAutonomyBudgetTracker, createTickTraceScope, runAutonomousVolitionStep, runReactiveStep, runGoalDrivenStep } from './eventloop/index';
import type { ChunkRef, Tension as WitnessTension } from '../types/WitnessTypes';
import { buildWitnessFrame } from './WitnessSystem';
import { detectBeliefViolation } from './CoreBeliefs';
import { evidenceLedger } from './EvidenceLedger';
import { tensionRegistry, type TensionItem } from './TensionRegistry';
import { formIntention } from './IntentionSystem';
import { selectAction, type ActionType } from './ActionSelector';
import { SchemaStore, type Schema } from '../memory/SchemaStore';
import { createSchemaFromObservation } from '../memory/SchemaBuilder';
import { DEFAULT_AGENT_ID, getAgentWorldRoot } from './WorldAccess';
import { executeWorldTool } from '../../tools/workspaceTools';
import { generateUUID } from '../../utils/uuid';
import { promises as fs } from 'fs';
import path from 'path';

export namespace EventLoop {
    export type ThinkMode = 'reactive' | 'goal_driven' | 'autonomous' | 'idle';

    export interface LoopContext {
        soma: SomaState;
        limbic: LimbicState;
        neuro: NeurotransmitterState; // NEW: Chemical state
        conversation: ConversationTurn[];
        autonomousMode: boolean;
        lastSpeakTimestamp: number;
        silenceStart: number;
        thoughtHistory: string[];
        poeticMode: boolean; // NEW: Track if user requested poetic style
        autonomousLimitPerMinute: number; // Budget limit for autonomous operations
        chemistryEnabled?: boolean; // Feature flag for Chemical Soul
        goalState: GoalState;
        traitVector: TraitVector; // NEW: Temperament / personality vector (FAZA 4)
        lastSpeechNovelty?: number; // FAZA 4.5: Novelty of last speech for boredom detection
        consecutiveAgentSpeeches: number; // FAZA 4.5: Narcissism Loop Fix - ile razy agent mówił bez odpowiedzi usera
        // FAZA 5: Dynamic Persona
        agentIdentity?: CortexSystemNS.AgentIdentityContext;
        sessionOverlay?: CortexSystemNS.SessionOverlay;
        // FAZA 5.1: RPE (Reward Prediction Error) tracking
        ticksSinceLastReward: number;
        hadExternalRewardThisTick: boolean;
        // FAZA 6: Social Dynamics (Soft Homeostasis)
        socialDynamics?: SocialDynamics;
        // FAZA 6: User Style Preferences (Style Contract)
        userStylePrefs?: UserStylePrefs;
    }

    // Module-level Budget Tracking (counters only, limit is in context)
    const budgetTracker = createAutonomyBudgetTracker({
        onExhausted: () => {
            console.warn("Autonomy budget exhausted for this minute, skipping.");
        }
    });
    let tickCount = 0;
    const fileLookupCache = new Map<string, string>();
    const schemaStores = new Map<string, SchemaStore>();
    const pendingWakeObserve = { key: null as string | null };

    const FILE_REF_REGEX = /([A-Za-z]:[\\/][^\s]+|\/[^\s]+|[A-Za-z0-9._-]+\.[A-Za-z0-9]{1,8})/;
    const EVIDENCE_QUERY_REGEX = /\b(co jest w|co zawiera|zawartosc|show|what is in|open|read|file|plik)\b/i;
    const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'ak-nexus', 'database', '_patches', '_workbench']);
    const safeCwd = typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '';

    const getSchemaStore = (worldRoot: string) => {
        const existing = schemaStores.get(worldRoot);
        if (existing) return existing;
        const store = new SchemaStore(worldRoot);
        schemaStores.set(worldRoot, store);
        return store;
    };

    const questionRequiresEvidence = (input: string) => {
        const normalized = String(input || '').toLowerCase();
        if (FILE_REF_REGEX.test(normalized)) return true;
        return EVIDENCE_QUERY_REGEX.test(normalized);
    };

    const extractFileTarget = (input: string | null): string | null => {
        if (!input) return null;
        const match = String(input).match(FILE_REF_REGEX);
        if (!match?.[1]) return null;
        return match[1].replace(/[),.;:]+$/, '');
    };

    const findFileByName = async (
        root: string,
        target: string,
        depth: number,
        state: { count: number }
    ): Promise<string | null> => {
        if (depth > 6 || state.count > 2000) return null;
        let entries: any[] = [];
        try {
            entries = await fs.readdir(root, { withFileTypes: true });
        } catch {
            return null;
        }
        for (const entry of entries) {
            if (state.count > 2000) return null;
            state.count += 1;
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name)) continue;
                const found = await findFileByName(path.join(root, entry.name), target, depth + 1, state);
                if (found) return found;
            } else if (entry.isFile() && entry.name.toLowerCase() === target.toLowerCase()) {
                return path.join(root, entry.name);
            }
        }
        return null;
    };

    const resolveObservationPath = async (rawTarget: string): Promise<string> => {
        const normalized = String(rawTarget || '').trim();
        if (!normalized) return normalized;
        if (path.isAbsolute(normalized) || normalized.startsWith('/')) return normalized;
        if (normalized.includes('/') || normalized.includes('\\')) {
            return safeCwd ? path.resolve(safeCwd, normalized) : normalized;
        }
        const cached = fileLookupCache.get(normalized);
        if (cached) return cached;
        const state = { count: 0 };
        const candidateRoots = safeCwd ? [path.join(safeCwd, 'src'), safeCwd] : [];
        for (const root of candidateRoots) {
            const found = await findFileByName(root, normalized, 0, state);
            if (found) {
                fileLookupCache.set(normalized, found);
                return found;
            }
        }
        const fallback = safeCwd ? path.resolve(safeCwd, normalized) : normalized;
        fileLookupCache.set(normalized, fallback);
        return fallback;
    };

    const buildChunkCandidates = (input: string | null, ctx: LoopContext): ChunkRef[] => {
        const chunks: ChunkRef[] = [];
        if (input) {
            chunks.push({
                id: `input_${Date.now()}`,
                summary: String(input).slice(0, 100),
                relevance: 1,
                type: 'observation'
            });
        }
        const lastTurn = ctx.conversation?.[ctx.conversation.length - 1];
        if (lastTurn?.text) {
            chunks.push({
                id: `conv_${Date.now()}`,
                summary: String(lastTurn.text).slice(0, 100),
                relevance: 0.6,
                type: 'memory'
            });
        }
        return chunks;
    };

    const toWitnessTension = (item: TensionItem, evidenceCount: number): WitnessTension => ({
        key: item.key,
        belief: item.belief,
        severity: item.severity,
        evidenceCount
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // SOCIAL DYNAMICS: Now unified in ExecutiveGate.checkSocialDynamics()
    // Legacy shouldSpeakToUser() removed - all checks in one gate
    // ═══════════════════════════════════════════════════════════════════════════

    export interface LoopCallbacks {
        onMessage: (role: string, text: string, type: any, meta?: {
            knowledgeSource?: 'memory' | 'tool' | 'llm' | 'mixed' | 'system';
            evidenceSource?: 'memory' | 'tool' | 'system';
            evidenceDetail?: string;
            generator?: 'llm' | 'system';
            agentMemoryId?: string;
        }) => void;
        onThought: (thought: string) => void;
        onSomaUpdate: (soma: SomaState) => void;
        onLimbicUpdate: (limbic: LimbicState) => void;
    }

    export async function runSingleStep(
        ctx: LoopContext,
        input: string | null,
        callbacks: LoopCallbacks
    ): Promise<LoopContext> {
        const startedAt = Date.now();
        const tickNumber = tickCount++;
        const traceScope = createTickTraceScope({
            agentId: getCurrentAgentId(),
            tickNumber,
            startedAt,
            deps: {
                generateTraceId,
                pushTraceId,
                popTraceId,
                publishTickStart,
                publishTickEnd
            }
        });

        p0MetricStartTick(traceScope.trace.traceId, tickNumber);
        const trace: TraceContext = traceScope.trace;

        let skipped = false;
        let skipReason: string | null = null;

        const runSiliconCycle = async (params: {
            input: string | null;
        }): Promise<{ blockCortex: boolean }> => {
            const agentId = trace.agentId || getCurrentAgentId() || DEFAULT_AGENT_ID;
            const worldRoot = getAgentWorldRoot(agentId);
            const schemaStore = getSchemaStore(worldRoot);

            if (!ctx.soma.isSleeping && pendingWakeObserve.key === null) {
                const selected = tensionRegistry.consumeSelectedForTomorrow();
                if (selected) pendingWakeObserve.key = selected;
            }

            tensionRegistry.tickDecay();

            const evidenceCount = evidenceLedger.getCount();
            const needsEvidence = Boolean(params.input && questionRequiresEvidence(params.input))
                || Boolean(pendingWakeObserve.key && !params.input);

            const beliefViolation = detectBeliefViolation({
                memoryCoherence: 1,
                evidenceCount,
                learningOpportunity: false,
                taskPending: Boolean(ctx.goalState?.activeGoal)
            });

            if (beliefViolation) {
                const key = beliefViolation.belief === 'truth'
                    ? 'evidence_missing'
                    : `belief_${beliefViolation.belief}`;
                tensionRegistry.upsert(key, beliefViolation.belief, beliefViolation.severity);
            }

            const topTensions = tensionRegistry.top(3);
            const selectedTensionItem = pendingWakeObserve.key
                ? tensionRegistry.get(pendingWakeObserve.key)
                : null;

            const witnessTensions: WitnessTension[] = [];
            if (selectedTensionItem) {
                const boost = (topTensions[0]?.severity ?? 0) + 0.01;
                witnessTensions.push({
                    key: selectedTensionItem.key,
                    belief: selectedTensionItem.belief,
                    severity: Math.max(selectedTensionItem.severity, boost),
                    evidenceCount
                });
            }
            for (const item of topTensions) {
                if (item.key === selectedTensionItem?.key) continue;
                witnessTensions.push(toWitnessTension(item, evidenceCount));
            }

            const contextPressure = Math.max(0, Math.min(1, ctx.soma.cognitiveLoad / 100));
            const chunkCandidates = buildChunkCandidates(params.input, ctx);

            const witnessFrame = buildWitnessFrame({
                energyBudget: ctx.soma.energy,
                contextPressure,
                beliefViolation,
                tensions: witnessTensions,
                evidenceCount,
                chunkCandidates
            });

            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.WITNESS_FRAME_UPDATED,
                payload: witnessFrame,
                priority: 0.6
            });

            const dominantItem = selectedTensionItem || topTensions[0] || null;
            const intention = formIntention(dominantItem, ctx.soma.energy, witnessFrame.readinessToAct);

            const selectedAction = selectAction({
                intention,
                drive: witnessFrame.dominantDrive,
                readiness: witnessFrame.readinessToAct,
                energy: ctx.soma.energy,
                evidenceCount
            });

            const forceObserve = needsEvidence && evidenceCount === 0;
            const wakeObserve = Boolean(pendingWakeObserve.key && !params.input);
            const action = forceObserve || wakeObserve
                ? { action: 'observe' as ActionType, reason: forceObserve ? 'evidence_gate' : 'wake_observe' }
                : selectedAction;

            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.ACTION_SELECTED,
                payload: {
                    action: action.action,
                    reason: action.reason,
                    intentionId: intention?.id ?? null
                },
                priority: 0.6
            });

            const upsertSchema = async (params: { path: string; content: string; evidenceId: string }) => {
                const concept = path.basename(params.path).replace(/\.[^.]+$/, '');
                const draft = createSchemaFromObservation({
                    concept,
                    observation: params.content,
                    evidenceRef: params.evidenceId
                });
                if (!draft) return;
                const schemaId = concept
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_+|_+$/g, '')
                    .slice(0, 48) || `schema_${Date.now()}`;
                const existing = await schemaStore.load(schemaId);
                if (existing) {
                    existing.attributes = Array.from(new Set([...existing.attributes, ...draft.attributes])).slice(0, 3);
                    existing.evidenceRefs = Array.from(new Set([...existing.evidenceRefs, ...draft.evidenceRefs]));
                    existing.usageCount += 1;
                    await schemaStore.save(existing);
                } else {
                    const now = Date.now();
                    const schema: Schema = {
                        id: schemaId,
                        createdAt: now,
                        updatedAt: now,
                        ...draft
                    };
                    await schemaStore.save(schema);
                }
            };

            const executeObserve = async () => {
                const target = extractFileTarget(params.input);
                if (target) {
                    const resolvedPath = await resolveObservationPath(target);
                    const readResult = await executeWorldTool({
                        tool: 'READ_FILE',
                        path: resolvedPath,
                        agentId
                    });
                    if (readResult.ok && readResult.content && readResult.evidenceId) {
                        const toolText = `READ_FILE ${readResult.path}\n${readResult.content.slice(0, 8000)}`;
                        callbacks.onMessage('assistant', toolText, 'tool_result');
                        ctx.conversation.push({ role: 'assistant', text: toolText, type: 'tool_result' });
                        await upsertSchema({
                            path: readResult.path,
                            content: readResult.content,
                            evidenceId: readResult.evidenceId
                        });
                        return true;
                    }
                    if (!readResult.ok) {
                        callbacks.onThought(`[OBSERVE_ERROR] ${readResult.error || 'unknown'}`);
                    }
                    return false;
                }

                if (pendingWakeObserve.key && !params.input) {
                    const listSchemas = await executeWorldTool({
                        tool: 'LIST_DIR',
                        path: `${worldRoot}/knowledge/schemas`,
                        agentId
                    });
                    if (listSchemas.ok && listSchemas.entries) {
                        const toolText = `LIST_DIR ${listSchemas.path}\n${listSchemas.entries.join('\n')}`;
                        callbacks.onMessage('assistant', toolText, 'tool_result');
                        ctx.conversation.push({ role: 'assistant', text: toolText, type: 'tool_result' });
                    }

                    const listNotes = await executeWorldTool({
                        tool: 'LIST_DIR',
                        path: `${worldRoot}/notes`,
                        agentId
                    });
                    if (listNotes.ok && listNotes.entries) {
                        const toolText = `LIST_DIR ${listNotes.path}\n${listNotes.entries.join('\n')}`;
                        callbacks.onMessage('assistant', toolText, 'tool_result');
                        ctx.conversation.push({ role: 'assistant', text: toolText, type: 'tool_result' });
                    }

                    if (listSchemas.ok || listNotes.ok) {
                        pendingWakeObserve.key = null;
                        return true;
                    }
                }

                return false;
            };

            if (action.action === 'observe') {
                try {
                    await executeObserve();
                } catch (error: any) {
                    callbacks.onThought(`[OBSERVE_ERROR] ${error?.message || String(error)}`);
                }
            }

            const updatedEvidenceCount = evidenceLedger.getCount();
            if (needsEvidence && updatedEvidenceCount === 0) {
                eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.CORTEX_FLOW,
                    type: PacketType.EVIDENCE_GATE_BLOCKED,
                    payload: { reason: 'missing_evidence', input: params.input },
                    priority: 0.7
                });
                if (params.input) {
                    ctx.goalState.lastUserInteractionAt = Date.now();
                }
                return { blockCortex: true };
            }

            return { blockCortex: false };
        };

        try {
            // P0 ONE MIND: Hard gate when no agent is selected.
            // Must happen before any LLM or memory hydration.
            if (!trace.agentId) {
                skipped = true;
                skipReason = 'NO_AGENT_ID';

                publishTickSkipped(trace.traceId, trace.tickNumber, Date.now(), skipReason);

                return ctx;
            }

            const memorySpace = createMemorySpace(trace.agentId);

            const thinkMode = ThinkModeSelector.select(input, ctx.autonomousMode, Boolean(ctx.goalState?.activeGoal));
            publishThinkModeSelected(trace.traceId, trace.tickNumber, Date.now(), thinkMode);

            // 1. Apply emotional homeostasis
            const cooledLimbic = LimbicSystem.applyHomeostasis(ctx.limbic);
            ctx.limbic = cooledLimbic;
            callbacks.onLimbicUpdate(ctx.limbic);

            const siliconEnabled = Boolean((SYSTEM_CONFIG as any).siliconBeing?.enabled);
            if (siliconEnabled && !ctx.soma.isSleeping && (input || ctx.autonomousMode)) {
                const siliconResult = await runSiliconCycle({ input });
                if (siliconResult.blockCortex) {
                    return ctx;
                }
            }

        // 2. Process User Input (if any)
        if (input) {
            await runReactiveStep({
                ctx: ctx as any,
                userInput: input,
                callbacks,
                memorySpace: memorySpace as any,
                trace: trace as any
            });
        }

        // 3. Autonomous Volition (only if autonomousMode is ON)
        if (ctx.autonomousMode && !input) {
            const silenceDuration = (Date.now() - ctx.silenceStart) / 1000;
            
            // EXECUTIVE GATE: Use proper silence window instead of hardcoded 3s
            const timeSinceLastUserInteraction = Date.now() - (ctx.goalState.lastUserInteractionAt || 0);
            // UNIFIED GATE: Pass socialDynamics to gate context
            const gateContext = {
                ...ExecutiveGate.getDefaultContext(ctx.limbic, timeSinceLastUserInteraction),
                socialDynamics: ctx.socialDynamics
            };
            
            // Check silence window via ExecutiveGate config
            if (timeSinceLastUserInteraction < gateContext.silence_window) {
                // User spoke recently - skip autonomous volition (ExecutiveGate silence window)
                return ctx;
            }

            // 3A. GOAL FORMATION HOOK (FAZA 3)
            if (!ctx.goalState.activeGoal) {
                const now = Date.now();
                const GOAL_COOLDOWN_MS = 5 * 60 * 1000;

                if (
                    ctx.goalState.lastGoalFormedAt &&
                    now - ctx.goalState.lastGoalFormedAt < GOAL_COOLDOWN_MS
                ) {
                    // hard cooldown: skip goal formation
                } else {
                    const goalCtx: GoalContext = {
                        now,
                        lastUserInteractionAt: ctx.goalState.lastUserInteractionAt || ctx.silenceStart,
                        soma: ctx.soma,
                        neuro: ctx.neuro,
                        limbic: ctx.limbic,
                        conversation: ctx.conversation
                    };

                    const newGoal = await GoalSystem.formGoal(goalCtx, ctx.goalState);

                    if (newGoal) {
                        ctx.goalState.lastGoalFormedAt = now;
                        ctx.goalState.activeGoal = newGoal;
                        ctx.goalState.goalsFormedTimestamps = [
                            ...(ctx.goalState.goalsFormedTimestamps || []).filter(t => now - t < 60 * 60 * 1000),
                            now
                        ];
                        // FAZA 4.2: Update lastGoals history (Refractory Period)
                        ctx.goalState.lastGoals = [
                            { description: newGoal.description, timestamp: now, source: newGoal.source },
                            ...(ctx.goalState.lastGoals || [])
                        ].slice(0, 3);

                        const silenceMs = now - goalCtx.lastUserInteractionAt;
                        const minSilenceMs = SYSTEM_CONFIG.goals.minSilenceMs;

                        eventBus.publish({
                            id: `goal-formed-${now}`,
                            timestamp: now,
                            source: AgentType.CORTEX_FLOW,
                            type: PacketType.SYSTEM_ALERT,
                            payload: {
                                event: 'GOAL_FORMED',
                                goal: {
                                    id: newGoal.id,
                                    source: newGoal.source,
                                    description: newGoal.description,
                                    priority: newGoal.priority
                                },
                                silenceMs,
                                minSilenceMs,
                                activeGoalId: ctx.goalState.activeGoal?.id ?? null,
                                lastGoalFormedAt: ctx.goalState.lastGoalFormedAt ?? null
                            },
                            priority: 0.7
                        });
                    }
                }
            }

            // 3B. GOAL EXECUTION (single-shot) - via ExecutiveGate
            if (ctx.goalState.activeGoal) {
                await runGoalDrivenStep({
                    ctx: ctx as any,
                    goal: ctx.goalState.activeGoal as any,
                    callbacks,
                    gateContext,
                    trace: trace as any
                });

                // After executing a goal, skip regular autonomous volition in this tick
                return ctx;
            }

            // 3C. Autonomous Volition (only if autonomousMode is ON)
            await runAutonomousVolitionStep({
                ctx: ctx as any,
                callbacks,
                memorySpace: memorySpace as any,
                trace: trace as any,
                gateContext,
                silenceDurationSec: silenceDuration,
                budgetTracker
            });
        }

            return ctx;
        } finally {
            publishP0Metric(traceScope.trace.traceId, Date.now());
            traceScope.finalize({ skipped, skipReason });
        }
    }
}
