import { AgentType, CognitivePacket, EventHandler, PacketType } from "../types";
import { isOneMindSubEnabled } from './config/featureFlags';
import { getCurrentTraceId, pushTraceId, popTraceId, generateExternalTraceId } from './trace/TraceContext';
import { generateUUID } from '../utils/uuid';

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
    let traceInjected = false;
    let injectionMode: 'active_scope' | 'external' | null = null;
    if (isOneMindSubEnabled('traceAutoInject') && !packet.traceId) {
      const active = getCurrentTraceId();
      if (active) {
        nextPacket = { ...packet, traceId: active };
        traceInjected = true;
        injectionMode = 'active_scope';
      }
    }

    if (isOneMindSubEnabled('traceExternalIds') && !nextPacket.traceId) {
      const active = getCurrentTraceId();
      if (!active) {
        nextPacket = { ...nextPacket, traceId: generateExternalTraceId(nextPacket.timestamp) };
        traceInjected = true;
        injectionMode = 'external';
      }
    }

    if (isOneMindSubEnabled('traceMissingAlert') && traceInjected && injectionMode && nextPacket.traceId) {
      this.publish({
        id: generateUUID(),
        traceId: nextPacket.traceId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.SYSTEM_ALERT,
        payload: {
          event: 'TRACE_MISSING',
          originalPacketId: packet.id,
          originalSource: packet.source,
          originalType: packet.type,
          injectedTraceId: nextPacket.traceId,
          injectionMode
        },
        priority: 0.2
      });
    }

    // Log to history (Short term buffer)
    this.history.push(nextPacket);
    // Increased buffer to 1000 to support meaningful session exports
    if (this.history.length > 1000) this.history.shift();

    if (this.listeners[nextPacket.type]) {
      this.listeners[nextPacket.type].forEach(handler => {
        // Asynchronous execution to simulate distributed processing
        setTimeout(() => {
          if (isOneMindSubEnabled('traceHandlerScope') && nextPacket.traceId) {
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
    let traceInjected = false;
    let injectionMode: 'active_scope' | 'external' | null = null;
    if (isOneMindSubEnabled('traceAutoInject') && !packet.traceId) {
      const active = getCurrentTraceId();
      if (active) {
        nextPacket = { ...packet, traceId: active };
        traceInjected = true;
        injectionMode = 'active_scope';
      }
    }

    if (isOneMindSubEnabled('traceExternalIds') && !nextPacket.traceId) {
      const active = getCurrentTraceId();
      if (!active) {
        nextPacket = { ...nextPacket, traceId: generateExternalTraceId(nextPacket.timestamp) };
        traceInjected = true;
        injectionMode = 'external';
      }
    }

    if (isOneMindSubEnabled('traceMissingAlert') && traceInjected && injectionMode && nextPacket.traceId) {
      this.publishSync({
        id: generateUUID(),
        traceId: nextPacket.traceId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.SYSTEM_ALERT,
        payload: {
          event: 'TRACE_MISSING',
          originalPacketId: packet.id,
          originalSource: packet.source,
          originalType: packet.type,
          injectedTraceId: nextPacket.traceId,
          injectionMode
        },
        priority: 0.2
      });
    }

    this.history.push(nextPacket);
    if (this.history.length > 1000) this.history.shift();

    if (this.listeners[nextPacket.type]) {
      this.listeners[nextPacket.type].forEach(handler => {
        if (isOneMindSubEnabled('traceHandlerScope') && nextPacket.traceId) {
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