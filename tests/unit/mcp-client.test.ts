import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import axios from 'axios';

// Mock axios
jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: { headers: { common: {} } },
  };

  return {
    create: jest.fn(() => mockAxiosInstance),
    isAxiosError: jest.fn((error) => error && error.isAxiosError === true),
  };
});

// Mock other dependencies
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../src/core/server-rate-limiter', () => ({
  RateLimiter: jest.fn().mockImplementation(() => ({
    execute: jest.fn((fn) => fn()),
    getMetrics: jest.fn().mockReturnValue({ totalRequests: 0 }),
  })),
}));

jest.mock('../../src/config/timeouts', () => ({
  createOperationTimeoutConfig: jest.fn().mockReturnValue({
    getTimeout: jest.fn().mockReturnValue(10000),
  }),
  OperationType: {
    READ: 'read',
    WRITE: 'write',
    LIST: 'list',
    DELETE: 'delete',
    SEARCH: 'search',
  },
}));

jest.mock('../../src/core/circuit-breaker', () => ({
  CircuitBreaker: jest.fn().mockImplementation(() => ({
    execute: jest.fn((fn) => fn()),
    getState: jest.fn().mockReturnValue('closed'),
    getMetrics: jest.fn().mockReturnValue({}),
  })),
  CircuitState: { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half-open' },
}));

jest.mock('../../src/core/cache', () => ({
  cacheManager: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    getNamespaceStats: jest.fn().mockReturnValue({}),
  },
  CacheStats: {},
}));

// Import after mocks
import { StateSetMCPClient } from '../../src/services/mcp-client';
import { Config } from '../../src/types/mcp-api';

describe('StateSetMCPClient', () => {
  let client: StateSetMCPClient;
  let mockAxiosInstance: any;
  const mockConfig: Config = {
    apiKey: 'test-api-key',
    baseUrl: 'https://api.stateset.io/v1',
    requestsPerHour: 1000,
    timeoutMs: 10000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosInstance = (axios.create as jest.Mock)();
    client = new StateSetMCPClient(mockConfig);
  });

  describe('Initialization', () => {
    it('should create client with valid config', () => {
      expect(client).toBeDefined();
    });

    it('should throw error without API key', () => {
      expect(
        () =>
          new StateSetMCPClient({
            ...mockConfig,
            apiKey: '',
          })
      ).toThrow('API key is required');
    });

    it('should create axios instance with correct config', () => {
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: mockConfig.baseUrl,
          timeout: mockConfig.timeoutMs,
        })
      );
    });
  });

  describe('RMA Operations', () => {
    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({ data: { id: 'rma-123' } });
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 'rma-123' } });
      mockAxiosInstance.put.mockResolvedValue({ data: { id: 'rma-123' } });
      mockAxiosInstance.delete.mockResolvedValue({ data: { success: true } });
    });

    it('should create RMA', async () => {
      const result = await client.createRMA({
        order_id: 'order-123',
        reason: 'Defective product',
        condition: 'damaged',
        requested_action: 'refund',
        customer_email: 'test@example.com',
      });

      expect(result).toHaveProperty('id');
    });

    it('should get RMA by ID', async () => {
      const result = await client.getRMA('rma-123');
      expect(result).toHaveProperty('id');
    });

    it('should list RMAs', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [{ id: 'rma-123' }] });
      const result = await client.listRMAs({ page: 1, per_page: 10 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Order Operations', () => {
    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({ data: { id: 'order-123' } });
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 'order-123' } });
      mockAxiosInstance.put.mockResolvedValue({ data: { id: 'order-123' } });
      mockAxiosInstance.delete.mockResolvedValue({ data: { success: true } });
    });

    it('should create order', async () => {
      const result = await client.createOrder({
        customer_email: 'test@example.com',
        line_items: [{ product_id: 'prod-1', quantity: 1, unit_price: 100 }],
      });

      expect(result).toHaveProperty('id');
    });

    it('should get order by ID', async () => {
      const result = await client.getOrder('order-123');
      expect(result).toHaveProperty('id');
    });

    it('should list orders', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [{ id: 'order-123' }] });
      const result = await client.listOrders({ page: 1, per_page: 10 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Inventory Operations', () => {
    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({ data: { id: 'inv-123' } });
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 'inv-123' } });
      mockAxiosInstance.put.mockResolvedValue({ data: { id: 'inv-123' } });
    });

    it('should create inventory', async () => {
      const result = await client.createInventory({
        product_id: 'prod-123',
        quantity: 100,
        location: 'warehouse-1',
      });

      expect(result).toHaveProperty('id');
    });

    it('should update inventory', async () => {
      const result = await client.updateInventory({
        inventory_id: 'inv-123',
        quantity: 150,
      });

      expect(result).toHaveProperty('id');
    });

    it('should get inventory', async () => {
      const result = await client.getInventory('inv-123');
      expect(result).toHaveProperty('id');
    });
  });

  describe('Customer Operations', () => {
    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({ data: { id: 'cust-123' } });
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 'cust-123' } });
    });

    it('should create customer', async () => {
      const result = await client.createCustomer({
        email: 'customer@example.com',
        name: 'Test Customer',
      });

      expect(result).toHaveProperty('id');
    });

    it('should get customer', async () => {
      const result = await client.getCustomer('cust-123');
      expect(result).toHaveProperty('id');
    });
  });

  describe('Product Operations', () => {
    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({ data: { id: 'prod-123' } });
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 'prod-123' } });
    });

    it('should create product', async () => {
      const result = await client.createProduct({
        name: 'Test Product',
        sku: 'TEST-SKU-001',
        price: 99.99,
      });

      expect(result).toHaveProperty('id');
    });

    it('should list products', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [{ id: 'prod-123' }] });
      const result = await client.listProducts({ page: 1, per_page: 10 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Health and Metrics', () => {
    it('should get API metrics', () => {
      const metrics = client.getApiMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalRequests');
    });

    it('should get cache stats', () => {
      const stats = client.getCacheStats();
      expect(stats).toBeDefined();
    });

    it('should check health', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { status: 'healthy' } });

      const health = await client.healthCheck({ include_details: true });
      expect(health).toBeDefined();
      expect(health).toHaveProperty('status');
    });
  });

  describe('Cache Operations', () => {
    it('should clear cache', () => {
      const { cacheManager } = require('../../src/core/cache');

      client.clearCache();

      expect(cacheManager.clear).toHaveBeenCalled();
    });

    it('should clear specific namespace cache', () => {
      const { cacheManager } = require('../../src/core/cache');

      client.clearCache('orders');

      expect(cacheManager.clear).toHaveBeenCalledWith('orders');
    });
  });

  describe('Error handling', () => {
    it('should handle API errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: { message: 'Not found' },
        },
        message: 'Request failed with status code 404',
      };

      mockAxiosInstance.get.mockRejectedValue(axiosError);

      await expect(client.getOrder('nonexistent')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      await expect(client.getOrder('order-123')).rejects.toThrow();
    });
  });
});
