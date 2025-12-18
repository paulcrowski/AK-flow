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
import { CortexService } from '../../services/gemini';
import { eventBus } from '../EventBus';
import * as GoalSystem from './GoalSystem';
import { GoalContext } from './GoalSystem';
import { ExecutiveGate } from './ExecutiveGate';
import { UserStylePrefs } from './StyleGuard';
import { TraceContext, generateTraceId, pushTraceId, popTraceId } from '../trace/TraceContext';
import { getCurrentAgentId } from '../../services/supabase';
import { createMemorySpace } from './MemorySpace';
import { TickCommitter } from './TickCommitter';
import { publishTickStart, publishTickSkipped, publishThinkModeSelected, publishTickEnd } from './TickLifecycleTelemetry';
import { isMainFeatureEnabled } from '../config/featureFlags';
import { ThinkModeSelector, createAutonomyBudgetTracker, createTickTraceScope, runAutonomousVolitionStep } from './eventloop/index';

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
        const trace: TraceContext = traceScope.trace;

        let skipped = false;
        let skipReason: string | null = null;

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

        // 2. Process User Input (if any)
        if (input) {
            // RACE CONDITION GUARD: Mark that user input arrived to block stale autonomous commits
            TickCommitter.markUserInput();
            
            const prefetchedMemories = isMainFeatureEnabled('ONE_MIND_ENABLED')
                ? await memorySpace.hot.semanticSearch(input)
                : undefined;

            const result = await CortexSystem.processUserMessage({
                text: input,
                currentLimbic: ctx.limbic,
                currentSoma: ctx.soma,
                conversationHistory: ctx.conversation,
                // FAZA 5: Pass identity context
                identity: ctx.agentIdentity,
                sessionOverlay: ctx.sessionOverlay,
                memorySpace,
                prefetchedMemories
            });

            // SEMANTIC INTENT DETECTION (Bonus 11/10)
            // Replaces old keyword matching with cognitive understanding
            const intent = await CortexService.detectIntent(input);

            // Apply Style Preference
            if (intent.style === 'POETIC') {
                ctx.poeticMode = true;
                console.log("Intent Detected: POETIC MODE ENABLED");
            } else if (intent.style === 'SIMPLE') {
                ctx.poeticMode = false;
                console.log("Intent Detected: POETIC MODE DISABLED (Simple Style Requested)");
            } else if (intent.style === 'ACADEMIC') {
                ctx.poeticMode = false; // Academic is not poetic, it's precise
                // TODO: Add academicMode flag in future
            }

            // Log Cognitive Metric
            // We don't have access to eventBus here directly without import, 
            // but we can log to console or rely on the CortexService logs if enabled.
            // For now, we trust the context update.

            // Update Context
            if (result.moodShift) {
                ctx.limbic = LimbicSystem.applyMoodShift(ctx.limbic, result.moodShift);
                callbacks.onLimbicUpdate(ctx.limbic);
            }

            // Callback to UI
            if (result.internalThought) {
                callbacks.onMessage('assistant', result.internalThought, 'thought');
            }

            if (isMainFeatureEnabled('ONE_MIND_ENABLED') && trace.agentId) {
                try {
                    const commit = TickCommitter.commitSpeech({
                        agentId: trace.agentId,
                        traceId: trace.traceId,
                        tickNumber: trace.tickNumber,
                        origin: 'reactive',
                        speechText: result.responseText
                    });

                    if (commit.committed) {
                        callbacks.onMessage('assistant', result.responseText, 'speech', {
                            knowledgeSource: result.knowledgeSource,
                            evidenceSource: result.evidenceSource,
                            evidenceDetail: result.evidenceDetail,
                            generator: result.generator
                        });
                    } else {
                        callbacks.onThought(`[REACTIVE_SUPPRESSED] ${commit.blockReason || 'UNKNOWN'}`);
                    }
                } catch (e) {
                    // FAIL-OPEN: reactive user response should never be silenced due to committer errors
                    callbacks.onThought(`[REACTIVE_COMMIT_ERROR] ${(e as Error)?.message || 'unknown'}`);
                    callbacks.onMessage('assistant', result.responseText, 'speech', {
                        knowledgeSource: result.knowledgeSource,
                        evidenceSource: result.evidenceSource,
                        evidenceDetail: result.evidenceDetail,
                        generator: result.generator
                    });
                }
            } else {
                callbacks.onMessage('assistant', result.responseText, 'speech', {
                    knowledgeSource: result.knowledgeSource,
                    evidenceSource: result.evidenceSource,
                    evidenceDetail: result.evidenceDetail,
                    generator: result.generator
                });
            }

            // Reset silence & mark user interaction for GoalSystem
            ctx.silenceStart = Date.now();
            ctx.lastSpeakTimestamp = Date.now();
            ctx.goalState.lastUserInteractionAt = Date.now();
            
            // FAZA 4.5: Reset consecutive agent speeches counter (user spoke!)
            ctx.consecutiveAgentSpeeches = 0;
            
            // FAZA 5.1: User input = EXTERNAL REWARD (world responded!)
            ctx.hadExternalRewardThisTick = true;
            ctx.ticksSinceLastReward = 0;
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
                const goalCtx: GoalContext = {
                    now,
                    lastUserInteractionAt: ctx.goalState.lastUserInteractionAt || ctx.silenceStart,
                    soma: ctx.soma,
                    neuro: ctx.neuro,
                    limbic: ctx.limbic
                };

                const newGoal = await GoalSystem.formGoal(goalCtx, ctx.goalState);

                if (newGoal) {
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
                            }
                        },
                        priority: 0.7
                    });
                }
            }

            // 3B. GOAL EXECUTION (single-shot) - via ExecutiveGate
            if (ctx.goalState.activeGoal) {
                const goal: Goal = ctx.goalState.activeGoal;
                const result = await CortexSystem.pursueGoal(goal, {
                    limbic: ctx.limbic,
                    soma: ctx.soma,
                    conversation: ctx.conversation,
                    traitVector: ctx.traitVector,
                    neuroState: ctx.neuro,
                    // FAZA 5: Pass identity context
                    identity: ctx.agentIdentity,
                    sessionOverlay: ctx.sessionOverlay
                });

                // Create goal-driven candidate
                const goalCandidate = ExecutiveGate.createGoalCandidate(
                    result.responseText,
                    result.internalThought || '',
                    goal.id,
                    { source: goal.source, salience: goal.priority }
                );
                
                // ExecutiveGate decides for goal-driven speech
                const goalGateDecision = ExecutiveGate.decide([goalCandidate], gateContext);
                
                // HEMISPHERE LOG: Goal-driven thought origin tracking
                eventBus.publish({
                    id: `thought-goal-${Date.now()}`,
                    timestamp: Date.now(),
                    source: AgentType.CORTEX_FLOW,
                    type: PacketType.THOUGHT_CANDIDATE,
                    payload: {
                        hemisphere: 'goal_driven',
                        goal_id: goal.id,
                        internal_monologue: result.internalThought || '',
                        status: 'THINKING'
                    },
                    priority: 0.5
                });
                
                if (result.internalThought) {
                    callbacks.onMessage('assistant', result.internalThought, 'thought');
                }

                if (goalGateDecision.should_speak && goalGateDecision.winner) {
                    const speechText = goalGateDecision.winner.speech_content;

                    const commit = isMainFeatureEnabled('ONE_MIND_ENABLED')
                        ? TickCommitter.commitSpeech({
                            agentId: trace.agentId!,
                            traceId: trace.traceId,
                            tickNumber: trace.tickNumber,
                            origin: 'goal_driven',
                            speechText
                        })
                        : { committed: true, blocked: false, deduped: false };

                    if (commit.committed) {
                        callbacks.onMessage('assistant', speechText, 'speech', {
                            knowledgeSource: result.knowledgeSource,
                            evidenceSource: result.evidenceSource,
                            generator: result.generator
                        });
                    }
                } else {
                    // Goal speech suppressed - log it
                    callbacks.onThought(`[GOAL SUPPRESSED] ${result.responseText?.slice(0, 50)}...`);
                }

                const executedAt = Date.now();

                eventBus.publish({
                    id: `goal-executed-${executedAt}`,
                    timestamp: executedAt,
                    source: AgentType.CORTEX_FLOW,
                    type: PacketType.SYSTEM_ALERT,
                    payload: {
                        event: 'GOAL_EXECUTED',
                        goal: {
                            id: goal.id,
                            source: goal.source,
                            description: goal.description,
                            priority: goal.priority
                        }
                    },
                    priority: 0.7
                });

                ctx.goalState.activeGoal = null;
                ctx.lastSpeakTimestamp = executedAt;
                ctx.silenceStart = executedAt;

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
            traceScope.finalize({ skipped, skipReason });
        }
    }
}
