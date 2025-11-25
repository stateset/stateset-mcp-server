import { config } from '@config/index';
import { createLogger } from '@utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('rate-limiter');

// Rate limiter metrics
export interface RateLimiterMetrics {
  totalRequests: number;
  acceptedRequests: number;
  rejectedRequests: number;
  queuedRequests: number;
  averageWaitTime: number;
  currentRate: number;
  availableTokens: number;
}

// Request priority levels
export enum Priority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

// Rate limiter strategies
export enum Strategy {
  TOKEN_BUCKET = 'token_bucket',
  SLIDING_WINDOW = 'sliding_window',
  ADAPTIVE = 'adaptive',
}

// Request interface
interface Request<T> {
  id: string;
  fn: () => Promise<T>;
  priority: Priority;
  timestamp: number;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  retries: number;
  operation: string;
}

// Abstract rate limiter strategy
abstract class RateLimiterStrategy extends EventEmitter {
  protected metrics: RateLimiterMetrics = {
    totalRequests: 0,
    acceptedRequests: 0,
    rejectedRequests: 0,
    queuedRequests: 0,
    averageWaitTime: 0,
    currentRate: 0,
    availableTokens: 0,
  };

  abstract canProceed(): boolean;
  abstract consume(): void;
  abstract getMetrics(): RateLimiterMetrics;
}

// Token Bucket Strategy
class TokenBucketStrategy extends RateLimiterStrategy {
  private tokens: number;
  private readonly maxTokens: number;
  private refillRate: number;
  private lastRefill: number;

  constructor(maxTokens: number, refillRate: number) {
    super();
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();

    // Start refill timer
    this.startRefillTimer();
  }

  canProceed(): boolean {
    this.refill();
    return this.tokens >= 1;
  }

  consume(): void {
    if (this.tokens >= 1) {
      this.tokens--;
      this.metrics.acceptedRequests++;
    } else {
      this.metrics.rejectedRequests++;
    }
    this.metrics.totalRequests++;
    this.updateMetrics();
  }

  getMetrics(): RateLimiterMetrics {
    this.refill();
    return {
      ...this.metrics,
      availableTokens: Math.floor(this.tokens),
    };
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = (timePassed / 1000) * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  private startRefillTimer(): void {
    setInterval(() => {
      this.refill();
      this.emit('refill', this.tokens);
    }, 1000);
  }

  private updateMetrics(): void {
    this.metrics.currentRate = this.metrics.acceptedRequests / (Date.now() / 1000 / 60);
  }

  getRefillRate(): number {
    return this.refillRate;
  }

  setRefillRate(rate: number): void {
    this.refillRate = rate;
  }
}

// Sliding Window Strategy
class SlidingWindowStrategy extends RateLimiterStrategy {
  private readonly windowSize: number;
  private readonly maxRequests: number;
  private requests: number[] = [];

  constructor(windowSize: number, maxRequests: number) {
    super();
    this.windowSize = windowSize;
    this.maxRequests = maxRequests;

    // Start cleanup timer
    this.startCleanupTimer();
  }

  canProceed(): boolean {
    this.cleanup();
    return this.requests.length < this.maxRequests;
  }

  consume(): void {
    this.cleanup();

    if (this.requests.length < this.maxRequests) {
      this.requests.push(Date.now());
      this.metrics.acceptedRequests++;
    } else {
      this.metrics.rejectedRequests++;
    }

    this.metrics.totalRequests++;
    this.updateMetrics();
  }

  getMetrics(): RateLimiterMetrics {
    this.cleanup();
    return {
      ...this.metrics,
      availableTokens: Math.max(0, this.maxRequests - this.requests.length),
    };
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.windowSize;
    this.requests = this.requests.filter((time) => time > cutoff);
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanup();
      this.emit('cleanup', this.requests.length);
    }, 1000);
  }

  private updateMetrics(): void {
    this.metrics.currentRate = this.requests.length;
  }
}

// Adaptive Strategy (adjusts rate based on response times)
class AdaptiveStrategy extends RateLimiterStrategy {
  private tokenBucket: TokenBucketStrategy;
  private responseTimes: number[] = [];
  private readonly targetResponseTime: number;
  private readonly adjustmentFactor: number;

  constructor(
    initialTokens: number,
    initialRate: number,
    targetResponseTime: number = 1000,
    adjustmentFactor: number = 0.1,
  ) {
    super();
    this.tokenBucket = new TokenBucketStrategy(initialTokens, initialRate);
    this.targetResponseTime = targetResponseTime;
    this.adjustmentFactor = adjustmentFactor;

    // Start adjustment timer
    this.startAdjustmentTimer();
  }

  canProceed(): boolean {
    return this.tokenBucket.canProceed();
  }

  consume(): void {
    this.tokenBucket.consume();
    this.metrics = this.tokenBucket.getMetrics();
  }

  recordResponseTime(duration: number): void {
    this.responseTimes.push(duration);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
  }

  getMetrics(): RateLimiterMetrics {
    return this.tokenBucket.getMetrics();
  }

  private adjustRate(): void {
    if (this.responseTimes.length < 10) return;

    const avgResponseTime =
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;

    if (avgResponseTime > this.targetResponseTime) {
      // Slow down
      const currentRate = this.tokenBucket.getRefillRate();
      const newRate = Math.max(1, currentRate * (1 - this.adjustmentFactor));
      this.tokenBucket.setRefillRate(newRate);
      logger.debug('Adaptive rate limiter slowing down', { avgResponseTime, newRate });
    } else if (avgResponseTime < this.targetResponseTime * 0.8) {
      // Speed up
      const currentRate = this.tokenBucket.getRefillRate();
      const newRate = currentRate * (1 + this.adjustmentFactor);
      this.tokenBucket.setRefillRate(newRate);
      logger.debug('Adaptive rate limiter speeding up', { avgResponseTime, newRate });
    }
  }

