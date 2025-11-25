import { config } from '@config/index';
import { createLogger } from '@utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('circuit-breaker');

// Circuit breaker states
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

// Circuit breaker metrics
export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  totalRequests: number;
  failureRate: number;
  averageResponseTime: number;
}

// Circuit breaker options
export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  volumeThreshold: number;
  errorFilter?: (error: Error) => boolean;
  fallback?: () => Promise<any>;
}

// Request result
interface RequestResult {
  success: boolean;
  duration: number;
  timestamp: number;
  error?: Error;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private consecutiveFailures: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttempt?: number;
  private requestHistory: RequestResult[] = [];
  private readonly options: Required<CircuitBreakerOptions>;
  private halfOpenRequests: number = 0;
  private readonly maxHalfOpenRequests: number = 1;

  constructor(
    private readonly name: string,
    options: Partial<CircuitBreakerOptions> = {},
  ) {
    super();

    this.options = {
      failureThreshold: options.failureThreshold || config.circuitBreaker.threshold,
      successThreshold: options.successThreshold || 3,
      timeout: options.timeout || config.circuitBreaker.timeout,
      resetTimeout: options.resetTimeout || config.circuitBreaker.resetTimeout,
      volumeThreshold: options.volumeThreshold || 10,
      errorFilter: options.errorFilter || (() => true),
      fallback: options.fallback || (() => Promise.reject(new Error('Circuit breaker is open'))),
    };

    // Start monitoring
    this.startMonitoring();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.canAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        logger.debug('Circuit breaker rejecting request', {
          name: this.name,
          state: this.state,
          nextAttempt: this.nextAttempt,
        });

        // Try fallback
        if (this.options.fallback) {
          return this.options.fallback();
        }

        throw new Error(`Circuit breaker is open for ${this.name}`);
      }
    }

    // Check if half-open and limit concurrent requests
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenRequests >= this.maxHalfOpenRequests) {
        logger.debug('Circuit breaker limiting half-open requests', {
          name: this.name,
          halfOpenRequests: this.halfOpenRequests,
        });

        if (this.options.fallback) {
          return this.options.fallback();
        }

        throw new Error(`Circuit breaker is half-open and at capacity for ${this.name}`);
      }
      this.halfOpenRequests++;
    }

    const startTime = Date.now();

    try {
      // Set timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), this.options.timeout);
      });

      const result = await Promise.race([fn(), timeoutPromise]);

      const duration = Date.now() - startTime;
      this.recordSuccess(duration);

      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenRequests--;
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordFailure(error as Error, duration);

      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenRequests--;
      }

      throw error;
    }
  }

  private recordSuccess(duration: number): void {
    this.successes++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();

    this.requestHistory.push({
      success: true,
      duration,
      timestamp: Date.now(),
    });

    this.trimHistory();

    logger.debug('Circuit breaker request succeeded', {
      name: this.name,
      state: this.state,
      duration,
    });

    // Handle state transitions
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.getRecentSuccesses() >= this.options.successThreshold) {
        this.transitionToClosed();
      }
    }

    this.emit('success', { name: this.name, duration });
  }

  private recordFailure(error: Error, duration: number): void {
    // Check if error should be counted
    if (!this.options.errorFilter(error)) {
      logger.debug('Circuit breaker ignoring filtered error', {
        name: this.name,
        error: error.message,
      });
      return;
    }

    this.failures++;
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    this.requestHistory.push({
      success: false,
      duration,
      error,
      timestamp: Date.now(),
    });

    this.trimHistory();

    logger.debug('Circuit breaker request failed', {
      name: this.name,
      state: this.state,
      error: error.message,
      consecutiveFailures: this.consecutiveFailures,
    });

    // Handle state transitions
    if (this.state === CircuitState.CLOSED) {
      if (this.shouldOpen()) {
        this.transitionToOpen();
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
    }

    this.emit('failure', { name: this.name, error, duration });
  }

  private shouldOpen(): boolean {
    // Check volume threshold
    if (this.requestHistory.length < this.options.volumeThreshold) {
      return false;
    }

    // Check failure rate
    const failureRate = this.getFailureRate();
    const thresholdExceeded = failureRate >= this.options.failureThreshold / 100;

    return thresholdExceeded || this.consecutiveFailures >= this.options.failureThreshold;
  }

  private canAttemptReset(): boolean {
    return this.nextAttempt ? Date.now() >= this.nextAttempt : true;
  }

  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.options.resetTimeout;

    logger.logCircuitBreakerOpen(this.name);
    logger.warn('Circuit breaker opened', {
      name: this.name,
      failures: this.failures,
      consecutiveFailures: this.consecutiveFailures,
      nextAttempt: new Date(this.nextAttempt).toISOString(),
    });

    this.emit('open', { name: this.name });
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenRequests = 0;

    logger.info('Circuit breaker half-open', {
      name: this.name,
      previousFailures: this.failures,
    });

    this.emit('half-open', { name: this.name });
  }

  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.consecutiveFailures = 0;
    this.nextAttempt = undefined;

    logger.logCircuitBreakerClose(this.name);
    logger.info('Circuit breaker closed', {
      name: this.name,
      successes: this.successes,
    });

    this.emit('close', { name: this.name });
  }

  private getRecentSuccesses(): number {
    const recentRequests = this.requestHistory.slice(-this.options.successThreshold);
    return recentRequests.filter((r) => r.success).length;
  }

  private getFailureRate(): number {
    if (this.requestHistory.length === 0) return 0;

    const failures = this.requestHistory.filter((r) => !r.success).length;
    return failures / this.requestHistory.length;
  }

  private trimHistory(): void {
    // Keep only recent history (last 100 requests or last 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const maxSize = 100;

    this.requestHistory = this.requestHistory
      .filter((entry) => entry.timestamp >= fiveMinutesAgo)
      .slice(-maxSize);
  }

  private startMonitoring(): void {
    // Periodic metrics emission
    setInterval(() => {
      const metrics = this.getMetrics();
      this.emit('metrics', metrics);

      logger.metric(`circuit_breaker.${this.name}.failure_rate`, metrics.failureRate * 100, {
        state: metrics.state,
      });
    }, 30000); // Every 30 seconds
  }

  // Public methods
  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    const totalRequests = this.successes + this.failures;
    const failureRate = totalRequests > 0 ? this.failures / totalRequests : 0;

    const responseTimes = this.requestHistory.map((r) => r.duration);
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests,
      failureRate,
      averageResponseTime,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextAttempt = undefined;
    this.requestHistory = [];

    logger.info('Circuit breaker manually reset', { name: this.name });
    this.emit('reset', { name: this.name });
  }

  // Force state changes (for testing/emergency)
  forceOpen(): void {
    this.transitionToOpen();
  }

  forceClosed(): void {
    this.transitionToClosed();
  }
}

