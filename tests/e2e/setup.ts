import dotenv from 'dotenv';
import { config } from '@config/index';

// Load environment variables for E2E tests
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Mock API key if not provided
if (!process.env.STATESET_API_KEY) {
  process.env.STATESET_API_KEY = 'test-api-key-for-e2e-testing';
}

// Extend timeout for E2E tests
jest.setTimeout(60000);

// Global test setup
beforeAll(() => {
  console.log('🚀 Starting E2E test suite');
  console.log(`Environment: ${config.server.environment}`);
  console.log(`API Base URL: ${config.api.baseUrl}`);
});

// Global test teardown
afterAll(() => {
  console.log('✅ E2E test suite completed');
});
