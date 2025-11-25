import { CircuitBreaker, CircuitState } from '../../src/core/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker('test-circuit', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      resetTimeout: 100,
      volumeThreshold: 3,
    });
  });

  afterEach(() => {
    circuitBreaker.reset();
  });

  describe('initial state', () => {
    it('should start in closed state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should have zero metrics initially', () => {
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
      expect(metrics.totalRequests).toBe(0);
    });
  });

  describe('successful requests', () => {
    it('should remain closed on successful requests', async () => {
      const result = await circuitBreaker.execute(async () => 'success');

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should track successful requests in metrics', async () => {
      await circuitBreaker.execute(async () => 'success');

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successes).toBe(1);
      expect(metrics.totalRequests).toBe(1);
    });
  });

  describe('failed requests', () => {
    it('should track failed requests in metrics', async () => {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Test error');
        });
      } catch {
        // Expected
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failures).toBe(1);
      expect(metrics.consecutiveFailures).toBe(1);
    });

    it('should open circuit after threshold failures', async () => {
      // Need to exceed volume threshold first
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Test error');
          });
        } catch {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('circuit open state', () => {
    beforeEach(async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Test error');
          });
        } catch {
          // Expected
        }
      }
    });

    it('should reject requests when open', async () => {
      await expect(
        circuitBreaker.execute(async () => 'success')
      ).rejects.toThrow(/Circuit breaker is open/);
    });
  });

  describe('circuit recovery', () => {
    it('should transition to half-open after reset timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Test error');
          });
        } catch {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next request should transition to half-open
      try {
        await circuitBreaker.execute(async () => 'success');
      } catch {
        // Might still fail depending on timing
      }

      // Should be either half-open or closed now
      const state = circuitBreaker.getState();
      expect([CircuitState.HALF_OPEN, CircuitState.CLOSED]).toContain(state);
    });
  });

  describe('manual controls', () => {
    it('should allow manual reset', () => {
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      circuitBreaker.reset();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should allow force open', () => {
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should allow force closed', () => {
      circuitBreaker.forceOpen();
      circuitBreaker.forceClosed();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('metrics', () => {
    it('should calculate failure rate correctly', async () => {
      // 2 successes
      await circuitBreaker.execute(async () => 'success');
      await circuitBreaker.execute(async () => 'success');

      // 1 failure
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Test error');
        });
      } catch {
        // Expected
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.failureRate).toBeCloseTo(1 / 3, 2);
    });
  });
});
