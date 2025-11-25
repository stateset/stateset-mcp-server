import { config } from '@config/index';
import { createLogger } from '@utils/logger';

const logger = createLogger('cache');

// Cache entry interface
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
  size: number;
}

// Cache statistics
interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  itemCount: number;
  hitRate: number;
}

// Abstract cache strategy
abstract class CacheStrategy<T> {
  protected cache: Map<string, CacheEntry<T>> = new Map();
  protected maxSize: number;
  protected currentSize: number = 0;
  protected stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    itemCount: 0,
    hitRate: 0,
  };

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  abstract evict(): void;
  abstract onAccess(key: string): void;

  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      logger.logCacheMiss(key);
      return undefined;
    }

    // Check TTL
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      logger.logCacheMiss(key);
      return undefined;
    }

    // Update access info
    entry.lastAccessed = Date.now();
    entry.hits++;
    this.onAccess(key);

    this.stats.hits++;
    this.updateHitRate();
    logger.logCacheHit(key);

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    const size = this.calculateSize(value);
    const effectiveTtl = ttl || config.cache.ttl * 1000;

    // Check if we need to evict
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evict();
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: effectiveTtl,
      hits: 0,
      lastAccessed: Date.now(),
      size,
    };

    // If key exists, update size
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.size;
    }

    this.cache.set(key, entry);
    this.currentSize += size;
    this.stats.itemCount = this.cache.size;
    this.stats.size = this.currentSize;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.stats.itemCount--;
      this.stats.size = this.currentSize;
      return this.cache.delete(key);
    }
    return false;
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      itemCount: 0,
      hitRate: 0,
    };
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  protected isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  protected calculateSize(value: T): number {
    // Simple size calculation - can be improved
    return JSON.stringify(value).length;
  }

  protected updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// LRU (Least Recently Used) Cache Strategy
class LRUCache<T> extends CacheStrategy<T> {
  private accessOrder: string[] = [];

  evict(): void {
    if (this.accessOrder.length === 0) return;

    const keyToEvict = this.accessOrder.shift();
    if (!keyToEvict) return;
    this.delete(keyToEvict);
    this.stats.evictions++;
    logger.debug('LRU eviction', { key: keyToEvict });
  }

  onAccess(key: string): void {
    // Remove from current position
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  set(key: string, value: T, ttl?: number): void {
    super.set(key, value, ttl);
    this.onAccess(key);
  }
}

// LFU (Least Frequently Used) Cache Strategy
class LFUCache<T> extends CacheStrategy<T> {
  evict(): void {
    let minHits = Infinity;
    let keyToEvict: string | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        keyToEvict = key;
      }
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
      this.stats.evictions++;
      logger.debug('LFU eviction', { key: keyToEvict, hits: minHits });
    }
  }

  onAccess(_key: string): void {
    // Hits are already updated in the base get method
  }
}

// FIFO (First In First Out) Cache Strategy
class FIFOCache<T> extends CacheStrategy<T> {
  private insertOrder: string[] = [];

  evict(): void {
    if (this.insertOrder.length === 0) return;

    const keyToEvict = this.insertOrder.shift();
    if (!keyToEvict) return;
    this.delete(keyToEvict);
    this.stats.evictions++;
    logger.debug('FIFO eviction', { key: keyToEvict });
  }

  onAccess(_key: string): void {
    // FIFO doesn't care about access patterns
  }

  set(key: string, value: T, ttl?: number): void {
    super.set(key, value, ttl);
    if (!this.insertOrder.includes(key)) {
      this.insertOrder.push(key);
    }
  }
}

// Cache factory
function createCacheStrategy<T>(strategy: string, maxSize: number): CacheStrategy<T> {
  switch (strategy) {
    case 'lru':
      return new LRUCache<T>(maxSize);
    case 'lfu':
      return new LFUCache<T>(maxSize);
    case 'fifo':
      return new FIFOCache<T>(maxSize);
    default:
      logger.warn(`Unknown cache strategy: ${strategy}, defaulting to LRU`);
      return new LRUCache<T>(maxSize);
  }
}

// Main Cache Manager
export class CacheManager {
  private caches: Map<string, CacheStrategy<any>> = new Map();
  private warmupFunctions: Map<string, () => Promise<void>> = new Map();

