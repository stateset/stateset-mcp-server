import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
  size: number;
  priority: number;
  tags: Set<string>;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  itemCount: number;
  hitRate: number;
  averageResponseTime: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  maxMemoryMB: number;
  strategy: 'lru' | 'lfu' | 'adaptive';
  enablePredictive: boolean;
  compressionThreshold: number;
}

// Intelligent Cache with predictive capabilities
export class IntelligentCache<T> extends EventEmitter {
  private cache = new Map<string, CacheEntry<T>>();
  private accessPattern = new Map<string, number[]>();
  private tagIndex = new Map<string, Set<string>>();
  private currentSize = 0;
  private stats: CacheStats;
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout;
  private predictionModel = new Map<string, number>();

  constructor(config: Partial<CacheConfig> = {}) {
    super();

    this.config = {
      maxSize: 1000,
      defaultTTL: 300000, // 5 minutes
      maxMemoryMB: 100,
      strategy: 'adaptive',
      enablePredictive: true,
      compressionThreshold: 1024, // 1KB
      ...config,
    };

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      itemCount: 0,
      hitRate: 0,
      averageResponseTime: 0,
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute

    logger.info('Intelligent cache initialized', { config: this.config });
  }

  async get(key: string): Promise<T | undefined> {
    const startTime = Date.now();
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.recordAccess(key, false);
      this.updateStats();
      return undefined;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      this.recordAccess(key, false);
      this.updateStats();
      return undefined;
    }

    // Update access statistics
    entry.hits++;
    entry.lastAccessed = Date.now();
    entry.priority = this.calculatePriority(entry);

    this.stats.hits++;
    this.recordAccess(key, true);
    this.updateStats();

    const responseTime = Date.now() - startTime;
    this.updateAverageResponseTime(responseTime);

    logger.debug('Cache hit', { key, hits: entry.hits, responseTime });