// Circuit breaker manager
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  getBreaker(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker(name, options);
      this.breakers.set(name, breaker);

      // Forward events
      breaker.on('open', (data) => this.handleBreakerOpen(data));
      breaker.on('close', (data) => this.handleBreakerClose(data));
      breaker.on('half-open', (data) => this.handleBreakerHalfOpen(data));
    }

    const breaker = this.breakers.get(name);
    if (!breaker) {
      throw new Error(`Circuit breaker ${name} not found`);
    }
    return breaker;
  }

  async execute<T>(
    name: string,
    fn: () => Promise<T>,
    options?: Partial<CircuitBreakerOptions>,
  ): Promise<T> {
    const breaker = this.getBreaker(name, options);
    return breaker.execute(fn);
  }

  getMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};

    for (const [name, breaker] of this.breakers.entries()) {
      metrics[name] = breaker.getMetrics();
    }

    return metrics;
  }

  reset(name?: string): void {
    if (name) {
      const breaker = this.breakers.get(name);
      if (breaker) {
        breaker.reset();
      }
    } else {
      for (const breaker of this.breakers.values()) {
        breaker.reset();
      }
    }
  }

  private handleBreakerOpen(data: { name: string }): void {
    logger.metric('circuit_breaker.state_change', 1, {
      breaker: data.name,
      state: 'open',
    });
  }

  private handleBreakerClose(data: { name: string }): void {
    logger.metric('circuit_breaker.state_change', 1, {
      breaker: data.name,
      state: 'closed',
    });
  }

  private handleBreakerHalfOpen(data: { name: string }): void {
    logger.metric('circuit_breaker.state_change', 1, {
      breaker: data.name,
      state: 'half_open',
    });
  }
}

// Create singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();

// Decorator for circuit breaker protection
export function CircuitBreakerProtected(name: string, options?: Partial<CircuitBreakerOptions>) {
  return function (_target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return circuitBreakerManager.execute(
        `${name}.${propertyName}`,
        async () => originalMethod.apply(this, args),
        options,
      );
    };

    return descriptor;
  };
}
