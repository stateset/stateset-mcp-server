import { cacheManager, CacheManager, CacheStats } from './cache';
import { RedisCache, getRedisCache, closeRedisCache } from './redis-cache';
import { createLogger } from '@utils/logger';
import { config } from '@config/index';

const logger = createLogger('hybrid-cache');

export type CacheBackend = 'memory' | 'redis' | 'hybrid';

export interface HybridCacheOptions {
  backend: CacheBackend;
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
  // Use L1 (memory) + L2 (Redis) for hybrid mode
  hybridL1Size?: number; // Number of items in L1 cache
  hybridL1TTL?: number; // TTL for L1 cache in seconds
}

/**
 * Hybrid Cache Manager
 *
 * Supports three modes:
 * - memory: In-memory only (default, fastest)
 * - redis: Redis only (distributed, persistent)
 * - hybrid: L1 (memory) + L2 (Redis) for best of both worlds
 */
export class HybridCache {
  private backend: CacheBackend;
  private memoryCache: CacheManager;
  private redisCache?: RedisCache;
  private hybridL1Size: number;
  private hybridL1TTL: number;

  constructor(options: HybridCacheOptions) {
    this.backend = options.backend;
    this.memoryCache = cacheManager;
    this.hybridL1Size = options.hybridL1Size || 1000;
    this.hybridL1TTL = options.hybridL1TTL || 60; // 1 minute L1 cache

    if (this.backend === 'redis' || this.backend === 'hybrid') {
      try {
        this.redisCache = getRedisCache(options.redis);
        logger.info('Hybrid cache initialized', {
          backend: this.backend,
          l1Size: this.hybridL1Size,
          l1TTL: this.hybridL1TTL,
        });
      } catch (error) {
        logger.error('Failed to initialize Redis cache, falling back to memory', error);
        this.backend = 'memory';
      }
    } else {
      logger.info('Using in-memory cache backend');
    }
  }