    return entry.value;
  }

  async set(
    key: string,
    value: T,
    options: {
      ttl?: number;
      tags?: string[];
      priority?: number;
    } = {},
  ): Promise<void> {
    const ttl = options.ttl || this.config.defaultTTL;
    const tags = new Set(options.tags || []);
    const priority = options.priority || this.calculateInitialPriority(key);

    const size = this.calculateSize(value);

    // Check memory limits
    if (this.currentSize + size > this.config.maxMemoryMB * 1024 * 1024) {
      await this.makeSpace(size);
    }

    // Compress large values
    const processedValue =
      size > this.config.compressionThreshold ? await this.compress(value) : value;

    const entry: CacheEntry<T> = {
      value: processedValue,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      lastAccessed: Date.now(),
      size,
      priority,
      tags,
    };

    // Remove old entry if exists
    if (this.cache.has(key)) {
      this.delete(key);
    }

    this.cache.set(key, entry);
    this.currentSize += size;

    // Update tag index
    tags.forEach((tag) => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    });

    this.updateStats();

    // Predictive caching
    if (this.config.enablePredictive) {
      this.updatePredictionModel(key);
    }

    logger.debug('Cache set', { key, size, ttl, tags: Array.from(tags) });

    this.emit('set', { key, value, size });
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.currentSize -= entry.size;

    // Update tag index
    entry.tags.forEach((tag) => {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) {
        tagSet.delete(key);
        if (tagSet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    });

    this.updateStats();
    this.emit('delete', { key });

    return true;
  }

  // Delete by tags
  deleteByTags(tags: string[]): number {
    let deletedCount = 0;

    tags.forEach((tag) => {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.forEach((key) => {
          if (this.delete(key)) {
            deletedCount++;
          }
        });
      }
    });

    logger.info('Cache invalidated by tags', { tags, deletedCount });
    return deletedCount;
  }

  // Predictive prefetch
  async prefetch(keyPattern: string, fetcher: (key: string) => Promise<T>): Promise<void> {
    if (!this.config.enablePredictive) return;

    const predictions = this.getPredictions(keyPattern);

    for (const predictedKey of predictions) {
      if (!this.cache.has(predictedKey)) {
        try {
          const value = await fetcher(predictedKey);
          await this.set(predictedKey, value, {
            ttl: this.config.defaultTTL * 0.5, // Shorter TTL for predicted items
            priority: 0.5, // Lower priority
          });
          logger.debug('Predictive cache prefetch', { key: predictedKey });
        } catch (error) {
          logger.warn('Predictive prefetch failed', { key: predictedKey, error });
        }
      }
    }
  }

  // Batch operations
  async mget(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get(key);
        if (value !== undefined) {
          result.set(key, value);
        }
      }),
    );

    return result;
  }

  async mset(entries: Array<{ key: string; value: T; options?: any }>): Promise<void> {
    await Promise.all(entries.map(({ key, value, options }) => this.set(key, value, options)));
  }

  // Cache warming
  async warm(
    entries: Array<{ key: string; fetcher: () => Promise<T>; options?: any }>,
  ): Promise<void> {
    logger.info('Starting cache warming', { entryCount: entries.length });

    const results = await Promise.allSettled(
      entries.map(async ({ key, fetcher, options }) => {
        try {
          const value = await fetcher();
          await this.set(key, value, options);
          return { key, success: true };
        } catch (error) {
          logger.warn('Cache warming failed for key', { key, error });
          return { key, success: false, error };
        }
      }),
    );

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    logger.info('Cache warming completed', { successful, total: entries.length });
  }

  // Advanced cleanup
  private async cleanup(): Promise<void> {
    const before = this.cache.size;

    // Remove expired entries
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.delete(key);
      }
    }

    // Adaptive eviction based on usage patterns
    if (this.cache.size > this.config.maxSize * 0.9) {
      await this.adaptiveEviction();
    }

    const after = this.cache.size;
    if (before !== after) {
      logger.debug('Cache cleanup completed', { before, after, removed: before - after });
    }
  }

  private async adaptiveEviction(): Promise<void> {
    const evictionCount = Math.floor(this.config.maxSize * 0.1); // Remove 10%
    const entries = Array.from(this.cache.entries());

    // Sort by adaptive priority (considers recency, frequency, and prediction)
    entries.sort(([, a], [, b]) => {
      const scoreA = this.calculateEvictionScore(a);
      const scoreB = this.calculateEvictionScore(b);
      return scoreA - scoreB; // Lower score = more likely to evict
    });

    for (let i = 0; i < evictionCount && i < entries.length; i++) {
      const entryPair = entries[i];
      if (!entryPair) {
        break;
      }
      const [key] = entryPair;
      this.delete(key);
      this.stats.evictions++;
    }

    logger.debug('Adaptive eviction completed', { evicted: evictionCount });
  }

  private calculateEvictionScore(entry: CacheEntry<T>): number {
    const now = Date.now();
    const timeSinceAccess = now - entry.lastAccessed;

    // Factors: recency (40%), frequency (30%), size (20%), priority (10%)
    const recencyScore = Math.min(timeSinceAccess / (24 * 60 * 60 * 1000), 1); // Normalize to days
    const frequencyScore = 1 / (entry.hits + 1);
    const sizeScore = entry.size / (1024 * 1024); // Normalize to MB
    const priorityScore = 1 - entry.priority;

    return recencyScore * 0.4 + frequencyScore * 0.3 + sizeScore * 0.2 + priorityScore * 0.1;
  }

  private calculatePriority(entry: CacheEntry<T>): number {
    const now = Date.now();
    const age = now - entry.timestamp;
    const recency = 1 - Math.min(age / (24 * 60 * 60 * 1000), 1); // Last 24 hours
    const frequency = Math.min(entry.hits / 100, 1); // Cap at 100 hits

    return recency * 0.6 + frequency * 0.4;
  }

  private calculateInitialPriority(key: string): number {
    // Higher priority for certain patterns
    if (key.includes('order') || key.includes('customer')) return 0.8;
    if (key.includes('product') || key.includes('inventory')) return 0.6;
    return 0.4;
  }

  private recordAccess(key: string, _hit: boolean): void {
    if (!this.accessPattern.has(key)) {
      this.accessPattern.set(key, []);
    }

    const pattern = this.accessPattern.get(key)!;
    pattern.push(Date.now());

    // Keep only last 100 accesses
    if (pattern.length > 100) {
      pattern.splice(0, pattern.length - 100);
    }
  }

  private updatePredictionModel(key: string): void {
    const pattern = this.accessPattern.get(key);
    if (!pattern || pattern.length < 2) return;
    const history = pattern;

    // Simple prediction based on access frequency
    const intervals: number[] = [];
    for (let i = 1; i < history.length; i++) {
      intervals.push(history[i] - history[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    this.predictionModel.set(key, avgInterval);
  }

  private getPredictions(keyPattern: string): string[] {
    const predictions: string[] = [];
    const now = Date.now();

    for (const [key, avgInterval] of this.predictionModel) {
      if (key.includes(keyPattern)) {
        const lastAccess = this.accessPattern.get(key)?.slice(-1)[0] || 0;
        const timeSinceAccess = now - lastAccess;

        // Predict if access is likely soon
        if (timeSinceAccess > avgInterval * 0.8) {
          predictions.push(key);
        }
      }
    }

    return predictions.slice(0, 10); // Limit predictions
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private calculateSize(value: T): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default size
    }
  }

  private async compress(value: T): Promise<T> {
    // Simple compression placeholder - could integrate with actual compression library
    return value;
  }

  private async makeSpace(requiredSize: number): Promise<void> {
    while (
      this.currentSize + requiredSize > this.config.maxMemoryMB * 1024 * 1024 &&
      this.cache.size > 0
    ) {
      await this.adaptiveEviction();
    }
  }

  private updateStats(): void {
    this.stats.itemCount = this.cache.size;
    this.stats.size = this.currentSize;
    this.stats.hitRate = this.stats.hits / (this.stats.hits + this.stats.misses || 1);
  }

  private updateAverageResponseTime(responseTime: number): void {
    const alpha = 0.1; // Smoothing factor
    this.stats.averageResponseTime =
      this.stats.averageResponseTime * (1 - alpha) + responseTime * alpha;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  clear(): void {
    this.cache.clear();
    this.accessPattern.clear();
    this.tagIndex.clear();
    this.predictionModel.clear();
    this.currentSize = 0;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      itemCount: 0,
      hitRate: 0,
      averageResponseTime: 0,
    };

    this.emit('clear');
    logger.info('Cache cleared');
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
    this.removeAllListeners();
    logger.info('Cache destroyed');
  }
}
