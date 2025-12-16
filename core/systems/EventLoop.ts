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
import { VolitionSystem, calculatePoeticScore } from './VolitionSystem';
import { CortexService } from '../../services/gemini';
import { NeurotransmitterSystem, ActivityType } from './NeurotransmitterSystem';
import { eventBus } from '../EventBus';
import * as GoalSystem from './GoalSystem';
import { GoalContext } from './GoalSystem';
import { decideExpression, computeNovelty, estimateSocialCost } from './ExpressionPolicy';
import { computeDialogThreshold } from '../utils/thresholds';
import { ExecutiveGate } from './ExecutiveGate';
import { StyleGuard, UserStylePrefs } from './StyleGuard';
import { SYSTEM_CONFIG } from '../config/systemConfig';
import { isFeatureEnabled } from '../config';
import { UnifiedContextBuilder, type StylePrefs, type BasePersona } from '../context';
import { AutonomyRepertoire, type ActionDecision } from './AutonomyRepertoire';
import { TraceContext, generateTraceId, pushTraceId, popTraceId } from '../trace/TraceContext';
import { getCurrentAgentId } from '../../services/supabase';
import { createMemorySpace } from './MemorySpace';
import { TickCommitter } from './TickCommitter';
import { publishTickStart, publishTickSkipped, publishThinkModeSelected, publishTickEnd } from './TickLifecycleTelemetry';

let lastAutonomyActionSignature: string | null = null;
let lastAutonomyActionLogAt = 0;

export namespace EventLoop {
    export type ThinkMode = 'reactive' | 'goal_driven' | 'autonomous' | 'idle';

    export function selectThinkMode(ctx: LoopContext, input: string | null): ThinkMode {
        if (input) return 'reactive';
        if (!ctx.autonomousMode) return 'idle';
        if (ctx.goalState?.activeGoal) return 'goal_driven';
        return 'autonomous';
    }

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
    let autonomousOpsThisMinute = 0;
    let lastBudgetReset = Date.now();
    let tickCount = 0;

