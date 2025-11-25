import { createLogger } from './logger';
import type { MCPServer } from '@core/server';

const logger = createLogger('shutdown');

let isShuttingDown = false;

/**
 * Setup graceful shutdown handlers
 */
export function gracefulShutdown(server: MCPServer): void {
  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, 'Graceful shutdown initiated');

    try {
      // Give ongoing requests time to complete
      const shutdownTimeout = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '10000', 10);

      await Promise.race([
        server.stop(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Shutdown timeout')), shutdownTimeout),
        ),
      ]);

      logger.info('Server stopped successfully');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGUSR2', () => void shutdown('SIGUSR2')); // For nodemon

  // Log that shutdown handlers are registered
  logger.info('Graceful shutdown handlers registered');
}

/**
 * Check if the server is shutting down
 */
export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}
