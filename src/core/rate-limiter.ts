import { createLogger } from '@utils/logger';

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

// Rate limiter configuration
export interface RateLimiterConfig {
  requestsPerHour: number;
  retryAttempts: number;
  retryDelay: number;
}

// Request interface
interface QueuedRequest<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  retries: number;
  operation: string;
  timestamp: number;
}

export class RateLimiter {
  private readonly requestsPerHour: number;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;
  private readonly minDelayMs: number;
  private queue: Array<QueuedRequest<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private requestTimes: number[] = [];
  private requestTimestamps: number[] = [];
  private metrics: RateLimiterMetrics = {
    totalRequests: 0,
    acceptedRequests: 0,
    rejectedRequests: 0,
    queuedRequests: 0,
    averageWaitTime: 0,
    currentRate: 0,
    availableTokens: 0,
  };

  constructor(config: RateLimiterConfig) {
    this.requestsPerHour = config.requestsPerHour;
    this.retryAttempts = config.retryAttempts;
    this.retryDelay = config.retryDelay;
    this.minDelayMs = 3600000 / config.requestsPerHour; // milliseconds between requests
  }

  async enqueue<T>(fn: () => Promise<T>, operation: string, retries?: number): Promise<T> {
    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: requestId,
        fn,
        resolve,
        reject,
        retries: retries || this.retryAttempts,
        operation,
        timestamp: startTime,
      };
      
      this.queue.push(request);
      this.metrics.queuedRequests = this.queue.length;
      this.metrics.totalRequests++;
      
      logger.debug({ operation, requestId, queueLength: this.queue.length }, 'Request queued');
      
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    logger.debug({ queueLength: this.queue.length }, 'Processing queue');

    while (this.queue.length > 0) {
      const now = Date.now();
      const requestsInLastHour = this.requestTimestamps.filter(t => t > now - 3600000).length;
      
      // Check if we need to wait due to rate limiting
      if (requestsInLastHour >= this.requestsPerHour * 0.9) {
        const waitTime = this.minDelayMs - (now - this.lastRequestTime);
        if (waitTime > 0) {
          logger.debug({ waitTime }, 'Rate limit reached, waiting');
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      const request = this.queue.shift();
      if (!request) break;
      
      this.metrics.queuedRequests = this.queue.length;
      
      try {
        logger.debug({ operation: request.operation, requestId: request.id }, 'Executing request');
        
        const result = await this.executeWithRetry(request);
        const duration = Date.now() - request.timestamp;
        
        this.trackRequest(request.timestamp, duration);
        this.metrics.acceptedRequests++;
        
        logger.debug({ 
          operation: request.operation, 
          requestId: request.id, 
          duration 
        }, 'Request completed');
        
        request.resolve(result);
      } catch (error) {
        this.metrics.rejectedRequests++;
        
        logger.error({ 
          operation: request.operation, 
          requestId: request.id, 
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Request failed');
        
        request.reject(error instanceof Error ? error : new Error('Unknown error'));
      }
      
      this.lastRequestTime = Date.now();
    }
    
    this.processing = false;
  }

  private async executeWithRetry<T>(request: QueuedRequest<T>): Promise<T> {
    for (let attempt = 1; attempt <= request.retries + 1; attempt++) {
      try {
        return await request.fn();
      } catch (error) {
        if (attempt > request.retries || !this.isRetryableError(error)) {
          throw error;
        }
        
        const delay = Math.pow(2, attempt - 1) * this.retryDelay;
        logger.warn({ 
          operation: request.operation, 
          attempt, 
          delay,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Retrying request');
        
        await new Promise(res => setTimeout(res, delay));
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  private isRetryableError(error: any): boolean {
    // Check if error is a network error or 5xx server error
    if (error?.response?.status) {
      return error.response.status >= 500 && error.response.status < 600;
    }
    
    // Check for network errors
    if (error?.code) {
      return ['ECONNABORTED', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code);
    }
    
    return false;
  }

  private trackRequest(startTime: number, duration: number): void {
    this.requestTimes.push(duration);
    this.requestTimestamps.push(startTime);
    
    // Keep only last hour of data
    const oneHourAgo = Date.now() - 3600000;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneHourAgo);
    this.requestTimes = this.requestTimes.slice(-this.requestTimestamps.length);
    
    // Update metrics
    this.updateMetrics();
  }

  private updateMetrics(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const recentRequests = this.requestTimestamps.filter(t => t > oneHourAgo);
    
    this.metrics.currentRate = recentRequests.length;
    this.metrics.availableTokens = Math.max(0, this.requestsPerHour - recentRequests.length);
    this.metrics.averageWaitTime = this.requestTimes.length > 0
      ? this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length
      : 0;
  }

  getMetrics(): RateLimiterMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  // Get queue status
  getQueueStatus(): { length: number; processing: boolean } {
    return {
      length: this.queue.length,
      processing: this.processing,
    };
  }

  // Clear the queue (useful for testing or emergency situations)
  clearQueue(): void {
    const clearedRequests = this.queue.length;
    this.queue.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    this.metrics.queuedRequests = 0;
    
    logger.info({ clearedRequests }, 'Queue cleared');
  }
} 