import pino, { Logger as PinoLogger } from 'pino';
import { config } from '@config/index';

// Custom log levels
const customLevels = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  metric: 35, // Custom level for metrics
};

// Create base logger configuration
const baseConfig: pino.LoggerOptions = {
  level: config.server.logLevel,
  customLevels,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      service: config.server.name,
      version: config.server.version,
      environment: config.server.environment,
    }),
  },
  serializers: {
    error: pino.stdSerializers.err,
    request: (req) => ({
      method: req.method,
      url: req.url,
      headers: req.headers,
      params: req.params,
    }),
    response: (res) => ({
      statusCode: res.statusCode,
      headers: res.headers,
    }),
  },
};

// Development-specific configuration
const devConfig: pino.LoggerOptions = {
  ...baseConfig,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
      errorLikeObjectKeys: ['err', 'error'],
    },
  },
};

// Create the base logger
const baseLogger = config.server.environment === 'development' 
  ? pino(devConfig)
  : pino(baseConfig);

// Logger context management
interface LogContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  [key: string]: any;
}

class Logger {
  private logger: PinoLogger;
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.logger = baseLogger;
    this.context = context;
  }

  // Create a child logger with additional context
  child(context: LogContext): Logger {
    const newLogger = new Logger({ ...this.context, ...context });
    newLogger.logger = this.logger.child(context);
    return newLogger;
  }

  // Logging methods
  trace(msg: string, data?: any): void {
    this.logger.trace({ ...this.context, ...data }, msg);
  }

  debug(msg: string, data?: any): void {
    this.logger.debug({ ...this.context, ...data }, msg);
  }

  info(msg: string, data?: any): void {
    this.logger.info({ ...this.context, ...data }, msg);
  }

  warn(msg: string, data?: any): void {
    this.logger.warn({ ...this.context, ...data }, msg);
  }

  error(msg: string, error?: Error | any, data?: any): void {
    if (error instanceof Error) {
      this.logger.error({ ...this.context, ...data, error }, msg);
    } else {
      this.logger.error({ ...this.context, ...data, ...error }, msg);
    }
  }

  fatal(msg: string, error?: Error | any, data?: any): void {
    if (error instanceof Error) {
      this.logger.fatal({ ...this.context, ...data, error }, msg);
    } else {
      this.logger.fatal({ ...this.context, ...data, ...error }, msg);
    }
  }

  // Metric logging
  metric(name: string, value: number, tags?: Record<string, string>): void {
    (this.logger as any).metric({
      ...this.context,
      metric: {
        name,
        value,
        tags: { ...tags },
        timestamp: new Date().toISOString(),
      },
    }, `Metric: ${name}`);
  }

  // Performance timing
  startTimer(operation: string): () => void {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
      this.metric(`${operation}.duration`, duration, { operation });
      this.debug(`${operation} completed`, { duration_ms: duration });
    };
  }

  // Structured API logging
  logApiRequest(method: string, endpoint: string, params?: any): void {
    this.info('API request initiated', {
      api: {
        method,
        endpoint,
        params,
      },
    });
  }

  logApiResponse(method: string, endpoint: string, statusCode: number, duration: number): void {
    const level = statusCode >= 400 ? 'error' : 'info';
    this[level]('API request completed', {
      api: {
        method,
        endpoint,
        statusCode,
        duration_ms: duration,
      },
    });
  }

  logApiError(method: string, endpoint: string, error: Error, duration: number): void {
    this.error('API request failed', error, {
      api: {
        method,
        endpoint,
        duration_ms: duration,
      },
    });
  }

  // Rate limiting logs
  logRateLimit(operation: string, metrics: any): void {
    this.debug('Rate limit status', {
      rateLimit: {
        operation,
        ...metrics,
      },
    });
  }

  // Cache logs
  logCacheHit(key: string): void {
    this.debug('Cache hit', { cache: { key, hit: true } });
  }

  logCacheMiss(key: string): void {
    this.debug('Cache miss', { cache: { key, hit: false } });
  }

  // Circuit breaker logs
  logCircuitBreakerOpen(service: string): void {
    this.warn('Circuit breaker opened', { circuitBreaker: { service, state: 'open' } });
  }

  logCircuitBreakerClose(service: string): void {
    this.info('Circuit breaker closed', { circuitBreaker: { service, state: 'closed' } });
  }

  // Health check logs
  logHealthCheck(status: 'healthy' | 'unhealthy', details: any): void {
    const level = status === 'healthy' ? 'info' : 'error';
    this[level]('Health check', { healthCheck: { status, ...details } });
  }
}

// Create and export default logger instance
export const logger = new Logger();

// Export Logger class for creating custom instances
export { Logger };

// Utility function to create a logger for a specific module
export function createLogger(module: string, context?: LogContext): Logger {
  return logger.child({ module, ...context });
}

// Request-scoped logger factory
export function createRequestLogger(requestId: string, userId?: string): Logger {
  return logger.child({ requestId, userId });
}

// Operation-scoped logger factory
export function createOperationLogger(operation: string, context?: LogContext): Logger {
  return logger.child({ operation, ...context });
} 