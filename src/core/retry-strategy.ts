import { createLogger } from '@utils/logger';
import { metrics } from './metrics';
import { addBreadcrumb, getCorrelationId } from './request-context';

const logger = createLogger('retry-strategy');

/**
 * Error classification for retry decisions
 */
export enum ErrorType {
  /** Transient errors that may succeed on retry */
  TRANSIENT = 'transient',
  /** Rate limit errors - should wait before retry */
  RATE_LIMITED = 'rate_limited',
  /** Network errors - connection issues */
  NETWORK = 'network',
  /** Timeout errors */
  TIMEOUT = 'timeout',
  /** Server errors (5xx) */
  SERVER_ERROR = 'server_error',
  /** Client errors (4xx except rate limit) - should not retry */
  CLIENT_ERROR = 'client_error',
  /** Permanent failures - should not retry */
  PERMANENT = 'permanent',
  /** Unknown errors */
  UNKNOWN = 'unknown',
}

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  /** Jitter factor (0-1) to randomize delays */
  jitterFactor: number;
  /** Error types that should be retried */
  retryableErrors: ErrorType[];
  /** Custom retry condition function */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback before each retry */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
  /** Operation name for metrics */
  operationName?: string;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDelayMs: number;
  finalErrorType?: ErrorType;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.2,
  retryableErrors: [
    ErrorType.TRANSIENT,
    ErrorType.RATE_LIMITED,
    ErrorType.NETWORK,
    ErrorType.TIMEOUT,
    ErrorType.SERVER_ERROR,
  ],
};

/**
 * Classifies an error for retry decision
 */
export function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Check for rate limiting
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('429')
  ) {
    return ErrorType.RATE_LIMITED;
  }

  // Check for timeouts
  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    name.includes('timeout') ||
    message.includes('econnaborted')
  ) {
    return ErrorType.TIMEOUT;
  }

  // Check for network errors
  if (
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('network') ||
    message.includes('socket') ||
    message.includes('dns')
  ) {
    return ErrorType.NETWORK;
  }

  // Check for server errors
  if (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('internal server error') ||
    message.includes('service unavailable')
  ) {
    return ErrorType.SERVER_ERROR;
  }

  // Check for client errors (should not retry)
  if (
    message.includes('400') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('404') ||
    message.includes('422') ||
    message.includes('bad request') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('not found') ||
    message.includes('validation')
  ) {
    return ErrorType.CLIENT_ERROR;
  }

  // Check for permanent failures
  if (
    message.includes('invalid') ||
    message.includes('malformed') ||
    message.includes('unsupported')
  ) {
    return ErrorType.PERMANENT;
  }

  // Default to unknown (will use shouldRetry if provided)
  return ErrorType.UNKNOWN;
}

/**
 * Calculates delay with exponential backoff and jitter
 */
export function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitterFactor: number,
): number {
  // Exponential backoff
  const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter
  const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);

  return Math.max(0, Math.round(cappedDelay + jitter));
}

/**
 * Extracts rate limit retry delay from error if available
 */
export function extractRateLimitDelay(error: Error): number | null {
  const message = error.message;

  // Look for "retry after X seconds" patterns
  const retryAfterMatch = message.match(/retry[- ]?after[:\s]+(\d+)/i);
  if (retryAfterMatch) {
    return parseInt(retryAfterMatch[1]!, 10) * 1000;
  }

  // Look for "X seconds" patterns
  const secondsMatch = message.match(/(\d+)\s*seconds?/i);
  if (secondsMatch) {
    return parseInt(secondsMatch[1]!, 10) * 1000;
  }

  return null;
}

