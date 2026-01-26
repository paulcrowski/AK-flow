/// <reference path="../../src/react-test-shim.d.ts" />
import React, { useEffect, useRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { AgentIdentity } from '@/hooks/useCognitiveKernelLite';
import { useConversation } from '@/hooks/useConversation';
import { getCognitiveState } from '@/stores/cognitiveStore';
import { EventLoop } from '@core/systems/EventLoop';

vi.mock('@core/systems/EventLoop', () => ({
  EventLoop: {
    runSingleStep: vi.fn()
  }
}));

const runSingleStepMock = vi.mocked(EventLoop.runSingleStep);

function ConversationHarness() {
  const identityRef = useRef<AgentIdentity | null>(null);
  const { conversation, handleInput } = useConversation({ identityRef });

  useEffect(() => {
    void handleInput('ping');
  }, [handleInput]);

  return (
    <div>
      {conversation.map((msg, idx) => (
        <div
          key={idx}
          data-testid={`msg-${idx}`}
          data-type={msg.type ?? ''}
          data-sources={(msg.sources ?? []).length}
        >
          {msg.text}
        </div>
      ))}
    </div>
  );
}

describe('Conversation intel/tool_result wiring', () => {
  beforeEach(() => {
    getCognitiveState().reset();
    runSingleStepMock.mockReset();
    runSingleStepMock.mockImplementation(async (ctx, _input, callbacks) => {
      callbacks.onMessage('assistant', 'intel text', 'intel', {
        sources: [{ uri: 'https://example.com', title: 'Example' }]
      });
      callbacks.onMessage('assistant', 'tool ok', 'tool_result');
      return ctx;
    });
  });

  it('stores intel and tool_result messages in conversation', async () => {
    render(<ConversationHarness />);

    await waitFor(() => {
      expect(screen.getByText('intel text')).toBeInTheDocument();
    });

    const intel = screen.getByText('intel text');
    expect(intel.getAttribute('data-type')).toBe('intel');
    expect(intel.getAttribute('data-sources')).toBe('1');

    const tool = screen.getByText('tool ok');
    expect(tool.getAttribute('data-type')).toBe('tool_result');
  });
});
