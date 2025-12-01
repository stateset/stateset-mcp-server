import { createLogger } from '@utils/logger';
import { metrics } from './metrics';
import { config } from '@config/index';

const logger = createLogger('adaptive-cache');

/**
 * Cache entry with access tracking for adaptive TTL
 */
interface CacheEntry<T> {
  value: T;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  ttl: number;
  tags: string[];
}

/**
 * Access pattern tracking for adaptive TTL
 */
interface AccessPattern {
  key: string;
  accessCount: number;
  lastAccess: number;
  averageInterval: number;
}

/**
 * Cache warming configuration
 */
export interface WarmingConfig {
  /** Keys to warm on startup */
  warmOnStartup: WarmingKey[];
  /** Keys to warm periodically */
  warmPeriodically: WarmingKey[];
  /** Warming interval in ms */
  warmingInterval: number;
  /** Maximum concurrent warming requests */
  maxConcurrent: number;
}

export interface WarmingKey {
  key: string;
  fetcher: () => Promise<unknown>;
  ttl?: number;
  tags?: string[];
  priority?: number;
}

/**
 * Adaptive cache with intelligent TTL and warming
 */
export class AdaptiveCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessPatterns: Map<string, AccessPattern> = new Map();
  private warmingInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  private readonly baseTTL: number;
  private readonly minTTL: number;
  private readonly maxTTL: number;
  private readonly maxSize: number;
  private readonly adaptiveTTL: boolean;

  constructor(
    options: {
      baseTTL?: number;
      minTTL?: number;
      maxTTL?: number;
      maxSize?: number;
      adaptiveTTL?: boolean;
    } = {},
  ) {
    this.baseTTL = options.baseTTL || config.cache.ttl * 1000;
    this.minTTL = options.minTTL || 30000; // 30 seconds
    this.maxTTL = options.maxTTL || 3600000; // 1 hour
    this.maxSize = options.maxSize || config.cache.maxSize;
    this.adaptiveTTL = options.adaptiveTTL ?? true;

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Gets a value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      metrics.increment('cache_miss_total', 1, { cache: 'adaptive' });
      return undefined;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.createdAt > entry.ttl) {
      this.cache.delete(key);
      metrics.increment('cache_expired_total', 1, { cache: 'adaptive' });
      return undefined;
    }

    // Update access tracking
    entry.lastAccessedAt = now;
    entry.accessCount++;
    this.updateAccessPattern(key);

    metrics.increment('cache_hit_total', 1, { cache: 'adaptive' });
    return entry.value;
  }

  /**
   * Sets a value in cache
   */
  set(key: string, value: T, options: { ttl?: number; tags?: string[] } = {}): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const ttl = options.ttl || this.calculateAdaptiveTTL(key);
    const now = Date.now();

    this.cache.set(key, {
      value,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 1,
      ttl,
      tags: options.tags || [],
    });

    metrics.set('cache_size', this.cache.size, { cache: 'adaptive' });
  }

  /**
   * Deletes a key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidates cache entries by tag
   */
  invalidateByTag(tag: string): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    logger.debug('Invalidated cache entries by tag', { tag, count });
    return count;
  }

  /**
   * Invalidates cache entries matching a pattern
   */
  invalidateByPattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    logger.debug('Invalidated cache entries by pattern', { pattern: pattern.toString(), count });
    return count;
  }

  /**
   * Gets or sets a value (cache-aside pattern)
   */
  async getOrSet(
    key: string,
    fetcher: () => Promise<T>,
    options: { ttl?: number; tags?: string[] } = {},
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, options);
    return value;
  }

  /**
   * Warms the cache with initial data
   */
  async warmCache(keys: WarmingKey[]): Promise<void> {
    logger.info('Starting cache warming', { keyCount: keys.length });
    const startTime = Date.now();

    // Sort by priority (higher first)
    const sortedKeys = [...keys].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Process in batches
    const batchSize = 5;
    for (let i = 0; i < sortedKeys.length; i += batchSize) {
      const batch = sortedKeys.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (warmingKey) => {
          try {
            const value = await warmingKey.fetcher();
            this.set(warmingKey.key, value as T, {
              ttl: warmingKey.ttl,
              tags: warmingKey.tags,
            });
            logger.debug('Warmed cache key', { key: warmingKey.key });
          } catch (error) {
            logger.warn('Failed to warm cache key', {
              key: warmingKey.key,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }),
      );
    }

    const duration = Date.now() - startTime;
    logger.info('Cache warming completed', {
      keyCount: keys.length,
      durationMs: duration,
      cacheSize: this.cache.size,
    });

    metrics.observe('cache_warming_duration_ms', duration, { cache: 'adaptive' });
  }

  /**
   * Starts periodic cache warming
   */
  startPeriodicWarming(keys: WarmingKey[], intervalMs: number = 300000): void {
    this.stopPeriodicWarming();

    // Initial warm
    this.warmCache(keys);

    // Periodic refresh
    this.warmingInterval = setInterval(() => {
      this.warmCache(keys);
    }, intervalMs);

    logger.info('Started periodic cache warming', { intervalMs, keyCount: keys.length });
  }

  /**
   * Stops periodic cache warming
   */
  stopPeriodicWarming(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = undefined;
    }
  }

  /**
   * Calculates adaptive TTL based on access patterns
   */
  private calculateAdaptiveTTL(key: string): number {
    if (!this.adaptiveTTL) {
      return this.baseTTL;
    }

    const pattern = this.accessPatterns.get(key);
    if (!pattern) {
      return this.baseTTL;
    }

    // Hot keys get longer TTL
    const accessRate = pattern.accessCount / Math.max(1, (Date.now() - pattern.lastAccess) / 60000);

    if (accessRate > 10) {
      // Very hot - extend to max
      return this.maxTTL;
    } else if (accessRate > 5) {
      // Hot - extend significantly
      return Math.min(this.baseTTL * 4, this.maxTTL);
    } else if (accessRate > 1) {
      // Warm - extend moderately
      return Math.min(this.baseTTL * 2, this.maxTTL);
    } else if (accessRate < 0.1) {
      // Cold - reduce TTL
      return Math.max(this.baseTTL / 2, this.minTTL);
    }

    return this.baseTTL;
  }

  /**
   * Updates access pattern tracking
   */
  private updateAccessPattern(key: string): void {
    const now = Date.now();
    const existing = this.accessPatterns.get(key);

    if (existing) {
      const interval = now - existing.lastAccess;
      existing.averageInterval = (existing.averageInterval + interval) / 2;
      existing.accessCount++;
      existing.lastAccess = now;
    } else {
      this.accessPatterns.set(key, {
        key,
        accessCount: 1,
        lastAccess: now,
        averageInterval: 0,
      });
    }

    // Limit pattern tracking size
    if (this.accessPatterns.size > this.maxSize * 2) {
      this.pruneAccessPatterns();
    }
  }

  /**
   * Prunes old access patterns
   */
  private pruneAccessPatterns(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [key, pattern] of this.accessPatterns.entries()) {
      if (now - pattern.lastAccess > maxAge) {
        this.accessPatterns.delete(key);
      }
    }
  }

  /**
   * Evicts least recently used entries
   */
  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      metrics.increment('cache_eviction_total', 1, { cache: 'adaptive', reason: 'lru' });
    }
  }

  /**
   * Cleans up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > entry.ttl) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.debug('Cache cleanup completed', { expiredCount, remaining: this.cache.size });
      metrics.increment('cache_cleanup_total', expiredCount, { cache: 'adaptive' });
    }
  }

  /**
   * Gets cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    avgTTL: number;
    hotKeys: string[];
  } {
    const hits = metrics.getCounter('cache_hit_total', { cache: 'adaptive' });
    const misses = metrics.getCounter('cache_miss_total', { cache: 'adaptive' });
    const total = hits + misses;

    let totalTTL = 0;
    for (const entry of this.cache.values()) {
      totalTTL += entry.ttl;
    }

    // Get hot keys (top 10 by access count)
    const hotKeys = [...this.accessPatterns.entries()]
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, 10)
      .map(([key]) => key);

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: total > 0 ? hits / total : 0,
      avgTTL: this.cache.size > 0 ? totalTTL / this.cache.size : 0,
      hotKeys,
    };
  }

  /**
   * Clears all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessPatterns.clear();
    metrics.set('cache_size', 0, { cache: 'adaptive' });
  }

  /**
   * Destroys the cache and stops all intervals
   */
  destroy(): void {
    this.stopPeriodicWarming();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clear();
  }
}

// Pre-configured cache instances
export const defaultCache = new AdaptiveCache();

// Create cache with specific configuration
export function createAdaptiveCache<T>(options?: {
  baseTTL?: number;
  minTTL?: number;
  maxTTL?: number;
  maxSize?: number;
  adaptiveTTL?: boolean;
}): AdaptiveCache<T> {
  return new AdaptiveCache<T>(options);
}