  async connect(): Promise<void> {
    if (this.redisCache && (this.backend === 'redis' || this.backend === 'hybrid')) {
      try {
        await this.redisCache.connect();
        logger.info('Redis cache connected');
      } catch (error) {
        logger.error('Failed to connect to Redis, falling back to memory', error);
        this.backend = 'memory';
        this.redisCache = undefined;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.redisCache) {
      await closeRedisCache();
    }
  }

  async get<T>(namespace: string, key: string, fetcher?: () => Promise<T>): Promise<T | undefined> {
    let value: T | undefined;

    switch (this.backend) {
      case 'memory':
        value = await this.memoryCache.get(namespace, key, fetcher);
        break;

      case 'redis':
        if (this.redisCache) {
          value = await this.redisCache.get<T>(namespace, key);

          // If miss and fetcher provided, fetch and cache
          if (value === undefined && fetcher) {
            try {
              value = await fetcher();
              if (value !== undefined) {
                await this.redisCache.set(namespace, key, value);
              }
            } catch (error) {
              logger.error('Cache fetcher error', error, { namespace, key });
              throw error;
            }
          }
        }
        break;

      case 'hybrid':
        // Try L1 (memory) first
        value = this.memoryCache.getCache<T>(namespace).get(key) as T | undefined;

        if (value === undefined && this.redisCache) {
          // Try L2 (Redis)
          value = await this.redisCache.get<T>(namespace, key);

          if (value !== undefined) {
            // Promote to L1
            this.memoryCache.set(namespace, key, value, this.hybridL1TTL * 1000);
            logger.debug('Cache promotion to L1', { namespace, key });
          } else if (fetcher) {
            // Miss on both levels, fetch from source
            try {
              value = await fetcher();
              if (value !== undefined) {
                // Store in both levels
                this.memoryCache.set(namespace, key, value, this.hybridL1TTL * 1000);
                await this.redisCache.set(namespace, key, value);
                logger.debug('Cache populated on both levels', { namespace, key });
              }
            } catch (error) {
              logger.error('Cache fetcher error', error, { namespace, key });
              throw error;
            }
          }
        }
        break;
    }

    return value;
  }

  async set<T>(namespace: string, key: string, value: T, ttl?: number): Promise<void> {
    switch (this.backend) {
      case 'memory':
        this.memoryCache.set(namespace, key, value, ttl ? ttl * 1000 : undefined);
        break;

      case 'redis':
        if (this.redisCache) {
          await this.redisCache.set(namespace, key, value, ttl);
        }
        break;

      case 'hybrid':
        // Set in both levels
        this.memoryCache.set(namespace, key, value, ttl ? Math.min(ttl, this.hybridL1TTL) * 1000 : this.hybridL1TTL * 1000);
        if (this.redisCache) {
          await this.redisCache.set(namespace, key, value, ttl);
        }
        break;
    }
  }

  async delete(namespace: string, key: string): Promise<boolean> {
    let deleted = false;

    switch (this.backend) {
      case 'memory':
        deleted = this.memoryCache.delete(namespace, key);
        break;

      case 'redis':
        if (this.redisCache) {
          deleted = await this.redisCache.delete(namespace, key);
        }
        break;

      case 'hybrid':
        // Delete from both levels
        this.memoryCache.delete(namespace, key);
        if (this.redisCache) {
          deleted = await this.redisCache.delete(namespace, key);
        }
        break;
    }

    return deleted;
  }

  async clear(namespace?: string): Promise<void> {
    switch (this.backend) {
      case 'memory':
        this.memoryCache.clear(namespace);
        break;

      case 'redis':
        if (this.redisCache) {
          await this.redisCache.clear(namespace);
        }
        break;

      case 'hybrid':
        // Clear both levels
        this.memoryCache.clear(namespace);
        if (this.redisCache) {
          await this.redisCache.clear(namespace);
        }
        break;
    }
  }

  async getStats(namespace?: string): Promise<CacheStats | Record<string, CacheStats>> {
    switch (this.backend) {
      case 'memory':
        return this.memoryCache.getStats(namespace);

      case 'redis':
        if (this.redisCache) {
          const stats = await this.redisCache.getStats(namespace);
          return {
            hits: 0,
            misses: 0,
            evictions: 0,
            size: stats.memoryUsage,
            itemCount: stats.totalKeys,
            hitRate: stats.hitRate || 0,
          } as CacheStats;
        }
        return this.getEmptyStats();

      case 'hybrid':
        const memStats = this.memoryCache.getStats(namespace);
        const redisStats = this.redisCache ? await this.redisCache.getStats(namespace) : null;

        return {
          l1: memStats,
          l2: redisStats ? {
            hits: 0,
            misses: 0,
            evictions: 0,
            size: redisStats.memoryUsage,
            itemCount: redisStats.totalKeys,
            hitRate: redisStats.hitRate || 0,
          } : this.getEmptyStats(),
        } as any;

      default:
        return this.getEmptyStats();
    }
  }

  private getEmptyStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      itemCount: 0,
      hitRate: 0,
    };
  }

  async healthCheck(): Promise<{
    backend: CacheBackend;
    memory: { healthy: boolean };
    redis?: { healthy: boolean; latency?: number; error?: string };
  }> {
    const result: any = {
      backend: this.backend,
      memory: { healthy: true },
    };

    if (this.redisCache && (this.backend === 'redis' || this.backend === 'hybrid')) {
      result.redis = await this.redisCache.healthCheck();
    }

    return result;
  }

  getBackend(): CacheBackend {
    return this.backend;
  }

  isRedisAvailable(): boolean {
    return this.redisCache !== undefined && this.redisCache.isReady();
  }
}

// Factory function
export function createHybridCache(options?: Partial<HybridCacheOptions>): HybridCache {
  const backend: CacheBackend =
    (process.env.CACHE_BACKEND as CacheBackend) ||
    options?.backend ||
    (config.cache.redis?.enabled ? 'redis' : 'memory');

  return new HybridCache({
    backend,
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB) : undefined,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'stateset:mcp:',
      ...options?.redis,
    },
    hybridL1Size: options?.hybridL1Size,
    hybridL1TTL: options?.hybridL1TTL,
  });
}

// Singleton instance
let hybridCacheInstance: HybridCache | null = null;

export function getHybridCache(options?: Partial<HybridCacheOptions>): HybridCache {
  if (!hybridCacheInstance) {
    hybridCacheInstance = createHybridCache(options);
  }
  return hybridCacheInstance;
}

export async function initializeHybridCache(options?: Partial<HybridCacheOptions>): Promise<HybridCache> {
  const cache = getHybridCache(options);
  await cache.connect();
  logger.info('Hybrid cache initialized and connected');
  return cache;
}

export async function closeHybridCache(): Promise<void> {
  if (hybridCacheInstance) {
    await hybridCacheInstance.disconnect();
    hybridCacheInstance = null;
    logger.info('Hybrid cache closed');
  }
}
