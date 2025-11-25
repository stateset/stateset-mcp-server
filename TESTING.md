# Testing Guide

## Overview

This project uses Jest for testing with comprehensive unit, integration, and end-to-end test coverage.

## Test Structure

```
tests/
├── unit/              # Unit tests for individual components
├── integration/       # Integration tests for API interactions
├── e2e/              # End-to-end tests for complete workflows
├── fixtures/         # Test data and mocks
├── setup.ts          # Global test setup
└── teardown.ts       # Global test cleanup
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests only
npm run test:e2e

# Run with open handles detection (for debugging leaks)
npm test -- --detectOpenHandles
```

## Current Coverage

| Metric     | Current | Target  |
|------------|---------|---------|
| Statements | ~13%    | 80%+    |
| Branches   | ~10%    | 80%+    |
| Functions  | ~8%     | 80%+    |
| Lines      | ~13%    | 80%+    |

### Well-Tested Modules

- ✅ **schemas.ts** - 100% coverage
- ✅ **validation.ts** - High coverage
- ✅ **cache.ts** - ~57% coverage
- ✅ **circuit-breaker.ts** - ~72% coverage

### Modules Needing Tests

- ⚠️ **server.ts** - 0% coverage (main entry point)
- ⚠️ **stateset-client.ts** - 0% coverage (core API client)
- ⚠️ **mcp-client.ts** - 0% coverage (MCP implementation)
- ⚠️ **tools/registry.ts** - 0% coverage (tool management)

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from '@jest/globals';
import { MyModule } from '@/core/my-module';

describe('MyModule', () => {
  let module: MyModule;

  beforeEach(() => {
    module = new MyModule();
  });

  afterEach(() => {
    // Clean up resources
    module.destroy();
  });

  it('should perform expected behavior', () => {
    const result = module.doSomething();
    expect(result).toBe('expected');
  });
});
```

### Integration Test Example

```typescript
import nock from 'nock';
import { StateSetClient } from '@/services/stateset-client';

describe('StateSet API Integration', () => {
  beforeEach(() => {
    nock('https://api.stateset.io')
      .get('/orders/123')
      .reply(200, { id: '123', status: 'pending' });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should fetch order from API', async () => {
    const client = new StateSetClient(config);
    const order = await client.getOrder('123');
    expect(order.status).toBe('pending');
  });
});
```

## Test Configuration

Tests are configured in `jest.config.cjs` with the following features:

- **TypeScript Support**: via `ts-jest`
- **Path Aliases**: `@config`, `@core`, `@tools`, etc.
- **Coverage Reports**: Text, LCOV, and HTML formats
- **Timeout**: 30 seconds per test
- **Force Exit**: Enabled to prevent hanging on async operations

## Improving Coverage

### Priority 1: Core Functionality
1. Add tests for `server.ts` - main entry point
2. Add tests for `stateset-client.ts` - API client
3. Add tests for `mcp-client.ts` - MCP protocol

### Priority 2: Tool System
4. Add tests for `tools/registry.ts` - tool registration
5. Add tests for `tools/dispatcher.ts` - tool execution
6. Add tests for `tools/definitions.ts` - tool definitions

### Priority 3: Supporting Services
7. Add tests for `services/` - service layer
8. Add tests for `middleware/` - request handling
9. Add tests for `core/metrics.ts` - metrics collection

## Test Best Practices

1. **Cleanup Resources**: Always use `afterEach` to clean up
2. **Mock External Services**: Use `nock` for HTTP mocks
3. **Use Fake Timers**: For time-dependent tests
4. **Isolate Tests**: Each test should be independent
5. **Descriptive Names**: Use clear test descriptions
6. **Test Edge Cases**: Don't just test happy paths

## Debugging Tests

### Finding Resource Leaks

```bash
npm test -- --detectOpenHandles
```

### Running Single Test File

```bash
npm test -- path/to/test.ts
```

### Debugging in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-coverage", "${fileBasename}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## CI/CD Integration

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request
- Multi-version testing: Node 18, 20, 22
- Coverage reports uploaded to Codecov

## Contributing

When adding new features:
1. Write tests first (TDD approach recommended)
2. Ensure tests pass locally
3. Maintain or improve coverage
4. Add integration tests for API interactions
5. Document complex test scenarios

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [MCP Testing Guide](https://modelcontextprotocol.io/docs/testing)
