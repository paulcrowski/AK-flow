/**
 * StartupLogger - Logs all feature flags and config at system start
 * 
 * ALARM 3 REQUIREMENT: Always know what's enabled/disabled at runtime.
 * Call logSystemConfig() at app initialization.
 * 
 * @module core/config/startupLogger
 */

import { FEATURE_FLAGS, getAllFeatureFlags } from './featureFlags';
import { PRISM_CONFIG } from '../systems/PrismIntegration';
import { PIPELINE_CONFIG } from '../systems/PrismPipeline';
import { FACT_ECHO_PIPELINE_CONFIG } from '../systems/FactEchoPipeline';
import { CHEMISTRY_BRIDGE_CONFIG } from '../systems/ChemistryBridge';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface ConfigSnapshot {
  timestamp: string;
  featureFlags: Record<string, boolean>;
  moduleConfigs: Record<string, Record<string, unknown>>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Logger
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log complete system configuration at startup.
 * Call this once when app initializes.
 */
export function logSystemConfig(): ConfigSnapshot {
  const snapshot: ConfigSnapshot = {
    timestamp: new Date().toISOString(),
    featureFlags: { ...FEATURE_FLAGS },
    moduleConfigs: {
      PRISM: { ...PRISM_CONFIG },
      PIPELINE: { ...PIPELINE_CONFIG },
      FACT_ECHO: { ...FACT_ECHO_PIPELINE_CONFIG },
      CHEMISTRY_BRIDGE: { ...CHEMISTRY_BRIDGE_CONFIG }
    }
  };

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║              AK-FLOW SYSTEM CONFIGURATION                     ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log('║ FEATURE FLAGS:                                                ║');
  
  const flagDefs = getAllFeatureFlags();
  for (const [key, value] of Object.entries(FEATURE_FLAGS)) {
    const status = value ? '✅ ENABLED ' : '⏸️ DISABLED';
    const desc = flagDefs[key]?.description || '';
    console.log(`║   ${status} ${key.padEnd(30)} ║`);
  }
  
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log('║ MODULE CONFIGS:                                               ║');
  
  // PRISM
  console.log(`║   PRISM:                                                      ║`);
  console.log(`║     GUARD_ENABLED:    ${PRISM_CONFIG.GUARD_ENABLED ? '✅' : '⏸️'}                                      ║`);
  console.log(`║     RETRY_ENABLED:    ${PRISM_CONFIG.RETRY_ENABLED ? '✅' : '⏸️'}                                      ║`);
  console.log(`║     LOG_ALL_CHECKS:   ${PRISM_CONFIG.LOG_ALL_CHECKS ? '✅' : '⏸️'}                                      ║`);
  
  // FactEcho
  console.log(`║   FACT_ECHO:                                                  ║`);
  console.log(`║     ENABLED:          ${FACT_ECHO_PIPELINE_CONFIG.ENABLED ? '✅' : '⏸️'}                                      ║`);
  console.log(`║     STRICT_MODE:      ${FACT_ECHO_PIPELINE_CONFIG.DEFAULT_STRICT_MODE ? '✅' : '⏸️'}                                      ║`);
  
  // Chemistry
  console.log(`║   CHEMISTRY_BRIDGE:                                           ║`);
  console.log(`║     ENABLED:          ${CHEMISTRY_BRIDGE_CONFIG.ENABLED ? '✅' : '⏸️'}                                      ║`);
  
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log(`║ Timestamp: ${snapshot.timestamp}                    ║`);
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  return snapshot;
}

/**
 * Get current config snapshot without logging.
 * Useful for debugging and diagnostics.
 */
export function getConfigSnapshot(): ConfigSnapshot {
  return {
    timestamp: new Date().toISOString(),
    featureFlags: { ...FEATURE_FLAGS },
    moduleConfigs: {
      PRISM: { ...PRISM_CONFIG },
      PIPELINE: { ...PIPELINE_CONFIG },
      FACT_ECHO: { ...FACT_ECHO_PIPELINE_CONFIG },
      CHEMISTRY_BRIDGE: { ...CHEMISTRY_BRIDGE_CONFIG }
    }
  };
}

/**
 * Log a single flag change (for runtime toggles).
 */
export function logFlagChange(flagName: string, oldValue: boolean, newValue: boolean): void {
  const arrow = oldValue ? '✅→⏸️' : '⏸️→✅';
  console.log(`[AK-FLOW] FLAG CHANGE: ${flagName} ${arrow}`);
}
