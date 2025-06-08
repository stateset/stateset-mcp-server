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
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught Exception');
  process.exit(1);
});

// Start the server
void main(); 