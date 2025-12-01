import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock config before importing rate-limiter
jest.mock('../../src/config', () => ({
  config: {
    rateLimit: {
      requestsPerHour: 1000,
      requestsPerMinute: 100,
      burstSize: 50,
      retryAttempts: 3,
      retryDelay: 100,
    },
  },
}));

jest.mock('../../src/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logRateLimit: jest.fn(),
    startTimer: jest.fn(() => jest.fn()),
  }),
}));

// Import after mocks are set up
import { RateLimiter, Priority, Strategy } from '../../src/core/rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  afterEach(() => {
    if (rateLimiter) {
      rateLimiter.destroy();
    }
  });

  describe('Token Bucket Strategy', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter(Strategy.TOKEN_BUCKET);
    });

    it('should allow requests within burst limit', async () => {
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(
          await rateLimiter.execute(async () => `result-${i}`, 'test', Priority.NORMAL)
        );
      }

      expect(results).toHaveLength(5);
      expect(results[0]).toBe('result-0');
    });

    it('should execute function and return result', async () => {
      const result = await rateLimiter.execute(
        async () => 'success',
        'test-operation',
        Priority.NORMAL
      );

      expect(result).toBe('success');
    });

    it('should return metrics', () => {
      const metrics = rateLimiter.getMetrics();

      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('acceptedRequests');
      expect(metrics).toHaveProperty('rejectedRequests');
      expect(metrics).toHaveProperty('availableTokens');
    });
  });

  describe('Sliding Window Strategy', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter(Strategy.SLIDING_WINDOW);
    });

    it('should allow requests within window limit', async () => {
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(
          await rateLimiter.execute(async () => `result-${i}`, 'test', Priority.NORMAL)
        );
      }

      expect(results).toHaveLength(5);
    });

    it('should get metrics for sliding window', () => {
      const metrics = rateLimiter.getMetrics();

      expect(metrics).toHaveProperty('totalRequests');
      expect(typeof metrics.totalRequests).toBe('number');
    });
  });

  describe('Adaptive Strategy', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter(Strategy.ADAPTIVE);
    });

    it('should execute requests', async () => {
      const result = await rateLimiter.execute(
        async () => 'success',
        'test',
        Priority.NORMAL
      );

      expect(result).toBe('success');
    });

    it('should return metrics', () => {
      const metrics = rateLimiter.getMetrics();
      expect(metrics.acceptedRequests).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Priority levels', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter(Strategy.TOKEN_BUCKET);
    });

    it('should process CRITICAL priority', async () => {
      const result = await rateLimiter.execute(
        async () => 'critical',
        'critical-op',
        Priority.CRITICAL
      );

      expect(result).toBe('critical');
    });

    it('should handle all priority levels', async () => {
      const priorities = [Priority.LOW, Priority.NORMAL, Priority.HIGH, Priority.CRITICAL];

      for (const priority of priorities) {
        const result = await rateLimiter.execute(
          async () => priority,
          'test',
          priority
        );
        expect(result).toBe(priority);
      }
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter(Strategy.TOKEN_BUCKET);
    });

    it('should propagate errors from executed function', async () => {
      await expect(
        rateLimiter.execute(
          async () => {
            throw new Error('Test error');
          },
          'test',
          Priority.NORMAL,
          0 // No retries
        )
      ).rejects.toThrow('Test error');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      rateLimiter = new RateLimiter(Strategy.TOKEN_BUCKET);

      // Should not throw
      expect(() => rateLimiter.destroy()).not.toThrow();
    });
  });

  describe('Default strategy', () => {
    it('should use TOKEN_BUCKET by default', () => {
      rateLimiter = new RateLimiter();
      expect(rateLimiter).toBeDefined();
    });
  });
});

describe('Priority enum', () => {
  it('should have correct priority values', () => {
    expect(Priority.LOW).toBe(0);
    expect(Priority.NORMAL).toBe(1);
    expect(Priority.HIGH).toBe(2);
    expect(Priority.CRITICAL).toBe(3);
  });
});

describe('Strategy enum', () => {
  it('should have correct strategy values', () => {
    expect(Strategy.TOKEN_BUCKET).toBe('token_bucket');
    expect(Strategy.SLIDING_WINDOW).toBe('sliding_window');
    expect(Strategy.ADAPTIVE).toBe('adaptive');
  });
});
