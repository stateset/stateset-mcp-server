import axios from 'axios';
import { logger } from '../utils/logger';
import { RateLimiterMetrics } from '../types/mcp-api';

// Rate Limiter
export class RateLimiter {
  private readonly requestsPerHour: number;
  private readonly minDelayMs: number;
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private requestTimes: number[] = [];
  private requestTimestamps: number[] = [];

  constructor(requestsPerHour: number) {
    this.requestsPerHour = requestsPerHour;
    this.minDelayMs = 3600000 / requestsPerHour;
  }

  async enqueue<T>(fn: () => Promise<T>, operation: string, retries = 3): Promise<T> {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          logger.debug('Starting API request', { operation });
          const result = await this.executeWithRetry(fn, operation, retries);
          const duration = Date.now() - startTime;
          this.trackRequest(startTime, duration);
          logger.debug('Completed API request', { operation, duration });
          resolve(result);
        } catch (error) {
          logger.error('API request failed', error, { operation });
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    operation: string,
    retries: number,
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt > retries || !this.isRetryableError(error)) {
          throw error;
        }
        const delay = Math.pow(2, attempt - 1) * 1000;
        logger.warn('Retrying API request', { operation, attempt, delay });
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  private isRetryableError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      return (
        !error.response ||
        error.code === 'ECONNABORTED' ||
        (error.response.status >= 500 && error.response.status < 600)
      );
    }
    return false;
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const requestsInLastHour = this.requestTimestamps.filter((t) => t > now - 3600000).length;

      if (requestsInLastHour >= this.requestsPerHour * 0.9) {
        const waitTime = this.minDelayMs - (now - this.lastRequestTime);
        if (waitTime > 0) await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      const fn = this.queue.shift();
      if (fn) {
        this.lastRequestTime = Date.now();
        await fn();
      }
    }
    this.processing = false;
  }

  private trackRequest(startTime: number, duration: number): void {
    this.requestTimes.push(duration);
    this.requestTimestamps.push(startTime);
    const oneHourAgo = Date.now() - 3600000;
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > oneHourAgo);
    this.requestTimes = this.requestTimes.slice(-this.requestTimestamps.length);
  }

  getMetrics(): RateLimiterMetrics {
    const now = Date.now();
    const requestsInLastHour = this.requestTimestamps.filter((t) => t > now - 3600000).length;
    return {
      totalRequests: this.requestTimestamps.length,
      requestsInLastHour,
      averageRequestTime:
        this.requestTimes.length > 0
          ? this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length
          : 0,
      queueLength: this.queue.length,
      lastRequestTime: new Date(this.lastRequestTime).toISOString(),
    };
  }
}

// Tool Rate Limit Categories
export type ToolCategory = 'read' | 'create' | 'update' | 'delete' | 'batch' | 'admin';

export interface ToolRateLimitConfig {
  requestsPerMinute: number;
  burstSize: number;
}

export interface ToolRateLimitMetrics {
  category: ToolCategory;
  requestsInLastMinute: number;
  tokensRemaining: number;
  isThrottled: boolean;
  lastRequestTime: string;
}

// Per-Tool Rate Limiter with Token Bucket Algorithm
export class ToolRateLimiter {
  private readonly limits: Record<ToolCategory, ToolRateLimitConfig> = {
    read: { requestsPerMinute: 120, burstSize: 20 }, // High throughput for reads
    create: { requestsPerMinute: 30, burstSize: 5 }, // Moderate for creates
    update: { requestsPerMinute: 60, burstSize: 10 }, // Medium for updates
    delete: { requestsPerMinute: 20, burstSize: 3 }, // Conservative for deletes
    batch: { requestsPerMinute: 10, burstSize: 2 }, // Very limited for batch operations
    admin: { requestsPerMinute: 30, burstSize: 5 }, // Moderate for admin/metrics
  };

  private readonly buckets: Map<
    ToolCategory,
    {
      tokens: number;
      lastRefill: number;
      requestTimestamps: number[];
    }
  > = new Map();

