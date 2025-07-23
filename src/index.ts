#!/usr/bin/env node

import { createServer } from '@core/server';
import { loadConfig } from '@config/config';
import { createLogger } from '@utils/logger';
import { gracefulShutdown } from '@utils/shutdown';

const logger = createLogger('main');

async function main(): Promise<void> {
  try {
    // Load configuration
    const config = loadConfig();
    logger.info('Configuration loaded successfully');

    // Create and start server
    const server = await createServer(config);
    await server.start();
    
    logger.info('StateSet MCP Server started successfully');

    // Setup graceful shutdown
    gracefulShutdown(server);
    
    // Log startup completion
    logger.info({
      name: config.server.name,
      version: config.server.version,
      logLevel: config.server.logLevel,
      metricsEnabled: config.features.enableMetrics,
    }, 'Server startup completed');
    
  } catch (error) {
    logger.error(`Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection: ${reason instanceof Error ? reason.message : reason}`);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Start the server
void main(); 