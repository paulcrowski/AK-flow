# 🧪 AK-FLOW Testing Architecture

## 🎯 Overview

The AK-FLOW testing architecture is designed to ensure comprehensive coverage, maintainability, and reliability of the cognitive agent system. This document describes the testing philosophy, organization, and best practices.

## 📁 Test Organization

### Directory Structure

```
__tests__/
├── e2e/                  # End-to-end tests (full system integration)
├── integration/          # Integration tests (multiple components)
├── unit/                 # Unit tests (single components)
├── setup.ts              # Global test setup and configuration
├── utils.ts              # Common test utilities and helpers
├── index.ts              # Centralized test exports
└── README.md             # Test organization documentation
```

### Test Categories

#### 1. Unit Tests (`__tests__/unit/`)
- **Purpose**: Test individual functions and components in isolation
- **Scope**: Single component or function
- **Mocking**: All external dependencies are mocked
- **Execution Time**: < 100ms per test
- **Naming Convention**: `<ComponentName>.test.ts`
- **Examples**: `CortexStateBuilder.test.ts`, `HardFactsBuilder.test.ts`

#### 2. Integration Tests (`__tests__/integration/`)
- **Purpose**: Test interactions between multiple components
- **Scope**: Multiple related components
- **Mocking**: Only external services (e.g., database, API)
- **Execution Time**: < 500ms per test
- **Naming Convention**: `<FeatureName>Integration.test.ts`
- **Examples**: `FactEchoPipeline.test.ts`, `PrismIntegration.test.ts`

#### 3. End-to-End Tests (`__tests__/e2e/`)
- **Purpose**: Test complete user flows and system behavior
- **Scope**: Full system integration
- **Mocking**: None (uses real dependencies)
- **Execution Time**: < 2000ms per test
- **Naming Convention**: `<UserFlow>.e2e.test.ts`
- **Examples**: (Future: `AgentWakeCycle.e2e.test.ts`)

## 📊 Test Coverage Requirements

### Minimum Coverage Thresholds

| Component Category | Lines | Functions | Branches | Statements |
|-------------------|-------|-----------|----------|------------|
| Core Systems | 90% | 90% | 85% | 90% |
| Services | 85% | 85% | 80% | 85% |
| Utilities | 95% | 95% | 90% | 95% |
| UI Components | 80% | 80% | 75% | 80% |

### Current Coverage Status

- **Total Tests**: 285+ (as of 2025-12-10)
- **Core Systems**: 152 tests
- **Services**: 45 tests
- **Utilities**: 18 tests
- **Integration**: 70 tests

## 🚀 Test Execution

### Basic Commands

```bash
# Run all tests
npm test

# Run tests with watch mode
npm run test:watch

# Run tests with coverage reporting
npm run test:coverage

# Run tests in CI mode (verbose output)
npm run test:ci
```

### Category-Specific Commands

```bash
# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only e2e tests
npm run test:e2e
```

### Advanced Test Runner

```bash
# List all test files
npm run test:list

# Analyze test coverage
npm run test:analyze

# Run specific test file
vitest run __tests__/unit/CortexStateBuilder.test.ts

# Run tests with filter
node scripts/test-runner.js run unit CortexState
```

## 🧪 Test Utilities

### Common Utilities (`__tests__/utils.ts`)

#### EventBus Helpers
- `waitForEventBus(ms: number = 50)` - Wait for async EventBus handlers
- `publishAndWait(packet: any, waitMs: number = 50)` - Publish and wait for handlers
- `publishSync(packet: any)` - Publish synchronously
- `clearEventBus()` - Clear EventBus state

#### Mocking Utilities
- `createMockFunction<T>(fn?: T)` - Create typed mock functions
- `createMockObject<T>(partialMock: Partial<T>)` - Create typed mock objects
- `spyOnMethod<T, K>(obj: T, method: K, mockImplementation?)` - Spy on object methods

#### Assertion Helpers
- `expectCalledWith(mockFn, expectedArgs)` - Assert function called with specific args
- `expectCalledOnceWith(mockFn, expectedArgs)` - Assert function called exactly once
- `expectDeepEqual(actual, expected)` - Deep equality check
- `expectInRange(value, min, max)` - Check if value is within range

#### Async Utilities
- `withTimeout(promise, timeoutMs, timeoutMessage)` - Add timeout to async operations
- `retryAsync(operation, maxAttempts, delayMs)` - Retry async operations

#### Data Utilities
- `createTestData(template, overrides)` - Create test data with overrides

### Global Utilities (`__tests__/setup.ts`)

- `testUtils.waitFor(ms)` - Wait for specified milliseconds
- `testUtils.createMockFunction()` - Create typed mock functions
- Console warning/error suppression for common test noise

### Test Configuration (`__tests__/index.ts`)

- `TEST_CONFIG` - Test configuration constants
- `TestCategory` enum - Test category definitions
- `TestPriority` enum - Test priority levels
- `testMeta` decorator - Add metadata to tests
- `getTestMetadata()` - Retrieve test metadata