  private startAdjustmentTimer(): void {
    setInterval(() => {
      this.adjustRate();
    }, 5000);
  }
}

// Main Rate Limiter
export class RateLimiter {
  private strategy: RateLimiterStrategy;
  private queue: Request<any>[] = [];
  private processing = false;
  private waitTimes: number[] = [];

  constructor(strategy: Strategy = Strategy.TOKEN_BUCKET) {
    this.strategy = this.createStrategy(strategy);

    // Listen to strategy events
    this.strategy.on('refill', () => this.processQueue());
    this.strategy.on('cleanup', () => this.processQueue());
  }

  async execute<T>(
    fn: () => Promise<T>,
    operation: string,
    priority: Priority = Priority.NORMAL,
    retries: number = config.rateLimit.retryAttempts,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: Request<T> = {
        id: `${Date.now()}-${Math.random()}`,
        fn,
        priority,
        timestamp: Date.now(),
        resolve,
        reject,
        retries,
        operation,
      };

      this.enqueue(request);
    });
  }

  private enqueue<T>(request: Request<T>): void {
    // Insert based on priority
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (request.priority > this.queue[i]!.priority) {
        this.queue.splice(i, 0, request);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.queue.push(request);
    }

    logger.logRateLimit(request.operation, {
      queueLength: this.queue.length,
      priority: Priority[request.priority],
    });

    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0 && this.strategy.canProceed()) {
      const request = this.queue.shift()!;
      const waitTime = Date.now() - request.timestamp;
      this.waitTimes.push(waitTime);

      if (this.waitTimes.length > 100) {
        this.waitTimes.shift();
      }

      this.strategy.consume();

      // Execute request
      this.executeRequest(request, waitTime);
    }

    this.processing = false;
  }

  private async executeRequest<T>(request: Request<T>, waitTime: number): Promise<void> {
    const timer = logger.startTimer(`rate_limiter.${request.operation}`);

    try {
      const result = await request.fn();
      timer();

      // Record response time for adaptive strategy
      if (this.strategy instanceof AdaptiveStrategy) {
        const duration = Date.now() - request.timestamp;
        this.strategy.recordResponseTime(duration);
      }

      request.resolve(result);
    } catch (error) {
      timer();

      if (request.retries > 0 && this.isRetryableError(error)) {
        logger.debug('Retrying request', {
          operation: request.operation,
          retriesLeft: request.retries,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Re-enqueue with reduced retries
        request.retries--;
        request.timestamp = Date.now();

        // Add exponential backoff
        setTimeout(
          () => {
            this.enqueue(request);
          },
          Math.pow(2, config.rateLimit.retryAttempts - request.retries) *
            config.rateLimit.retryDelay,
        );
      } else {
        logger.error('Request failed', error, {
          operation: request.operation,
          waitTime,
        });
        request.reject(error as Error);
      }
    }
  }

  private isRetryableError(error: any): boolean {
    if (error.response) {
      const status = error.response.status;
      return status === 429 || (status >= 500 && status < 600);
    }
    return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
  }

  private createStrategy(strategy: Strategy): RateLimiterStrategy {
    switch (strategy) {
      case Strategy.TOKEN_BUCKET:
        return new TokenBucketStrategy(
          config.rateLimit.burstSize,
          config.rateLimit.requestsPerMinute / 60,
        );

      case Strategy.SLIDING_WINDOW:
        return new SlidingWindowStrategy(
          60000, // 1 minute window
          config.rateLimit.requestsPerMinute,
        );

      case Strategy.ADAPTIVE:
        return new AdaptiveStrategy(
          config.rateLimit.burstSize,
          config.rateLimit.requestsPerMinute / 60,
        );

      default:
        logger.warn(`Unknown rate limiter strategy: ${strategy}, defaulting to token bucket`);
        return new TokenBucketStrategy(
          config.rateLimit.burstSize,
          config.rateLimit.requestsPerMinute / 60,
        );
    }
  }

  getMetrics(): RateLimiterMetrics & { averageWaitTime: number } {
    const metrics = this.strategy.getMetrics();
    const avgWaitTime =
      this.waitTimes.length > 0
        ? this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length
        : 0;

    return {
      ...metrics,
      queuedRequests: this.queue.length,
      averageWaitTime: avgWaitTime,
    };
  }

  // Change strategy at runtime
  changeStrategy(strategy: Strategy): void {
    const oldMetrics = this.strategy.getMetrics();
    this.strategy = this.createStrategy(strategy);

    // Transfer metrics
    this.strategy['metrics'] = oldMetrics;

    logger.info('Rate limiter strategy changed', { newStrategy: strategy });
  }

  // Clear the queue
  clearQueue(): void {
    const clearedCount = this.queue.length;
    this.queue.forEach((request) => {
      request.reject(new Error('Queue cleared'));
    });
    this.queue = [];

    logger.info('Rate limiter queue cleared', { clearedCount });
  }
}

// Create singleton instance
export const rateLimiter = new RateLimiter();

// Export for custom instances
export { Strategy as RateLimiterStrategy };
