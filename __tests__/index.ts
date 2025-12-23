/**
 * Test Exports
 * 
 * Centralized export of all test utilities and helpers
 */

export * from './utils';
export * from './setup';

// Test configuration
export const TEST_CONFIG = {
    DEFAULT_TIMEOUT: 5000,
    DEFAULT_WAIT: 50,
    MAX_RETRIES: 3,
    COVERAGE_THRESHOLD: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
    }
};

// Test categories
export enum TestCategory {
    UNIT = 'unit',
    INTEGRATION = 'integration',
    E2E = 'e2e'
}

// Test priority
export enum TestPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

// Test metadata interface
interface TestMetadata {
    category: TestCategory;
    priority: TestPriority;
    description: string;
    relatedComponents?: string[];
}

// Test decorator for metadata
export const testMeta = (metadata: TestMetadata) => {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        // Store metadata for test reporting
        if (!target.__testMetadata) {
            target.__testMetadata = {};
        }
        target.__testMetadata[propertyKey] = metadata;
    };
};

// Get test metadata
export const getTestMetadata = (target: any, propertyKey: string): TestMetadata | undefined => {
    return target.__testMetadata?.[propertyKey];
};