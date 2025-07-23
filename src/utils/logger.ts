import pino from 'pino';

// Get log level from environment
const logLevel = process.env.LOG_LEVEL || 'info';

// Create base logger
const baseLogger = pino({
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  serializers: {
    error: pino.stdSerializers.err,
  },
  redact: {
    paths: ['req.headers.authorization', 'api_key', 'password', 'token'],
    censor: '[REDACTED]',
  },
});

// Logger interface for consistency - supports both string and structured logging
export interface Logger {
  trace(msg: string, obj?: any): void;
  trace(obj: any, msg?: string): void;
  debug(msg: string, obj?: any): void;
  debug(obj: any, msg?: string): void;
  info(msg: string, obj?: any): void;
  info(obj: any, msg?: string): void;
  warn(msg: string, obj?: any): void;
  warn(obj: any, msg?: string): void;
  error(msg: string, error?: string | Error | undefined): void;
  error(obj: any, msg?: string): void;
  fatal(msg: string, error?: string | Error | undefined): void;
  fatal(obj: any, msg?: string): void;
  
  // Custom methods for specific logging patterns
  logCacheHit(key: string): void;
  logCacheMiss(key: string): void;
  logCircuitBreakerOpen(name: string): void;
  logCircuitBreakerClose(name: string): void;
  logHealthCheck(status: string, details: any): void;
  metric(name: string, value: number, labels?: Record<string, string>): void;
  startTimer(name: string): { end: () => void };
}

// Enhanced logger implementation
class EnhancedLogger implements Logger {
  constructor(private readonly logger: pino.Logger) {}

  trace(objOrMsg: any, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.logger.trace(msg || {}, objOrMsg);
    } else {
      this.logger.trace(objOrMsg, msg || '');
    }
  }

  debug(objOrMsg: any, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.logger.debug(msg || {}, objOrMsg);
    } else {
      this.logger.debug(objOrMsg, msg || '');
    }
  }

  info(objOrMsg: any, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.logger.info(msg || {}, objOrMsg);
    } else {
      this.logger.info(objOrMsg, msg || '');
    }
  }

  warn(objOrMsg: any, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.logger.warn(msg || {}, objOrMsg);
    } else {
      this.logger.warn(objOrMsg, msg || '');
    }
  }

  error(objOrMsg: any, errorOrMsg?: string | Error): void {
    if (typeof objOrMsg === 'string') {
      // objOrMsg is the message, errorOrMsg is the error
      const errorInfo = errorOrMsg ? 
        { error: errorOrMsg instanceof Error ? errorOrMsg.message : errorOrMsg } : 
        {};
      this.logger.error(errorInfo, objOrMsg);
    } else {
      // objOrMsg is the context object, errorOrMsg is the message
      this.logger.error(objOrMsg, errorOrMsg || '');
    }
  }

  fatal(objOrMsg: any, errorOrMsg?: string | Error): void {
    if (typeof objOrMsg === 'string') {
      // objOrMsg is the message, errorOrMsg is the error
      const errorInfo = errorOrMsg ? 
        { error: errorOrMsg instanceof Error ? errorOrMsg.message : errorOrMsg } : 
        {};
      this.logger.fatal(errorInfo, objOrMsg);
    } else {
      // objOrMsg is the context object, errorOrMsg is the message
      this.logger.fatal(objOrMsg, errorOrMsg || '');
    }
  }

  // Cache-specific logging
  logCacheHit(key: string): void {
    this.logger.debug({ cache: 'hit', key }, 'Cache hit');
  }

  logCacheMiss(key: string): void {
    this.logger.debug({ cache: 'miss', key }, 'Cache miss');
  }

  // Circuit breaker logging
  logCircuitBreakerOpen(name: string): void {
    this.logger.warn({ circuitBreaker: name, state: 'open' }, 'Circuit breaker opened');
  }

  logCircuitBreakerClose(name: string): void {
    this.logger.info({ circuitBreaker: name, state: 'closed' }, 'Circuit breaker closed');
  }

  // Health check logging
  logHealthCheck(status: string, details: any): void {
    this.logger.info({ healthCheck: status, ...details }, `Health check ${status}`);
  }

  // Metrics logging
  metric(name: string, value: number, labels?: Record<string, string>): void {
    this.logger.debug({ metric: name, value, labels }, 'Metric recorded');
  }

  // Timer functionality
  startTimer(name: string): { end: () => void } {
    const start = process.hrtime.bigint();
    return {
      end: () => {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000; // Convert to milliseconds
        this.logger.debug({ timer: name, duration }, 'Timer completed');
      }
    };
  }
}

/**
 * Create a child logger with the given name
 */
export function createLogger(name: string): Logger {
  const childLogger = baseLogger.child({ component: name });
  return new EnhancedLogger(childLogger);
}

// Create the main logger instance
export const logger = createLogger('main');

// Export default logger
export default logger; 