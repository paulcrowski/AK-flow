# 🧪 AK-FLOW Test Organization

## 📁 Structure

```
__tests__/
├── e2e/                  # End-to-end tests (full system integration)
├── integration/          # Integration tests (multiple components)
├── unit/                 # Unit tests (single components)
├── setup.ts              # Global test setup
├── utils.ts              # Test utilities
└── README.md             # This file
```

## 🎯 Test Categories

### 1. Unit Tests (`__tests__/unit/`)
- Test individual functions/components in isolation
- Mock all external dependencies
- Fast execution (< 100ms per test)
- Naming: `<ComponentName>.test.ts`

### 2. Integration Tests (`__tests__/integration/`)
- Test interactions between multiple components
- Limited mocking (only external services)
- Medium execution (< 500ms per test)
- Naming: `<FeatureName>Integration.test.ts`

### 3. E2E Tests (`__tests__/e2e/`)
- Test complete user flows
- No mocking (real dependencies)
- Slower execution (< 2s per test)
- Naming: `<UserFlow>.e2e.test.ts`

## 📋 Test Coverage Requirements

| Category | Minimum Coverage | Test Type |
|----------|------------------|-----------|
| Core Systems | 90% | Unit + Integration |
| Services | 85% | Unit + Integration |
| Utilities | 95% | Unit |
| UI Components | 80% | Unit |

## 🚀 Running Tests

```bash
# Run all tests
npm test

# Run tests with watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
vitest run __tests__/unit/CortexStateBuilder.test.ts

# Run tests by category
vitest run __tests__/unit/
vitest run __tests__/integration/
vitest run __tests__/e2e/
```

## 🧪 Test Utilities

### Common Utilities (`utils.ts`)
- `waitForEventBus()` - Wait for async EventBus handlers
- `publishAndWait()` - Publish and wait for handlers
- `publishSync()` - Publish synchronously
- `clearEventBus()` - Clear EventBus state

### Global Utilities (`setup.ts`)
- `testUtils.waitFor(ms)` - Wait for specified milliseconds
- `testUtils.createMockFunction()` - Create typed mock functions

## ✅ Test Best Practices

### 1. Test Naming
```typescript
// Good
describe('CortexStateBuilder', () => {
  describe('buildInitialState()', () => {
    it('should create initial state with default values', () => {
      // ...
    });
  });
});

// Bad - too generic
describe('State builder', () => {
  it('should work', () => {
    // ...
  });
});
```

### 2. Test Structure
```typescript
// Arrange
const builder = new CortexStateBuilder();

// Act
const result = builder.buildInitialState();

// Assert
expect(result.energy).toBe(100);
expect(result.mood).toBe('neutral');
```

### 3. Mocking Strategy
```typescript
// Unit test - mock everything
const mockService = {
  getData: jest.fn().mockReturnValue({ energy: 100 })
};

// Integration test - mock only external services
const mockDatabase = {
  query: jest.fn().mockResolvedValue([{ id: 1 }])
};

// E2E test - no mocking
const realService = new RealService();
```

### 4. Async Testing
```typescript
// Use async/await
it('should handle async operations', async () => {
  const result = await service.fetchData();
  expect(result).toBeDefined();
});

// Use testUtils.waitFor() for timing issues
it('should handle timing issues', async () => {
  const promise = service.startProcess();
  await testUtils.waitFor(100);
  expect(service.isRunning()).toBe(true);
});
```

## 📊 Test Reporting

- **Coverage Reports**: Generated in `/coverage` directory
- **HTML Report**: Open `coverage/index.html` in browser
- **JSON Report**: `test-results.json` for CI/CD integration
- **Console Output**: Detailed test results with timing

## 🔧 CI/CD Integration

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npm run test:ci

- name: Upload Coverage
  uses: actions/upload-artifact@v3
  with:
    name: coverage-report
    path: coverage/
```

## 📝 Test Documentation

Each test file should include:
1. **Purpose**: What component/feature is being tested
2. **Coverage**: What scenarios are covered
3. **Dependencies**: What needs to be mocked/stubbed
4. **Edge Cases**: What boundary conditions are tested

Example:
```typescript
/**
 * CortexStateBuilder Tests
 * 
 * Purpose: Test state building logic for cognitive cortex
 * Coverage: Initial state, state updates, validation
 * Dependencies: None (pure functions)
 * Edge Cases: Invalid inputs, boundary values
 */
```

## 🎓 Test Writing Guidelines

1. **One Assertion per Test**: Each test should verify one specific behavior
2. **Independent Tests**: Tests should not depend on each other
3. **Fast Tests**: Unit tests should run in < 100ms
4. **Deterministic**: Tests should always produce the same result
5. **Clear Names**: Test names should describe the expected behavior

## 🚨 Common Anti-Patterns

❌ **Test Interdependence**: Tests that rely on other tests
❌ **Over-Mocking**: Mocking everything makes tests meaningless
❌ **Slow Tests**: Tests that take > 500ms should be optimized
❌ **Fragile Tests**: Tests that break with minor implementation changes
❌ **Untested Edge Cases**: Missing boundary condition tests

## 📈 Test Maintenance

- **Update Tests with Code**: When changing implementation, update tests
- **Add Tests for Bugs**: Every bug fix should include a regression test
- **Review Test Coverage**: Regularly check coverage reports
- **Refactor Tests**: Keep tests clean and maintainable

## 🔗 Related Documentation

- [Testing Architecture](docs/TESTING_ARCHITECTURE.md)
- [Test Coverage Policy](docs/TEST_COVERAGE_POLICY.md)
- [Test Writing Guide](docs/TEST_WRITING_GUIDE.md)