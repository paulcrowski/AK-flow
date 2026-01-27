/**
 * WiringValidator - Runtime invariant checker for critical systems
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * ALARM 3 PROCEDURA: Po każdym wdrożeniu ten walidator MUSI przejść.
 * 
 * Chroni przed sytuacją: "ktoś doda nowy EventLoop / refactor i zapomni wpiąć guard"
 * 
 * UŻYCIE:
 * 1. Na starcie App: validateWiring()
 * 2. W CI/CD: npm run validate:wiring
 * 3. W testach: describe('Wiring Invariants')
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @module core/config/wiringValidator
 */

import { pathToFileURL } from 'url';

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL SYSTEMS REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lista KRYTYCZNYCH systemów które MUSZĄ być aktywne.
 * Dodaj tutaj każdy nowy system który jest niezbędny do działania.
 */
export const CRITICAL_SYSTEMS = [
  {
    name: 'PersonaGuard',
    description: 'Prevents identity drift and fact mutations',
    configPath: 'prism.guardEnabled',
    testFn: async () => {
      const { isPrismEnabled } = await import('../systems/PrismPipeline.ts');
      return isPrismEnabled();
    }
  },
  {
    name: 'FactEchoPipeline',
    description: 'Validates fact preservation in LLM responses',
    configPath: 'factEcho.enabled',
    testFn: async () => {
      const { isFactEchoPipelineEnabled } = await import('../systems/FactEchoPipeline.ts');
      return isFactEchoPipelineEnabled();
    }
  },
  {
    name: 'HardFactsBuilder',
    description: 'Builds immutable facts for LLM context',
    configPath: 'N/A (always active)',
    testFn: async () => {
      const { buildHardFacts } = await import('../systems/HardFactsBuilder.ts');
      const facts = buildHardFacts({ agentName: 'test' });
      return facts.agentName === 'test' && facts.date !== undefined;
    }
  },
  {
    name: 'NeurotransmitterSystem',
    description: 'Manages dopamine/serotonin with RPE decay',
    configPath: 'N/A (always active)',
    testFn: async () => {
      const { NeurotransmitterSystem } = await import('../systems/NeurotransmitterSystem.ts');
      return typeof NeurotransmitterSystem.updateNeuroState === 'function';
    }
  },
  {
    name: 'CentralConfig',
    description: 'Single source of truth for all settings',
    configPath: 'SYSTEM_CONFIG',
    testFn: async () => {
      const { SYSTEM_CONFIG } = await import('./systemConfig.ts');
      return SYSTEM_CONFIG.features !== undefined && 
             SYSTEM_CONFIG.prism !== undefined;
    }
  },
  {
    name: 'IdentityFallback',
    description: 'Prevents Assistant identity drift via UNINITIALIZED_AGENT',
    configPath: 'N/A (compile-time)',
    testFn: async () => {
      const { DEFAULT_CORE_IDENTITY } = await import('../types/CoreIdentity.ts');
      return DEFAULT_CORE_IDENTITY.name === 'UNINITIALIZED_AGENT';
    }
  },
  {
    name: 'HardFactsInCortexState',
    description: 'Ensures hard_facts field exists in CortexState',
    configPath: 'N/A (type-level)',
    testFn: async () => {
      // Import directly to avoid supabase dependency chain from CortexStateBuilder
      const { buildMinimalCortexState, setCachedIdentity } = await import('../builders/MinimalCortexStateBuilder.ts');
      setCachedIdentity('wiring-test', {
        name: 'WiringTest',
        core_values: [],
        constitutional_constraints: []
      }, { verbosity: 0.5, arousal: 0.5, conscientiousness: 0.5, socialAwareness: 0.5, curiosity: 0.5 });
      
      const state = buildMinimalCortexState({
        agentId: 'wiring-test',
        metaStates: { energy: 100, stress: 0, confidence: 100 },
        userInput: 'test'
      });
      return state.hard_facts !== undefined && state.hard_facts.agentName !== undefined;
    }
  }
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// WIRING CHECKS
// ═══════════════════════════════════════════════════════════════════════════

export interface WiringCheckResult {
  system: string;
  status: 'PASS' | 'FAIL' | 'DISABLED';
  description: string;
  configPath: string;
  error?: string;
}

export interface WiringValidationResult {
  timestamp: string;
  allPassed: boolean;
  results: WiringCheckResult[];
  criticalFailures: string[];
}

/**
 * Validate all critical systems are wired correctly.
 * Call this at app startup and in CI/CD.
 */
export async function validateWiring(): Promise<WiringValidationResult> {
  const results: WiringCheckResult[] = [];
  const criticalFailures: string[] = [];

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║            AK-FLOW WIRING VALIDATION                          ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');

  for (const system of CRITICAL_SYSTEMS) {
    try {
      const isActive = await system.testFn();
      
      const result: WiringCheckResult = {
        system: system.name,
        status: isActive ? 'PASS' : 'DISABLED',
        description: system.description,
        configPath: system.configPath
      };
      
      results.push(result);
      
      if (isActive) {
        console.log(`║ ✅ ${system.name.padEnd(25)} ACTIVE                    ║`);
      } else {
        console.log(`║ ⏸️  ${system.name.padEnd(25)} DISABLED                  ║`);
        criticalFailures.push(system.name);
      }
    } catch (error) {
      const result: WiringCheckResult = {
        system: system.name,
        status: 'FAIL',
        description: system.description,
        configPath: system.configPath,
        error: error instanceof Error ? error.message : String(error)
      };
      
      results.push(result);
      criticalFailures.push(system.name);
      console.log(`║ ❌ ${system.name.padEnd(25)} FAILED                     ║`);
      console.log(`║    Error: ${(result.error || '').substring(0, 45).padEnd(45)}    ║`);
    }
  }

  console.log('╠═══════════════════════════════════════════════════════════════╣');
  
  const allPassed = criticalFailures.length === 0;
  
  if (allPassed) {
    console.log('║ ✅ ALL CRITICAL SYSTEMS ACTIVE                                ║');
  } else {
    console.log(`║ ❌ ${criticalFailures.length} CRITICAL SYSTEM(S) FAILED!                             ║`);
    console.log('║                                                               ║');
    console.log('║ ⚠️  DEPLOYMENT SHOULD BE BLOCKED UNTIL FIXED!                 ║');
  }
  
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  return {
    timestamp: new Date().toISOString(),
    allPassed,
    results,
    criticalFailures
  };
}

/**
 * Strict validation - throws if any critical system fails.
 * Use in CI/CD pipelines.
 */
export async function validateWiringStrict(): Promise<void> {
  const result = await validateWiring();
  
  if (!result.allPassed) {
    throw new Error(
      `WIRING VALIDATION FAILED!\n` +
      `Critical systems not active: ${result.criticalFailures.join(', ')}\n` +
      `This deployment should be blocked.`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPLOYMENT CHECKLIST
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deployment checklist - human-readable summary of what to verify.
 * Print this after each deployment.
 */
export function printDeploymentChecklist(): void {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📋 AK-FLOW DEPLOYMENT CHECKLIST');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('After EVERY deployment, verify:');
  console.log('');
  console.log('1. [ ] npm test -- --run passes (all tests)');
  console.log('2. [ ] validateWiring() shows all systems ACTIVE');
  console.log('3. [ ] logSystemConfig() shows expected flags');
  console.log('4. [ ] Manual test: "Jak masz na imię?" → correct name');
  console.log('5. [ ] Manual test: "Jaki dziś dzień?" → correct date');
  console.log('6. [ ] 60s silence → dopamine should decrease in logs');
  console.log('');
  console.log('If ANY fails → DO NOT DEPLOY, investigate wiring!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURE PROCEDURE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Procedura dla KAŻDEJ nowej funkcji.
 * Wydrukuj to i trzymaj przy biurku!
 */
export const NEW_FEATURE_PROCEDURE = `
═══════════════════════════════════════════════════════════════════════════
🔧 AK-FLOW NEW FEATURE PROCEDURE (ALARM 3 STANDARD)
═══════════════════════════════════════════════════════════════════════════

Każda nowa funkcja MUSI przejść przez:

1. CONFIG
   □ Dodaj przełącznik do core/config/systemConfig.ts
   □ NIE twórz lokalnych const ENABLED = true
   
2. INVARIANT
   □ Jeśli system jest krytyczny → dodaj do CRITICAL_SYSTEMS w wiringValidator.ts
   □ Dodaj test do __tests__/IntegrationWiring.test.ts
   
3. TELEMETRY
   □ Dodaj log na wejściu funkcji: [ModuleName] ACTION: details
   □ Dodaj log na wyjściu z wynikiem
   
4. WIRING CHECK
   □ Upewnij się że funkcja jest WYWOŁANA w main flow
   □ Nie tylko zdefiniowana, ale UŻYWANA!
   
5. TEST
   □ Unit test dla logiki
   □ Integration test dla wiring (czy jest podpięta?)
   
6. DOCUMENTATION
   □ Dodaj do docs/FEATURE_FLAGS.md
   □ Zaktualizuj docs/ARCHITECTURE_MAP.md

═══════════════════════════════════════════════════════════════════════════
`;

export function printNewFeatureProcedure(): void {
  console.log(NEW_FEATURE_PROCEDURE);
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI ENTRY POINT (ES Modules compatible)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * CLI entry point for wiring validation
 * Usage: ts-node src/core/config/wiringValidator.ts [strict]
 */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const strictMode = args.includes('strict');

  if (strictMode) {
    validateWiringStrict().then(() => {
      console.log('✅ Wiring validation passed - all systems active');
      process.exit(0);
    }).catch(error => {
      console.error('❌ Wiring validation failed:', error.message);
      process.exit(1);
    });
  } else {
    validateWiring().then(result => {
      if (!result.allPassed) {
        process.exit(1);
      }
    });
  }
}