  constructor(customLimits?: Partial<Record<ToolCategory, ToolRateLimitConfig>>) {
    // Apply custom limits if provided
    if (customLimits) {
      for (const [category, config] of Object.entries(customLimits)) {
        if (this.limits[category as ToolCategory]) {
          this.limits[category as ToolCategory] = {
            ...this.limits[category as ToolCategory],
            ...config,
          };
        }
      }
    }

    // Initialize buckets for each category
    for (const category of Object.keys(this.limits) as ToolCategory[]) {
      this.buckets.set(category, {
        tokens: this.limits[category].burstSize,
        lastRefill: Date.now(),
        requestTimestamps: [],
      });
    }
  }

  // Categorize a tool based on its name
  private categorize(toolName: string): ToolCategory {
    if (toolName.includes('batch') || toolName.includes('csv_import')) {
      return 'batch';
    }
    if (toolName.includes('_delete_')) {
      return 'delete';
    }
    if (toolName.includes('_create_')) {
      return 'create';
    }
    if (toolName.includes('_update_')) {
      return 'update';
    }
    if (toolName.includes('_get_') || toolName.includes('_list_') || toolName.includes('_search')) {
      return 'read';
    }
    // Admin tools: health_check, cache_stats, clear_cache, metrics
    if (toolName.includes('health') || toolName.includes('cache') || toolName.includes('metrics')) {
      return 'admin';
    }
    // Default to create for unknown operations (conservative)
    return 'create';
  }

  // Refill tokens based on elapsed time
  private refillTokens(category: ToolCategory): void {
    const bucket = this.buckets.get(category)!;
    const config = this.limits[category];
    const now = Date.now();
    const elapsedMs = now - bucket.lastRefill;
    const tokensToAdd = (elapsedMs / 60000) * config.requestsPerMinute;

    bucket.tokens = Math.min(config.burstSize, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Clean up old timestamps (older than 1 minute)
    const oneMinuteAgo = now - 60000;
    bucket.requestTimestamps = bucket.requestTimestamps.filter((t) => t > oneMinuteAgo);
  }

  // Check if a tool can be executed (acquire token)
  async acquire(
    toolName: string,
  ): Promise<{ allowed: boolean; waitTimeMs: number; category: ToolCategory }> {
    const category = this.categorize(toolName);
    this.refillTokens(category);

    const bucket = this.buckets.get(category)!;
    const config = this.limits[category];

    // Check if we have tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      bucket.requestTimestamps.push(Date.now());
      return { allowed: true, waitTimeMs: 0, category };
    }

    // Calculate wait time until next token is available
    const msPerToken = 60000 / config.requestsPerMinute;
    const waitTimeMs = Math.ceil(msPerToken - ((Date.now() - bucket.lastRefill) % msPerToken));

    return { allowed: false, waitTimeMs, category };
  }

  // Wait for rate limit and then proceed
  async waitAndAcquire(toolName: string): Promise<ToolCategory> {
    let result = await this.acquire(toolName);

    while (!result.allowed) {
      logger.debug('Tool rate limited, waiting', {
        toolName,
        category: result.category,
        waitTimeMs: result.waitTimeMs,
      });
      await new Promise((resolve) => setTimeout(resolve, result.waitTimeMs));
      result = await this.acquire(toolName);
    }

    return result.category;
  }

  // Get metrics for a specific category or all categories
  getMetrics(
    category?: ToolCategory,
  ): ToolRateLimitMetrics | Record<ToolCategory, ToolRateLimitMetrics> {
    if (category) {
      this.refillTokens(category);
      const bucket = this.buckets.get(category)!;
      const lastTimestamp = bucket.requestTimestamps[bucket.requestTimestamps.length - 1];
      return {
        category,
        requestsInLastMinute: bucket.requestTimestamps.length,
        tokensRemaining: Math.floor(bucket.tokens),
        isThrottled: bucket.tokens < 1,
        lastRequestTime:
          lastTimestamp !== undefined ? new Date(lastTimestamp).toISOString() : 'never',
      };
    }

    const allMetrics: Record<ToolCategory, ToolRateLimitMetrics> = {} as any;
    for (const cat of Object.keys(this.limits) as ToolCategory[]) {
      allMetrics[cat] = this.getMetrics(cat) as ToolRateLimitMetrics;
    }
    return allMetrics;
  }

  // Get limit configuration
  getLimits(): Record<ToolCategory, ToolRateLimitConfig> {
    return { ...this.limits };
  }
}

// Singleton tool rate limiter
export const toolRateLimiter = new ToolRateLimiter();
