import { createLogger } from './logger';

const logger = createLogger('shutdown');

export interface Shutdownable {
  stop(): Promise<void>;
}

/**
 * Setup graceful shutdown handlers
 */
export function gracefulShutdown(server: Shutdownable): void {
  const shutdown = async (signal: string) => {
    logger.info(`Graceful shutdown initiated: ${signal}`);
    
    try {
      // Give processes time to finish
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Stop the server
      await server.stop();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error(`Error during shutdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  };

  // Handle various termination signals
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon
} 