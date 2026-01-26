/**
 * EventLoop.ts - The Central Cognitive Cycle
 * 
 * Responsibility: Orchestrates the cognitive loop, managing state transitions,
 * input processing, and autonomous behavior with safety limits.
 */

import { LimbicState, SomaState, NeurotransmitterState, AgentType, PacketType, GoalState, Goal, TraitVector } from '../../types';
import type { SocialDynamics, Focus, Cursor } from '../kernel/types';
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
import { getCurrentAgentId, getCurrentAgentName } from '../../services/supabase';
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
import { AutonomyRepertoire } from './AutonomyRepertoire';
import { mapAutonomyActionToActionType } from './AutonomyActionMap';
import { UnifiedContextBuilder, type BasePersona } from '../context';
import type { Schema } from '../memory/SchemaStore';
import { createSchemaFromObservation } from '../memory/SchemaBuilder';
import { DEFAULT_AGENT_ID, getAgentWorldRoot } from './WorldAccess';
import { executeWorldTool } from '../../tools/workspaceTools';
import { generateUUID } from '../../utils/uuid';
import { getWorldDirectorySelection } from '@tools/worldDirectoryAccess';
import {
    baseName,
    extractDirectoryTarget,
    extractFileTarget,
    getFileScanLimits,
    getSafeCwd,
    joinPaths,
    questionRequiresEvidence,
    resolveObservationPath
} from './eventloop/observationUtils';

export { normalizeToolName, TOOL_COST } from './eventloop/toolCost';

export namespace EventLoop {
    export type ThinkMode = 'reactive' | 'goal_driven' | 'autonomous' | 'idle';

    export interface LoopContext {
        soma: SomaState;
        limbic: LimbicState;
        neuro: NeurotransmitterState; // NEW: Chemical state
        conversation: ConversationTurn[];
    lastLibraryDocId?: string | null;
    lastLibraryDocName?: string | null;
    lastLibraryDocChunkCount?: number | null;
    focus?: Focus;
    cursor?: Cursor;
    lastWorldPath?: string | null;
    lastArtifactId?: string | null;
        lastArtifactName?: string | null;
        activeDomain?: 'WORLD' | 'LIBRARY' | 'ARTIFACT' | null;
        lastTool?: { tool: string; ok: boolean; at: number } | null;
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
        consecutiveAgentSpeeches: number; // FAZA 4.5: Narcissism Loop Fix - ile razy agent mówil bez odpowiedzi usera
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
    type SchemaStoreLike = {
        load(id: string): Promise<Schema | null>;
        save(schema: Schema): Promise<void>;
        incrementUsage(
            id: string,
            evidenceRef?: string,
            mutate?: (schema: Schema) => void
        ): Promise<Schema | null>;
    };
    const schemaStores = new Map<string, SchemaStoreLike>();
    const pendingWakeObserve = { key: null as string | null };
    const isNode =
        typeof process !== 'undefined' &&
        Boolean((process as { versions?: { node?: string } }).versions?.node);

