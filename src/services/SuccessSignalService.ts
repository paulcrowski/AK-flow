import { eventBus } from '../core/EventBus';
import { AgentType, PacketType, TraitVote, TraitVector } from '../types';

/**
 * SuccessSignalService
 * 
 * Detects positive user feedback and emits trait votes.
 * Super-human: evolution from BOTH failures AND successes.
 */
export class SuccessSignalService {
    private static instance: SuccessSignalService;
    private lastResponse: string = '';

    private constructor() {
        // Track last agent response
        eventBus.subscribe(PacketType.MOTOR_COMMAND, (packet) => {
            if (packet.payload?.action === 'SPEAK') {
                this.lastResponse = packet.payload.content || '';
            }
        });
        console.log('[SuccessSignalService] Initialized.');
    }

    public static getInstance(): SuccessSignalService {
        if (!SuccessSignalService.instance) {
            SuccessSignalService.instance = new SuccessSignalService();
        }
        return SuccessSignalService.instance;
    }

    /**
     * Call this when user sends input to detect success signals
     */
    public checkForSuccess(userInput: string): TraitVote | null {
        const input = userInput.toLowerCase();

        // Positive patterns
        const positivePatterns = [
            'thanks', 'thank you', 'great', 'perfect',
            'exactly', 'dobrze', 'super', 'świetnie',
            'yes', 'correct', 'good', 'awesome'
        ];

        const isPositive = positivePatterns.some(p => input.includes(p));

        if (isPositive && this.lastResponse.length > 0) {
            const vote = this.generateSuccessVote(this.lastResponse);

            if (vote) {
                // Emit as trait evolution signal
                eventBus.publish({
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    source: AgentType.MORAL,
                    type: PacketType.TRAIT_EVOLUTION_SIGNAL,
                    payload: vote,
                    priority: 0.5
                });
            }

            return vote;
        }

        return null;
    }

    private generateSuccessVote(lastResponse: string): TraitVote | null {
        // Detect which trait was successful based on response characteristics
        const dimension = this.detectRelevantDimension(lastResponse);

        if (dimension) {
            return {
                dimension,
                direction: 'increase',  // Reinforce!
                weight: 1,
                reason: 'positive_user_feedback',
                is_success: true
            };
        }
        return null;
    }

    private detectRelevantDimension(response: string): keyof TraitVector | null {
        // Long, structured response = reinforce conscientiousness
        if (response.length > 300 && (response.includes('##') || response.includes('1.'))) {
            return 'conscientiousness';
        }
        // Creative, expressive = reinforce verbosity (as positive: rich expression)
        if (response.includes('imagine') || response.includes('dream') || response.includes('create')) {
            return 'verbosity';
        }
        return null;
    }
}

export const successSignalService = SuccessSignalService.getInstance();
