import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleToolCall } from '../../src/tools/dispatcher';
import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../src/core/server-rate-limiter', () => ({
  toolRateLimiter: {
    waitAndAcquire: (jest.fn() as any).mockResolvedValue('read'),
  },
}));

// Mock validation
jest.mock('../../src/utils/validation', () => ({
  sanitizeToolArguments: jest.fn((args) => args),
}));

// Mock the toolHandlers Map
jest.mock('../../src/tools/registry', () => {
  const mockHandler = jest.fn();
  const toolHandlers = new Map([
    ['stateset_test_tool', mockHandler],
    ['stateset_health_check', (jest.fn() as any).mockResolvedValue({ status: 'healthy' })],
  ]);
  return { toolHandlers };
});

describe('Tool Dispatcher', () => {
  const mockClient = {
    healthCheck: (jest.fn() as any).mockResolvedValue({ status: 'healthy' }),
  } as any;
  let mockHandler: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const { toolHandlers } = require('../../src/tools/registry');
    mockHandler = toolHandlers.get('stateset_test_tool');
    mockHandler.mockReset();
    mockHandler.mockResolvedValue({ success: true });
  });

  describe('handleToolCall', () => {
    it('should call the correct tool handler', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'stateset_test_tool',
          arguments: { test: 'value' },
        },
      };

      const result = await handleToolCall(mockClient, request);

      expect(mockHandler).toHaveBeenCalledWith(mockClient, { test: 'value' });
      expect(result).toEqual({ success: true });
    });

    it('should throw error for unknown tool', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {},
        },
      };

      await expect(handleToolCall(mockClient, request)).rejects.toThrow('Unknown tool: nonexistent_tool');
    });

    it('should handle empty arguments', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'stateset_test_tool',
        },
      };

      await handleToolCall(mockClient, request);

      expect(mockHandler).toHaveBeenCalledWith(mockClient, {});
    });

    it('should pass sanitized arguments to handler', async () => {
      const { sanitizeToolArguments } = require('../../src/utils/validation');
      sanitizeToolArguments.mockReturnValue({ sanitized: true });

      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'stateset_test_tool',
          arguments: { raw: 'data' },
        },
      };

      await handleToolCall(mockClient, request);

      expect(sanitizeToolArguments).toHaveBeenCalledWith({ raw: 'data' }, 'stateset_test_tool');
      expect(mockHandler).toHaveBeenCalledWith(mockClient, { sanitized: true });
    });

    it('should acquire rate limit before calling handler', async () => {
      const { toolRateLimiter } = require('../../src/core/server-rate-limiter');

      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'stateset_test_tool',
          arguments: {},
        },
      };

      await handleToolCall(mockClient, request);

      expect(toolRateLimiter.waitAndAcquire).toHaveBeenCalledWith('stateset_test_tool');
    });

    it('should propagate handler errors', async () => {
      const error = new Error('Handler failed');
      (mockHandler as any).mockRejectedValue(error);

      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'stateset_test_tool',
          arguments: {},
        },
      };

      await expect(handleToolCall(mockClient, request)).rejects.toThrow('Handler failed');
    });

    it('should log tool execution details', async () => {
      const { logger } = require('../../src/utils/logger');

      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'stateset_test_tool',
          arguments: { test: 'value' },
        },
      };

      await handleToolCall(mockClient, request);

      expect(logger.debug).toHaveBeenCalledWith(
        'Tool request received',
        expect.objectContaining({
          tool: 'stateset_test_tool',
          hasArguments: true,
        })
      );
    });
  });
});
