import { cacheManager } from '../../src/core/cache';

describe('CacheManager', () => {
  const testNamespace = 'test-cache';

  beforeEach(() => {
    cacheManager.clear(testNamespace);
  });

  afterEach(() => {
    cacheManager.clear(testNamespace);
  });

  describe('basic operations', () => {
    it('should store and retrieve values', async () => {
      cacheManager.set(testNamespace, 'key1', { data: 'test value' });

      const result = await cacheManager.get<{ data: string }>(testNamespace, 'key1');

      expect(result).toEqual({ data: 'test value' });
    });

    it('should return undefined for missing keys', async () => {
      const result = await cacheManager.get(testNamespace, 'nonexistent');

      expect(result).toBeUndefined();
    });

    it('should delete values', () => {
      cacheManager.set(testNamespace, 'key1', 'value1');
      cacheManager.delete(testNamespace, 'key1');

      const result = cacheManager.get(testNamespace, 'key1');

      expect(result).resolves.toBeUndefined();
    });

    it('should clear all values in namespace', async () => {
      cacheManager.set(testNamespace, 'key1', 'value1');
      cacheManager.set(testNamespace, 'key2', 'value2');

      cacheManager.clear(testNamespace);

      const result1 = await cacheManager.get(testNamespace, 'key1');
      const result2 = await cacheManager.get(testNamespace, 'key2');

      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });
  });

  describe('fetcher function', () => {
    it('should use fetcher when value is not cached', async () => {
      const fetcher = jest.fn().mockResolvedValue('fetched value');

      const result = await cacheManager.get(testNamespace, 'key1', fetcher);

      expect(result).toBe('fetched value');
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('should not call fetcher when value is cached', async () => {
      cacheManager.set(testNamespace, 'key1', 'cached value');
      const fetcher = jest.fn().mockResolvedValue('fetched value');

      const result = await cacheManager.get(testNamespace, 'key1', fetcher);

      expect(result).toBe('cached value');
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should cache fetcher results', async () => {
      const fetcher = jest.fn().mockResolvedValue('fetched value');

      await cacheManager.get(testNamespace, 'key1', fetcher);
      await cacheManager.get(testNamespace, 'key1', fetcher);

      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire values after TTL', async () => {
      cacheManager.set(testNamespace, 'key1', 'value1', 50); // 50ms TTL

      // Value should exist initially
      let result = await cacheManager.get(testNamespace, 'key1');
      expect(result).toBe('value1');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Value should be expired
      result = await cacheManager.get(testNamespace, 'key1');
      expect(result).toBeUndefined();
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', async () => {
      cacheManager.set(testNamespace, 'key1', 'value1');

      // 1 hit
      await cacheManager.get(testNamespace, 'key1');

      // 1 miss
      await cacheManager.get(testNamespace, 'nonexistent');

      const stats = cacheManager.getStats(testNamespace);

      expect((stats as any).hits).toBeGreaterThanOrEqual(1);
      expect((stats as any).misses).toBeGreaterThanOrEqual(1);
    });

    it('should calculate hit rate', async () => {
      cacheManager.set(testNamespace, 'key1', 'value1');

      // Generate some hits and misses
      await cacheManager.get(testNamespace, 'key1'); // hit
      await cacheManager.get(testNamespace, 'key1'); // hit
      await cacheManager.get(testNamespace, 'miss1'); // miss

      const stats = cacheManager.getStats(testNamespace);

      expect((stats as any).hitRate).toBeGreaterThan(0);
    });
  });

  describe('namespaces', () => {
    it('should isolate data between namespaces', async () => {
      const namespace1 = 'namespace1';
      const namespace2 = 'namespace2';

      cacheManager.set(namespace1, 'key1', 'value1');
      cacheManager.set(namespace2, 'key1', 'value2');

      const result1 = await cacheManager.get(namespace1, 'key1');
      const result2 = await cacheManager.get(namespace2, 'key1');

      expect(result1).toBe('value1');
      expect(result2).toBe('value2');

      // Cleanup
      cacheManager.clear(namespace1);
      cacheManager.clear(namespace2);
    });
  });
});