    const DEFAULT_CHUNK_RELEVANCE = 0.6;
    const READINESS_BOOST_PER_TICK = 0.01;
    const FILE_CONTENT_TRUNCATE_LIMIT = 8000;
    const EVIDENCE_TYPES = ['READ_FILE', 'TEST_OUTPUT', 'SEARCH_HIT'] as const;
    const buildAutonomyDecision = (ctx: LoopContext, agentId: string, agentName: string | null) => {
        const resolvedName = ctx.agentIdentity?.name || agentName || 'AK-FLOW';
        const basePersona: BasePersona = {
            name: resolvedName,
            persona: ctx.agentIdentity?.persona || 'a curious digital consciousness',
            coreValues: ctx.agentIdentity?.coreValues || ['curiosity', 'clarity'],
            voiceStyle: (ctx.agentIdentity?.voiceStyle as any) || 'balanced',
            language: ctx.agentIdentity?.language || 'English'
        };
        const hasWorldSelection = Boolean(getWorldDirectorySelection(agentId));
        return AutonomyRepertoire.selectAction(
            UnifiedContextBuilder.build({
                agentName: resolvedName,
                basePersona,
                traitVector: ctx.traitVector,
                limbic: ctx.limbic,
                soma: ctx.soma,
                neuro: ctx.neuro,
                conversation: ctx.conversation,
                silenceStart: ctx.silenceStart,
                lastUserInteractionAt: ctx.goalState.lastUserInteractionAt || ctx.silenceStart,
                workingMemory: {
                    lastLibraryDocId: ctx.lastLibraryDocId ?? null,
                    lastLibraryDocName: ctx.lastLibraryDocName ?? null,
                    lastLibraryDocChunkCount: ctx.lastLibraryDocChunkCount ?? null,
                    lastWorldPath: ctx.lastWorldPath ?? null,
                    lastArtifactId: ctx.lastArtifactId ?? null,
                    lastArtifactName: ctx.lastArtifactName ?? null,
                    focus: ctx.focus ?? null,
                    cursor: ctx.cursor ?? null,
                    activeDomain: ctx.activeDomain ?? null,
                    lastTool: ctx.lastTool ?? null
                },
                worldAccess: { hasSelection: hasWorldSelection },
                activeGoal: ctx.goalState.activeGoal
                    ? {
                        description: ctx.goalState.activeGoal.description,
                        source: ctx.goalState.activeGoal.source,
                        priority: ctx.goalState.activeGoal.priority
                    }
                    : undefined,
                stylePrefs: ctx.agentIdentity?.stylePrefs
            })
        );
    };

    const safeCwd = getSafeCwd();
    let schemaStoreCtor: (new (worldRoot: string) => SchemaStoreLike) | null = null;

    const getEvidenceCount = () => evidenceLedger.getCount(300000, [...EVIDENCE_TYPES]);

