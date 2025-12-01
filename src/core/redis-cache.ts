import Redis, { RedisOptions } from 'ioredis';
import { createLogger } from '@utils/logger';
import { config } from '@config/index';

const logger = createLogger('redis-cache');

export interface RedisCacheOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttl?: number; // Default TTL in seconds
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  metadata?: Record<string, any>;
}

export class RedisCache {
  private client: Redis;
  private subscriber?: Redis;
  private isConnected: boolean = false;
  private readonly keyPrefix: string;
  private readonly defaultTTL: number;

  constructor(options: RedisCacheOptions = {}) {
    this.keyPrefix = options.keyPrefix || 'stateset:mcp:';
    this.defaultTTL = options.ttl || config.cache.ttl || 300; // 5 minutes default

    const redisOptions: RedisOptions = {
      host: options.host || process.env.REDIS_HOST || 'localhost',
      port: options.port || Number(process.env.REDIS_PORT) || 6379,
      password: options.password || process.env.REDIS_PASSWORD,
      db: options.db || Number(process.env.REDIS_DB) || 0,
      maxRetriesPerRequest: options.maxRetriesPerRequest || 3,
      enableReadyCheck: options.enableReadyCheck !== false,
      lazyConnect: options.lazyConnect !== false,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
    };

    this.client = new Redis(redisOptions);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connecting');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis client ready', {
        host: this.client.options.host,
        port: this.client.options.port,
        db: this.client.options.db,
      });
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.client.connect();
      logger.info('Successfully connected to Redis');
    } catch (error) {
      logger.error('Failed to connect to Redis', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      logger.info('Disconnected from Redis');
    } catch (error) {
      logger.error('Error disconnecting from Redis', error);
      throw error;
    }
  }

  private makeKey(namespace: string, key: string): string {
    return `${this.keyPrefix}${namespace}:${key}`;
  }

  async get<T>(namespace: string, key: string): Promise<T | undefined> {
    try {
      const redisKey = this.makeKey(namespace, key);
      const data = await this.client.get(redisKey);

      if (!data) {
        logger.debug('Cache miss', { namespace, key });
        return undefined;
      }

      const entry: CacheEntry<T> = JSON.parse(data);

      // Check if expired
      if (entry.ttl > 0 && Date.now() - entry.timestamp > entry.ttl * 1000) {
        await this.delete(namespace, key);
        logger.debug('Cache entry expired', { namespace, key });
        return undefined;
      }

      logger.debug('Cache hit', { namespace, key });
      return entry.value;
    } catch (error) {
      logger.error('Redis get error', error, { namespace, key });
      return undefined;
    }
  }

  async set<T>(namespace: string, key: string, value: T, ttl?: number): Promise<void> {
    try {
      const redisKey = this.makeKey(namespace, key);
      const effectiveTTL = ttl || this.defaultTTL;

      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl: effectiveTTL,
        metadata: {
          namespace,
          key,
        },
      };

      const serialized = JSON.stringify(entry);

      if (effectiveTTL > 0) {
        await this.client.setex(redisKey, effectiveTTL, serialized);
      } else {
        await this.client.set(redisKey, serialized);
      }

      logger.debug('Cache set', { namespace, key, ttl: effectiveTTL });
    } catch (error) {
      logger.error('Redis set error', error, { namespace, key });
      throw error;
    }
  }

  async delete(namespace: string, key: string): Promise<boolean> {
    try {
      const redisKey = this.makeKey(namespace, key);
      const result = await this.client.del(redisKey);
      logger.debug('Cache delete', { namespace, key, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      logger.error('Redis delete error', error, { namespace, key });
      return false;
    }
  }

  async clear(namespace?: string): Promise<void> {
    try {
      if (namespace) {
        // Clear specific namespace
        const pattern = this.makeKey(namespace, '*');
        const keys = await this.client.keys(pattern);

        if (keys.length > 0) {
          await this.client.del(...keys);
        }

        logger.info('Cleared cache namespace', { namespace, count: keys.length });
      } else {
        // Clear all keys with our prefix
        const pattern = `${this.keyPrefix}*`;
        const keys = await this.client.keys(pattern);

        if (keys.length > 0) {
          await this.client.del(...keys);
        }

        logger.info('Cleared all caches', { count: keys.length });
      }
    } catch (error) {
      logger.error('Redis clear error', error, { namespace });
      throw error;
    }
  }

  async has(namespace: string, key: string): Promise<boolean> {
    try {
      const redisKey = this.makeKey(namespace, key);
      const exists = await this.client.exists(redisKey);
      return exists === 1;
    } catch (error) {
      logger.error('Redis has error', error, { namespace, key });
      return false;
    }
  }

  async getMany<T>(namespace: string, keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    try {
      if (keys.length === 0) {
        return result;
      }

      const redisKeys = keys.map((k) => this.makeKey(namespace, k));
      const values = await this.client.mget(...redisKeys);

      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          try {
            const entry: CacheEntry<T> = JSON.parse(value);

            // Check if expired
            if (entry.ttl === 0 || Date.now() - entry.timestamp <= entry.ttl * 1000) {
              result.set(key, entry.value);
            }
          } catch (parseError) {
            logger.error('Error parsing cached value', parseError, { namespace, key });
          }
        }
      });

      logger.debug('Cache getMany', { namespace, requested: keys.length, found: result.size });
      return result;
    } catch (error) {
      logger.error('Redis getMany error', error, { namespace, keys });
      return result;
    }
  }

  async setMany<T>(namespace: string, entries: Map<string, T>, ttl?: number): Promise<void> {
    try {
      if (entries.size === 0) {
        return;
      }

      const effectiveTTL = ttl || this.defaultTTL;
      const pipeline = this.client.pipeline();

      for (const [key, value] of entries.entries()) {
        const redisKey = this.makeKey(namespace, key);
        const entry: CacheEntry<T> = {
          value,
          timestamp: Date.now(),
          ttl: effectiveTTL,
          metadata: { namespace, key },
        };

        const serialized = JSON.stringify(entry);

        if (effectiveTTL > 0) {
          pipeline.setex(redisKey, effectiveTTL, serialized);
        } else {
          pipeline.set(redisKey, serialized);
        }
      }

      await pipeline.exec();

      logger.debug('Cache setMany', { namespace, count: entries.size, ttl: effectiveTTL });
    } catch (error) {
      logger.error('Redis setMany error', error, { namespace });
      throw error;
    }
  }

  async getStats(namespace?: string): Promise<{
    totalKeys: number;
    memoryUsage: number;
    hitRate?: number;
  }> {
    try {
      const pattern = namespace ? this.makeKey(namespace, '*') : `${this.keyPrefix}*`;
      const keys = await this.client.keys(pattern);

      // Get memory info
      const info = await this.client.info('memory');
      const memoryMatch = info?.match(/used_memory:(\d+)/);
      const memoryUsage = memoryMatch && memoryMatch[1] ? parseInt(memoryMatch[1], 10) : 0;

      return {
        totalKeys: keys.length,
        memoryUsage,
      };
    } catch (error) {
      logger.error('Redis getStats error', error, { namespace });
      return {
        totalKeys: 0,
        memoryUsage: 0,
      };
    }
  }

  async flush(): Promise<void> {
    try {
      await this.client.flushdb();
      logger.warn('Redis database flushed');
    } catch (error) {
      logger.error('Redis flush error', error);
      throw error;
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }

  // Pub/Sub functionality
  async subscribe(channel: string, handler: (message: string) => void): Promise<void> {
    if (!this.subscriber) {
      this.subscriber = this.client.duplicate();
      await this.subscriber.connect();
    }

    await this.subscriber.subscribe(channel);

    this.subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        handler(message);
      }
    });

    logger.info('Subscribed to Redis channel', { channel });
  }

  async publish(channel: string, message: string): Promise<number> {
    try {
      const receivers = await this.client.publish(channel, message);
      logger.debug('Published to Redis channel', { channel, receivers });
      return receivers;
    } catch (error) {
      logger.error('Redis publish error', error, { channel });
      return 0;
    }
  }

  // Advanced operations
  async increment(namespace: string, key: string, amount: number = 1): Promise<number> {
    try {
      const redisKey = this.makeKey(namespace, key);
      const result = await this.client.incrby(redisKey, amount);
      logger.debug('Cache increment', { namespace, key, amount, result });
      return result;
    } catch (error) {
      logger.error('Redis increment error', error, { namespace, key });
      throw error;
    }
  }

  async expire(namespace: string, key: string, seconds: number): Promise<boolean> {
    try {
      const redisKey = this.makeKey(namespace, key);
      const result = await this.client.expire(redisKey, seconds);
      return result === 1;
    } catch (error) {
      logger.error('Redis expire error', error, { namespace, key });
      return false;
    }
  }
}

// Singleton instance
let redisCacheInstance: RedisCache | null = null;

export function getRedisCache(options?: RedisCacheOptions): RedisCache {
  if (!redisCacheInstance) {
    redisCacheInstance = new RedisCache(options);
  }
  return redisCacheInstance;
}

export async function closeRedisCache(): Promise<void> {
  if (redisCacheInstance) {
    await redisCacheInstance.disconnect();
    redisCacheInstance = null;
  }
}
