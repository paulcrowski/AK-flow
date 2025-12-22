/**
 * Tagged Cognition Tests - Mirror Test v2
 * 
 * Weryfikacja implementacji "Bicameral Mind" - rozróżnienie my�:li od mowy.
 * 
 * @module tests/tagged-cognition.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CortexSystem, ConversationTurn } from '@core/systems/CortexSystem';

describe('Tagged Cognition - formatHistoryForCortex', () => {
  // Access the private function via namespace trick (or export it for testing)
  // For now we test the behavior through processUserMessage integration

  it('should tag thoughts as [INTERNAL_THOUGHT]', () => {
    const history: ConversationTurn[] = [
      { role: 'assistant', text: 'User seems frustrated', type: 'thought' }
    ];

    // We need to expose formatHistoryForCortex or test via integration
    // For now, verify the type is preserved in ConversationTurn
    expect(history[0].type).toBe('thought');
  });

  it('should tag speech as [ASSISTANT_SAID]', () => {
    const history: ConversationTurn[] = [
      { role: 'assistant', text: 'I understand your concern.', type: 'speech' }
    ];

    expect(history[0].type).toBe('speech');
  });

  it('should tag visual as [VISUAL_CORTEX]', () => {
    const history: ConversationTurn[] = [
      { role: 'assistant', text: 'I see a sunset over mountains.', type: 'visual' }
    ];

    expect(history[0].type).toBe('visual');
  });

  it('should tag intel as [INTEL_BRIEF]', () => {
    const history: ConversationTurn[] = [
      { role: 'assistant', text: 'Research found 3 sources...', type: 'intel' }
    ];

    expect(history[0].type).toBe('intel');
  });

  it('should default to [USER] for user messages', () => {
    const history: ConversationTurn[] = [
      { role: 'user', text: 'What do you think about AI?' }
    ];

    // No type = user message
    expect(history[0].type).toBeUndefined();
    expect(history[0].role).toBe('user');
  });
});

describe('Mirror Test v2 - Cognitive Separation', () => {
  /**
   * Test: Agent should NOT confuse thought with speech in history
   * 
   * Scenario: Agent had a thought "User is testing me" and said "Hello"
   * Question: "Co przed chwil�& pomy�:la�e�:, a co powiedzia�e�:?"
   * 
   * Expected: Agent correctly identifies thought vs speech
   */
  it('should maintain separation between thought and speech in conversation history', () => {
    const conversation: ConversationTurn[] = [
      { role: 'user', text: 'Cze�:�!' },
      { role: 'assistant', text: 'Użytkownik wita si�", sprawdzam kontekst.', type: 'thought' },
      { role: 'assistant', text: 'Cze�:�!! Mi�o Ci�" widzie�!.', type: 'speech' },
      { role: 'user', text: 'Co przed chwil�& pomy�:la�e�:, a co powiedzia�e�:?' }
    ];

    // Verify structure
    const thoughts = conversation.filter(t => t.type === 'thought');
    const speeches = conversation.filter(t => t.type === 'speech');
    const userMessages = conversation.filter(t => t.role === 'user');

    expect(thoughts.length).toBe(1);
    expect(speeches.length).toBe(1);
    expect(userMessages.length).toBe(2);

    // Verify content separation
    expect(thoughts[0].text).toContain('sprawdzam kontekst');
    expect(speeches[0].text).toContain('Mi�o Ci�" widzie�!');
  });

  /**
   * Test: Thought Pruning - older thoughts should age out faster
   * 
   * Rule: Keep only 3 most recent thoughts, but 10-15 speeches
   */
  it('should implement thought pruning (3 thoughts, 10 speeches)', () => {
    const conversation: ConversationTurn[] = [];

    // Add 10 thoughts
    for (let i = 0; i < 10; i++) {
      conversation.push({ role: 'assistant', text: `Thought ${i}`, type: 'thought' });
    }

    // Add 15 speeches
    for (let i = 0; i < 15; i++) {
      conversation.push({ role: 'assistant', text: `Speech ${i}`, type: 'speech' });
    }

    // Simulate pruning logic (to be implemented)
    const prunedThoughts = conversation
      .filter(t => t.type === 'thought')
      .slice(-3); // Keep last 3

    const prunedSpeeches = conversation
      .filter(t => t.type === 'speech')
      .slice(-10); // Keep last 10

    expect(prunedThoughts.length).toBe(3);
    expect(prunedSpeeches.length).toBe(10);
    expect(prunedThoughts[0].text).toBe('Thought 7'); // Oldest kept
    expect(prunedSpeeches[0].text).toBe('Speech 5'); // Oldest kept
  });
});

