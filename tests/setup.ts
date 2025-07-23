const dotenv = require('dotenv');

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment defaults
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  // Uncomment below to silence logs in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Setup global test timeout
jest.setTimeout(10000);

// Global test utilities
const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

global.delay = delay; 