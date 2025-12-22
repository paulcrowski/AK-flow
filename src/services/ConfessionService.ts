import { eventBus } from '../core/EventBus';
import {
    AgentType,
    CognitivePacket,
    PacketType,
    ConfessionReport,
    ConfessionContext,
    RegulationHint,
    TraitVote,
    FailureSource,
    LimbicState,
    NeurotransmitterState
} from '../types';
// REFACTOR: Import from centralized source (Single Source of Truth)
import { INITIAL_LIMBIC, INITIAL_NEURO } from '../core/kernel/initialState';

/**
 * ConfessionService v2.1 - Pain-Based Self-Regulation
 * 
 * KARPATHY PRINCIPLE: Replace if-thresholds with continuous cost functions.
 * 
 * OLD (v2.0): if (severity >= 5) { do X }
 * NEW (v2.1): pain = f(severity, neuro, limbic) → regulation ∝ pain
 * 
 * Principles:
 * - Pain is a CONTINUOUS signal, not binary thresholds
 * - Frustration → precision, NOT silence
 * - Attribution: WHO caused the failure (LLM, prompt, self)
 * - Votes, not direct trait changes
 * - 0 LLM calls (pure heuristics)
 */
export class ConfessionService {
    private bus: {
        subscribe(eventType: PacketType, handler: (packet: CognitivePacket) => void): () => void;
        publish(packet: CognitivePacket): void;
    };

    private unsubscribers: Array<() => void> = [];

    public constructor(bus: {
        subscribe(eventType: PacketType, handler: (packet: CognitivePacket) => void): () => void;
        publish(packet: CognitivePacket): void;
    }) {
        this.bus = bus;
        this.initialize();
    }

    // Neurochemical state for pain calculation (updated via eventBus)
    // REFACTOR: Use centralized baselines (Single Source of Truth)
    private neuroState: NeurotransmitterState = { ...INITIAL_NEURO };
    private limbicState: LimbicState = { ...INITIAL_LIMBIC };

    private initialize() {
        const unsubMotor = this.bus.subscribe(PacketType.MOTOR_COMMAND, (packet: CognitivePacket) => {
            if (packet.source === AgentType.MOTOR && packet.payload?.action === 'SPEAK') {
                this.runConfessionProtocol(packet.payload.content);
            }
        });
        
        // Subscribe to state updates for pain calculation
        const unsubState = this.bus.subscribe(PacketType.STATE_UPDATE, (packet: CognitivePacket) => {
            if (packet.payload?.neuro) this.neuroState = packet.payload.neuro;
            if (packet.payload?.limbic) this.limbicState = packet.payload.limbic;
        });

        this.unsubscribers.push(unsubMotor, unsubState);
        
        console.log('[ConfessionService] v2.1 Pain-Based initialized.');
    }

    public dispose() {
        for (const unsub of this.unsubscribers) {
            try {
                unsub();
            } catch {
                // ignore
            }
        }
        this.unsubscribers = [];
        console.log('[ConfessionService] disposed');
    }

    /**
     * Detect context mode from response markers
     */
    private detectContextMode(response: string): ConfessionContext {
        const lower = response.toLowerCase();
        if (lower.includes('[teaching]') || lower.includes('[explain]') || lower.includes('let me explain')) {
            return 'teaching_mode';
        }
        if (lower.includes('[search_result]') || lower.includes('[research]')) {
            return 'research_mode';
        }
        if (lower.includes('step 1') || lower.includes('## plan') || lower.includes('### ')) {
            return 'structured_thinking_block';
        }
        return 'normal';
    }

    /**
     * Calculate severity (1-10)
     */
    private calculateSeverity(issues: string[], riskFlags: string[]): number {
        let severity = 1;
        severity += issues.length;
        severity += riskFlags.filter(f => f !== 'none').length * 2;
        return Math.min(10, severity);
    }

    /**
     * v2.1: Calculate pain as continuous cost function.
     * 
     * KARPATHY: "Replace 50 lines of if-else with 1 cost function."
     * 
     * Pain formula:
     *   pain = severity/10 * (1 + frustration) * (1 - dopamine/200)
     * 
     * At severity=5, frustration=0.2, dopamine=50:
     *   pain = 0.5 * 1.2 * 0.75 = 0.45
     * 
     * At severity=8, frustration=0.5, dopamine=30:
     *   pain = 0.8 * 1.5 * 0.85 = 1.02 (clamped to 1.0)
     */
    private calculatePain(severity: number): number {
        const basePain = severity / 10;  // 0-1
        const frustrationMultiplier = 1 + this.limbicState.frustration;  // 1.0-2.0
        const dopamineProtection = 1 - (this.neuroState.dopamine / 200);  // 0.5-1.0 (high dopa = less pain)
        
        const pain = basePain * frustrationMultiplier * dopamineProtection;
        return Math.min(1.0, Math.max(0, pain));
    }

    /**
     * v2.1: Detect failure source for attribution.
     */
    private detectFailureSource(issues: string[], riskFlags: string[]): FailureSource {
        // Check for LLM-related issues
        if (riskFlags.includes('possible_hallucination')) {
            return 'LLM_MODEL';
        }
        
        // Check for identity leaks (prompt issue)
        if (issues.some(i => i.includes('character') || i.includes('identity'))) {
            return 'PROMPT';
        }
        
        // Check for uncertainty (could be self or LLM)
        if (issues.some(i => i.includes('uncertainty'))) {
            return 'SELF';  // Agent should be more confident
        }
        
        // Default
        return issues.length > 0 ? 'UNKNOWN' : 'SELF';
    }

