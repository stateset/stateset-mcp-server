// Mock axios
jest.mock('axios', () => {
  const mockAxios = {
    create: jest.fn(),
    isAxiosError: jest.fn(),
  };
  return { __esModule: true, default: mockAxios, ...mockAxios };
});

// Mock the config
jest.mock('@config/index', () => ({
  config: {
    api: {
      key: 'test-api-key',
      baseUrl: 'https://api.stateset.io/v1',
      version: 'v1',
      timeout: 10000,
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
      environment: 'test',
      logLevel: 'error',
    },
    features: {
      caching: false,
      metrics: false,
      healthCheck: false,
      requestValidation: true,
      responseEnrichment: false,
      circuitBreaker: false,
      compression: false,
      openApiConverter: false,
      enableTelemetry: false,
      websocket: false,
    },
    cache: {
      enabled: false,
      ttl: 300,
      maxSize: 1000,
      strategy: 'lru',
    },
    circuitBreaker: {
      enabled: false,
      threshold: 5,
      timeout: 60000,
      resetTimeout: 30000,
    },
    monitoring: {
      enabled: false,
      metricsInterval: 60000,
      healthCheckInterval: 30000,
    },
  },
  isProduction: () => false,
  isDevelopment: () => false,
  isFeatureEnabled: () => false,
}));

// Mock core modules
jest.mock('../../src/core/cache', () => ({
  cacheManager: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, size: 0 }),
    registerWarmup: jest.fn(),
  },
}));

jest.mock('../../src/core/circuit-breaker', () => ({
  circuitBreakerManager: {
    execute: jest.fn((_key, fn) => fn()),
    getMetrics: jest.fn().mockReturnValue({}),
  },
}));

jest.mock('../../src/core/rate-limiter', () => ({
  Priority: {
    LOW: 0,
    NORMAL: 1,
    HIGH: 2,
    CRITICAL: 3,
  },
  rateLimiter: {
    execute: jest.fn((fn) => fn()),
    getMetrics: jest.fn().mockReturnValue({}),
  },
}));

jest.mock('../../src/core/metrics', () => ({
  metrics: {
    startTimer: jest.fn().mockReturnValue(() => {}),
    increment: jest.fn(),
    record: jest.fn(),
  },
}));

