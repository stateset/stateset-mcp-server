import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger';
import { sanitizeToolArguments } from '../utils/validation';
import { toolRateLimiter } from '../core/server-rate-limiter';
import { StateSetMCPClient } from '../services/mcp-client';
import { toolHandlers } from './registry';

export async function handleToolCall(
  client: StateSetMCPClient,
  request: CallToolRequest,
): Promise<any> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log incoming request
  logger.debug('Tool request received', {
    requestId,
    tool: request.params.name,
    hasArguments: !!request.params.arguments,
  });

  // Sanitize input arguments for security
  const rawArgs = request.params.arguments || {};
  const sanitizedArgs = sanitizeToolArguments(
    rawArgs as Record<string, unknown>,
    request.params.name,
  );

  // Create a modified request with sanitized arguments
  const safeRequest = {
    ...request,
    params: {
      ...request.params,
      arguments: sanitizedArgs,
    },
  };

  // Apply per-tool rate limiting
  const toolCategory = await toolRateLimiter.waitAndAcquire(safeRequest.params.name);
  logger.debug('Tool rate limit acquired', {
    requestId,
    tool: safeRequest.params.name,
    category: toolCategory,
  });

  const handler = toolHandlers.get(safeRequest.params.name);

  if (!handler) {
    throw new Error(`Unknown tool: ${safeRequest.params.name}`);
  }

  try {
    return await handler(client, safeRequest.params.arguments);
  } catch (error) {
    logger.error('Tool execution failed', {
      requestId,
      tool: safeRequest.params.name,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