## ✅ Test Writing Best Practices

### 1. Test Structure (AAA Pattern)

```typescript
// Arrange - Setup test conditions
describe('CortexStateBuilder', () => {
  let builder: CortexStateBuilder;
  
  beforeEach(() => {
    builder = new CortexStateBuilder();
  });
  
  describe('buildInitialState()', () => {
    it('should create initial state with default values', () => {
      // Act - Execute the operation
      const result = builder.buildInitialState();
      
      // Assert - Verify the outcome
      expect(result.energy).toBe(100);
      expect(result.mood).toBe('neutral');
    });
  });
});
```

### 2. Test Naming Conventions

**Good:**
```typescript
describe('FactEchoGuard', () => {
  describe('validateFactEcho()', () => {
    it('should pass validation when fact_echo matches hard facts', () => {
      // ...
    });
    
    it('should fail validation when fact_echo differs from hard facts', () => {
      // ...
    });
  });
});
```

**Bad:**
```typescript
describe('Guard', () => {
  it('should work', () => {
    // ...
  });
  
  it('should not fail', () => {
    // ...
  });
});
```

### 3. Mocking Strategy

**Unit Tests:** Mock everything
```typescript
const mockService = {
  getData: jest.fn().mockReturnValue({ energy: 100 })
};
```

**Integration Tests:** Mock only external services
```typescript
const mockDatabase = {
  query: jest.fn().mockResolvedValue([{ id: 1 }])
};
```

**E2E Tests:** No mocking
```typescript
const realService = new RealService();
```

### 4. Async Testing

```typescript
// Use async/await
it('should handle async operations', async () => {
  const result = await service.fetchData();
  expect(result).toBeDefined();
});

// Use withTimeout for operations that might hang
it('should complete within timeout', async () => {
  await withTimeout(service.longOperation(), 1000);
});

// Use retryAsync for flaky operations
it('should eventually succeed', async () => {
  const result = await retryAsync(service.flakyOperation, 3, 100);
  expect(result).toBeTruthy();
});
```

### 5. Edge Case Testing

```typescript
// Test boundary conditions
describe('EnergyValidation', () => {
  it('should reject negative energy values', () => {
    expect(() => validateEnergy(-1)).toThrow();
  });
  
  it('should reject energy values above maximum', () => {
    expect(() => validateEnergy(101)).toThrow();
  });
  
  it('should accept valid energy values', () => {
    expect(validateEnergy(50)).toBe(50);
  });
});
```

## 📝 Test Documentation Standards

Each test file should include a header comment:

```typescript
/**
 * FactEchoGuard Tests
 * 
 * Purpose: Validate fact echo mechanism to prevent agent hallucinations
 * Coverage: 
 *   - Fact echo validation logic
 *   - Hard facts comparison
 *   - Error handling for mismatches
 * Dependencies: 
 *   - HardFactsBuilder (mocked)
 *   - EventBus (real)
 * Edge Cases: 
 *   - Missing fact_echo field
 *   - Null/undefined values
 *   - Floating point precision
 */
```

## 🎓 Test Writing Guidelines

### 1. One Assertion per Test
Each test should verify one specific behavior or outcome.

### 2. Independent Tests
Tests should not depend on each other or share state.

### 3. Fast Tests
Unit tests should execute in < 100ms. Integration tests < 500ms.

### 4. Deterministic Results
Tests should always produce the same result regardless of environment.

### 5. Clear Failure Messages
Use descriptive error messages that help identify the problem.

### 6. Test Data Isolation
Use `createTestData()` to create isolated test data for each test.

## 🚨 Common Anti-Patterns

### ❌ Test Interdependence
```typescript
// Bad - tests depend on each other
it('should create user', () => {
  user = createUser();
});

it('should update user', () => {
  updateUser(user); // Depends on previous test
});
```

### ❌ Over-Mocking
```typescript
// Bad - mocking everything makes tests meaningless
const mockEverything = {
  getData: jest.fn(),
  processData: jest.fn(),
  saveData: jest.fn()
};
```

### ❌ Slow Tests
```typescript
// Bad - tests that take too long
it('should process large dataset', async () => {
  await processDataset(1000000); // Takes 5 seconds
});
```

### ❌ Fragile Tests
```typescript
// Bad - tests that break with minor implementation changes
it('should have exact implementation', () => {
  expect(service.internalMethod()).toBeCalled(); // Tests implementation, not behavior
});
```

### ❌ Untested Edge Cases
```typescript
// Bad - missing boundary condition tests
it('should handle normal case', () => {
  expect(calculate(50)).toBe(100);
});
// Missing: what about calculate(0)? calculate(101)?
```

## 📈 Test Maintenance

