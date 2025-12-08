/**
 * Test Utilities
 * 
 * Common helpers for all tests in AK-FLOW
 */
import { eventBus } from '../core/EventBus';

// Wait for async EventBus handlers
export const waitForEventBus = () => new Promise(resolve => setTimeout(resolve, 50));

// Publish and wait for handlers
export const publishAndWait = async (packet: any) => {
    eventBus.publish(packet);
    await waitForEventBus();
};

// Publish synchronously (no waiting needed)
export const publishSync = (packet: any) => {
    eventBus.publishSync(packet);
};

// Clear EventBus state
export const clearEventBus = async () => {
    eventBus.clear();
    await waitForEventBus();
};
