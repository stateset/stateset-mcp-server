import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { config } from '@config/index';
import { createLogger } from '@utils/logger';
import { cacheManager } from '@core/cache';
import { rateLimiter, Priority } from '@core/rate-limiter';
import { circuitBreakerManager } from '@core/circuit-breaker';
import { metrics, recordApiCall } from '@core/metrics';
import { z } from 'zod';

const logger = createLogger('stateset-client');

// Extend axios config to include metadata
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: {
    startTime: number;
    requestId: string;
  };
}

// Response enrichment
interface EnrichedResponse<T> {
  data: T;
  metadata: {
    requestId: string;
    timestamp: number;
    duration: number;
    cached: boolean;
    rateLimitRemaining?: number;
    apiVersion: string;
  };
}

// Request context
interface RequestContext {
  requestId: string;
  operation: string;
  priority?: Priority;
  skipCache?: boolean;
  timeout?: number;
}

// API Error class
export class StateSetApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any,
    public requestId?: string
  ) {
    super(message);
    this.name = 'StateSetApiError';
  }
}

// Base response interface
interface StateSetResponse {
  id: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

// Response with metadata
interface ResponseWithMetadata<T> extends StateSetResponse {
  _metadata?: {
    requestId: string;
    duration: number;
    timestamp: number;
  };
}

export class StateSetClient {
  private readonly apiClient: AxiosInstance;
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.api.baseUrl;
    
