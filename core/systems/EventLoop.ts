/**
 * EventLoop.ts - The Central Cognitive Cycle
 * 
 * Responsibility: Orchestrates the cognitive loop, managing state transitions,
 * input processing, and autonomous behavior with safety limits.
 */

import { LimbicState, SomaState, NeurotransmitterState, AgentType, PacketType, GoalState, Goal, TraitVector } from '../../types';
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

export namespace EventLoop {
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
    }

    // Module-level Budget Tracking (counters only, limit is in context)
    let autonomousOpsThisMinute = 0;
    let lastBudgetReset = Date.now();

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
        // 1. Apply emotional homeostasis
        const cooledLimbic = LimbicSystem.applyHomeostasis(ctx.limbic);
        ctx.limbic = cooledLimbic;
        callbacks.onLimbicUpdate(ctx.limbic);

        // 2. Process User Input (if any)
        if (input) {
            const result = await CortexSystem.processUserMessage({
                text: input,
                currentLimbic: ctx.limbic,
                currentSoma: ctx.soma,
                conversationHistory: ctx.conversation,
                // FAZA 5: Pass identity context
                identity: ctx.agentIdentity,
                sessionOverlay: ctx.sessionOverlay
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

            // 3B. GOAL EXECUTION (single-shot)
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

                if (result.internalThought) {
                    callbacks.onMessage('assistant', result.internalThought, 'thought');
                }

                callbacks.onMessage('assistant', result.responseText, 'speech');

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

                // SAFETY: Check Budget (limit from context)
                if (!checkBudget(ctx.autonomousLimitPerMinute)) {
                    return ctx;
                }
                autonomousOpsThisMinute++;

                // Generate Thought
                const historyText = ctx.conversation.slice(-3).map(m => m.text).join('\n');

                // Notify UI of thought process
                callbacks.onThought("Autonomous processing...");

                const volition = await CortexService.autonomousVolition(
                    JSON.stringify(ctx.limbic),
                    "Latent processing...",
                    historyText,
                    silenceDuration
                );

                callbacks.onThought(volition.internal_monologue);

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
                const decision = VolitionSystem.shouldSpeak(
                    volition.internal_monologue,
                    voicePressure,
                    silenceDuration,
                    ctx.limbic,
                    ctx.thoughtHistory,
                    ctx.lastSpeakTimestamp,
                    Date.now(),
                    ctx.poeticMode, // Pass mode to volition
                    ctx.soma.isSleeping // FAZA 5: Sleep Mode v1
                );

                if (decision.shouldSpeak) {
                    callbacks.onMessage('assistant', volition.speech_content, 'speech');
                    ctx.lastSpeakTimestamp = Date.now();
                    ctx.silenceStart = Date.now();
                    ctx.thoughtHistory.push(volition.internal_monologue);

                    // Limit history size
                    if (ctx.thoughtHistory.length > 20) ctx.thoughtHistory.shift();

                    // FAZA 4.5: Increment consecutive agent speeches counter
                    ctx.consecutiveAgentSpeeches++;

                    // Emotional response to speech
                    ctx.limbic = LimbicSystem.applySpeechResponse(ctx.limbic);
                    callbacks.onLimbicUpdate(ctx.limbic);
                }
            }
        }

        return ctx;
    }
}
