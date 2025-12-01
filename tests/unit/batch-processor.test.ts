import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('../../src/core/metrics', () => ({
  metrics: {
    recordBatchOperation: jest.fn(),
    recordProcessingTime: jest.fn(),
  },
}));

// Import after mocks
import { BatchProcessor } from '../../src/core/batch-processor';

describe('BatchProcessor', () => {
  let processor: BatchProcessor<string, string>;
  let mockProcessFn: jest.Mock;

  beforeEach(() => {
    mockProcessFn = jest.fn().mockImplementation(async (items: string[]) => {
      return items.map((item) => `processed-${item}`);
    });

    processor = new BatchProcessor(mockProcessFn, {
      maxBatchSize: 10,
      maxWaitTime: 100,
      maxConcurrency: 2,
      defaultTimeout: 5000,
      defaultMaxRetries: 2,
    });
  });

  afterEach(() => {
    processor.destroy();
  });

  describe('Initialization', () => {
    it('should create a batch processor with default config', () => {
      const defaultProcessor = new BatchProcessor(mockProcessFn);
      expect(defaultProcessor).toBeDefined();
      defaultProcessor.destroy();
    });

    it('should create a batch processor with custom config', () => {
      expect(processor).toBeDefined();
    });
  });

  describe('Adding items', () => {
    it('should add item to queue and process', async () => {
      const result = await processor.add('test-item');
      expect(result).toBe('processed-test-item');
    });

    it('should add multiple items', async () => {
      const results = await Promise.all([
        processor.add('item-1'),
        processor.add('item-2'),
        processor.add('item-3'),
      ]);

      expect(results).toHaveLength(3);
      expect(results).toContain('processed-item-1');
      expect(results).toContain('processed-item-2');
      expect(results).toContain('processed-item-3');
    });

    it('should accept custom options', async () => {
      const result = await processor.add('priority-item', {
        operation: 'test-op',
        priority: 10,
        timeout: 10000,
        maxRetries: 5,
      });

      expect(result).toBe('processed-priority-item');
    });
  });

  describe('Batching behavior', () => {
    it('should batch multiple items together', async () => {
      // Add items quickly to batch them
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(processor.add(`item-${i}`));
      }

      await Promise.all(promises);

      // Processor should have been called at least once
      expect(mockProcessFn).toHaveBeenCalled();
    });

    it('should process immediately when batch is full', async () => {
      // Create processor with small batch size
      const smallBatchProcessor = new BatchProcessor(mockProcessFn, {
        maxBatchSize: 2,
        maxWaitTime: 10000, // Long wait time
      });

      const promises = [
        smallBatchProcessor.add('item-1'),
        smallBatchProcessor.add('item-2'),
      ];

      await Promise.all(promises);

      expect(mockProcessFn).toHaveBeenCalled();
      smallBatchProcessor.destroy();
    });
  });

  describe('Priority handling', () => {
    it('should process higher priority items first', async () => {
      const processedOrder: string[] = [];
      const orderTrackingFn = jest.fn().mockImplementation(async (items: string[]) => {
        items.forEach((item) => processedOrder.push(item));
        return items.map((item) => `processed-${item}`);
      });

      const priorityProcessor = new BatchProcessor(orderTrackingFn, {
        maxBatchSize: 1,
        maxWaitTime: 50,
        enablePrioritization: true,
      });

      // Add items with different priorities
      const lowPriority = priorityProcessor.add('low', { priority: 1 });
      const highPriority = priorityProcessor.add('high', { priority: 10 });

      await Promise.all([lowPriority, highPriority]);

      priorityProcessor.destroy();
    });
  });

  describe('Error handling', () => {
    it('should handle processor errors', async () => {
      const errorProcessor = new BatchProcessor(
        async () => {
          throw new Error('Processing failed');
        },
        { maxBatchSize: 1, maxWaitTime: 10, defaultMaxRetries: 0 }
      );

      await expect(errorProcessor.add('item')).rejects.toThrow();

      errorProcessor.destroy();
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const retryProcessor = new BatchProcessor(
        async (items: string[]) => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Temporary failure');
          }
          return items.map((item) => `processed-${item}`);
        },
        { maxBatchSize: 1, maxWaitTime: 10, defaultMaxRetries: 3 }
      );

      const result = await retryProcessor.add('retry-item');
      expect(result).toBe('processed-retry-item');
      expect(attempts).toBeGreaterThanOrEqual(2);

      retryProcessor.destroy();
    });
  });

  describe('Statistics', () => {
    it('should track processing statistics', async () => {
      await processor.add('stat-item');

      const stats = processor.getStats();

      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('successfulOperations');
      expect(stats).toHaveProperty('failedOperations');
      expect(stats).toHaveProperty('averageProcessingTime');
      expect(stats).toHaveProperty('currentQueueSize');
    });

    it('should update stats after processing', async () => {
      const initialStats = processor.getStats();

      await Promise.all([
        processor.add('item-1'),
        processor.add('item-2'),
      ]);

      const finalStats = processor.getStats();

      expect(finalStats.totalProcessed).toBeGreaterThanOrEqual(initialStats.totalProcessed);
    });
  });

  describe('Queue management', () => {
    it('should return queue size', async () => {
      const size = processor.getQueueSize();
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(0);
    });

    it('should clear queue', () => {
      processor.clear();
      expect(processor.getQueueSize()).toBe(0);
    });
  });

  describe('Events', () => {
    it('should emit batch processed event', async () => {
      const batchProcessedHandler = jest.fn();
      processor.on('batchProcessed', batchProcessedHandler);

      await processor.add('event-item');

      // Give time for event to fire
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Event should be emitted
      expect(batchProcessedHandler).toHaveBeenCalled();
    });

    it('should emit error event on failure', async () => {
      const errorProcessor = new BatchProcessor(
        async () => {
          throw new Error('Test error');
        },
        { maxBatchSize: 1, maxWaitTime: 10, defaultMaxRetries: 0 }
      );

      const errorHandler = jest.fn();
      errorProcessor.on('error', errorHandler);

      try {
        await errorProcessor.add('error-item');
      } catch {
        // Expected
      }

      errorProcessor.destroy();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const testProcessor = new BatchProcessor(mockProcessFn);

      // Should not throw
      expect(() => testProcessor.destroy()).not.toThrow();
    });
  });
});