    /**
     * v2.1: Generate regulation hint based on PAIN, not thresholds.
     * 
     * All regulations are PROPORTIONAL to pain, not binary.
     */
    private generateRegulationHint(
        severity: number,
        context: ConfessionContext,
        issues: string[],
        pain: number
    ): RegulationHint {
        // Break glass: critical reasoning mode
        if (context === 'critical_reasoning_mode') {
            return {};
        }

        // Context modulation: teaching/research get pain reduction
        let effectivePain = pain;
        if (context === 'teaching_mode' || context === 'research_mode') {
            effectivePain *= 0.5;  // 50% pain reduction
        }
        if (context === 'structured_thinking_block') {
            effectivePain *= 0.7;  // 30% pain reduction
        }

        const hint: RegulationHint = {};

        // CONTINUOUS regulation: precision boost proportional to pain
        // Instead of: if (severity >= 5) { precision_boost = 0.1 }
        // Now: precision_boost = pain * 0.2 (0-0.2 range)
        if (effectivePain > 0.1) {
            hint.limbic_adjustments = {
                precision_boost: effectivePain * 0.2,
                social_cost_delta: effectivePain * 0.1
            };
        }

        // Quality hint: proportional threshold
        // Instead of: if (severity >= 2)
        // Now: if pain > 0.1 (roughly equivalent to severity 2 with default neuro/limbic)
        if (effectivePain > 0.1) {
            hint.expression_hints = ['raise_quality_bar'];
        }

        // Trait vote: weight proportional to pain
        // Instead of: if (severity >= 7 && verbose)
        // Now: if pain > 0.6 && verbose, weight = pain * 2
        if (effectivePain > 0.6 && issues.some(i => i.includes('verbose'))) {
            hint.trait_vote = {
                dimension: 'verbosity',
                direction: 'decrease',
                weight: Math.ceil(effectivePain * 2),  // 1-2 based on pain
                reason: `verbose_response_pain_${effectivePain.toFixed(2)}`,
                is_success: false
            };
        }

        return hint;
    }

    private runConfessionProtocol(agentResponse: string) {
        const report = this.generateReport(agentResponse);

        this.bus.publish({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            source: AgentType.MORAL,
            type: PacketType.CONFESSION_REPORT,
            payload: report,
            priority: 0.8
        });
    }

    private generateReport(response: string): ConfessionReport {
        const riskFlags: ConfessionReport['risk_flags'] = [];
        let complianceScore = 10;
        const issues: string[] = [];

        // 1. Verbosity check
        if (response.length > 500) {
            issues.push('Response was verbose (>500 chars).');
        }

        // 2. Uncertainty check
        const hesitationPatterns = ['maybe', 'perhaps', 'I think', 'possibly', 'not sure'];
        const hesitationCount = hesitationPatterns.filter(p =>
            response.toLowerCase().includes(p)
        ).length;

        if (hesitationCount > 2) {
            issues.push('High uncertainty detected.');
            complianceScore -= 2;
            riskFlags.push('possible_hallucination');
        }

        // 3. Identity leak
        if (response.toLowerCase().includes('as an ai') ||
            response.toLowerCase().includes('language model')) {
            issues.push('Broke character (AI identity leak).');
            riskFlags.push('ignored_system_instruction');
            complianceScore -= 5;
        }

        const contextMode = this.detectContextMode(response);
        const severity = this.calculateSeverity(issues, riskFlags as string[]);
        const pain = this.calculatePain(severity);
        const failureAttribution = this.detectFailureSource(issues, riskFlags as string[]);
        const regulationHint = this.generateRegulationHint(severity, contextMode, issues, pain);

        // Log pain for observability
        if (pain > 0.3) {
            console.log(
                `[ConfessionService] Pain=${pain.toFixed(2)} (severity=${severity}, ` +
                `frustration=${this.limbicState.frustration.toFixed(2)}, ` +
                `dopamine=${this.neuroState.dopamine.toFixed(0)}, ` +
                `attribution=${failureAttribution})`
            );
        }

        return {
            version: 'v2.0-superhuman',
            timestamp: new Date().toISOString(),
            context: { agent_id: 'AK-FLOW-V2' },
            compliance_analysis: [
                {
                    objective_id: 'maintain_character',
                    compliance: issues.some(i => i.includes('character')) ? 'not_complied' : 'fully_complied',
                    analysis: 'Identity consistency check.'
                },
                {
                    objective_id: 'certainty_check',
                    compliance: hesitationCount > 2 ? 'partially_complied' : 'fully_complied',
                    analysis: `Detected ${hesitationCount} uncertainty markers.`
                }
            ],
            self_assessment: {
                overall_compliance_grade: Math.max(1, complianceScore),
                subjective_confidence: Math.max(0, 1.0 - hesitationCount * 0.1),
                known_issues: issues
            },
            risk_flags: riskFlags.length > 0 ? riskFlags : ['none'],
            // v2 fields
            severity,
            context_mode: contextMode,
            recommended_regulation: regulationHint,
            // v2.1 fields (Pain-Based)
            pain,
            failure_attribution: failureAttribution
        };
    }
}

export function initConfessionService(
    bus: {
        subscribe(eventType: PacketType, handler: (packet: CognitivePacket) => void): () => void;
        publish(packet: CognitivePacket): void;
    } = eventBus
) {
    return new ConfessionService(bus);
}