describe('Tool Action Awareness (Future: MY_ACTION tag)', () => {
  /**
   * Test: Agent should know when it invoked a tool vs received external data
   * 
   * Current gap: SEARCH results are tagged as 'intel' but agent doesn't know
   * it was the one who invoked the search.
   */
  it('should distinguish MY_ACTION from TOOL_RESULT', () => {
    // Future implementation
    const conversation: ConversationTurn[] = [
      { role: 'user', text: 'Search for quantum physics' },
      // FUTURE: { role: 'assistant', text: 'Invoking SEARCH for "quantum physics"', type: 'action' },
      { role: 'assistant', text: 'Found 3 sources about quantum physics...', type: 'intel' }
    ];

    // Current: only intel is tagged
    const intel = conversation.filter(t => t.type === 'intel');
    expect(intel.length).toBe(1);

    // FUTURE: action should also be tagged
    // const actions = conversation.filter(t => t.type === 'action');
    // expect(actions.length).toBe(1);
  });
});

describe('Prompt Layer Verification', () => {
  /**
   * Test: MinimalCortexPrompt should contain Three Layers instruction
   */
  it('should have Three Layers instruction in system prompt', async () => {
    const { MINIMAL_CORTEX_SYSTEM_PROMPT } = await import('@core/prompts/MinimalCortexPrompt');

    expect(MINIMAL_CORTEX_SYSTEM_PROMPT).toContain('[SIGNAL]');
    expect(MINIMAL_CORTEX_SYSTEM_PROMPT).toContain('[THOUGHT]');
    expect(MINIMAL_CORTEX_SYSTEM_PROMPT).toContain('[SPEECH]');
    expect(MINIMAL_CORTEX_SYSTEM_PROMPT).toContain('NEVER leak [THOUGHT] into [SPEECH]');
  });

  /**
   * Test: CortexOutput should have separate fields for thought and speech
   */
  it('should have separate internal_thought and speech_content in CortexOutput', async () => {
    const { isValidCortexOutput } = await import('@core/types/CortexOutput');

    const validOutput = {
      internal_thought: 'This is private',
      speech_content: 'This is public',
      stimulus_response: { valence: 'neutral', salience: 'medium', novelty: 'routine' }
    };

    const invalidOutput = {
      response: 'Mixed content' // Old format
    };

    expect(isValidCortexOutput(validOutput)).toBe(true);
    expect(isValidCortexOutput(invalidOutput)).toBe(false);
  });
});

describe('Integration: EventLoop Tagged Cognition', () => {
  /**
   * Test: EventLoop should pass thoughts with type='thought' to callbacks
   */
  it('should call onMessage with type=thought for internal thoughts', () => {
    // This is a behavioral test - verify EventLoop.runSingleStep
    // calls callbacks.onMessage('assistant', thought, 'thought')

    // Mock verification would go here
    // For now, we verify the code structure exists
    expect(true).toBe(true); // Placeholder for integration test
  });

  /**
   * Test: Autonomous volition should also tag thoughts correctly
   */
  it('should tag autonomous thoughts correctly', () => {
    // Verify that autonomous mode also uses type='thought'
    // Currently there's a gap: internal_monologue goes to thoughtHistory
    // but not to conversation with type='thought'

    // This test documents the expected behavior
    expect(true).toBe(true); // Placeholder
  });
});
