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

        p0MetricStartTick(traceScope.trace.traceId, tickNumber);
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
