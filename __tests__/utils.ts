/**
 * Test Utilities
 * 
 * Common helpers for all tests in AK-FLOW
 */
import { eventBus } from '../core/EventBus';

// Wait for async EventBus handlers
export const waitForEventBus = (ms: number = 50) => new Promise(resolve => setTimeout(resolve, ms));

// Publish and wait for handlers
export const publishAndWait = async (packet: any, waitMs: number = 50) => {
    eventBus.publish(packet);
    await waitForEventBus(waitMs);
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

// Create a mock function with typing
export const createMockFunction = <T extends (...args: any[]) => any>(fn?: T): jest.MockedFunction<T> => {
    return fn ? jest.fn(fn) as jest.MockedFunction<T> : jest.fn() as jest.MockedFunction<T>;
};

// Create a mock object with typed methods
export const createMockObject = <T extends object>(partialMock: Partial<T> = {}): jest.Mocked<T> => {
    return {
        ...partialMock,
        // Add any missing methods as mocks
        ...Object.fromEntries(
            Object.keys(partialMock).map(key => [key, jest.fn(partialMock[key as keyof T])])
        )
    } as jest.Mocked<T>;
};

// Assert that a function was called with specific arguments
export const expectCalledWith = <T extends (...args: any[]) => any>(
    mockFn: jest.MockedFunction<T>,
    expectedArgs: Parameters<T>
) => {
    expect(mockFn).toHaveBeenCalledWith(...expectedArgs);
};

// Assert that a function was called exactly once with specific arguments
export const expectCalledOnceWith = <T extends (...args: any[]) => any>(
    mockFn: jest.MockedFunction<T>,
    expectedArgs: Parameters<T>
) => {
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(...expectedArgs);
};

// Create a spy on an object method
export const spyOnMethod = <T extends object, K extends keyof T>(
    obj: T,
    method: K,
    mockImplementation?: (...args: any[]) => any
): jest.SpyInstance => {
    return jest.spyOn(obj, method as any).mockImplementation(mockImplementation);
};

// Test helper for async operations with timeout
export const withTimeout = async <T>(
    promise: Promise<T>,
    timeoutMs: number = 2000,
    timeoutMessage: string = 'Operation timed out'
): Promise<T> => {
    let timeoutHandle: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error(timeoutMessage));
        }, timeoutMs);
    });
    
    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutHandle);
        return result;
    } catch (error) {
        clearTimeout(timeoutHandle);
        throw error;
    }
};

// Test helper for retrying async operations
export const retryAsync = async <T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 100
): Promise<T> => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;
            if (attempt < maxAttempts) {
                await waitForEventBus(delayMs);
            }
        }
    }
    
    throw lastError || new Error('Operation failed after maximum attempts');
};

// Test helper for creating test data
export const createTestData = <T>(template: T, overrides: Partial<T> = {}): T => {
    return { ...template, ...overrides };
};

// Test helper for deep equality check
export const expectDeepEqual = (actual: any, expected: any) => {
    expect(actual).toEqual(expected);
};

// Test helper for checking if value is within range
export const expectInRange = (value: number, min: number, max: number) => {
    expect(value).toBeGreaterThanOrEqual(min);
    expect(value).toBeLessThanOrEqual(max);
};
