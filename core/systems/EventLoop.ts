/**
 * EventLoop.ts - The Central Cognitive Cycle
 * 
 * Responsibility: Orchestrates the cognitive loop, managing state transitions,
 * input processing, and autonomous behavior with safety limits.
 */

import { LimbicState, SomaState } from '../../types';
import { LimbicSystem } from './LimbicSystem';
import { CortexSystem, ConversationTurn } from './CortexSystem';
import { VolitionSystem, calculatePoeticScore } from './VolitionSystem';
import { CortexService } from '../../services/gemini';

export namespace EventLoop {
    export interface LoopContext {
        soma: SomaState;
        limbic: LimbicState;
        conversation: ConversationTurn[];
        autonomousMode: boolean;
        lastSpeakTimestamp: number;
        silenceStart: number;
        thoughtHistory: string[];
        poeticMode: boolean; // NEW: Track if user requested poetic style
        autonomousLimitPerMinute: number; // Budget limit for autonomous operations
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
                conversationHistory: ctx.conversation
            });

            // DETECT POETIC MODE REQUEST
            const lowerInput = input.toLowerCase();
            if (lowerInput.includes("poetic") || lowerInput.includes("metaphor") || lowerInput.includes("abstract")) {
                ctx.poeticMode = true;
                console.log("Poetic Mode ENABLED by user request.");
            } else if (lowerInput.includes("simple") || lowerInput.includes("plain") || lowerInput.includes("normal")) {
                ctx.poeticMode = false;
                console.log("Poetic Mode DISABLED by user request.");
            }

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

            // Reset silence
            ctx.silenceStart = Date.now();
            ctx.lastSpeakTimestamp = Date.now();
        }

        // 3. Autonomous Volition (only if autonomousMode is ON)
        if (ctx.autonomousMode && !input) {
            const silenceDuration = (Date.now() - ctx.silenceStart) / 1000;

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

                // Decide to speak
                const decision = VolitionSystem.shouldSpeak(
                    volition.internal_monologue,
                    volition.voice_pressure,
                    silenceDuration,
                    ctx.limbic,
                    ctx.thoughtHistory,
                    ctx.lastSpeakTimestamp,
                    Date.now(),
                    ctx.poeticMode // Pass mode to volition
                );

                if (decision.shouldSpeak) {
                    callbacks.onMessage('assistant', volition.speech_content, 'speech');
                    ctx.lastSpeakTimestamp = Date.now();
                    ctx.silenceStart = Date.now();
                    ctx.thoughtHistory.push(volition.internal_monologue);

                    // Limit history size
                    if (ctx.thoughtHistory.length > 20) ctx.thoughtHistory.shift();

                    // Emotional response to speech
                    ctx.limbic = LimbicSystem.applySpeechResponse(ctx.limbic);
                    callbacks.onLimbicUpdate(ctx.limbic);
                }
            }
        }

        return ctx;
    }
}
