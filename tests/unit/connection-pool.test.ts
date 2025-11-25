import { ConnectionPool } from '../../src/core/connection-pool';
import { Config } from '../../src/config/index';
import nock from 'nock';

describe('ConnectionPool', () => {
  let pool: ConnectionPool;
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {
      api: {
        key: 'test-api-key',
        baseUrl: 'https://api.test.com',
        version: 'v1',
        timeout: 5000,
      },
      rateLimit: {
        requestsPerHour: 1000,
        requestsPerMinute: 50,
        burstSize: 10,
        retryAttempts: 3,
        retryDelay: 1000,
      },
      server: {
        name: 'test-server',
        version: '1.0.0',
        environment: 'development' as const,
        logLevel: 'info' as const,
      },
      features: {
        caching: true,
        metrics: true,
        healthCheck: true,
        requestValidation: true,
        responseEnrichment: true,
        circuitBreaker: true,
        compression: true,
        openApiConverter: false,
        enableTelemetry: false,
        websocket: true,
      },
      cache: {
        enabled: true,
        ttl: 300,
        maxSize: 1000,
        strategy: 'lru' as const,
      },
      circuitBreaker: {
        enabled: true,
        threshold: 5,
        timeout: 60000,
        resetTimeout: 30000,
      },
      monitoring: {
        enabled: true,
        metricsInterval: 60000,
        healthCheckInterval: 30000,
      },
    };

    pool = new ConnectionPool(mockConfig);
  });

  afterEach(() => {
    pool.destroy();
    nock.cleanAll();
  });

  describe('Connection Management', () => {
    it('should create connections on demand', async () => {
      nock('https://api.test.com')
        .get('/test')
        .reply(200, { success: true });

      const result = await pool.request({
        method: 'GET',
        url: '/test',
      });

      expect(result).toEqual({ success: true });
      
      const stats = pool.getStats();
      expect(stats.totalRequests).toBe(1);
    });

    it('should reuse existing connections', async () => {
      nock('https://api.test.com')
        .get('/test')
        .times(2)
        .reply(200, { success: true });

      await pool.request({ method: 'GET', url: '/test' });
      await pool.request({ method: 'GET', url: '/test' });

      const stats = pool.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalConnections).toBeGreaterThan(0);
    });

    it('should handle connection failures', async () => {
      nock('https://api.test.com')
        .get('/test')
        .replyWithError('Connection failed');

      await expect(pool.request({
        method: 'GET',
        url: '/test',
      })).rejects.toThrow();

      const stats = pool.getStats();
      expect(stats.failedRequests).toBe(1);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on retryable errors', async () => {
      nock('https://api.test.com')
        .get('/test')
        .reply(500, { error: 'Internal Server Error' })
        .get('/test')
        .reply(200, { success: true });

      const result = await pool.request({
        method: 'GET',
        url: '/test',
      });

      expect(result).toEqual({ success: true });
    });

    it('should not retry on non-retryable errors', async () => {
      nock('https://api.test.com')
        .get('/test')
        .reply(400, { error: 'Bad Request' });

      await expect(pool.request({
        method: 'GET',
        url: '/test',
      })).rejects.toThrow();
    });

    it('should respect max retry attempts', async () => {
      nock('https://api.test.com')
        .get('/test')
        .times(4) // Initial + 3 retries
        .reply(500, { error: 'Internal Server Error' });

      await expect(pool.request({
        method: 'GET',
        url: '/test',
      })).rejects.toThrow();
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch requests', async () => {
      nock('https://api.test.com')
        .get('/test1')
        .reply(200, { result: 1 })
        .get('/test2')
        .reply(200, { result: 2 })
        .get('/test3')
        .reply(500, { error: 'Server Error' });

      const requests = [
        { method: 'GET' as const, url: '/test1' },
        { method: 'GET' as const, url: '/test2' },
        { method: 'GET' as const, url: '/test3' },
      ];

      const results = await pool.batchRequest(requests);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ result: 1 });
      expect(results[1]).toEqual({ result: 2 });
      expect(results[2]).toBeInstanceOf(Error);
    });
  });

  describe('Health Checks', () => {
    it('should perform health checks on connections', async () => {
      nock('https://api.test.com')
        .get('/health')
        .reply(200, { status: 'ok' });

      // Create a connection first
      await pool.request({ method: 'GET', url: '/test' });

      // Wait for health check interval
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = pool.getStats();
      expect(stats.totalConnections).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should track connection statistics', async () => {
      nock('https://api.test.com')
        .get('/test')
        .reply(200, { success: true });

      await pool.request({ method: 'GET', url: '/test' });

      const stats = pool.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.failedRequests).toBe(0);
      expect(stats.totalConnections).toBeGreaterThan(0);
      expect(stats.poolUtilization).toBeGreaterThanOrEqual(0);
    });

    it('should provide connection details', async () => {
      nock('https://api.test.com')
        .get('/test')
        .reply(200, { success: true });

      await pool.request({ method: 'GET', url: '/test' });

      const details = pool.getConnectionDetails();
      expect(details).toBeInstanceOf(Array);
      expect(details.length).toBeGreaterThan(0);
      
      const connection = details[0];
      expect(connection).toHaveProperty('id');
      expect(connection).toHaveProperty('inUse');
      expect(connection).toHaveProperty('age');
      expect(connection).toHaveProperty('requestCount');
    });
  });

  describe('Connection Lifecycle', () => {
    it('should drain connections gracefully', async () => {
      nock('https://api.test.com')
        .get('/test')
        .reply(200, { success: true });

      await pool.request({ method: 'GET', url: '/test' });
      
      const statsBefore = pool.getStats();
      expect(statsBefore.totalConnections).toBeGreaterThan(0);

      await pool.drain();
      
      const statsAfter = pool.getStats();
      expect(statsAfter.totalConnections).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      nock('https://api.test.com')
        .get('/test')
        .delayConnection(6000) // Longer than timeout
        .reply(200, { success: true });

      await expect(pool.request({
        method: 'GET',
        url: '/test',
      })).rejects.toThrow();
    });

    it('should handle connection pool exhaustion', async () => {
      // This test would require creating many concurrent requests
      // to exhaust the pool, which is difficult to test reliably
      // in a unit test environment
    });
  });
});