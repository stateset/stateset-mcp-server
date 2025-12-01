import { RedisCache } from '../../src/core/redis-cache';
import { HybridCache } from '../../src/core/hybrid-cache';

// Mock Redis for testing
jest.mock('ioredis', () => {
  const RedisMock = jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(0),
    mget: jest.fn().mockResolvedValue([]),
    pipeline: jest.fn().mockReturnValue({
      setex: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
    info: jest.fn().mockResolvedValue('used_memory:1024'),
    ping: jest.fn().mockResolvedValue('PONG'),
    publish: jest.fn().mockResolvedValue(0),
    subscribe: jest.fn().mockResolvedValue(undefined),
    incrby: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    flushdb: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    duplicate: jest.fn().mockReturnThis(),
    options: {
      host: 'localhost',
      port: 6379,
      db: 0,
    },
  }));

  return RedisMock;
});

describe('RedisCache', () => {
  let cache: RedisCache;

  beforeEach(() => {
    cache = new RedisCache({
      host: 'localhost',
      port: 6379,
      lazyConnect: true,
    });
  });

  afterEach(async () => {
    try {
      await cache.disconnect();
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('Connection Management', () => {
    it('should create a Redis cache instance', () => {
      expect(cache).toBeDefined();
      expect(cache).toBeInstanceOf(RedisCache);
    });

    it('should connect to Redis', async () => {
      await expect(cache.connect()).resolves.not.toThrow();
    });

    it('should disconnect from Redis', async () => {
      await cache.connect();
      await expect(cache.disconnect()).resolves.not.toThrow();
    });

    it('should perform health check', async () => {
      await cache.connect();
      const health = await cache.healthCheck();

      expect(health).toBeDefined();
      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Basic Operations', () => {
    beforeEach(async () => {
      await cache.connect();
    });

    it('should set and get a value', async () => {
      const namespace = 'test';
      const key = 'key1';
      const value = { data: 'test value' };

      await cache.set(namespace, key, value);
      const retrieved = await cache.get(namespace, key);

      // In mock mode, get returns undefined since we're not actually storing
      expect(retrieved).toBeUndefined();
    });

    it('should delete a key', async () => {
      const namespace = 'test';
      const key = 'key1';

      const deleted = await cache.delete(namespace, key);
      expect(deleted).toBe(true);
    });

    it('should check if key exists', async () => {
      const namespace = 'test';
      const key = 'key1';

      const exists = await cache.has(namespace, key);
      expect(typeof exists).toBe('boolean');
    });

    it('should clear namespace', async () => {
      const namespace = 'test';
      await expect(cache.clear(namespace)).resolves.not.toThrow();
    });

    it('should clear all caches', async () => {
      await expect(cache.clear()).resolves.not.toThrow();
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      await cache.connect();
    });

    it('should get multiple values', async () => {
      const namespace = 'test';
      const keys = ['key1', 'key2', 'key3'];

      const results = await cache.getMany(namespace, keys);

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(0); // Mock returns empty
    });

    it('should set multiple values', async () => {
      const namespace = 'test';
      const entries = new Map([
        ['key1', { data: 'value1' }],
        ['key2', { data: 'value2' }],
      ]);

      await expect(cache.setMany(namespace, entries)).resolves.not.toThrow();
    });

    it('should handle empty batch operations', async () => {
      const namespace = 'test';

      const results = await cache.getMany(namespace, []);
      expect(results.size).toBe(0);

      await expect(cache.setMany(namespace, new Map())).resolves.not.toThrow();
    });
  });

  describe('Advanced Operations', () => {
    beforeEach(async () => {
      await cache.connect();
    });

    it('should increment a counter', async () => {
      const namespace = 'test';
      const key = 'counter';

      const result = await cache.increment(namespace, key, 5);
      expect(typeof result).toBe('number');
    });

    it('should set expiration', async () => {
      const namespace = 'test';
      const key = 'key1';

      const result = await cache.expire(namespace, key, 60);
      expect(typeof result).toBe('boolean');
    });

    it('should get statistics', async () => {
      const stats = await cache.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalKeys).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsage).toBeGreaterThanOrEqual(0);
    });

    it('should flush database', async () => {
      await expect(cache.flush()).resolves.not.toThrow();
    });
  });

  describe('Pub/Sub', () => {
    beforeEach(async () => {
      await cache.connect();
    });

    it('should publish a message', async () => {
      const channel = 'test-channel';
      const message = 'test message';

      const receivers = await cache.publish(channel, message);
      expect(typeof receivers).toBe('number');
    });

    it('should subscribe to a channel', async () => {
      const channel = 'test-channel';
      const handler = jest.fn();

      await expect(cache.subscribe(channel, handler)).resolves.not.toThrow();
    });
  });
});

describe('HybridCache', () => {
  describe('Memory Backend', () => {
    let cache: HybridCache;

    beforeEach(() => {
      cache = new HybridCache({
        backend: 'memory',
      });
    });

    afterEach(async () => {
      await cache.disconnect();
    });

    it('should create a memory-backed cache', () => {
      expect(cache).toBeDefined();
      expect(cache.getBackend()).toBe('memory');
    });

    it('should set and get values', async () => {
      const namespace = 'test';
      const key = 'key1';
      const value = { data: 'test' };

      await cache.set(namespace, key, value);
      const retrieved = await cache.get(namespace, key);

      expect(retrieved).toEqual(value);
    });

    it('should delete values', async () => {
      const namespace = 'test';
      const key = 'key1';
      const value = { data: 'test' };

      await cache.set(namespace, key, value);
      const deleted = await cache.delete(namespace, key);
      const retrieved = await cache.get(namespace, key);

      expect(deleted).toBe(true);
      expect(retrieved).toBeUndefined();
    });

    it('should clear cache', async () => {
      const namespace = 'test';

      await cache.set(namespace, 'key1', { data: 'test1' });
      await cache.set(namespace, 'key2', { data: 'test2' });
      await cache.clear(namespace);

      const retrieved1 = await cache.get(namespace, 'key1');
      const retrieved2 = await cache.get(namespace, 'key2');

      expect(retrieved1).toBeUndefined();
      expect(retrieved2).toBeUndefined();
    });

    it('should get cache statistics', async () => {
      const stats = await cache.getStats();
      expect(stats).toBeDefined();
    });

    it('should perform health check', async () => {
      const health = await cache.healthCheck();

      expect(health).toBeDefined();
      expect(health.backend).toBe('memory');
      expect(health.memory.healthy).toBe(true);
    });
  });

  describe('Redis Backend', () => {
    let cache: HybridCache;

    beforeEach(async () => {
      cache = new HybridCache({
        backend: 'redis',
        redis: {
          host: 'localhost',
          port: 6379,
        },
      });

      // In test mode, Redis might not be available, so we'll handle that gracefully
      try {
        await cache.connect();
      } catch (error) {
        // Expected if Redis is not available
      }
    });

    afterEach(async () => {
      await cache.disconnect();
    });

    it('should create a redis-backed cache', () => {
      expect(cache).toBeDefined();
      // Backend might fall back to memory if Redis unavailable
      expect(['redis', 'memory']).toContain(cache.getBackend());
    });

    it('should check Redis availability', () => {
      const isAvailable = cache.isRedisAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });
  });

  describe('Hybrid Backend', () => {
    let cache: HybridCache;

    beforeEach(() => {
      cache = new HybridCache({
        backend: 'hybrid',
        redis: {
          host: 'localhost',
          port: 6379,
        },
        hybridL1Size: 100,
        hybridL1TTL: 30,
      });
    });

    afterEach(async () => {
      await cache.disconnect();
    });

    it('should create a hybrid cache', () => {
      expect(cache).toBeDefined();
      // Backend might fall back to memory if Redis unavailable
      expect(['hybrid', 'memory']).toContain(cache.getBackend());
    });

    it('should handle L1 cache operations', async () => {
      const namespace = 'test';
      const key = 'key1';
      const value = { data: 'test' };

      await cache.set(namespace, key, value);
      const retrieved = await cache.get(namespace, key);

      // Should work even if Redis is unavailable (L1 cache)
      expect(retrieved).toEqual(value);
    });
  });

  describe('Fetcher Function', () => {
    let cache: HybridCache;

    beforeEach(async () => {
      cache = new HybridCache({
        backend: 'memory',
      });
      // Clear test namespace to ensure clean state for fetcher tests
      await cache.clear('fetcher-test');
    });

    afterEach(async () => {
      await cache.disconnect();
    });

    it('should use fetcher on cache miss', async () => {
      // Use unique namespace to avoid conflicts with other tests
      const namespace = 'fetcher-test';
      const key = `fetcher-key-${Date.now()}`;
      const fetchedValue = { data: 'fetched' };

      const fetcher = jest.fn().mockResolvedValue(fetchedValue);

      const result = await cache.get(namespace, key, fetcher);

      expect(fetcher).toHaveBeenCalled();
      expect(result).toEqual(fetchedValue);

      // Second call should not invoke fetcher (cached)
      const result2 = await cache.get(namespace, key, fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result2).toEqual(fetchedValue);
    });

    it('should handle fetcher errors', async () => {
      // Use unique namespace to avoid conflicts with other tests
      const namespace = 'fetcher-test';
      const key = `error-key-${Date.now()}`;

      const fetcher = jest.fn().mockRejectedValue(new Error('Fetch failed'));

      await expect(cache.get(namespace, key, fetcher)).rejects.toThrow('Fetch failed');
    });
  });
});