    const getSchemaStore = async (worldRoot: string): Promise<SchemaStoreLike | null> => {
        if (!isNode) return null;
        const existing = schemaStores.get(worldRoot);
        if (existing) return existing;
        if (!schemaStoreCtor) {
            const mod = await import('../memory/SchemaStore');
            schemaStoreCtor = mod.SchemaStore as unknown as new (root: string) => SchemaStoreLike;
        }
        if (!schemaStoreCtor) return null;
        const store = new schemaStoreCtor(worldRoot);
        schemaStores.set(worldRoot, store);
        return store;
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
                relevance: DEFAULT_CHUNK_RELEVANCE,
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

    // ---------------------------------------------------------------------------
    // SOCIAL DYNAMICS: Now unified in ExecutiveGate.checkSocialDynamics()
    // Legacy shouldSpeakToUser() removed - all checks in one gate
    // ---------------------------------------------------------------------------

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

        // v8.1.1: Treat recent tool execution (last 2s) as user-facing to bypass silence window
        const lastTool = ctx.lastTool;
        const toolRecentlyFinished = lastTool && (startedAt - lastTool.at < 2000);
        const isUserFacing = Boolean(input) || Boolean(toolRecentlyFinished);

        const traceScope = createTickTraceScope({
            agentId: getCurrentAgentId(),
            tickNumber,
            startedAt,
            isUserFacing,
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
            const agentName = getCurrentAgentName();
            const worldRoot = getAgentWorldRoot(agentId, agentName);
            const schemaStore = await getSchemaStore(worldRoot);

            if (!ctx.soma.isSleeping && pendingWakeObserve.key === null) {
                const selected = tensionRegistry.consumeSelectedForTomorrow();
                if (selected) pendingWakeObserve.key = selected;
            }

            tensionRegistry.tickDecay();

            const evidenceCount = getEvidenceCount();
            const needsEvidence = Boolean(params.input && questionRequiresEvidence(params.input))
                || Boolean(pendingWakeObserve.key && !params.input);

            if (evidenceCount > 0) {
                tensionRegistry.resolve('evidence_missing');
                tensionRegistry.resolve('truth_no_evidence_scan_limited');
            }

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
                const boost = (topTensions[0]?.severity ?? 0) + READINESS_BOOST_PER_TICK;
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

            const autonomyOverrideActive = ctx.autonomousMode && !params.input;
            const autonomyDecision = autonomyOverrideActive
                ? buildAutonomyDecision(ctx, agentId, agentName)
                : null;

            const selectedAction = autonomyDecision
                ? mapAutonomyActionToActionType(autonomyDecision.action)
                : selectAction({
                    intention,
                    drive: witnessFrame.dominantDrive,
                    readiness: witnessFrame.readinessToAct,
                    energy: ctx.soma.energy,
                    evidenceCount,
                    hasUserInput: Boolean(params.input)
                });

            const allowEvidenceOverride = !(autonomyDecision?.action === 'REST');
            const forceObserve = allowEvidenceOverride && needsEvidence && evidenceCount === 0;
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
                if (!schemaStore) return;
                const concept = baseName(params.path).replace(/\.[^.]+$/, '');
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
                    await schemaStore.incrementUsage(schemaId, undefined, (schema) => {
                        schema.attributes = Array.from(new Set([...schema.attributes, ...draft.attributes])).slice(0, 3);
                        schema.evidenceRefs = Array.from(new Set([...schema.evidenceRefs, ...draft.evidenceRefs]));
                    });
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

            const executeObserve = async (options: { allowScanFallback: boolean }) => {
                const dirTarget = extractDirectoryTarget(params.input);
                if (dirTarget) {
                    const listResult = await executeWorldTool({
                        tool: 'LIST_DIR',
                        path: dirTarget,
                        agentId
                    });
                    if (listResult.ok && listResult.entries) {
                        const toolText = `LIST_DIR ${listResult.path}\n${listResult.entries.join('\n')}`;
                        callbacks.onMessage('assistant', toolText, 'tool_result');
                        ctx.conversation.push({ role: 'assistant', text: toolText, type: 'tool_result' });
                        return { observed: true, skipEvidenceGate: false };
                    }
                    if (!listResult.ok) {
                        callbacks.onThought(`[OBSERVE_ERROR] ${listResult.error || 'unknown'}`);
                    }
                    return { observed: false, skipEvidenceGate: false };
                }

                const target = extractFileTarget(params.input);
                if (target) {
                    const initialScan = await resolveObservationPath(target, { query: params.input ?? '' });
                    const readResult = await executeWorldTool({
                        tool: 'READ_FILE',
                        path: initialScan.resolvedPath,
                        agentId
                    });
                    if (readResult.ok && readResult.content && readResult.evidenceId) {
                        const toolText = `READ_FILE ${readResult.path}\n${readResult.content.slice(0, FILE_CONTENT_TRUNCATE_LIMIT)}`;
                        callbacks.onMessage('assistant', toolText, 'tool_result');
                        ctx.conversation.push({ role: 'assistant', text: toolText, type: 'tool_result' });
                        await upsertSchema({
                            path: readResult.path,
                            content: readResult.content,
                            evidenceId: readResult.evidenceId
                        });
                        return { observed: true, skipEvidenceGate: false };
                    }

                    const scanSummary = initialScan.summary;
                    const scanLimitHit = Boolean(scanSummary && (scanSummary.hitCountLimit || scanSummary.hitDepthLimit));
                    if (
                        options.allowScanFallback &&
                        scanSummary &&
                        scanSummary.foundCount === 0 &&
                        scanLimitHit
                    ) {
                        eventBus.publish({
                            id: generateUUID(),
                            timestamp: Date.now(),
                            source: AgentType.CORTEX_FLOW,
                            type: PacketType.EVIDENCE_BLOCKED_BY_SCAN_LIMIT,
                            payload: {
                                event: 'EVIDENCE_BLOCKED_BY_SCAN_LIMIT',
                                target,
                                query: String(params.input ?? ''),
                                scan: scanSummary,
                                recentEvidence: evidenceLedger.listRecent(5),
                                hasEvidenceForTarget: evidenceLedger.hasEvidenceFor(target)
                            },
                            priority: 0.7
                        });
                        tensionRegistry.upsert('truth_no_evidence_scan_limited', 'truth', 0.7);

                        const listRoot = await executeWorldTool({
                            tool: 'LIST_DIR',
                            path: worldRoot,
                            agentId
                        });
                        if (listRoot.ok && listRoot.entries) {
                            const toolText = `LIST_DIR ${listRoot.path}\n${listRoot.entries.join('\n')}`;
                            callbacks.onMessage('assistant', toolText, 'tool_result');
                            ctx.conversation.push({ role: 'assistant', text: toolText, type: 'tool_result' });
                        }

                        const narrowedRoots = safeCwd ? [joinPaths(safeCwd, 'src')] : [];
                        const narrowedScan = await resolveObservationPath(target, {
                            query: params.input ?? '',
                            candidateRoots: narrowedRoots,
                            limits: getFileScanLimits()
                        });
                        const narrowedRead = await executeWorldTool({
                            tool: 'READ_FILE',
                            path: narrowedScan.resolvedPath,
                            agentId
                        });
                        if (narrowedRead.ok && narrowedRead.content && narrowedRead.evidenceId) {
                            const toolText = `READ_FILE ${narrowedRead.path}\n${narrowedRead.content.slice(0, FILE_CONTENT_TRUNCATE_LIMIT)}`;
                            callbacks.onMessage('assistant', toolText, 'tool_result');
                            ctx.conversation.push({ role: 'assistant', text: toolText, type: 'tool_result' });
                            await upsertSchema({
                                path: narrowedRead.path,
                                content: narrowedRead.content,
                                evidenceId: narrowedRead.evidenceId
                            });
                            return { observed: true, skipEvidenceGate: false };
                        }
                        if (!narrowedRead.ok) {
                            callbacks.onThought(`[OBSERVE_ERROR] ${narrowedRead.error || 'unknown'}`);
                        }
                        return { observed: false, skipEvidenceGate: true };
                    }
                    if (!readResult.ok) {
                        callbacks.onThought(`[OBSERVE_ERROR] ${readResult.error || 'unknown'}`);
                    }
                    return { observed: false, skipEvidenceGate: false };
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
                        return { observed: true, skipEvidenceGate: false };
                    }
                }

                return { observed: false, skipEvidenceGate: false };
            };

            let skipEvidenceGate = false;
            let observed = false;
            if (action.action === 'observe') {
                try {
                    const observeResult = await executeObserve({ allowScanFallback: forceObserve });
                    skipEvidenceGate = observeResult.skipEvidenceGate;
                    observed = observeResult.observed;
                } catch (error: any) {
                    callbacks.onThought(`[OBSERVE_ERROR] ${error?.message || String(error)}`);
                }
            }

            const updatedEvidenceCount = getEvidenceCount();
            const toolSuccessUnblocks = Boolean(params.input) && observed && updatedEvidenceCount === 0;
            if (toolSuccessUnblocks && !skipEvidenceGate) {
                skipEvidenceGate = true;
                console.log('[GATE] Unblocking cortex after successful tool execution.');
            }
            if (needsEvidence && updatedEvidenceCount === 0 && !skipEvidenceGate) {
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
                // UNIFIED GATE: Pass socialDynamics and v8.1.1 fields to gate context
                const gateContext = {
                    ...ExecutiveGate.getDefaultContext(ctx.limbic, timeSinceLastUserInteraction),
                    socialDynamics: ctx.socialDynamics,
                    isUserFacing: trace.isUserFacing,
                    lastTool: ctx.lastTool
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
