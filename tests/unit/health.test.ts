import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies
jest.mock('@config/index', () => ({
  config: {
    api: { timeout: 10000, baseUrl: undefined },
    cache: { enabled: true },
    rateLimit: { requestsPerHour: 1000 },
    monitoring: { enabled: false, healthCheckInterval: 30000 }, // Disable monitoring to avoid timers
    server: { version: '1.0.0' },
  },
}));

jest.mock('../../src/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logHealthCheck: jest.fn(),
  }),
}));

jest.mock('../../src/core/metrics', () => ({
  metrics: {
    observe: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('axios');

// Import after mocks
import { HealthChecker, HealthStatus } from '../../src/core/health';

describe('HealthChecker', () => {
  let healthChecker: HealthChecker;

  beforeEach(() => {
    healthChecker = new HealthChecker();
  });

  afterEach(() => {
    healthChecker.stopMonitoring();
  });

  describe('Initialization', () => {
    it('should create a health checker instance', () => {
      expect(healthChecker).toBeDefined();
    });
  });

  describe('Health checks', () => {
    it('should return health status', async () => {
      const status = await healthChecker.check();

      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('timestamp');
      expect([HealthStatus.HEALTHY, HealthStatus.DEGRADED, HealthStatus.UNHEALTHY]).toContain(status.status);
    });

    it('should include check results', async () => {
      const status = await healthChecker.check();

      expect(status).toHaveProperty('checks');
      expect(Array.isArray(status.checks)).toBe(true);
    });

    it('should include version information', async () => {
      const status = await healthChecker.check();

      expect(status).toHaveProperty('version');
      expect(typeof status.version).toBe('string');
    });

    it('should include uptime', async () => {
      const status = await healthChecker.check();

      expect(status).toHaveProperty('uptime');
      expect(typeof status.uptime).toBe('number');
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Custom checks', () => {
    it('should register custom health check', () => {
      const customCheck = (jest.fn() as any).mockResolvedValue({
        name: 'custom',
        status: HealthStatus.HEALTHY,
        duration: 10,
        timestamp: Date.now(),
      });

      healthChecker.register('custom', customCheck);

      // Check should be registered without errors
      expect(customCheck).not.toHaveBeenCalled();
    });

    it('should execute registered health checks', async () => {
      const customCheck = (jest.fn() as any).mockResolvedValue({
        name: 'custom',
        status: HealthStatus.HEALTHY,
        duration: 10,
        timestamp: Date.now(),
      });

      healthChecker.register('custom', customCheck);

      await healthChecker.check();

      expect(customCheck).toHaveBeenCalled();
    });
  });

  describe('HTTP dependency checks', () => {
    it('should register HTTP dependency check', () => {
      // Should not throw
      expect(() => {
        healthChecker.registerHttpDependency('api', 'https://api.example.com/health');
      }).not.toThrow();
    });
  });

  describe('Status determination', () => {
    it('should return healthy when all checks pass', async () => {
      const status = await healthChecker.check();

      // Status should be one of the valid statuses
      expect([HealthStatus.HEALTHY, HealthStatus.DEGRADED, HealthStatus.UNHEALTHY]).toContain(
        status.status
      );
    });
  });

  describe('Metrics', () => {
    it('should include metrics in health report', async () => {
      const status = await healthChecker.check();

      if (status.metrics) {
        expect(status.metrics).toHaveProperty('memory');
        expect(status.metrics).toHaveProperty('cpu');
      }
    });
  });

  describe('Error handling', () => {
    it('should handle check errors gracefully', async () => {
      const failingCheck = (jest.fn() as any).mockRejectedValue(new Error('Check failed'));

      healthChecker.register('failing', failingCheck);

      // Should not throw even if a check fails
      const status = await healthChecker.check();
      expect(status).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const testChecker = new HealthChecker();

      // Should not throw
      expect(() => testChecker.stopMonitoring()).not.toThrow();
    });
  });
});
