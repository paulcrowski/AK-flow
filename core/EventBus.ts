import { CognitivePacket, EventHandler, PacketType } from "../types";
import { isFeatureEnabled } from './config/featureFlags';
import { getCurrentTraceId, pushTraceId, popTraceId, generateExternalTraceId } from './trace/TraceContext';

class CognitiveBus {

  private listeners: { [key: string]: EventHandler[] } = {};
  private history: CognitivePacket[] = [];

  subscribe(eventType: PacketType, handler: EventHandler) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(handler);

    // Return unsubscribe function
    return () => {
      this.listeners[eventType] = this.listeners[eventType].filter(h => h !== handler);
    };
  }

  publish(packet: CognitivePacket) {
    let nextPacket = packet;
    if (isFeatureEnabled('USE_TRACE_AUTO_INJECT') && !packet.traceId) {
      const active = getCurrentTraceId();
      if (active) nextPacket = { ...packet, traceId: active };
    }

    if (isFeatureEnabled('USE_TRACE_EXTERNAL_IDS') && !nextPacket.traceId) {
      const active = getCurrentTraceId();
      if (!active) nextPacket = { ...nextPacket, traceId: generateExternalTraceId(nextPacket.timestamp) };
    }

    // Log to history (Short term buffer)
    this.history.push(nextPacket);
    // Increased buffer to 1000 to support meaningful session exports
    if (this.history.length > 1000) this.history.shift();

    if (this.listeners[nextPacket.type]) {
      this.listeners[nextPacket.type].forEach(handler => {
        // Asynchronous execution to simulate distributed processing
        setTimeout(() => {
          if (isFeatureEnabled('USE_TRACE_HANDLER_SCOPE') && nextPacket.traceId) {
            pushTraceId(nextPacket.traceId);
            try {
              handler(nextPacket);
            } finally {
              popTraceId(nextPacket.traceId);
            }
            return;
          }

          handler(nextPacket);
        }, 0);
      });
    }
  }

  /**
   * Synchronous publish - useful for testing.
   * Handlers execute immediately, no setTimeout.
   */
  publishSync(packet: CognitivePacket) {
    let nextPacket = packet;
    if (isFeatureEnabled('USE_TRACE_AUTO_INJECT') && !packet.traceId) {
      const active = getCurrentTraceId();
      if (active) nextPacket = { ...packet, traceId: active };
    }

    if (isFeatureEnabled('USE_TRACE_EXTERNAL_IDS') && !nextPacket.traceId) {
      const active = getCurrentTraceId();
      if (!active) nextPacket = { ...nextPacket, traceId: generateExternalTraceId(nextPacket.timestamp) };
    }

    this.history.push(nextPacket);
    if (this.history.length > 1000) this.history.shift();

    if (this.listeners[nextPacket.type]) {
      this.listeners[nextPacket.type].forEach(handler => {
        if (isFeatureEnabled('USE_TRACE_HANDLER_SCOPE') && nextPacket.traceId) {
          pushTraceId(nextPacket.traceId);
          try {
            handler(nextPacket);
          } finally {
            popTraceId(nextPacket.traceId);
          }
          return;
        }

        handler(nextPacket);
      });
    }
  }

  getHistory() {
    return this.history;
  }

  clear() {
    this.history = [];
  }
}

export const eventBus = new CognitiveBus();