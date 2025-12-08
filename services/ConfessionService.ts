import { eventBus } from '../core/EventBus';
import {
    AgentType,
    CognitivePacket,
    PacketType,
    ConfessionReport,
    ConfessionContext,
    RegulationHint,
    TraitVote
} from '../types';

/**
 * ConfessionService v2.0 - Super-Human Self-Regulation
 * 
 * Principles:
 * - Frustration → precision, NOT silence
 * - Context-aware (teaching_mode, research_mode don't penalize verbosity)
 * - Votes, not direct trait changes
 * - 0 LLM calls (pure heuristics)
 */
export class ConfessionService {
    private static instance: ConfessionService;

    private constructor() {
        this.initialize();
    }

    public static getInstance(): ConfessionService {
        if (!ConfessionService.instance) {
            ConfessionService.instance = new ConfessionService();
        }
        return ConfessionService.instance;
    }

    private initialize() {
        eventBus.subscribe(PacketType.MOTOR_COMMAND, (packet: CognitivePacket) => {
            if (packet.source === AgentType.MOTOR && packet.payload?.action === 'SPEAK') {
                this.runConfessionProtocol(packet.payload.content);
            }
        });
        console.log('[ConfessionService] v2.0 Super-Human initialized.');
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
     * Generate super-human regulation hint
     * Key: modulate style, not capacity
     */
    private generateRegulationHint(
        severity: number,
        context: ConfessionContext,
        issues: string[]
    ): RegulationHint {
        // Break glass: critical reasoning mode
        if (context === 'critical_reasoning_mode') {
            return {};
        }

        // Flow guard: structured thinking
        if (context === 'structured_thinking_block') {
            return severity >= 7
                ? { expression_hints: ['raise_quality_bar'] }
                : {};
        }

        // Teaching/research: be lenient
        if ((context === 'teaching_mode' || context === 'research_mode') && severity < 7) {
            return {};
        }

        const hint: RegulationHint = {};

        // Super-human: precision boost (not silence)
        if (severity >= 5) {
            hint.limbic_adjustments = {
                precision_boost: 0.1,
                social_cost_delta: 0.05
            };
        }

        // Quality hint - be responsive even for minor issues (super-human self-improvement)
        if (severity >= 2) {
            hint.expression_hints = ['raise_quality_bar'];
        }

        // Trait vote (only severe, not direct change)
        if (severity >= 7 && issues.some(i => i.includes('verbose'))) {
            hint.trait_vote = {
                dimension: 'verbosity',
                direction: 'decrease',
                weight: 1,
                reason: 'verbose_response_severity_7+',
                is_success: false
            };
        }

        return hint;
    }

    private runConfessionProtocol(agentResponse: string) {
        const report = this.generateReport(agentResponse);

        eventBus.publish({
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
        const regulationHint = this.generateRegulationHint(severity, contextMode, issues);

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
            recommended_regulation: regulationHint
        };
    }
}

export const confessionService = ConfessionService.getInstance();
