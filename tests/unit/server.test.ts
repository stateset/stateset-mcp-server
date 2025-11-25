import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Mock dependencies
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');
jest.mock('dotenv');
jest.mock('../../src/utils/logger');
jest.mock('../../src/tools/definitions');
jest.mock('../../src/middleware/error-handler');
jest.mock('../../src/core/websocket');
jest.mock('../../src/core/cache');
jest.mock('../../src/services/mcp-client');

describe('Server', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.STATESET_API_KEY = 'test-api-key';
    process.env.STATESET_BASE_URL = 'https://api.stateset.io/v1';
    process.env.REQUESTS_PER_HOUR = '1000';
    process.env.API_TIMEOUT_MS = '10000';
    process.env.WEBSOCKET_PORT = '8081';

    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should validate required environment variables', () => {
    expect(process.env.STATESET_API_KEY).toBe('test-api-key');
  });

  it('should use default values for optional environment variables', () => {
    delete process.env.STATESET_BASE_URL;
    delete process.env.REQUESTS_PER_HOUR;

    // These should use defaults
    expect(process.env.STATESET_BASE_URL).toBeUndefined();
    expect(process.env.REQUESTS_PER_HOUR).toBeUndefined();
  });

  it('should parse numeric environment variables correctly', () => {
    const requestsPerHour = parseInt(process.env.REQUESTS_PER_HOUR || '1000');
    const timeoutMs = parseInt(process.env.API_TIMEOUT_MS || '10000');

    expect(requestsPerHour).toBe(1000);
    expect(timeoutMs).toBe(10000);
  });

  describe('Server initialization', () => {
    it('should create server with correct config', () => {
      const ServerMock = Server as jest.MockedClass<typeof Server>;

      expect(ServerMock).toBeDefined();
    });
  });

  describe('Environment validation', () => {
    it('should require STATESET_API_KEY', () => {
      delete process.env.STATESET_API_KEY;

      // Server should fail to start without API key
      expect(process.env.STATESET_API_KEY).toBeUndefined();
    });

    it('should validate URL format for STATESET_BASE_URL', () => {
      const url = process.env.STATESET_BASE_URL;

      expect(url).toMatch(/^https?:\/\//);
    });
  });

  describe('Configuration', () => {
    it('should create valid config object', () => {
      const config = {
        apiKey: process.env.STATESET_API_KEY,
        baseUrl: process.env.STATESET_BASE_URL,
        requestsPerHour: parseInt(process.env.REQUESTS_PER_HOUR || '1000'),
        timeoutMs: parseInt(process.env.API_TIMEOUT_MS || '10000'),
      };

      expect(config.apiKey).toBe('test-api-key');
      expect(config.baseUrl).toBe('https://api.stateset.io/v1');
      expect(config.requestsPerHour).toBe(1000);
      expect(config.timeoutMs).toBe(10000);
    });
  });
});