/**
 * Sleeps for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<RetryResult<T>> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  const correlationId = getCorrelationId();
  const operationName = opts.operationName || 'unknown';

  let lastError: Error | undefined;
  let attempts = 0;
  let totalDelayMs = 0;
  let finalErrorType: ErrorType | undefined;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    attempts = attempt;

    try {
      addBreadcrumb('retry', `Attempt ${attempt}/${opts.maxRetries + 1}`, 'debug', {
        operationName,
        correlationId,
      });

      const result = await fn();

      // Success!
      if (attempt > 1) {
        logger.info('Operation succeeded after retry', {
          correlationId,
          operationName,
          attempt,
          totalDelayMs,
        });
        metrics.increment('retry_success_total', 1, { operation: operationName });
      }

      return {
        success: true,
        result,
        attempts,
        totalDelayMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      finalErrorType = classifyError(lastError);

      addBreadcrumb('retry', `Attempt ${attempt} failed: ${lastError.message}`, 'warn', {
        operationName,
        errorType: finalErrorType,
        correlationId,
      });

      // Check if we should retry
      const shouldRetryError =
        opts.retryableErrors.includes(finalErrorType) || finalErrorType === ErrorType.UNKNOWN;

      const customShouldRetry = opts.shouldRetry
        ? opts.shouldRetry(lastError, attempt)
        : shouldRetryError;

      if (!customShouldRetry) {
        logger.debug('Error not retryable', {
          correlationId,
          operationName,
          errorType: finalErrorType,
          error: lastError.message,
        });
        break;
      }

      if (attempt > opts.maxRetries) {
        logger.warn('Max retries exceeded', {
          correlationId,
          operationName,
          attempts,
          totalDelayMs,
          finalErrorType,
        });
        break;
      }

      // Calculate delay
      let delayMs: number;
      if (finalErrorType === ErrorType.RATE_LIMITED) {
        // Try to extract retry-after from error
        const rateLimitDelay = extractRateLimitDelay(lastError);
        delayMs = rateLimitDelay || opts.maxDelayMs; // Use max delay if no hint
      } else {
        delayMs = calculateDelay(
          attempt,
          opts.baseDelayMs,
          opts.maxDelayMs,
          opts.backoffMultiplier,
          opts.jitterFactor,
        );
      }

      totalDelayMs += delayMs;

      // Call retry callback
      if (opts.onRetry) {
        opts.onRetry(lastError, attempt, delayMs);
      }

      logger.debug('Retrying operation', {
        correlationId,
        operationName,
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        errorType: finalErrorType,
        error: lastError.message,
      });

      metrics.increment('retry_attempt_total', 1, {
        operation: operationName,
        error_type: finalErrorType,
      });

      // Wait before retry
      await sleep(delayMs);
    }
  }

  // All retries exhausted
  metrics.increment('retry_exhausted_total', 1, {
    operation: operationName,
    error_type: finalErrorType || 'unknown',
  });

  return {
    success: false,
    error: lastError,
    attempts,
    totalDelayMs,
    finalErrorType,
  };
}

/**
 * Creates a retry wrapper for a function
 */
export function createRetryableFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: Partial<RetryOptions> = {},
): T {
  return (async (...args: Parameters<T>) => {
    const result = await withRetry(() => fn(...args), options);

    if (result.success) {
      return result.result;
    }

    throw result.error;
  }) as T;
}

/**
 * Retry decorator for class methods
 */
export function Retryable(options: Partial<RetryOptions> = {}) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await withRetry(
        () => originalMethod.apply(this, args),
        { ...options, operationName: options.operationName || propertyKey },
      );

      if (result.success) {
        return result.result;
      }

      throw result.error;
    };

    return descriptor;
  };
}

/**
 * Preset retry configurations
 */
export const RetryPresets = {
  /** Fast retry for transient errors */
  fast: {
    maxRetries: 2,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  } as Partial<RetryOptions>,

  /** Standard retry for most operations */
  standard: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
  } as Partial<RetryOptions>,

  /** Aggressive retry for critical operations */
  aggressive: {
    maxRetries: 5,
    baseDelayMs: 500,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.3,
  } as Partial<RetryOptions>,

  /** Patient retry for rate-limited operations */
  patient: {
    maxRetries: 3,
    baseDelayMs: 5000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
    retryableErrors: [ErrorType.RATE_LIMITED, ErrorType.SERVER_ERROR],
  } as Partial<RetryOptions>,

  /** No retry - fail immediately */
  none: {
    maxRetries: 0,
  } as Partial<RetryOptions>,
};