describe('StateSetClient', () => {
  let client: any;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock axios instance
    mockAxiosInstance = {
      request: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    // Re-require module after setting axios mock, since it instantiates a singleton on import
    jest.resetModules();
    const axiosMock = require('axios');
    const singletonAxiosInstance = {
      request: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };
    axiosMock.create
      .mockReturnValueOnce(singletonAxiosInstance as any)
      .mockReturnValue(mockAxiosInstance as any);
    const { StateSetClient } = require('../../src/services/stateset-client');
    client = new StateSetClient();
  });

  describe('Order Operations', () => {
    const validUUID = '123e4567-e89b-12d3-a456-426614174000';

    describe('createOrder', () => {
      it('should create an order successfully', async () => {
        const orderData = {
          customer_id: validUUID,
          items: [{ product_id: 'PROD-001', quantity: 2 }],
        };

        const mockResponse = {
          data: {
            id: 'ORD-001',
            status: 'pending',
            ...orderData,
          },
          headers: {
            'x-ratelimit-remaining': '999',
            'x-api-version': 'v1',
          },
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        const result = await client.createOrder(orderData);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/orders',
            data: orderData,
          })
        );
        expect(result).toHaveProperty('id', 'ORD-001');
      });

      it('should handle API errors gracefully', async () => {
        const orderData = {
          customer_id: validUUID,
          items: [{ product_id: 'PROD-001', quantity: 2 }],
        };

        mockAxiosInstance.request.mockRejectedValueOnce({
          response: {
            status: 400,
            data: { message: 'Invalid order data' },
          },
        });

        await expect(client.createOrder(orderData)).rejects.toBeDefined();
      });
    });

    describe('getOrder', () => {
      it('should retrieve an order by ID', async () => {
        const mockResponse = {
          data: {
            id: 'ORD-001',
            status: 'shipped',
            items: [],
          },
          headers: {
            'x-ratelimit-remaining': '999',
          },
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        const result = await client.getOrder('ORD-001');

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            url: '/orders/ORD-001',
          })
        );
        expect(result).toHaveProperty('id', 'ORD-001');
      });
    });

    describe('listOrders', () => {
      it('should list orders with pagination', async () => {
        const mockResponse = {
          data: [
            { id: 'ORD-001', status: 'pending' },
            { id: 'ORD-002', status: 'shipped' },
          ],
          headers: {},
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        const result = await client.listOrders({ page: 1, per_page: 10 });

        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('updateOrder', () => {
      it('should update an order', async () => {
        const updateData = {
          order_id: 'ORD-001',
          notes: 'Updated notes',
        };

        const mockResponse = {
          data: {
            id: 'ORD-001',
            notes: 'Updated notes',
          },
          headers: {},
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        const result = await client.updateOrder(updateData);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'PATCH',
            url: '/orders/ORD-001',
          })
        );
        expect(result.notes).toBe('Updated notes');
      });
    });

    describe('deleteOrder', () => {
      it('should delete an order', async () => {
        const mockResponse = {
          data: { success: true },
          headers: {},
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        await client.deleteOrder('ORD-001');

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'DELETE',
            url: '/orders/ORD-001',
          })
        );
      });
    });
  });

  describe('RMA Operations', () => {
    const validUUID = '123e4567-e89b-12d3-a456-426614174000';

    describe('createRMA', () => {
      it('should create an RMA successfully', async () => {
        const rmaData = {
          order_id: validUUID,
          reason: 'Product defective',
        };

        const mockResponse = {
          data: {
            id: 'RMA-001',
            status: 'pending',
            ...rmaData,
          },
          headers: {},
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        const result = await client.createRMA(rmaData);

        expect(result).toHaveProperty('id', 'RMA-001');
        expect(result).toHaveProperty('status', 'pending');
      });
    });

    describe('approveReturn', () => {
      it('should approve an RMA', async () => {
        const mockResponse = {
          data: {
            id: 'RMA-001',
            status: 'approved',
          },
          headers: {},
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        const result = await client.approveReturn('RMA-001');

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/returns/RMA-001/approve',
          })
        );
        expect(result.status).toBe('approved');
      });
    });

    describe('restockReturn', () => {
      it('should restock items from an RMA', async () => {
        const mockResponse = {
          data: {
            id: 'RMA-001',
            status: 'restocked',
          },
          headers: {},
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        await client.restockReturn('RMA-001');

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/returns/RMA-001/restock',
          })
        );
      });
    });
  });

  describe('Product Operations', () => {
    describe('createProduct', () => {
      it('should create a product', async () => {
        const productData = {
          name: 'Widget Pro',
          sku: 'WIDGET-001',
          price: 99.99,
        };

        const mockResponse = {
          data: {
            id: 'PROD-001',
            ...productData,
          },
          headers: {},
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        const result = await client.createProduct(productData);

        expect(result).toHaveProperty('id', 'PROD-001');
        expect(result).toHaveProperty('name', 'Widget Pro');
      });
    });

    describe('listProducts', () => {
      it('should list products', async () => {
        const mockResponse = {
          data: [
            { id: 'PROD-001', name: 'Widget A' },
            { id: 'PROD-002', name: 'Widget B' },
          ],
          headers: {},
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        const result = await client.listProducts({});

        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Customer Operations', () => {
    describe('createCustomer', () => {
      it('should create a customer', async () => {
        const customerData = {
          email: 'customer@example.com',
          name: 'John Doe',
          address: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            postal_code: '10001',
            country: 'US',
          },
        };

        const mockResponse = {
          data: {
            id: 'CUST-001',
            ...customerData,
          },
          headers: {},
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        const result = await client.createCustomer(customerData);

        expect(result).toHaveProperty('id', 'CUST-001');
        expect(result).toHaveProperty('email', 'customer@example.com');
      });
    });
  });

  describe('Inventory Operations', () => {
    describe('createInventory', () => {
      it('should create an inventory record', async () => {
        const inventoryData = {
          item_number: 'INV-001',
          location_id: 1,
          quantity_on_hand: 100,
        };

        const mockResponse = {
          data: {
            id: 'inventory-uuid',
            ...inventoryData,
          },
          headers: {},
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        const result = await client.createInventory(inventoryData);

        expect(result).toHaveProperty('quantity_on_hand', 100);
      });
    });

    describe('updateInventory', () => {
      it('should update inventory levels', async () => {
        const updateData = {
          inventory_id: 'inv-uuid',
          location_id: 1,
          on_hand: 50,
          reason: 'Stock adjustment',
        };

        const mockResponse = {
          data: {
            id: 'inv-uuid',
            on_hand: 50,
          },
          headers: {},
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        const result = await client.updateInventory(updateData);

        expect(result.on_hand).toBe(50);
      });
    });
  });

  describe('Shipment Operations', () => {
    describe('createShipment', () => {
      it('should create a shipment', async () => {
        const shipmentData = {
          order_id: '123e4567-e89b-12d3-a456-426614174000',
          shipping_address: '123 Main St',
          shipping_method: 'express',
          tracking_number: '1Z999AA1',
          recipient_name: 'John Doe',
        };

        const mockResponse = {
          data: {
            id: 'SHIP-001',
            status: 'pending',
            ...shipmentData,
          },
          headers: {},
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        const result = await client.createShipment(shipmentData);

        expect(result).toHaveProperty('id', 'SHIP-001');
        expect(result).toHaveProperty('tracking_number', '1Z999AA1');
      });
    });

    describe('markShipmentShipped', () => {
      it('should mark shipment as shipped', async () => {
        const mockResponse = {
          data: {
            id: 'SHIP-001',
            status: 'shipped',
          },
          headers: {},
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        const result = await client.markShipmentShipped('SHIP-001');

        expect(result.status).toBe('shipped');
      });
    });

    describe('markShipmentDelivered', () => {
      it('should mark shipment as delivered', async () => {
        const mockResponse = {
          data: {
            id: 'SHIP-001',
            status: 'delivered',
          },
          headers: {},
        };

        mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

        const result = await client.markShipmentDelivered('SHIP-001');

        expect(result.status).toBe('delivered');
      });
    });
  });

  // Error handling is covered in per-operation tests above.
});
