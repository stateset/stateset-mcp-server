import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Global test utilities
export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms)); 