    // Create axios instance with interceptors
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: config.api.timeout,
      headers: {
        'Authorization': `Bearer ${config.api.key}`,
        'Content-Type': 'application/json',
        'X-API-Version': config.api.version,
        'User-Agent': `${config.server.name}/${config.server.version}`,
      },
    });

    // Request interceptor
    this.apiClient.interceptors.request.use(
      (request: InternalAxiosRequestConfig) => {
        const requestId = this.generateRequestId();
        request.headers['X-Request-ID'] = requestId;
        (request as ExtendedAxiosRequestConfig).metadata = { startTime: Date.now(), requestId };
        
        logger.logApiRequest(
          request.method?.toUpperCase() || 'GET',
          request.url || '',
          request.params
        );
        
        return request;
      },
      (error) => {
        logger.error('Request interceptor error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.apiClient.interceptors.response.use(
      (response) => {
        const extendedConfig = response.config as ExtendedAxiosRequestConfig;
        const duration = Date.now() - (extendedConfig.metadata?.startTime || Date.now());
        const requestId = extendedConfig.metadata?.requestId;
        
        logger.logApiResponse(
          response.config.method?.toUpperCase() || 'GET',
          response.config.url || '',
          response.status,
          duration
        );
        
        recordApiCall(
          response.config.method?.toUpperCase() || 'GET',
          response.config.url || '',
          response.status,
          duration
        );
        
        // Add metadata to response
        if (response.data && typeof response.data === 'object') {
          response.data._metadata = {
            requestId,
            duration,
            timestamp: Date.now(),
          };
        }
        
        return response;
      },
      (error: AxiosError) => {
        const extendedConfig = error.config as ExtendedAxiosRequestConfig | undefined;
        const duration = Date.now() - (extendedConfig?.metadata?.startTime || Date.now());
        const requestId = extendedConfig?.metadata?.requestId;
        
        logger.logApiError(
          error.config?.method?.toUpperCase() || 'GET',
          error.config?.url || '',
          error,
          duration
        );
        
        recordApiCall(
          error.config?.method?.toUpperCase() || 'GET',
          error.config?.url || '',
          error.response?.status || 0,
          duration
        );
        
        throw new StateSetApiError(
          error.message,
          error.response?.status,
          error.response?.data,
          requestId
        );
      }
    );

    // Warm up caches
    this.setupCacheWarming();
  }

  // Generic request method with all features
  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    context: RequestContext = { requestId: this.generateRequestId(), operation: 'unknown' }
  ): Promise<EnrichedResponse<T>> {
    const cacheKey = this.getCacheKey(method, endpoint, data);
    const requestLogger = logger.child({ requestId: context.requestId, operation: context.operation });

    // Try cache first for GET requests
    if (method === 'GET' && !context.skipCache) {
      const cached = await cacheManager.get<T>('api-responses', cacheKey);
      if (cached) {
        requestLogger.debug('Cache hit', { endpoint });
        return {
          data: cached,
          metadata: {
            requestId: context.requestId,
            timestamp: Date.now(),
            duration: 0,
            cached: true,
            apiVersion: config.api.version,
          },
        };
      }
    }

    // Execute request with rate limiting and circuit breaker
    const executeRequest = async () => {
      const timer = metrics.startTimer('api_request_duration', { method, endpoint });
      
      try {
        const response = await this.apiClient.request<T>({
          method,
          url: endpoint,
          data,
          timeout: context.timeout || config.api.timeout,
        });
        
        timer();
        
        // Cache successful GET responses
        if (method === 'GET' && response.data) {
          await cacheManager.set('api-responses', cacheKey, response.data, 300000); // 5 min TTL
        }
        
        // Add metadata if response is an object
        if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
          (response.data as any)._metadata = {
            requestId: context.requestId,
            duration: 0,
            timestamp: Date.now(),
          };
        }
        
        return {
          data: response.data,
          metadata: {
            requestId: context.requestId,
            timestamp: Date.now(),
            duration: (response.data as any)?._metadata?.duration || 0,
            cached: false,
            rateLimitRemaining: parseInt(response.headers['x-ratelimit-remaining'] || '0'),
            apiVersion: response.headers['x-api-version'] || config.api.version,
          },
        };
      } catch (error) {
        timer();
        throw error;
      }
    };

    // Apply rate limiting
    const rateLimitedRequest = () => rateLimiter.execute(
      executeRequest,
      context.operation,
      context.priority
    );

    // Apply circuit breaker
    return circuitBreakerManager.execute(
      `api.${endpoint}`,
      rateLimitedRequest,
      {
        errorFilter: (error) => {
          // Don't trip circuit breaker for client errors
          if (error instanceof StateSetApiError) {
            return !error.statusCode || error.statusCode >= 500;
          }
          return true;
        },
      }
    );
  }

  // Helper methods
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCacheKey(method: string, endpoint: string, data?: any): string {
    const dataStr = data ? JSON.stringify(data) : '';
    return `${method}:${endpoint}:${dataStr}`;
  }

  private setupCacheWarming(): void {
    // Register cache warming functions
    cacheManager.registerWarmup('api-responses', async () => {
      logger.info('Warming API response cache');
      
      // Warm up common endpoints
      try {
        await this.listOrders({ page: 1, per_page: 10 });
        await this.listRMAs({ page: 1, per_page: 10 });
        await this.listProducts({ page: 1, per_page: 10 });
      } catch (error) {
        logger.error('Cache warming failed', error);
      }
    });
  }

  // API Methods with enhanced features

  async createOrder(args: any): Promise<StateSetResponse> {
    // Apply caching and circuit breaker manually
    const cacheKey = `createOrder:${JSON.stringify(args)}`;
    
    const executeCreate = async () => {
      const response = await this.request<StateSetResponse>(
        'POST',
        '/orders',
        args,
        { requestId: this.generateRequestId(), operation: 'createOrder', priority: Priority.HIGH }
      );
      
      const result = {
        ...response.data,
        url: `${this.baseUrl}/dashboard/orders/${response.data.id}`,
      };
      
      // Cache the result
      await cacheManager.set('orders', cacheKey, result, 300000);
      
      return result;
    };
    
    // Check cache first
    const cached = await cacheManager.get<StateSetResponse>('orders', cacheKey);
    if (cached) return cached;
    
    // Execute with circuit breaker
    return circuitBreakerManager.execute('orders.create', executeCreate);
  }

  async updateOrder(args: any): Promise<StateSetResponse> {
    const { order_id, ...data } = args;
    const response = await this.request<StateSetResponse>(
      'PATCH',
      `/orders/${order_id}`,
      data,
      { requestId: this.generateRequestId(), operation: 'updateOrder', priority: Priority.NORMAL }
    );
    
    return response.data;
  }

  async getOrder(orderId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'GET',
      `/orders/${orderId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'getOrder', priority: Priority.NORMAL }
    );
    
    return response.data;
  }

  async listOrders(args: { page?: number; per_page?: number } = {}): Promise<StateSetResponse[]> {
    const response = await this.request<StateSetResponse[]>(
      'GET',
      '/orders',
      args,
      { requestId: this.generateRequestId(), operation: 'listOrders', priority: Priority.LOW }
    );
    
    return response.data;
  }

  async createRMA(args: any): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'POST',
      '/rmas',
      args,
      { requestId: this.generateRequestId(), operation: 'createRMA', priority: Priority.HIGH }
    );
    
    return {
      ...response.data,
      url: `${this.baseUrl}/dashboard/rmas/${response.data.id}`,
    };
  }

  async updateRMA(args: any): Promise<StateSetResponse> {
    const { rma_id, ...data } = args;
    const response = await this.request<StateSetResponse>(
      'PATCH',
      `/rmas/${rma_id}`,
      data,
      { requestId: this.generateRequestId(), operation: 'updateRMA', priority: Priority.NORMAL }
    );
    
    return response.data;
  }

  async getRMA(rmaId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'GET',
      `/rmas/${rmaId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'getRMA', priority: Priority.NORMAL }
    );
    
    return response.data;
  }

  async listRMAs(args: { page?: number; per_page?: number } = {}): Promise<StateSetResponse[]> {
    const response = await this.request<StateSetResponse[]>(
      'GET',
      '/rmas',
      args,
      { requestId: this.generateRequestId(), operation: 'listRMAs', priority: Priority.LOW }
    );
    
    return response.data;
  }

  async createProduct(args: any): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'POST',
      '/products',
      args,
      { requestId: this.generateRequestId(), operation: 'createProduct', priority: Priority.NORMAL }
    );
    
    return response.data;
  }

  async updateProduct(args: any): Promise<StateSetResponse> {
    const { product_id, ...data } = args;
    const response = await this.request<StateSetResponse>(
      'PATCH',
      `/products/${product_id}`,
      data,
      { requestId: this.generateRequestId(), operation: 'updateProduct', priority: Priority.NORMAL }
    );
    
    return response.data;
  }

  async getProduct(productId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'GET',
      `/products/${productId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'getProduct', priority: Priority.NORMAL }
    );
    
    return response.data;
  }

  async listProducts(args: { page?: number; per_page?: number } = {}): Promise<StateSetResponse[]> {
    const response = await this.request<StateSetResponse[]>(
      'GET',
      '/products',
      args,
      { requestId: this.generateRequestId(), operation: 'listProducts', priority: Priority.LOW }
    );
    
    return response.data;
  }

  // Batch operations
  async batchCreate<T>(
    resource: string,
    items: T[],
    options: { batchSize?: number; concurrency?: number } = {}
  ): Promise<StateSetResponse[]> {
    const { batchSize = 10, concurrency = 3 } = options;
    const results: StateSetResponse[] = [];
    
    logger.info('Starting batch create operation', {
      resource,
      totalItems: items.length,
      batchSize,
      concurrency,
    });
    
    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map((item, index) =>
        this.request<StateSetResponse>(
          'POST',
          `/${resource}`,
          item,
          {
            requestId: this.generateRequestId(),
            operation: `batchCreate${resource}`,
            priority: Priority.NORMAL,
          }
        ).then(r => r.data).catch(error => {
          logger.error('Batch item failed', error, { index: i + index });
          return null;
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null) as StateSetResponse[]);
      
      // Add delay between batches to avoid overwhelming the API
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    logger.info('Batch create operation completed', {
      resource,
      successCount: results.length,
      failureCount: items.length - results.length,
    });
    
    return results;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; version: string }> {
    const response = await this.request<{ status: string; version: string }>(
      'GET',
      '/health',
      undefined,
      {
        requestId: this.generateRequestId(),
        operation: 'healthCheck',
        priority: Priority.CRITICAL,
        skipCache: true,
      }
    );
    
    return response.data;
  }

  // Get client metrics
  getMetrics() {
    return {
      cache: cacheManager.getStats('api-responses'),
      rateLimit: rateLimiter.getMetrics(),
      circuitBreaker: circuitBreakerManager.getMetrics(),
    };
  }

  // Add all missing methods

  // Delete methods
  async deleteRMA(rmaId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'DELETE',
      `/rmas/${rmaId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'deleteRMA', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async deleteOrder(orderId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'DELETE',
      `/orders/${orderId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'deleteOrder', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async deleteProduct(productId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'DELETE',
      `/products/${productId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'deleteProduct', priority: Priority.NORMAL }
    );
    return response.data;
  }

  // Customer methods
  async createCustomer(args: any): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'POST',
      '/customers',
      args,
      { requestId: this.generateRequestId(), operation: 'createCustomer', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async updateCustomer(args: any): Promise<StateSetResponse> {
    const { customer_id, ...data } = args;
    const response = await this.request<StateSetResponse>(
      'PATCH',
      `/customers/${customer_id}`,
      data,
      { requestId: this.generateRequestId(), operation: 'updateCustomer', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async deleteCustomer(customerId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'DELETE',
      `/customers/${customerId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'deleteCustomer', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async getCustomer(customerId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'GET',
      `/customers/${customerId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'getCustomer', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async listCustomers(args: { page?: number; per_page?: number } = {}): Promise<StateSetResponse[]> {
    const response = await this.request<StateSetResponse[]>(
      'GET',
      '/customers',
      args,
      { requestId: this.generateRequestId(), operation: 'listCustomers', priority: Priority.LOW }
    );
    return response.data;
  }

  // Inventory methods
  async createInventory(args: any): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'POST',
      '/inventory',
      args,
      { requestId: this.generateRequestId(), operation: 'createInventory', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async updateInventory(args: any): Promise<StateSetResponse> {
    const { inventory_id, ...data } = args;
    const response = await this.request<StateSetResponse>(
      'PATCH',
      `/inventory/${inventory_id}`,
      data,
      { requestId: this.generateRequestId(), operation: 'updateInventory', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async deleteInventory(inventoryId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'DELETE',
      `/inventory/${inventoryId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'deleteInventory', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async getInventory(inventoryId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'GET',
      `/inventory/${inventoryId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'getInventory', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async listInventories(args: { page?: number; per_page?: number } = {}): Promise<StateSetResponse[]> {
    const response = await this.request<StateSetResponse[]>(
      'GET',
      '/inventory',
      args,
      { requestId: this.generateRequestId(), operation: 'listInventories', priority: Priority.LOW }
    );
    return response.data;
  }

  // Warranty methods
  async createWarranty(args: any): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'POST',
      '/warranties',
      args,
      { requestId: this.generateRequestId(), operation: 'createWarranty', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async updateWarranty(args: any): Promise<StateSetResponse> {
    const { warranty_id, ...data } = args;
    const response = await this.request<StateSetResponse>(
      'PATCH',
      `/warranties/${warranty_id}`,
      data,
      { requestId: this.generateRequestId(), operation: 'updateWarranty', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async deleteWarranty(warrantyId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'DELETE',
      `/warranties/${warrantyId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'deleteWarranty', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async getWarranty(warrantyId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'GET',
      `/warranties/${warrantyId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'getWarranty', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async listWarranties(args: { page?: number; per_page?: number } = {}): Promise<StateSetResponse[]> {
    const response = await this.request<StateSetResponse[]>(
      'GET',
      '/warranties',
      args,
      { requestId: this.generateRequestId(), operation: 'listWarranties', priority: Priority.LOW }
    );
    return response.data;
  }

  // Shipment methods
  async createShipment(args: any): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'POST',
      '/shipments',
      args,
      { requestId: this.generateRequestId(), operation: 'createShipment', priority: Priority.HIGH }
    );
    return response.data;
  }

  async updateShipment(args: any): Promise<StateSetResponse> {
    const { shipment_id, ...data } = args;
    const response = await this.request<StateSetResponse>(
      'PATCH',
      `/shipments/${shipment_id}`,
      data,
      { requestId: this.generateRequestId(), operation: 'updateShipment', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async deleteShipment(shipmentId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'DELETE',
      `/shipments/${shipmentId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'deleteShipment', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async getShipment(shipmentId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'GET',
      `/shipments/${shipmentId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'getShipment', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async listShipments(args: { page?: number; per_page?: number } = {}): Promise<StateSetResponse[]> {
    const response = await this.request<StateSetResponse[]>(
      'GET',
      '/shipments',
      args,
      { requestId: this.generateRequestId(), operation: 'listShipments', priority: Priority.LOW }
    );
    return response.data;
  }

  // Sales Order methods
  async createSalesOrder(args: any): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'POST',
      '/sales-orders',
      args,
      { requestId: this.generateRequestId(), operation: 'createSalesOrder', priority: Priority.HIGH }
    );
    return response.data;
  }

  async updateSalesOrder(args: any): Promise<StateSetResponse> {
    const { sales_order_id, ...data } = args;
    const response = await this.request<StateSetResponse>(
      'PATCH',
      `/sales-orders/${sales_order_id}`,
      data,
      { requestId: this.generateRequestId(), operation: 'updateSalesOrder', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async deleteSalesOrder(salesOrderId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'DELETE',
      `/sales-orders/${salesOrderId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'deleteSalesOrder', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async getSalesOrder(salesOrderId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'GET',
      `/sales-orders/${salesOrderId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'getSalesOrder', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async listSalesOrders(args: { page?: number; per_page?: number } = {}): Promise<StateSetResponse[]> {
    const response = await this.request<StateSetResponse[]>(
      'GET',
      '/sales-orders',
      args,
      { requestId: this.generateRequestId(), operation: 'listSalesOrders', priority: Priority.LOW }
    );
    return response.data;
  }

  // Purchase Order methods
  async createPurchaseOrder(args: any): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'POST',
      '/purchase-orders',
      args,
      { requestId: this.generateRequestId(), operation: 'createPurchaseOrder', priority: Priority.HIGH }
    );
    return response.data;
  }

  async updatePurchaseOrder(args: any): Promise<StateSetResponse> {
    const { purchase_order_id, ...data } = args;
    const response = await this.request<StateSetResponse>(
      'PATCH',
      `/purchase-orders/${purchase_order_id}`,
      data,
      { requestId: this.generateRequestId(), operation: 'updatePurchaseOrder', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async deletePurchaseOrder(purchaseOrderId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'DELETE',
      `/purchase-orders/${purchaseOrderId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'deletePurchaseOrder', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async getPurchaseOrder(purchaseOrderId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'GET',
      `/purchase-orders/${purchaseOrderId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'getPurchaseOrder', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async listPurchaseOrders(args: { page?: number; per_page?: number } = {}): Promise<StateSetResponse[]> {
    const response = await this.request<StateSetResponse[]>(
      'GET',
      '/purchase-orders',
      args,
      { requestId: this.generateRequestId(), operation: 'listPurchaseOrders', priority: Priority.LOW }
    );
    return response.data;
  }

  // Invoice methods
  async createInvoice(args: any): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'POST',
      '/invoices',
      args,
      { requestId: this.generateRequestId(), operation: 'createInvoice', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async updateInvoice(args: any): Promise<StateSetResponse> {
    const { invoice_id, ...data } = args;
    const response = await this.request<StateSetResponse>(
      'PATCH',
      `/invoices/${invoice_id}`,
      data,
      { requestId: this.generateRequestId(), operation: 'updateInvoice', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async deleteInvoice(invoiceId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'DELETE',
      `/invoices/${invoiceId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'deleteInvoice', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async getInvoice(invoiceId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'GET',
      `/invoices/${invoiceId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'getInvoice', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async listInvoices(args: { page?: number; per_page?: number } = {}): Promise<StateSetResponse[]> {
    const response = await this.request<StateSetResponse[]>(
      'GET',
      '/invoices',
      args,
      { requestId: this.generateRequestId(), operation: 'listInvoices', priority: Priority.LOW }
    );
    return response.data;
  }

  // Payment methods
  async createPayment(args: any): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'POST',
      '/payments',
      args,
      { requestId: this.generateRequestId(), operation: 'createPayment', priority: Priority.HIGH }
    );
    return response.data;
  }

  async updatePayment(args: any): Promise<StateSetResponse> {
    const { payment_id, ...data } = args;
    const response = await this.request<StateSetResponse>(
      'PATCH',
      `/payments/${payment_id}`,
      data,
      { requestId: this.generateRequestId(), operation: 'updatePayment', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async deletePayment(paymentId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'DELETE',
      `/payments/${paymentId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'deletePayment', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async getPayment(paymentId: string): Promise<StateSetResponse> {
    const response = await this.request<StateSetResponse>(
      'GET',
      `/payments/${paymentId}`,
      undefined,
      { requestId: this.generateRequestId(), operation: 'getPayment', priority: Priority.NORMAL }
    );
    return response.data;
  }

  async listPayments(args: { page?: number; per_page?: number } = {}): Promise<StateSetResponse[]> {
    const response = await this.request<StateSetResponse[]>(
      'GET',
      '/payments',
      args,
      { requestId: this.generateRequestId(), operation: 'listPayments', priority: Priority.LOW }
    );
    return response.data;
  }
}

// Create singleton instance
export const statesetClient = new StateSetClient();

// Export types
export type { StateSetResponse, EnrichedResponse }; 