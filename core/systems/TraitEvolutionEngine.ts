import { eventBus } from '../EventBus';
import { PacketType, TraitVote, TraitVector, NeurotransmitterState } from '../../types';

interface TraitEvolutionSignal {
    dimension: keyof TraitVector;
    direction: 'increase' | 'decrease';
    strength: number;
    date: string;
    is_success: boolean;
}

interface TraitEvolutionProposal {
    dimension: keyof TraitVector;
    currentValue: number;
    proposedValue: number;
    delta: number;
    evidence: {
        successVotes: number;
        failureVotes: number;
        uniqueDays: number;
    };
}

/**
 * TraitEvolutionEngine v2.0 - Homeostatic Evolution
 * 
 * KARPATHY PRINCIPLE: Replace if-thresholds with continuous homeostasis.
 * 
 * OLD (v1): if (uniqueDays >= 3 && netScore >= 3) → binary change
 * NEW (v2): trait = trait * (1 - α) + signal * α → continuous drift
 * 
 * Rules:
 * - Traits drift CONTINUOUSLY toward signal average
 * - Learning rate α depends on confidence (signal count, unique days)
 * - Dopamine modulates learning rate (high dopa = faster learning)
 * - Clamped to [0.3, 0.7]
 */
export class TraitEvolutionEngine {
    private signals: TraitEvolutionSignal[] = [];
    private readonly CLAMP_MIN = 0.3;
    private readonly CLAMP_MAX = 0.7;
    private readonly MAX_DELTA = 0.01;
    private readonly BASE_LEARNING_RATE = 0.005; // Very slow base learning

    constructor() {
        // Collect signals from confession reports
        eventBus.subscribe(PacketType.CONFESSION_REPORT, (packet) => {
            const vote = packet.payload?.recommended_regulation?.trait_vote as TraitVote;
            if (vote) {
                this.addSignal(vote);
            }
        });

        // Collect signals from success service
        eventBus.subscribe(PacketType.TRAIT_EVOLUTION_SIGNAL, (packet) => {
            const vote = packet.payload as TraitVote;
            if (vote) {
                this.addSignal(vote);
            }
        });

        console.log('[TraitEvolutionEngine] Initialized.');
    }

    private addSignal(vote: TraitVote) {
        const today = new Date().toISOString().split('T')[0];
        this.signals.push({
            dimension: vote.dimension,
            direction: vote.direction,
            strength: vote.weight,
            date: today,
            is_success: vote.is_success
        });

        // Keep only last 30 days of signals
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        this.signals = this.signals.filter(s => s.date >= cutoffStr);
    }

    /**
     * v2.0: Homeostatic trait evolution - continuous drift instead of binary jumps.
     * 
     * KARPATHY: "Replace 50 lines of if-else with 1 cost function."
     * 
     * @param currentTraits - Current trait vector
     * @param neuro - Neurochemical state (dopamine modulates learning rate)
     * @returns Updated trait vector (always changes, but very slowly)
     */
    public applyTraitHomeostasis(
        currentTraits: TraitVector,
        neuro?: NeurotransmitterState
    ): TraitVector {
        const last7Days = this.getSignalsFromDays(7);
        const grouped = this.groupByDimension(last7Days);
        
        const updatedTraits = { ...currentTraits };
        
        for (const [dimension, signals] of Object.entries(grouped)) {
            if (signals.length === 0) continue;
            
            const dimKey = dimension as keyof TraitVector;
            const current = currentTraits[dimKey] || 0.5;
            
            // Calculate target from signals (weighted average)
            const targetSignal = this.calculateTargetSignal(signals, current);
            
            // Calculate confidence (more signals + more days = higher confidence)
            const confidence = this.calculateConfidence(signals);
            
            // Dopamine modulation: high dopamine = faster learning (more plastic)
            const dopamineFactor = neuro ? 0.5 + (neuro.dopamine / 200) : 1.0; // 0.5-1.0
            
            // Learning rate: base * confidence * dopamine
            // Base rate is very small (0.001) to ensure slow evolution
            const α = this.BASE_LEARNING_RATE * confidence * dopamineFactor;
            
            // Homeostatic update: trait drifts toward target
            const newValue = current * (1 - α) + targetSignal * α;
            updatedTraits[dimKey] = this.clamp(newValue);
            
            // Log significant changes
            const delta = newValue - current;
            if (Math.abs(delta) > 0.0001) {
                console.log(
                    `[TraitEvolution] ${dimension}: ${current.toFixed(4)} → ${newValue.toFixed(4)} ` +
                    `(α=${α.toFixed(4)}, confidence=${confidence.toFixed(2)}, signals=${signals.length})`
                );
            }
        }
        
        return updatedTraits;
    }
    
