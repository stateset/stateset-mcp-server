#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  ListResourceTemplatesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { tools, resourceTemplates, serverPrompt } from './tools/definitions';
import { handleError } from './middleware/error-handler';
import { wsManager } from './core/websocket';
import { cacheManager } from './core/cache';
import { StateSetMCPClient } from './services/mcp-client';
import { handleToolCall } from './tools/dispatcher';
import { Config } from './types/mcp-api';

import { resourceHandlers } from './core/resource-registry';

// Main Function
async function main(): Promise<void> {
  try {
    dotenv.config();
    const env = z
      .object({
        STATESET_API_KEY: z.string().min(1, 'STATESET_API_KEY is required'),
        STATESET_BASE_URL: z.string().url().default('https://api.stateset.io/v1'),
        REQUESTS_PER_HOUR: z.coerce.number().positive().default(1000),
        API_TIMEOUT_MS: z.coerce.number().positive().default(10000),
        WEBSOCKET_PORT: z.coerce.number().positive().default(8081),
      })
      .parse(process.env);

    const config: Config = {
      apiKey: env.STATESET_API_KEY,
      baseUrl: env.STATESET_BASE_URL,
      requestsPerHour: env.REQUESTS_PER_HOUR,
      timeoutMs: env.API_TIMEOUT_MS,
    };

    const client = new StateSetMCPClient(config);

    // Start WebSocket server for real-time updates
    try {
      wsManager.start(env.WEBSOCKET_PORT);
      logger.info('WebSocket server started', { port: env.WEBSOCKET_PORT });
    } catch (wsError) {
      logger.warn('Failed to start WebSocket server - real-time updates will be unavailable', {
        error: wsError instanceof Error ? wsError.message : String(wsError),
      });
    }

    const server = new Server(
      { name: 'stateset-mcp-server', version: '1.0.0' },
      {
        capabilities: {
          prompts: { default: serverPrompt },
          resources: { templates: true, read: true },
          tools: {},
        },
      },
    );

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        return await handleToolCall(client, request);
      } catch (error) {
        // Use the error handler for better error messages
        const apiError = handleError(error, { operation: request.params.name });
        throw new Error(apiError.message);
      }
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = new URL(request.params.uri);
      const path = uri.pathname.replace(/^\//, '');
      const handler = resourceHandlers.get(uri.protocol);

      if (!handler) {
        throw new Error(`Unsupported URI: ${request.params.uri}`);
      }

      const data = await handler(client, path);
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools,
    }));

    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      templates: resourceTemplates,
    }));

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('Server started successfully');

    // Graceful shutdown handling
    let isShuttingDown = false;

    const gracefulShutdown = async (signal: string) => {
      if (isShuttingDown) {
        logger.warn('Shutdown already in progress, forcing exit');
        process.exit(1);
      }

      isShuttingDown = true;
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Close WebSocket connections
        logger.info('Closing WebSocket connections...');
        wsManager.stop();

        // Clear caches
        logger.info('Stopping cache cleanup tasks...');
        cacheManager.stopCleanupTimer();
        logger.info('Clearing caches...');
        cacheManager.clear();

        // Close server transport
        logger.info('Closing server transport...');
        await server.close();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Unhandled error in main', error);
  process.exit(1);
});
