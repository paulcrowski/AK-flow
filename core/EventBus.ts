import { CognitivePacket, EventHandler, PacketType } from "../types";

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
    // Log to history (Short term buffer)
    this.history.push(packet);
    // Increased buffer to 1000 to support meaningful session exports
    if (this.history.length > 1000) this.history.shift();

    if (this.listeners[packet.type]) {
      this.listeners[packet.type].forEach(handler => {
        // Asynchronous execution to simulate distributed processing
        setTimeout(() => handler(packet), 0);
      });
    }
  }

  /**
   * Synchronous publish - useful for testing.
   * Handlers execute immediately, no setTimeout.
   */
  publishSync(packet: CognitivePacket) {
    this.history.push(packet);
    if (this.history.length > 1000) this.history.shift();

    if (this.listeners[packet.type]) {
      this.listeners[packet.type].forEach(handler => handler(packet));
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