### Test Update Strategy
1. **Update Tests with Code Changes**: When changing implementation, update corresponding tests
2. **Add Regression Tests**: Every bug fix should include a test that reproduces the bug
3. **Review Coverage Regularly**: Check coverage reports after major changes
4. **Refactor Tests**: Keep tests clean and maintainable

### Test Refactoring Patterns

**Extract Common Setup:**
```typescript
// Before
it('should do X', () => {
  const service = new Service();
  const mock = createMock();
  // ...
});

it('should do Y', () => {
  const service = new Service();
  const mock = createMock();
  // ...
});

// After
beforeEach(() => {
  service = new Service();
  mock = createMock();
});
```

**Parameterized Tests:**
```typescript
// Instead of multiple similar tests
const testCases = [
  { input: 1, expected: 2 },
  { input: 5, expected: 10 },
  { input: 10, expected: 20 }
];

testCases.forEach(({ input, expected }) => {
  it(`should double ${input} to ${expected}`, () => {
    expect(double(input)).toBe(expected);
  });
});
```

## 🔧 CI/CD Integration

### GitHub Actions Example

```yaml
name: AK-FLOW CI

on: [push, pull_request]

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    
    - name: Install dependencies
      run: npm install
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run all tests with coverage
      run: npm run test:coverage
    
    - name: Upload coverage report
      uses: actions/upload-artifact@v3
      with:
        name: coverage-report
        path: coverage/
    
    - name: Analyze coverage
      run: npm run test:analyze
```

### Coverage Monitoring

Use services like Codecov or Coveralls to monitor coverage trends:

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: coverage/coverage-final.json
```

## 📊 Test Reporting

### Coverage Reports
- **HTML Report**: `coverage/index.html` - Interactive coverage visualization
- **JSON Report**: `coverage/coverage-summary.json` - Machine-readable coverage data
- **Text Report**: Console output during test execution

### Test Results
- **JSON Output**: `test-results.json` - Detailed test execution results
- **Console Output**: Real-time test execution feedback
- **JUnit XML**: (Future) For CI/CD integration

## 🎯 Future Improvements

### Planned Enhancements

1. **Performance Testing**: Add benchmark tests for critical components
2. **Visual Regression Testing**: For UI components
3. **Snapshot Testing**: For configuration and state objects
4. **Property-Based Testing**: Using libraries like fast-check
5. **Test Impact Analysis**: Identify which tests to run based on code changes

### Technical Debt

- **Legacy Tests**: Some tests use deprecated patterns
- **Test Coverage**: Some edge cases not covered
- **Test Performance**: Some integration tests could be optimized
- **Test Documentation**: Some test files lack proper documentation

## 📚 Related Documentation

- [Test Organization Guide](__tests__/README.md)
- [Test Coverage Policy](TEST_COVERAGE_POLICY.md)
- [Test Writing Guide](TEST_WRITING_GUIDE.md)
- [Continuous Integration Guide](CI_CD_GUIDE.md)

## 🤝 Contributing to Tests

### Adding New Tests

1. **Identify Test Category**: Determine if it's unit, integration, or e2e
2. **Create Test File**: Follow naming conventions
3. **Write Tests**: Follow best practices and patterns
4. **Add Documentation**: Include header comment with metadata
5. **Run Tests**: Verify all tests pass
6. **Check Coverage**: Ensure coverage meets requirements

### Reviewing Tests

1. **Code Review**: All tests should be reviewed
2. **Coverage Check**: Verify coverage requirements are met
3. **Performance Check**: Ensure tests run quickly
4. **Maintainability**: Tests should be easy to understand and modify

## 🎓 Training and Resources

### Recommended Reading
- "Test-Driven Development by Example" - Kent Beck
- "Working Effectively with Legacy Code" - Michael Feathers
- "Clean Code" - Robert C. Martin (Testing chapter)

### Online Resources
- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing JavaScript](https://testingjavascript.com/)

## 📅 Test Maintenance Schedule

| Frequency | Activity |
|-----------|----------|
| Daily | Run unit tests before commits |
| Weekly | Run full test suite and check coverage |
| Monthly | Review test performance and refactor slow tests |
| Quarterly | Review test coverage and add missing tests |
| Yearly | Major test architecture review and updates |

## 🏆 Quality Metrics

### Test Quality Indicators
- **Coverage**: Percentage of code covered by tests
- **Reliability**: Percentage of tests that pass consistently
- **Performance**: Average test execution time
- **Maintainability**: Ease of understanding and modifying tests

### Target Metrics
- **Test Coverage**: 85%+ overall, 90%+ for core systems
- **Test Reliability**: 99%+ pass rate
- **Test Performance**: < 100ms average for unit tests
- **Test Maintainability**: All tests documented and reviewed

## 🔚 Conclusion

The AK-FLOW testing architecture provides a comprehensive framework for ensuring code quality, reliability, and maintainability. By following the established patterns, conventions, and best practices, we can maintain a robust test suite that supports the continuous evolution of the cognitive agent system.