import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Set default API key for tests
process.env.STATESET_API_KEY = process.env.STATESET_API_KEY || 'test-api-key';

// Global test utilities
export const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

// Setup global afterEach to clean up resources
afterEach(async () => {
  // Clear all Jest timers
  jest.clearAllTimers();

  // Give pending async operations a chance to complete
  await new Promise(resolve => setImmediate(resolve));
});

// Setup global afterAll for final cleanup
afterAll(async () => {
  // Allow final async operations to complete
  await new Promise(resolve => setTimeout(resolve, 50));
});

// Setup global beforeAll
beforeAll(() => {
  // Suppress console warnings in tests unless explicitly enabled
  if (!process.env.SHOW_TEST_LOGS) {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  }
}); 