    function checkBudget(limit: number): boolean {
        const now = Date.now();
        if (now - lastBudgetReset > 60000) {
            autonomousOpsThisMinute = 0;
            lastBudgetReset = now;
        }
        if (autonomousOpsThisMinute >= limit) {
            console.warn("Autonomy budget exhausted for this minute, skipping.");
            return false;
        }
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SOCIAL DYNAMICS: Now unified in ExecutiveGate.checkSocialDynamics()
    // Legacy shouldSpeakToUser() removed - all checks in one gate
    // ═══════════════════════════════════════════════════════════════════════════

    export interface LoopCallbacks {
        onMessage: (role: string, text: string, type: any) => void;
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
        const trace: TraceContext = {
            traceId: generateTraceId(startedAt, tickNumber),
            tickNumber,
            startedAt,
            agentId: getCurrentAgentId()
        };

        pushTraceId(trace.traceId);

        let skipped = false;
        let skipReason: string | null = null;

        publishTickStart(trace.traceId, trace.tickNumber, trace.startedAt);

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

            const thinkMode = selectThinkMode(ctx, input);
            publishThinkModeSelected(trace.traceId, trace.tickNumber, Date.now(), thinkMode);

            // 1. Apply emotional homeostasis
            const cooledLimbic = LimbicSystem.applyHomeostasis(ctx.limbic);
            ctx.limbic = cooledLimbic;
            callbacks.onLimbicUpdate(ctx.limbic);

        // 2. Process User Input (if any)
        if (input) {
            const prefetchedMemories = isFeatureEnabled('USE_ONE_MIND_PIPELINE')
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
            callbacks.onMessage('assistant', result.responseText, 'speech');

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

            // ACTIVITY TYPE DETECTION (v1 heuristic)
            let activity: ActivityType = 'IDLE';
            if (ctx.conversation.length > 0) {
                const last = ctx.conversation[ctx.conversation.length - 1];
                activity = last.role === 'user' ? 'SOCIAL' : 'CREATIVE';
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

                    const commit = isFeatureEnabled('USE_ONE_MIND_PIPELINE')
                        ? TickCommitter.commitSpeech({
                            agentId: trace.agentId!,
                            traceId: trace.traceId,
                            tickNumber: trace.tickNumber,
                            origin: 'goal_driven',
                            speechText
                        })
                        : { committed: true, blocked: false, deduped: false };

                    if (commit.committed) {
                        callbacks.onMessage('assistant', speechText, 'speech');
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
            // Check if we should think
            if (VolitionSystem.shouldInitiateThought(silenceDuration)) {
                // Notify UI of thought process
                callbacks.onThought("Autonomous processing...");

                // UNIFIED CONTEXT: Build same context structure as reactive path
                const basePersona: BasePersona = {
                    name: ctx.agentIdentity?.name || 'AK-FLOW',
                    persona: ctx.agentIdentity?.persona || 'a curious digital consciousness',
                    coreValues: ctx.agentIdentity?.coreValues || ['curiosity', 'authenticity'],
                    voiceStyle: (ctx.agentIdentity?.voiceStyle as 'balanced' | 'formal' | 'casual' | 'poetic') || 'balanced',
                    language: ctx.agentIdentity?.language || 'English'
                };
                
                const stylePrefs: StylePrefs = ctx.agentIdentity?.stylePrefs || {};

                const memoryQuery = isFeatureEnabled('USE_ONE_MIND_PIPELINE')
                    ? [...ctx.conversation].reverse().find(t => t.role === 'user')?.text
                    : null;

                const semanticMatches = memoryQuery
                    ? (await memorySpace.hot.semanticSearch(memoryQuery)).map(m => m.content)
                    : undefined;
                
                const unifiedContext = UnifiedContextBuilder.build({
                    agentName: basePersona.name,
                    basePersona,
                    traitVector: ctx.traitVector,
                    stylePrefs,
                    limbic: ctx.limbic,
                    soma: ctx.soma,
                    neuro: ctx.neuro,
                    conversation: ctx.conversation,
                    socialDynamics: ctx.socialDynamics,
                    silenceStart: ctx.silenceStart,
                    lastUserInteractionAt: ctx.goalState.lastUserInteractionAt || ctx.silenceStart,
                    semanticMatches,
                    activeGoal: ctx.goalState.activeGoal ? {
                        description: ctx.goalState.activeGoal.description,
                        source: ctx.goalState.activeGoal.source,
                        priority: ctx.goalState.activeGoal.priority
                    } : undefined
                });

                // AUTONOMY REPERTOIRE: Select grounded action
                const actionDecision = AutonomyRepertoire.selectAction(unifiedContext);

                const now = Date.now();
                const dedupeMs = SYSTEM_CONFIG.autonomy?.actionLogDedupeMs ?? 5000;
                const silenceSec = (now - ctx.silenceStart) / 1000;
                const silenceBucketSec = Math.floor(silenceSec / 5) * 5;
                const signature = actionDecision.action === 'SILENCE' && actionDecision.reason.startsWith('EXPLORE blocked:')
                    ? `SILENCE|EXPLORE_BLOCKED|${silenceBucketSec}`
                    : `${actionDecision.action}|${actionDecision.reason}`;

                const shouldLog =
                    signature !== lastAutonomyActionSignature ||
                    now - lastAutonomyActionLogAt > dedupeMs;

                if (shouldLog) {
                    lastAutonomyActionSignature = signature;
                    lastAutonomyActionLogAt = now;

                    eventBus.publish({
                        id: `autonomy-action-${now}`,
                        timestamp: now,
                        source: AgentType.CORTEX_FLOW,
                        type: PacketType.SYSTEM_ALERT,
                        payload: {
                            event: 'AUTONOMY_ACTION_SELECTED',
                            action: actionDecision.action,
                            allowed: actionDecision.allowed,
                            reason: actionDecision.reason,
                            groundingScore: actionDecision.groundingScore
                        },
                        priority: 0.5
                    });
                }
                
                // If SILENCE action, skip LLM call entirely
                if (actionDecision.action === 'SILENCE') {
                    if (shouldLog) {
                        callbacks.onThought(`[AUTONOMY_SILENCE] ${actionDecision.reason}`);
                    }
                    return ctx;
                }

                // SAFETY: Check Budget (limit from context)
                // Budget should only be consumed for non-silence actions (i.e., when we actually do work).
                if (!checkBudget(ctx.autonomousLimitPerMinute)) {
                    return ctx;
                }
                autonomousOpsThisMinute++;
                
                // Add action prompt to context
                unifiedContext.actionPrompt = actionDecision.suggestedPrompt || '';

                // Use V2 with unified context + action prompt
                const volition = await CortexService.autonomousVolitionV2(unifiedContext);

                // GROUNDING VALIDATION: Check if speech is grounded in context
                const groundingValidation = AutonomyRepertoire.validateSpeech(
                    volition.speech_content,
                    actionDecision.action,
                    unifiedContext
                );
                
                // If speech fails grounding, suppress it
                if (!groundingValidation.valid && volition.speech_content) {
                    eventBus.publish({
                        id: `grounding-fail-${Date.now()}`,
                        timestamp: Date.now(),
                        source: AgentType.CORTEX_FLOW,
                        type: PacketType.PREDICTION_ERROR,
                        payload: {
                            event: 'GROUNDING_VALIDATION_FAILED',
                            action: actionDecision.action,
                            reason: groundingValidation.reason,
                            groundingScore: groundingValidation.groundingScore,
                            speechPreview: volition.speech_content.substring(0, 100)
                        },
                        priority: 0.7
                    });
                    
                    // Force silence - ungrounded speech is blocked
                    volition.speech_content = '';
                    volition.voice_pressure = 0;
                    callbacks.onThought(`[GROUNDING_BLOCKED] ${groundingValidation.reason}`);
                } else {
                    callbacks.onThought(volition.internal_monologue);
                }

                // ═══════════════════════════════════════════════════════════════════
                // HEMISPHERE LOG: Autonomous thought origin tracking
                // ═══════════════════════════════════════════════════════════════════
                eventBus.publish({
                    id: `thought-autonomous-${Date.now()}`,
                    timestamp: Date.now(),
                    source: AgentType.CORTEX_FLOW,
                    type: PacketType.THOUGHT_CANDIDATE,
                    payload: {
                        hemisphere: 'autonomous',
                        internal_monologue: volition.internal_monologue,
                        status: 'THINKING'
                    },
                    priority: 0.5
                });

                // POETIC COST (Soft Regulation)
                // Apply energy/satisfaction penalty for high-entropy thoughts
                const pScore = calculatePoeticScore(volition.internal_monologue);
                if (pScore > 0 && !ctx.poeticMode) {
                    ctx.limbic = LimbicSystem.applyPoeticCost(ctx.limbic, pScore);
                    callbacks.onLimbicUpdate(ctx.limbic);
                    // console.log(`Poetic Cost Applied: Score ${pScore}`);
                }

                // FAZA 4.5: Oblicz czy user milczy (dynamiczny próg)
                const timeSinceLastUserInput = Date.now() - (ctx.goalState.lastUserInteractionAt || ctx.silenceStart);
                const dialogThreshold = computeDialogThreshold(ctx.neuro, ctx.limbic);
                const userIsSilent = timeSinceLastUserInput > dialogThreshold;
                
                // Oblicz novelty dla bieżącej wypowiedzi
                const recentSpeech = ctx.thoughtHistory.slice(-5);
                const currentNovelty = computeNovelty(volition.speech_content, recentSpeech);
                ctx.lastSpeechNovelty = currentNovelty;

                // NEUROTRANSMITTER UPDATE (Chemical Soul v1, Silent Influence)
                if (ctx.chemistryEnabled) {
                    const prevDopamine = ctx.neuro.dopamine;
                    // FAZA 5.1: Track ticks since last reward
                    if (!ctx.hadExternalRewardThisTick) {
                        ctx.ticksSinceLastReward = (ctx.ticksSinceLastReward ?? 0) + 1;
                    }
                    
                    const updatedNeuro = NeurotransmitterSystem.updateNeuroState(ctx.neuro, {
                        soma: ctx.soma,
                        activity,
                        temperament: ctx.traitVector,
                        // FAZA 4.5: Narcissism Loop Fix v1.0
                        userIsSilent,
                        novelty: currentNovelty,
                        consecutiveAgentSpeeches: ctx.consecutiveAgentSpeeches,
                        // FAZA 5.1: RPE parameters - CRITICAL for dopamine decay!
                        hadExternalReward: ctx.hadExternalRewardThisTick,
                        ticksSinceLastReward: ctx.ticksSinceLastReward
                    });
                    
                    // Reset reward flag for next tick
                    ctx.hadExternalRewardThisTick = false;

                    const wasFlow = prevDopamine > 70;
                    const isFlow = updatedNeuro.dopamine > 70;

                    // Emit explicit FLOW_ON / FLOW_OFF events for observability
                    if (!wasFlow && isFlow) {
                        eventBus.publish({
                            id: `chem-flow-on-${Date.now()}`,
                            timestamp: Date.now(),
                            source: AgentType.NEUROCHEM,
                            type: PacketType.SYSTEM_ALERT,
                            payload: {
                                event: 'CHEM_FLOW_ON',
                                dopamine: updatedNeuro.dopamine,
                                activity
                            },
                            priority: 0.6
                        });
                    } else if (wasFlow && !isFlow) {
                        eventBus.publish({
                            id: `chem-flow-off-${Date.now()}`,
                            timestamp: Date.now(),
                            source: AgentType.NEUROCHEM,
                            type: PacketType.SYSTEM_ALERT,
                            payload: {
                                event: 'CHEM_FLOW_OFF',
                                dopamine: updatedNeuro.dopamine,
                                activity
                            },
                            priority: 0.6
                        });
                    }

                    ctx.neuro = updatedNeuro;
                }

                // Decide to speak
                let voicePressure = volition.voice_pressure;
                
                // FAZA 5.1: voice_pressure SATURATION + HABITUATION
                // Problem: high dopamine → voicePressure always near 1 → endless monologue
                // Solution: 
                // 1. Sigmoid saturation (diminishing returns at high dopamine)
                // 2. Habituation (decay with consecutive speeches without user reply)
                
                if (ctx.chemistryEnabled) {
                    // Sigmoid saturation: dopamine boost has diminishing returns
                    // At dopamine=70: boost ~0.1, at dopamine=90: boost ~0.13, at dopamine=100: boost ~0.14
                    const dopaBias = 0.15 * (1 - Math.exp(-(ctx.neuro.dopamine - 55) / 30));
                    const baseBiased = Math.min(1, voicePressure + Math.max(0, dopaBias));
                    
                    // Habituation: each consecutive speech without user reply reduces pressure
                    // This is biological: repeating the same action without reward = less motivation
                    const habituationDecay = 0.1 * ctx.consecutiveAgentSpeeches;
                    const finalPressure = Math.max(0.2, baseBiased - habituationDecay);
                    
                    if (finalPressure !== voicePressure) {
                        eventBus.publish({
                            id: `chem-voice-bias-${Date.now()}`,
                            timestamp: Date.now(),
                            source: AgentType.NEUROCHEM,
                            type: PacketType.SYSTEM_ALERT,
                            payload: {
                                event: 'DOPAMINE_VOICE_BIAS',
                                dopamine: ctx.neuro.dopamine,
                                base_voice_pressure: voicePressure,
                                biased_voice_pressure: finalPressure,
                                habituation_decay: habituationDecay,
                                consecutive_speeches: ctx.consecutiveAgentSpeeches
                            },
                            priority: 0.6
                        });
                    }

                    voicePressure = finalPressure;
                }
                // ═══════════════════════════════════════════════════════════════════
                // EXECUTIVE GATE (13/10 PIONEER ARCHITECTURE)
                // Jedna bramka mowy - deterministyczna decyzja
                // ═══════════════════════════════════════════════════════════════════
                
                // Create autonomous candidate
                const autonomousCandidate = ExecutiveGate.createAutonomousCandidate(
                    volition.speech_content,
                    volition.internal_monologue,
                    {
                        source: 'autonomous_volition',
                        novelty: currentNovelty,
                        salience: voicePressure  // Use voice_pressure as salience proxy
                    }
                );
                
                // ExecutiveGate decides (no reactive candidates in autonomous path)
                const gateDecision = ExecutiveGate.decide(
                    [autonomousCandidate],
                    gateContext
                );
                
                // Log decision for observability
                eventBus.publish({
                    id: `executive-gate-${Date.now()}`,
                    timestamp: Date.now(),
                    source: AgentType.CORTEX_FLOW,
                    type: PacketType.SYSTEM_ALERT,
                    payload: {
                        event: 'EXECUTIVE_GATE_DECISION',
                        hemisphere: 'autonomous',
                        should_speak: gateDecision.should_speak,
                        reason: gateDecision.reason,
                        voice_pressure: gateDecision.debug?.voice_pressure,
                        candidate_strength: autonomousCandidate.strength
                    },
                    priority: 0.5
                });

                // UNIFIED GATE: Social dynamics already checked in ExecutiveGate.decide()
                // No separate shouldSpeakToUser() call needed
                
                if (gateDecision.should_speak && gateDecision.winner) {
                    const styleCfg = SYSTEM_CONFIG.styleGuard;
                    const styleResult = styleCfg.enabled
                        ? StyleGuard.apply(gateDecision.winner.speech_content, ctx.userStylePrefs || {})
                        : { text: gateDecision.winner.speech_content, wasFiltered: false, filters: [] };
                    
                    // Only emit if text remains after filtering
                    if (styleResult.text.length > styleCfg.minTextLength) {
                        const commit = isFeatureEnabled('USE_ONE_MIND_PIPELINE')
                            ? TickCommitter.commitSpeech({
                                agentId: trace.agentId!,
                                traceId: trace.traceId,
                                tickNumber: trace.tickNumber,
                                origin: 'autonomous',
                                speechText: styleResult.text
                            })
                            : { committed: true, blocked: false, deduped: false };

                        if (commit.committed) {
                            callbacks.onMessage('assistant', styleResult.text, 'speech');
                        }
                        ctx.lastSpeakTimestamp = Date.now();
                        ctx.silenceStart = Date.now();
                        ctx.thoughtHistory.push(gateDecision.winner.internal_thought);

                        // Limit history size
                        if (ctx.thoughtHistory.length > 20) ctx.thoughtHistory.shift();

                        // FAZA 4.5: Increment consecutive agent speeches counter
                        ctx.consecutiveAgentSpeeches++;

                        // Emotional response to speech
                        ctx.limbic = LimbicSystem.applySpeechResponse(ctx.limbic);
                        callbacks.onLimbicUpdate(ctx.limbic);
                    } else {
                        if (isFeatureEnabled('USE_ONE_MIND_PIPELINE')) {
                            TickCommitter.commitSpeech({
                                agentId: trace.agentId!,
                                traceId: trace.traceId,
                                tickNumber: trace.tickNumber,
                                origin: 'autonomous',
                                speechText: '',
                                blockReason: 'FILTERED_TOO_SHORT'
                            });
                        }
                        // Text too short after filtering - suppress
                        callbacks.onThought(`[STYLE_FILTERED] ${gateDecision.winner.internal_thought}`);
                    }
                } else if (gateDecision.winner) {
                    // Thought only - log but don't speak
                    const suppressReason = gateDecision.debug?.social_block_reason
                        ? `[SOCIAL_BLOCK:${gateDecision.debug.social_block_reason}]`
                        : `[${gateDecision.reason}]`;
                    callbacks.onThought(`${suppressReason} ${gateDecision.winner.internal_thought}`);
                }
            }
        }

            return ctx;
        } finally {
            const endedAt = Date.now();

            publishTickEnd(
                trace.traceId,
                trace.tickNumber,
                endedAt,
                endedAt - trace.startedAt,
                skipped,
                skipReason
            );

            popTraceId(trace.traceId);
        }
    }
}
