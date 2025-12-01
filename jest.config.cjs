/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    'stateset-client.test.ts',
    'intelligent-cache.test.ts',
    'openapi-converter.test.ts',
    'connection-pool.test.ts',
    'e2e/',  // E2E tests require built dist and real server connections
    // Tests with complex module dependencies - excluded until mocking improved
    'dispatcher.test.ts',
    'registry.test.ts',
    'mcp-client.test.ts',
    'batch-processor.test.ts',
    'health.test.ts',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@tools/(.*)$': '<rootDir>/src/tools/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts',
    '!src/auth/**',
    '!src/utils/shutdown.ts',
    '!src/middleware/security.ts',
    '!src/middleware/api-docs.ts',
    '!src/core/realtime-manager.ts',
    '!src/core/intelligent-cache.ts',
    '!src/core/openapi-converter.ts',
    '!src/core/performance-optimizer.ts',
    '!src/core/advanced-metrics.ts',
    '!src/services/enhanced-stateset-client.ts',
    '!src/tools/ai-insights.ts',
    '!src/tools/openapi-tools.ts',
    '!src/tools/enhanced-tools.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 12,
      lines: 20,
      statements: 20,
    },
    // Current coverage: ~24% lines
    // Roadmap to 80%:
    // Phase 1 (current): 20% - Core utilities and schemas
    // Phase 2: 40% - Add integration tests for services
    // Phase 3: 60% - Add E2E tests with mocked APIs
    // Phase 4: 80% - Full coverage including edge cases
  },
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  globalTeardown: '<rootDir>/tests/teardown.ts',
  testTimeout: 30000,
  verbose: true,
  // Detect open handles to identify resource leaks
  detectOpenHandles: false, // Disabled for performance, enable for debugging
}; 