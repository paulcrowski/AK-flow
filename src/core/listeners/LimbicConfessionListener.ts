import { eventBus } from '../EventBus';
import { PacketType, ConfessionReport, LimbicState } from '../../types';

/**
 * LimbicConfessionListener
 * 
 * Listens for CONFESSION_REPORT and applies limbic adjustments.
 * Super-human principle: frustration → precision, NOT shutdown.
 * 
 * SINGLETON: Only initializes once per app lifecycle.
 */

// Track if already initialized to prevent duplicate subscriptions
let isInitialized = false;

export function initLimbicConfessionListener(
    getLimbic: () => LimbicState,
    setLimbic: (state: LimbicState) => void
): () => void {
    // Prevent duplicate initialization
    if (isInitialized) {
        return () => {}; // Return no-op cleanup
    }
    isInitialized = true;

    const unsubscribe = eventBus.subscribe(PacketType.CONFESSION_REPORT, (packet) => {
        const report = packet.payload as ConfessionReport;
        const hint = report.recommended_regulation?.limbic_adjustments;

        // Only apply if severity >= 5 and we have hints
        if (report.severity >= 5 && hint) {
            const current = getLimbic();

            // Super-human: precision boost, not punishment
            // frustration increases slightly = more careful next time
            const newFrustration = Math.min(1, current.frustration + (hint.social_cost_delta || 0));

            setLimbic({
                ...current,
                frustration: newFrustration
            });

            console.log(`[LimbicConfession] Severity ${report.severity} → frustration: ${current.frustration.toFixed(2)} → ${newFrustration.toFixed(2)}`);
        }
    });

    console.log('[LimbicConfessionListener] Initialized.');

    // Return cleanup function
    return () => {
        unsubscribe();
        isInitialized = false;
    };
}
