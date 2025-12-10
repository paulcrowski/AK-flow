/**
 * WakeService - Single Source of Truth for Wake Process
 * 
 * ARCHITEKTURA: Jeden serwis, jedna funkcja, jedno miejsce do zmiany.
 * 
 * Odpowiedzialność:
 * 1. TraitEvolution (homeostasis)
 * 2. DreamConsolidation (lessons, identity, shards)
 * 3. Logging do identity_evolution_log
 * 
 * Używany przez:
 * - toggleSleep (force wake)
 * - cognitiveCycle (auto wake)
 * 
 * @module core/services/WakeService
 */

import { TraitEvolutionEngine } from '../systems/TraitEvolutionEngine';
import { DreamConsolidationService } from '../../services/DreamConsolidationService';
import { updateAgentTraitVector, logIdentityEvolution } from './IdentityDataService';
import type { TraitVector, LimbicState, NeurotransmitterState } from '../../types';

// ═══════════════════════════════════════════════════════════════
// SINGLETON: One TraitEvolutionEngine instance for entire app
// Preserves signals across wake cycles
// ═══════════════════════════════════════════════════════════════
let traitEngineInstance: TraitEvolutionEngine | null = null;

function getTraitEngine(): TraitEvolutionEngine {
    if (!traitEngineInstance) {
        traitEngineInstance = new TraitEvolutionEngine();
    }
    return traitEngineInstance;
}

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface WakeInput {
    agentId: string;
    agentName: string;
    currentTraits: TraitVector;
    currentLimbic: LimbicState;
    currentNeuro: NeurotransmitterState;
}

export interface WakeResult {
    success: boolean;
    evolvedTraits: TraitVector | null;
    consolidation: {
        episodesProcessed: number;
        lessonsGenerated: number;
        identityUpdated: boolean;
    } | null;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════
// MAIN SERVICE
// ═══════════════════════════════════════════════════════════════

/**
 * Execute full wake process - SINGLE SOURCE OF TRUTH
 * 
 * Called by both force wake and auto wake.
 * All wake logic lives HERE and ONLY here.
 */
export async function executeWakeProcess(input: WakeInput): Promise<WakeResult> {
    console.log('☀️ [WakeService] Starting wake process...');

    const result: WakeResult = {
        success: false,
        evolvedTraits: null,
        consolidation: null
    };

    try {
        // ═══════════════════════════════════════════════════════════════
        // STEP 1: Trait Evolution (Homeostasis)
        // ═══════════════════════════════════════════════════════════════
        const traitEngine = getTraitEngine();
        const traitsBefore = { ...input.currentTraits };
        const evolvedTraits = traitEngine.applyTraitHomeostasis(
            input.currentTraits,
            input.currentNeuro
        );

        // Save to database
        await updateAgentTraitVector(input.agentId, evolvedTraits);

        // Log evolution
        await logIdentityEvolution({
            agentId: input.agentId,
            component: 'trait_vector',
            stateBefore: traitsBefore,
            stateAfter: evolvedTraits,
            trigger: 'homeostasis',
            reason: 'wake_cycle_homeostasis'
        });

        result.evolvedTraits = evolvedTraits;
        console.log('🧬 [WakeService] Trait evolution applied:', evolvedTraits);

        // ═══════════════════════════════════════════════════════════════
        // STEP 2: Dream Consolidation (Lessons, Identity, Shards)
        // ═══════════════════════════════════════════════════════════════
        try {
            const consolidationResult = await DreamConsolidationService.consolidate(
                input.currentLimbic,
                evolvedTraits,
                input.agentName
            );

            result.consolidation = {
                episodesProcessed: consolidationResult.episodesProcessed,
                lessonsGenerated: consolidationResult.lessonsGenerated.length,
                identityUpdated: consolidationResult.identityConsolidation?.narrativeSelfUpdated ?? false
            };

            console.log('💤 [WakeService] Dream consolidation complete:', result.consolidation);
        } catch (consolidationError) {
            console.error('💤 [WakeService] Dream consolidation error:', consolidationError);
            // Non-fatal - wake still succeeds
        }

        result.success = true;
        console.log('☀️ [WakeService] Wake process complete');

    } catch (error) {
        console.error('☀️ [WakeService] Wake process error:', error);
        result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
}

/**
 * Get singleton TraitEvolutionEngine for external use (e.g., signal count)
 */
export function getTraitEvolutionEngine(): TraitEvolutionEngine {
    return getTraitEngine();
}

export default {
    executeWakeProcess,
    getTraitEvolutionEngine
};