  constructor() {
    // Start periodic cleanup
    if (config.cache.enabled) {
      this.startCleanupTimer();
    }
  }

  // Get or create a cache namespace
  getCache<T>(namespace: string, maxSize?: number): CacheStrategy<T> {
    if (!this.caches.has(namespace)) {
      const size = maxSize || config.cache.maxSize;
      const strategy = createCacheStrategy<T>(config.cache.strategy, size);
      this.caches.set(namespace, strategy);
      logger.info('Created cache namespace', {
        namespace,
        strategy: config.cache.strategy,
        maxSize: size,
      });
    }
    const cache = this.caches.get(namespace);
    if (!cache) {
      throw new Error(`Cache namespace ${namespace} not found`);
    }
    return cache;
  }

  // Cache operations with namespace
  async get<T>(namespace: string, key: string, fetcher?: () => Promise<T>): Promise<T | undefined> {
    const cache = this.getCache<T>(namespace);
    let value = cache.get(key);

    if (value === undefined && fetcher) {
      try {
        value = await fetcher();
        if (value !== undefined) {
          cache.set(key, value);
        }
      } catch (error) {
        logger.error('Cache fetcher error', error, { namespace, key });
        throw error;
      }
    }

    return value;
  }

  set<T>(namespace: string, key: string, value: T, ttl?: number): void {
    const cache = this.getCache<T>(namespace);
    cache.set(key, value, ttl);
  }

  delete(namespace: string, key: string): boolean {
    const cache = this.caches.get(namespace);
    return cache ? cache.delete(key) : false;
  }

  clear(namespace?: string): void {
    if (namespace) {
      const cache = this.caches.get(namespace);
      if (cache) {
        cache.clear();
        logger.info('Cleared cache namespace', { namespace });
      }
    } else {
      for (const [_ns, cache] of this.caches.entries()) {
        cache.clear();
      }
      logger.info('Cleared all caches');
    }
  }

  // Cache warming
  registerWarmup(namespace: string, warmupFn: () => Promise<void>): void {
    this.warmupFunctions.set(namespace, warmupFn);
    logger.info('Registered cache warmup function', { namespace });
  }

  async warmup(namespace?: string): Promise<void> {
    const namespaces = namespace ? [namespace] : Array.from(this.warmupFunctions.keys());

    for (const ns of namespaces) {
      const warmupFn = this.warmupFunctions.get(ns);
      if (warmupFn) {
        try {
          const timer = logger.startTimer(`cache.warmup.${ns}`);
          await warmupFn();
          timer();
          logger.info('Cache warmup completed', { namespace: ns });
        } catch (error) {
          logger.error('Cache warmup failed', error, { namespace: ns });
        }
      }
    }
  }

  // Get statistics
  getStats(namespace?: string): Record<string, CacheStats> | CacheStats {
    if (namespace) {
      const cache = this.caches.get(namespace);
      return cache
        ? cache.getStats()
        : {
            hits: 0,
            misses: 0,
            evictions: 0,
            size: 0,
            itemCount: 0,
            hitRate: 0,
          };
    }

    const stats: Record<string, CacheStats> = {};
    for (const [ns, cache] of this.caches.entries()) {
      stats[ns] = cache.getStats();
    }
    return stats;
  }

  // Periodic cleanup of expired entries
  private startCleanupTimer(): void {
    setInterval(() => {
      for (const [namespace, cache] of this.caches.entries()) {
        const beforeCount = cache.getStats().itemCount;
        // Trigger cleanup by attempting to get all keys
        for (const key of (cache as any).cache.keys()) {
          cache.get(key); // This will remove expired entries
        }
        const afterCount = cache.getStats().itemCount;
        if (beforeCount !== afterCount) {
          logger.debug('Cache cleanup completed', {
            namespace,
            removed: beforeCount - afterCount,
          });
        }
      }
    }, 60000); // Run every minute
  }
}

// Create singleton instance
export const cacheManager = new CacheManager();

// Cache decorators
export function Cacheable(namespace: string, _ttl?: number) {
  return function (_target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const key = `${propertyName}:${JSON.stringify(args)}`;

      return cacheManager.get(namespace, key, async () => {
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

// Export types
export type { CacheStats, CacheEntry };