    /**
     * Calculate target signal value from recent signals.
     * Success signals push toward increase, failure toward decrease.
     */
    private calculateTargetSignal(signals: TraitEvolutionSignal[], current: number): number {
        let weightedSum = 0;
        let totalWeight = 0;
        
        for (const signal of signals) {
            const weight = signal.strength;
            // Success = push toward 0.7, Failure = push toward 0.3
            const target = signal.is_success 
                ? (signal.direction === 'increase' ? 0.7 : 0.3)
                : (signal.direction === 'increase' ? 0.3 : 0.7);
            
            weightedSum += target * weight;
            totalWeight += weight;
        }
        
        return totalWeight > 0 ? weightedSum / totalWeight : current;
    }
    
    /**
     * Calculate confidence based on signal count and unique days.
     * More signals over more days = higher confidence = faster learning.
     */
    private calculateConfidence(signals: TraitEvolutionSignal[]): number {
        const uniqueDays = new Set(signals.map(s => s.date)).size;
        const signalCount = signals.length;
        
        // Confidence formula: sqrt(days) * log(signals + 1) / 10
        // At 1 day, 1 signal: ~0.0
        // At 3 days, 5 signals: ~0.31
        // At 7 days, 10 signals: ~0.63
        const confidence = Math.sqrt(uniqueDays) * Math.log(signalCount + 1) / 10;
        
        return Math.min(1.0, confidence);
    }

    /**
     * LEGACY: Evaluate if any trait should evolve (v1 binary logic).
     * Kept for backwards compatibility and A/B testing.
     * @deprecated Use applyTraitHomeostasis() instead
     */
    public evaluateEvolution(currentTraits: TraitVector): TraitEvolutionProposal | null {
        const last7Days = this.getSignalsFromDays(7);
        const grouped = this.groupByDimension(last7Days);

        for (const [dimension, signals] of Object.entries(grouped)) {
            const successVotes = signals.filter(s => s.is_success);
            const failureVotes = signals.filter(s => !s.is_success);
            const uniqueDays = new Set(signals.map(s => s.date)).size;

            // Net score
            const netScore = successVotes.length - failureVotes.length;

            // Rule: ≥3 unique days AND net ≥3 in one direction
            if (uniqueDays >= 3 && Math.abs(netScore) >= 3) {
                const direction = netScore > 0 ? 'increase' : 'decrease';
                const delta = direction === 'increase' ? this.MAX_DELTA : -this.MAX_DELTA;
                const current = currentTraits[dimension as keyof TraitVector] || 0.5;
                const proposed = this.clamp(current + delta);

                return {
                    dimension: dimension as keyof TraitVector,
                    currentValue: current,
                    proposedValue: proposed,
                    delta,
                    evidence: {
                        successVotes: successVotes.length,
                        failureVotes: failureVotes.length,
                        uniqueDays
                    }
                };
            }
        }

        return null;
    }

    private getSignalsFromDays(days: number): TraitEvolutionSignal[] {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        return this.signals.filter(s => s.date >= cutoffStr);
    }

    private groupByDimension(signals: TraitEvolutionSignal[]): Record<string, TraitEvolutionSignal[]> {
        return signals.reduce((acc, s) => {
            if (!acc[s.dimension]) acc[s.dimension] = [];
            acc[s.dimension].push(s);
            return acc;
        }, {} as Record<string, TraitEvolutionSignal[]>);
    }

    private clamp(value: number): number {
        return Math.max(this.CLAMP_MIN, Math.min(this.CLAMP_MAX, value));
    }

    /** Get current signal count for debugging */
    public getSignalCount(): number {
        return this.signals.length;
    }
}
