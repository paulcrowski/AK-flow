/**
 * ExecutiveGate Integration Tests
 * 
 * PIONEER ARCHITECTURE (13/10):
 * "System może generować wiele myśli równolegle, ale tylko jedna deterministyczna 
 * bramka wykonawcza decyduje, która myśl staje się mową; odpowiedź na użytkownika 
 * zawsze ma absolutny priorytet."
 */

import { ExecutiveGate, SpeechCandidate, GateContext, GateDecision } from '../systems/ExecutiveGate';
import { LimbicState } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const createLimbic = (overrides: Partial<LimbicState> = {}): LimbicState => ({
  fear: 0.1,
  curiosity: 0.5,
  frustration: 0.1,
  satisfaction: 0.5,
  ...overrides
});

const createContext = (
  limbic: LimbicState,
  timeSinceUserInput: number = 10000
): GateContext => ExecutiveGate.getDefaultContext(limbic, timeSinceUserInput);

// ═══════════════════════════════════════════════════════════════════════════
// RULE 1: REACTIVE VETO TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExecutiveGate - Reactive VETO', () => {
  
  test('reactive candidate always wins over autonomous', () => {
    const reactive = ExecutiveGate.createReactiveCandidate(
      'Hello user!',
      'Responding to user',
      'reactive-1'
    );
    
    const autonomous = ExecutiveGate.createAutonomousCandidate(
      'Random thought',
      'Just thinking',
      { novelty: 0.9, salience: 0.9 },
      'auto-1'
    );
    
    const context = createContext(createLimbic(), 0); // User just spoke
    const decision = ExecutiveGate.decide([reactive, autonomous], context);
    
    expect(decision.should_speak).toBe(true);
    expect(decision.winner?.id).toBe('reactive-1');
    expect(decision.reason).toBe('REACTIVE_VETO');
  });
  
  test('reactive wins even with low voice_pressure', () => {
    const reactive = ExecutiveGate.createReactiveCandidate(
      'Hello!',
      'Responding',
      'reactive-2'
    );
    
    // Low curiosity, high fear = low voice_pressure
    const limbic = createLimbic({ curiosity: 0.1, fear: 0.8 });
    const context = createContext(limbic, 0);
    
    const decision = ExecutiveGate.decide([reactive], context);
    
    expect(decision.should_speak).toBe(true);
    expect(decision.reason).toBe('REACTIVE_VETO');
  });
  
  test('reactive wins regardless of silence window', () => {
    const reactive = ExecutiveGate.createReactiveCandidate(
      'Response',
      'Thinking',
      'reactive-3'
    );
    
    const context = createContext(createLimbic(), 100); // Only 100ms silence
    const decision = ExecutiveGate.decide([reactive], context);
    
    expect(decision.should_speak).toBe(true);
    expect(decision.reason).toBe('REACTIVE_VETO');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 2: SILENCE WINDOW TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExecutiveGate - Silence Window', () => {
  
  test('autonomous blocked during silence window', () => {
    const autonomous = ExecutiveGate.createAutonomousCandidate(
      'I want to speak',
      'Thinking...',
      { novelty: 0.8, salience: 0.8 },
      'auto-blocked'
    );
    
    const context = createContext(createLimbic({ curiosity: 0.9 }), 2000); // Only 2s
    const decision = ExecutiveGate.decide([autonomous], context);
    
    expect(decision.should_speak).toBe(false);
    expect(decision.reason).toBe('SILENCE_WINDOW_VIOLATED');
  });
  
  test('autonomous allowed after silence window', () => {
    const autonomous = ExecutiveGate.createAutonomousCandidate(
      'Now I can speak',
      'Thinking...',
      { novelty: 0.8, salience: 0.8 },
      'auto-allowed'
    );
    
    const context = createContext(createLimbic({ curiosity: 0.9 }), 6000); // 6s > 5s window
    const decision = ExecutiveGate.decide([autonomous], context);
    
    expect(decision.should_speak).toBe(true);
    expect(decision.winner?.id).toBe('auto-allowed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 3: COMPETITIVE INHIBITION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExecutiveGate - Competitive Inhibition', () => {
  
  test('strongest autonomous candidate wins', () => {
    const weak = ExecutiveGate.createAutonomousCandidate(
      'Weak thought',
      'Low priority',
      { novelty: 0.2, salience: 0.2 },
      'weak'
    );
    
    const strong = ExecutiveGate.createAutonomousCandidate(
      'Strong thought',
      'High priority',
      { novelty: 0.9, salience: 0.9 },
      'strong'
    );
    
    const context = createContext(createLimbic({ curiosity: 0.8 }), 10000);
    const decision = ExecutiveGate.decide([weak, strong], context);
    
    expect(decision.should_speak).toBe(true);
    expect(decision.winner?.id).toBe('strong');
    expect(decision.losers?.map(l => l.id)).toContain('weak');
  });
  
  test('goal-driven competes with autonomous', () => {
    const autonomous = ExecutiveGate.createAutonomousCandidate(
      'Random thought',
      'Thinking',
      { novelty: 0.5, salience: 0.5 },
      'auto'
    );
    
    const goalDriven = ExecutiveGate.createGoalCandidate(
      'Goal response',
      'Pursuing goal',
      'goal-123',
      { salience: 0.8 },
      'goal'
    );
    
    const context = createContext(createLimbic({ curiosity: 0.8 }), 10000);
    const decision = ExecutiveGate.decide([autonomous, goalDriven], context);
    
    // Goal-driven has higher goal_relevance weight
    expect(decision.winner?.type).toBe('goal_driven');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 4: VOICE_PRESSURE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExecutiveGate - Voice Pressure', () => {
  
  test('computeVoicePressure returns correct value', () => {
    // High curiosity + satisfaction = high pressure
    const highPressure = ExecutiveGate.computeVoicePressure({
      curiosity: 0.9,
      satisfaction: 0.8,
      fear: 0.1,
      frustration: 0.1
    });
    expect(highPressure).toBeGreaterThan(0.7);
    
    // High fear + frustration = low pressure
    const lowPressure = ExecutiveGate.computeVoicePressure({
      curiosity: 0.2,
      satisfaction: 0.2,
      fear: 0.8,
      frustration: 0.7
    });
    expect(lowPressure).toBeLessThan(0.3);
  });
  
  test('autonomous blocked when voice_pressure too low', () => {
    const autonomous = ExecutiveGate.createAutonomousCandidate(
      'Want to speak',
      'Thinking',
      { novelty: 0.8, salience: 0.8 },
      'blocked-by-pressure'
    );
    
    // Low curiosity, high fear = low voice_pressure
    const limbic = createLimbic({ curiosity: 0.1, satisfaction: 0.1, fear: 0.9, frustration: 0.8 });
    const context = createContext(limbic, 10000);
    
    const decision = ExecutiveGate.decide([autonomous], context);
    
    expect(decision.should_speak).toBe(false);
    expect(decision.reason).toBe('VOICE_PRESSURE_LOW');
  });
  
  test('autonomous speaks when voice_pressure high enough', () => {
    const autonomous = ExecutiveGate.createAutonomousCandidate(
      'I will speak',
      'Confident',
      { novelty: 0.8, salience: 0.8 },
      'allowed-by-pressure'
    );
    
    // High curiosity, low fear = high voice_pressure
    const limbic = createLimbic({ curiosity: 0.9, satisfaction: 0.8, fear: 0.1, frustration: 0.1 });
    const context = createContext(limbic, 10000);
    
    const decision = ExecutiveGate.decide([autonomous], context);
    
    expect(decision.should_speak).toBe(true);
    expect(decision.reason).toBe('AUTONOMOUS_WON');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe('ExecutiveGate - Edge Cases', () => {
  
  test('no candidates returns NO_CANDIDATES', () => {
    const context = createContext(createLimbic(), 10000);
    const decision = ExecutiveGate.decide([], context);
    
    expect(decision.should_speak).toBe(false);
    expect(decision.reason).toBe('NO_CANDIDATES');
  });
  
  test('empty speech content blocked', () => {
    const empty = ExecutiveGate.createAutonomousCandidate(
      '   ',
      'Thinking but nothing to say',
      { novelty: 0.9, salience: 0.9 },
      'empty'
    );
    
    const context = createContext(createLimbic({ curiosity: 0.9 }), 10000);
    const decision = ExecutiveGate.decide([empty], context);
    
    expect(decision.should_speak).toBe(false);
    expect(decision.reason).toBe('EMPTY_SPEECH');
  });
  
  test('candidate strength computation is deterministic', () => {
    const candidate = ExecutiveGate.createAutonomousCandidate(
      'Test',
      'Test thought',
      { novelty: 0.5, salience: 0.5 },
      'deterministic'
    );
    
    const strength1 = ExecutiveGate.computeCandidateStrength(candidate);
    const strength2 = ExecutiveGate.computeCandidateStrength(candidate);
    
    expect(strength1).toBe(strength2);
  });
  
  test('voice_pressure is bounded 0-1', () => {
    // Extreme high values
    const high = ExecutiveGate.computeVoicePressure({
      curiosity: 1.5, // Beyond normal
      satisfaction: 1.5,
      fear: 0,
      frustration: 0
    });
    expect(high).toBeLessThanOrEqual(1);
    
    // Extreme low values
    const low = ExecutiveGate.computeVoicePressure({
      curiosity: -0.5, // Below normal
      satisfaction: -0.5,
      fear: 1.5,
      frustration: 1.5
    });
    expect(low).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExecutiveGate - Integration Scenarios', () => {
  
  test('typical conversation flow', () => {
    const limbic = createLimbic({ curiosity: 0.7, satisfaction: 0.6 });
    
    // 1. User speaks, reactive wins
    const reactive = ExecutiveGate.createReactiveCandidate('Hello!', 'Greeting', 'r1');
    const context1 = createContext(limbic, 0);
    const decision1 = ExecutiveGate.decide([reactive], context1);
    expect(decision1.reason).toBe('REACTIVE_VETO');
    
    // 2. Short silence, autonomous blocked
    const auto1 = ExecutiveGate.createAutonomousCandidate('Hmm', 'Thinking', { novelty: 0.5 }, 'a1');
    const context2 = createContext(limbic, 3000);
    const decision2 = ExecutiveGate.decide([auto1], context2);
    expect(decision2.reason).toBe('SILENCE_WINDOW_VIOLATED');
    
    // 3. Long silence, autonomous speaks
    const auto2 = ExecutiveGate.createAutonomousCandidate('I wonder...', 'Curious', { novelty: 0.8 }, 'a2');
    const context3 = createContext(limbic, 8000);
    const decision3 = ExecutiveGate.decide([auto2], context3);
    expect(decision3.reason).toBe('AUTONOMOUS_WON');
  });
  
  test('race condition prevented', () => {
    // Simulates: user input + autonomous volition happening close together
    const reactive = ExecutiveGate.createReactiveCandidate('Response', 'Replying', 'r');
    const autonomous = ExecutiveGate.createAutonomousCandidate('Random', 'Thinking', { novelty: 0.9 }, 'a');
    
    // User just spoke (0ms ago)
    const context = createContext(createLimbic(), 0);
    const decision = ExecutiveGate.decide([reactive, autonomous], context);
    
    // Reactive ALWAYS wins, autonomous is in losers
    expect(decision.winner?.id).toBe('r');
    expect(decision.losers?.map(l => l.id)).toContain('a');
    expect(decision.reason).toBe('REACTIVE_VETO');
  });
});
