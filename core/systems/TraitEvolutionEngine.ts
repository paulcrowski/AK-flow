import { eventBus } from '../EventBus';
import { PacketType, TraitVote, TraitVector } from '../../types';

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
 * TraitEvolutionEngine
 * 
 * Long-term personality evolution. Changes SLOWLY based on consistent patterns.
 * 
 * Rules:
 * - Requires ≥3 unique days of signals
 * - Net score (successes - failures) must be ≥3 or ≤-3
 * - Max change per event: ±0.01
 * - Clamped to [0.3, 0.7]
 */
export class TraitEvolutionEngine {
    private signals: TraitEvolutionSignal[] = [];
    private readonly CLAMP_MIN = 0.3;
    private readonly CLAMP_MAX = 0.7;
    private readonly MAX_DELTA = 0.01;

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
     * Evaluate if any trait should evolve. Call weekly or during sleep.
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
