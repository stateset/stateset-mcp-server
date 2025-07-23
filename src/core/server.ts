import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Config } from '@config/config';
import { createLogger } from '@utils/logger';
import { setupHandlers } from './handlers';
import { StateSetClient } from '@services/stateset-client';
import { MetricsCollector } from '@services/metrics';

const logger = createLogger('server');

export interface MCPServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Create and configure the MCP server
 */
export async function createServer(config: Config): Promise<MCPServer> {
  logger.info('Creating MCP server');

  // Initialize services
  const statesetClient = new StateSetClient(config);
  const metricsCollector = config.features.enableMetrics 
    ? new MetricsCollector(config) 
    : undefined;

  // Create MCP server instance
  const server = new Server(
    {
      name: config.server.name,
      version: config.server.version,
    },
    {
      capabilities: {
        prompts: {},
        resources: { templates: true, read: true },
        tools: {},
      },
    },
  );

  // Setup request handlers
  setupHandlers(server, statesetClient, metricsCollector);

  // Create transport
  const transport = new StdioServerTransport();

  return {
    async start(): Promise<void> {
      logger.info('Starting MCP server');
      
      // Start metrics collection if enabled
      if (metricsCollector) {
        metricsCollector.start();
      }

      // Connect the server to the transport
      await server.connect(transport);
      
      logger.info('MCP server started successfully');
    },

    async stop(): Promise<void> {
      logger.info('Stopping MCP server');
      
      // Stop metrics collection
      if (metricsCollector) {
        metricsCollector.stop();
      }

      // Close the transport
      await transport.close();
      
      logger.info('MCP server stopped successfully');
    },
  };
} 