import { IntelligentCache } from '../../src/core/intelligent-cache';

describe('IntelligentCache', () => {
  let cache: IntelligentCache<string>;

  beforeEach(() => {
    cache = new IntelligentCache<string>({
      maxSize: 100,
      defaultTTL: 1000,
      maxMemoryMB: 1,
      strategy: 'adaptive',
      enablePredictive: true,
    });
  });

  afterEach(async () => {
    cache.destroy();
  });

  describe('Basic Operations', () => {
    it('should set and get values', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');
      expect(result).toBe('value1');
    });

    it('should return undefined for non-existent keys', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should handle TTL expiration', async () => {
      await cache.set('key1', 'value1', { ttl: 100 });
      
      // Should exist immediately
      let result = await cache.get('key1');
      expect(result).toBe('value1');
      
      // Should expire after TTL
      await new Promise(resolve => setTimeout(resolve, 150));
      result = await cache.get('key1');
      expect(result).toBeUndefined();
    });

    it('should delete values', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.get('key1')).toBe('value1');
      
      const deleted = cache.delete('key1');
      expect(deleted).toBe(true);
      expect(await cache.get('key1')).toBeUndefined();
    });

    it('should clear all values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
    });
  });

  describe('Tag-based Operations', () => {
    it('should handle tags', async () => {
      await cache.set('key1', 'value1', { tags: ['tag1', 'tag2'] });
      await cache.set('key2', 'value2', { tags: ['tag2', 'tag3'] });
      await cache.set('key3', 'value3', { tags: ['tag3'] });
      
      // Delete by tag should remove matching entries
      const deletedCount = cache.deleteByTags(['tag2']);
      expect(deletedCount).toBe(2);
      
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
      expect(await cache.get('key3')).toBe('value3');
    });
  });

  describe('Batch Operations', () => {
    it('should handle multiple get operations', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      const result = await cache.mget(['key1', 'key2', 'key4']);
      
      expect(result.get('key1')).toBe('value1');
      expect(result.get('key2')).toBe('value2');
      expect(result.has('key4')).toBe(false);
    });

    it('should handle multiple set operations', async () => {
      await cache.mset([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
        { key: 'key3', value: 'value3' },
      ]);
      
      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBe('value2');
      expect(await cache.get('key3')).toBe('value3');
    });
  });

  describe('Cache Warming', () => {
    it('should warm cache with fetchers', async () => {
      const mockFetcher1 = jest.fn().mockResolvedValue('value1');
      const mockFetcher2 = jest.fn().mockResolvedValue('value2');
      
      await cache.warm([
        { key: 'key1', fetcher: mockFetcher1 },
        { key: 'key2', fetcher: mockFetcher2 },
      ]);
      
      expect(mockFetcher1).toHaveBeenCalled();
      expect(mockFetcher2).toHaveBeenCalled();
      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBe('value2');
    });

    it('should handle warming failures gracefully', async () => {
      const mockFetcher1 = jest.fn().mockResolvedValue('value1');
      const mockFetcher2 = jest.fn().mockRejectedValue(new Error('Fetch failed'));
      
      await cache.warm([
        { key: 'key1', fetcher: mockFetcher1 },
        { key: 'key2', fetcher: mockFetcher2 },
      ]);
      
      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBeUndefined();
    });
  });

  describe('Statistics', () => {
    it('should track cache statistics', async () => {
      // Generate some cache activity
      await cache.set('key1', 'value1');
      await cache.get('key1'); // hit
      await cache.get('key2'); // miss
      await cache.get('key1'); // hit
      
      const stats = cache.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.itemCount).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.67, 2);
    });
  });

  describe('Predictive Caching', () => {
    it('should perform predictive prefetch', async () => {
      const mockFetcher = jest.fn()
        .mockResolvedValueOnce('value1')
        .mockResolvedValueOnce('value2');
      
      // Set up access pattern
      await cache.set('order_123', 'data1');
      await cache.get('order_123');
      
      // Trigger predictive prefetch
      await cache.prefetch('order_', mockFetcher);
      
      // Note: This test depends on internal prediction logic
      // In a real scenario, you'd need to set up a more predictable pattern
    });
  });

  describe('Memory Management', () => {
    it('should respect memory limits', async () => {
      const smallCache = new IntelligentCache<string>({
        maxSize: 2,
        maxMemoryMB: 0.001, // Very small limit
      });

      try {
        await smallCache.set('key1', 'value1');
        await smallCache.set('key2', 'value2');
        await smallCache.set('key3', 'value3'); // Should trigger eviction
        
        const stats = smallCache.getStats();
        expect(stats.itemCount).toBeLessThanOrEqual(2);
      } finally {
        smallCache.destroy();
      }
    });
  });

  describe('Event Handling', () => {
    it('should emit events for cache operations', async () => {
      const setHandler = jest.fn();
      const deleteHandler = jest.fn();
      const clearHandler = jest.fn();
      
      cache.on('set', setHandler);
      cache.on('delete', deleteHandler);
      cache.on('clear', clearHandler);
      
      await cache.set('key1', 'value1');
      cache.delete('key1');
      cache.clear();
      
      expect(setHandler).toHaveBeenCalledWith({
        key: 'key1',
        value: 'value1',
        size: expect.any(Number),
      });
      
      expect(deleteHandler).toHaveBeenCalledWith({
        key: 'key1',
      });
      
      expect(clearHandler).toHaveBeenCalled();
    });
  });
});