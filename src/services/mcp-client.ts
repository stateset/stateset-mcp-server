import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../utils/logger';
import { RateLimiter } from '../core/server-rate-limiter';
import {
  createOperationTimeoutConfig,
  OperationTimeoutConfig,
  OperationType,
} from '../config/timeouts';
import { CircuitBreaker, CircuitState } from '../core/circuit-breaker';
import { cacheManager, CacheStats } from '../core/cache';
import {
  Config,
  RateLimiterMetrics,
  StateSetResponse,
  CreateRMAArgs,
  UpdateRMAArgs,
  CreateOrderArgs,
  UpdateOrderArgs,
  CreateWarrantyArgs,
  UpdateWarrantyArgs,
  CreateShipmentArgs,
  UpdateShipmentArgs,
  CreateBillOfMaterialsArgs,
  UpdateBillOfMaterialsArgs,
  CreateWorkOrderArgs,
  UpdateWorkOrderArgs,
  CreateManufacturerOrderArgs,
  UpdateManufacturerOrderArgs,
  CreatePurchaseOrderArgs,
  UpdatePurchaseOrderArgs,
  DeletePurchaseOrderArgs,
  CreateASNArgs,
  UpdateASNArgs,
  DeleteASNArgs,
  CreateInvoiceArgs,
  UpdateInvoiceArgs,
  DeleteInvoiceArgs,
  CreatePaymentArgs,
  UpdatePaymentArgs,
  DeletePaymentArgs,
  CreateSalesOrderArgs,
  UpdateSalesOrderArgs,
  DeleteSalesOrderArgs,
  CreateFulfillmentOrderArgs,
  UpdateFulfillmentOrderArgs,
  DeleteFulfillmentOrderArgs,
  CreateItemReceiptArgs,
  UpdateItemReceiptArgs,
  DeleteItemReceiptArgs,
  CreateCashSaleArgs,
  UpdateCashSaleArgs,
  DeleteCashSaleArgs,
  CreateCustomerArgs,
  UpdateCustomerArgs,
  DeleteCustomerArgs,
  CreateProductArgs,
  UpdateProductArgs,
  DeleteProductArgs,
  CreateInventoryArgs,
  UpdateInventoryArgs,
  DeleteInventoryArgs,
  DeleteRMAArgs,
  DeleteOrderArgs,
  DeleteWarrantyArgs,
  DeleteShipmentArgs,
  DeleteBillOfMaterialsArgs,
  DeleteWorkOrderArgs,
  DeleteManufacturerOrderArgs,
  ListArgs,
} from '../types/mcp-api';

// Main Client
export class StateSetMCPClient {
  private readonly apiClient: AxiosInstance;
  private readonly rateLimiter: RateLimiter;
  private readonly baseUrl: string;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly timeoutConfig: OperationTimeoutConfig;

  constructor(config: Config) {
    if (!config.apiKey) throw new Error('API key is required');

    this.baseUrl = config.baseUrl;
    this.rateLimiter = new RateLimiter(config.requestsPerHour);
    this.timeoutConfig = createOperationTimeoutConfig(config.timeoutMs);
    this.circuitBreaker = new CircuitBreaker('stateset-api', {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: config.timeoutMs,
      resetTimeout: 30000, // 30 seconds
      volumeThreshold: 10,
      errorFilter: (error: Error) => {
        // Only count server errors and network errors for circuit breaker
        if (axios.isAxiosError(error)) {
          return !error.response || error.response.status >= 500;
        }
        return true;
      },
    });

    this.apiClient = axios.create({
      baseURL: config.baseUrl,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: config.timeoutMs, // Default timeout, will be overridden per-request
    });

    this.apiClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logger.error('API request failed', { message: error.message, code: error.code });
        throw error;
      },
    );
  }

  private enrichResponse<T>(data: T): T & { metadata: { apiMetrics: RateLimiterMetrics } } {
    return {
      ...data,
      metadata: { apiMetrics: this.rateLimiter.getMetrics() },
    };
  }

  private enrichListResponse<T>(data: T[]): {
    items: T[];
    metadata: { apiMetrics: RateLimiterMetrics };
  } {
    return {
      items: data,
      metadata: { apiMetrics: this.rateLimiter.getMetrics() },
    };
  }

  /**
   * Execute an API call with circuit breaker protection and rate limiting
   */
  private async executeWithProtection<T>(fn: () => Promise<T>, operationName: string): Promise<T> {
    const timeout = this.timeoutConfig.getTimeout(operationName);
    logger.debug('Executing operation with timeout', { operationName, timeoutMs: timeout });

    return this.circuitBreaker.execute(async () => {
      return this.rateLimiter.enqueue(fn, operationName);
    });
  }

  /**
   * Create a request config with operation-specific timeout
   */
  private getRequestConfig(operationName: string): { timeout: number } {
    return { timeout: this.timeoutConfig.getTimeout(operationName) };
  }

  /**
   * Get timeout configuration for monitoring
   */
  getTimeoutConfig(): Record<OperationType, number> {
    return this.timeoutConfig.timeouts;
  }

  /**
   * Get circuit breaker status for health checks
   */
  getCircuitBreakerStatus(): { state: CircuitState; metrics: any } {
    return {
      state: this.circuitBreaker.getState(),
      metrics: this.circuitBreaker.getMetrics(),
    };
  }

  /**
   * Get data with caching support
   */
  private async getCached<T>(
    cacheKey: string,
    namespace: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 60000, // 1 minute default
  ): Promise<T> {
    const cached = await cacheManager.get<T>(namespace, cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const result = await fetcher();
    cacheManager.set(namespace, cacheKey, result, ttlMs);
    return result;
  }

  /**
   * Invalidate cache entries for a resource
   */
  invalidateCache(namespace: string, pattern?: string): void {
    if (pattern) {
      // For now, clear the entire namespace
      // A more sophisticated implementation would use pattern matching
      cacheManager.clear(namespace);
    } else {
      cacheManager.clear(namespace);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): Record<string, CacheStats> | CacheStats {
    return cacheManager.getStats();
  }

  async createRMA(args: CreateRMAArgs): Promise<StateSetResponse> {
    const operationName = 'createRMA';
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/rmas', args, this.getRequestConfig(operationName)),
      operationName,
    );
    const rma = response.data;
    return this.enrichResponse({
      id: rma.id,
      order_id: rma.order_id,
      customer_email: rma.customer_email,
      status: rma.status,
      created_at: rma.created_at,
      updated_at: rma.updated_at,
      url: `${this.baseUrl}/dashboard/rmas/${rma.id}`,
    });
  }

  async updateRMA(args: UpdateRMAArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/rmas/${args.rma_id}`, args),
      'updateRMA',
    );
    const rma = response.data;
    return this.enrichResponse({
      id: rma.id,
      order_id: rma.order_id,
      status: rma.status,
      created_at: rma.created_at,
      updated_at: rma.updated_at,
      url: `${this.baseUrl}/dashboard/rmas/${rma.id}`,
    });
  }

  async createOrder(args: CreateOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/orders', args),
      'createOrder',
    );
    const order = response.data;
    return this.enrichResponse({
      id: order.id,
      customer_email: order.customer_email,
      status: order.status,
      total_amount: order.total_amount,
      created_at: order.created_at,
      updated_at: order.updated_at,
      url: `${this.baseUrl}/dashboard/orders/${order.id}`,
    });
  }

  async updateOrder(args: UpdateOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/orders/${args.order_id}`, args),
      'updateOrder',
    );
    return this.enrichResponse(response.data);
  }

  async createWarranty(args: CreateWarrantyArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/warranties', args),
      'createWarranty',
    );
    const warranty = response.data;
    return this.enrichResponse({
      id: warranty.id,
      order_id: warranty.order_id,
      customer_email: warranty.customer_email,
      status: warranty.status,
      created_at: warranty.created_at,
      updated_at: warranty.updated_at,
      url: `${this.baseUrl}/dashboard/warranties/${warranty.id}`,
    });
  }

  async updateWarranty(args: UpdateWarrantyArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/warranties/${args.warranty_id}`, args),
      'updateWarranty',
    );
    return this.enrichResponse(response.data);
  }

  async createShipment(args: CreateShipmentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/shipments', args),
      'createShipment',
    );
    const shipment = response.data;
    return this.enrichResponse({
      id: shipment.id,
      order_id: shipment.order_id,
      carrier: shipment.carrier,
      status: shipment.status,
      created_at: shipment.created_at,
      updated_at: shipment.updated_at,
      url: `${this.baseUrl}/dashboard/shipments/${shipment.id}`,
    });
  }

  async updateShipment(args: UpdateShipmentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/shipments/${args.shipment_id}`, args),
      'updateShipment',
    );
    return this.enrichResponse(response.data);
  }

  async getRMA(rmaId: string): Promise<StateSetResponse> {
    return this.getCached(
      `rma:${rmaId}`,
      'rmas',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/rmas/${rmaId}`),
          'getRMA',
        );
        const rma = response.data;
        return this.enrichResponse({
          id: rma.id,
          order_id: rma.order_id,
          customer_email: rma.customer_email,
          status: rma.status,
          created_at: rma.created_at,
          updated_at: rma.updated_at,
          url: `${this.baseUrl}/dashboard/rmas/${rma.id}`,
        });
      },
      120000, // 2 minute TTL
    );
  }

  async getOrder(orderId: string): Promise<StateSetResponse> {
    return this.getCached(
      `order:${orderId}`,
      'orders',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/orders/${orderId}`),
          'getOrder',
        );
        return this.enrichResponse(response.data);
      },
      120000,
    );
  }

  async getWarranty(warrantyId: string): Promise<StateSetResponse> {
    return this.getCached(
      `warranty:${warrantyId}`,
      'warranties',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/warranties/${warrantyId}`),
          'getWarranty',
        );
        return this.enrichResponse(response.data);
      },
      120000,
    );
  }

  async getShipment(shipmentId: string): Promise<StateSetResponse> {
    return this.getCached(
      `shipment:${shipmentId}`,
      'shipments',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/shipments/${shipmentId}`),
          'getShipment',
        );
        return this.enrichResponse(response.data);
      },
      60000, // 1 minute TTL for shipments (they change more frequently)
    );
  }

  async getBillOfMaterials(bomId: string): Promise<StateSetResponse> {
    return this.getCached(
      `bom:${bomId}`,
      'bom',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/bill-of-materials/${bomId}`),
          'getBillOfMaterials',
        );
        return this.enrichResponse(response.data);
      },
      300000, // 5 minute TTL for BOMs (they change infrequently)
    );
  }

  async getWorkOrder(workOrderId: string): Promise<StateSetResponse> {
    return this.getCached(
      `workorder:${workOrderId}`,
      'workorders',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/work-orders/${workOrderId}`),
          'getWorkOrder',
        );
        return this.enrichResponse(response.data);
      },
      60000,
    );
  }

  async getManufacturerOrder(manufacturerOrderId: string): Promise<StateSetResponse> {
    return this.getCached(
      `mfgorder:${manufacturerOrderId}`,
      'mfgorders',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/manufacturer-orders/${manufacturerOrderId}`),
          'getManufacturerOrder',
        );
        return this.enrichResponse(response.data);
      },
      120000,
    );
  }

  async getInvoice(invoiceId: string): Promise<StateSetResponse> {
    return this.getCached(
      `invoice:${invoiceId}`,
      'invoices',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/invoices/${invoiceId}`),
          'getInvoice',
        );
        return this.enrichResponse(response.data);
      },
      120000,
    );
  }

  async getPayment(paymentId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/payments/${paymentId}`),
      'getPayment',
    );
    return this.enrichResponse(response.data);
  }

  async createBillOfMaterials(args: CreateBillOfMaterialsArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/bill-of-materials', args),
      'createBillOfMaterials',
    );
    return this.enrichResponse(response.data);
  }

  async updateBillOfMaterials(args: UpdateBillOfMaterialsArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/bill-of-materials/${args.bill_of_materials_id}`, args),
      'updateBillOfMaterials',
    );
    return this.enrichResponse(response.data);
  }

  async createWorkOrder(args: CreateWorkOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/work-orders', args),
      'createWorkOrder',
    );
    return this.enrichResponse(response.data);
  }

  async updateWorkOrder(args: UpdateWorkOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/work-orders/${args.work_order_id}`, args),
      'updateWorkOrder',
    );
    return this.enrichResponse(response.data);
  }

  async createManufacturerOrder(args: CreateManufacturerOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/manufacturer-orders', args),
      'createManufacturerOrder',
    );
    return this.enrichResponse(response.data);
  }

  async updateManufacturerOrder(args: UpdateManufacturerOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/manufacturer-orders/${args.manufacturer_order_id}`, args),
      'updateManufacturerOrder',
    );
    return this.enrichResponse(response.data);
  }

  async createPurchaseOrder(args: CreatePurchaseOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/purchase-orders', args),
      'createPurchaseOrder',
    );
    return this.enrichResponse(response.data);
  }

  async updatePurchaseOrder(args: UpdatePurchaseOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/purchase-orders/${args.purchase_order_id}`, args),
      'updatePurchaseOrder',
    );
    return this.enrichResponse(response.data);
  }

  async deletePurchaseOrder(args: DeletePurchaseOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/purchase-orders/${args.purchase_order_id}`),
      'deletePurchaseOrder',
    );
    return this.enrichResponse(response.data);
  }

  async getPurchaseOrder(purchaseOrderId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/purchase-orders/${purchaseOrderId}`),
      'getPurchaseOrder',
    );
    return this.enrichResponse(response.data);
  }

  async listPurchaseOrders(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/purchase-orders', { params: args }),
      'listPurchaseOrders',
    );
    return this.enrichListResponse(response.data);
  }

  async createASN(args: CreateASNArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/asns', args),
      'createASN',
    );
    return this.enrichResponse(response.data);
  }

  async updateASN(args: UpdateASNArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/asns/${args.asn_id}`, args),
      'updateASN',
    );
    return this.enrichResponse(response.data);
  }

  async deleteASN(args: DeleteASNArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/asns/${args.asn_id}`),
      'deleteASN',
    );
    return this.enrichResponse(response.data);
  }

  async getASN(asnId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/asns/${asnId}`),
      'getASN',
    );
    return this.enrichResponse(response.data);
  }

  async listASNs(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/asns', { params: args }),
      'listASNs',
    );
    return this.enrichListResponse(response.data);
  }

  async createInvoice(args: CreateInvoiceArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/invoices', args),
      'createInvoice',
    );
    return this.enrichResponse(response.data);
  }

  async updateInvoice(args: UpdateInvoiceArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/invoices/${args.invoice_id}`, args),
      'updateInvoice',
    );
    return this.enrichResponse(response.data);
  }

  async createPayment(args: CreatePaymentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/payments', args),
      'createPayment',
    );
    return this.enrichResponse(response.data);
  }

  async updatePayment(args: UpdatePaymentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/payments/${args.payment_id}`, args),
      'updatePayment',
    );
    return this.enrichResponse(response.data);
  }

  async createSalesOrder(args: CreateSalesOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/sales-orders', args),
      'createSalesOrder',
    );
    return this.enrichResponse(response.data);
  }

  async updateSalesOrder(args: UpdateSalesOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/sales-orders/${args.sales_order_id}`, args),
      'updateSalesOrder',
    );
    return this.enrichResponse(response.data);
  }

  async deleteSalesOrder(args: DeleteSalesOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/sales-orders/${args.sales_order_id}`),
      'deleteSalesOrder',
    );
    return this.enrichResponse(response.data);
  }

  async getSalesOrder(salesOrderId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/sales-orders/${salesOrderId}`),
      'getSalesOrder',
    );
    return this.enrichResponse(response.data);
  }

  async listSalesOrders(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/sales-orders', { params: args }),
      'listSalesOrders',
    );
    return this.enrichListResponse(response.data);
  }

  async createFulfillmentOrder(args: CreateFulfillmentOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/fulfillment-orders', args),
      'createFulfillmentOrder',
    );
    return this.enrichResponse(response.data);
  }

  async updateFulfillmentOrder(args: UpdateFulfillmentOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/fulfillment-orders/${args.fulfillment_order_id}`, args),
      'updateFulfillmentOrder',
    );
    return this.enrichResponse(response.data);
  }

  async deleteFulfillmentOrder(args: DeleteFulfillmentOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/fulfillment-orders/${args.fulfillment_order_id}`),
      'deleteFulfillmentOrder',
    );
    return this.enrichResponse(response.data);
  }

  async getFulfillmentOrder(fulfillmentOrderId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/fulfillment-orders/${fulfillmentOrderId}`),
      'getFulfillmentOrder',
    );
    return this.enrichResponse(response.data);
  }

  async listFulfillmentOrders(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/fulfillment-orders', { params: args }),
      'listFulfillmentOrders',
    );
    return this.enrichListResponse(response.data);
  }

  async createItemReceipt(args: CreateItemReceiptArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/item-receipts', args),
      'createItemReceipt',
    );
    return this.enrichResponse(response.data);
  }

  async updateItemReceipt(args: UpdateItemReceiptArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/item-receipts/${args.item_receipt_id}`, args),
      'updateItemReceipt',
    );
    return this.enrichResponse(response.data);
  }

  async deleteItemReceipt(args: DeleteItemReceiptArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/item-receipts/${args.item_receipt_id}`),
      'deleteItemReceipt',
    );
    return this.enrichResponse(response.data);
  }

  async getItemReceipt(itemReceiptId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/item-receipts/${itemReceiptId}`),
      'getItemReceipt',
    );
    return this.enrichResponse(response.data);
  }

  async listItemReceipts(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/item-receipts', { params: args }),
      'listItemReceipts',
    );
    return this.enrichListResponse(response.data);
  }

  async createCashSale(args: CreateCashSaleArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/cash-sales', args),
      'createCashSale',
    );
    return this.enrichResponse(response.data);
  }

  async updateCashSale(args: UpdateCashSaleArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/cash-sales/${args.cash_sale_id}`, args),
      'updateCashSale',
    );
    return this.enrichResponse(response.data);
  }

  async deleteCashSale(args: DeleteCashSaleArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/cash-sales/${args.cash_sale_id}`),
      'deleteCashSale',
    );
    return this.enrichResponse(response.data);
  }

  async getCashSale(cashSaleId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/cash-sales/${cashSaleId}`),
      'getCashSale',
    );
    return this.enrichResponse(response.data);
  }

  async listCashSales(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/cash-sales', { params: args }),
      'listCashSales',
    );
    return this.enrichListResponse(response.data);
  }

  async createCustomer(args: CreateCustomerArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/customers', args),
      'createCustomer',
    );
    return this.enrichResponse(response.data);
  }

  async updateCustomer(args: UpdateCustomerArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/customers/${args.customer_id}`, args),
      'updateCustomer',
    );
    return this.enrichResponse(response.data);
  }

  async deleteCustomer(args: DeleteCustomerArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/customers/${args.customer_id}`),
      'deleteCustomer',
    );
    return this.enrichResponse(response.data);
  }

  async getCustomer(customerId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/customers/${customerId}`),
      'getCustomer',
    );
    return this.enrichResponse(response.data);
  }

  async listCustomers(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/customers', { params: args }),
      'listCustomers',
    );
    return this.enrichListResponse(response.data);
  }

  async deleteRMA(args: DeleteRMAArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/rmas/${args.rma_id}`),
      'deleteRMA',
    );
    return this.enrichResponse(response.data);
  }

  async deleteOrder(args: DeleteOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/orders/${args.order_id}`),
      'deleteOrder',
    );
    return this.enrichResponse(response.data);
  }

  async deleteWarranty(args: DeleteWarrantyArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/warranties/${args.warranty_id}`),
      'deleteWarranty',
    );
    return this.enrichResponse(response.data);
  }

  async deleteShipment(args: DeleteShipmentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/shipments/${args.shipment_id}`),
      'deleteShipment',
    );
    return this.enrichResponse(response.data);
  }

  async deleteBillOfMaterials(args: DeleteBillOfMaterialsArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/bill-of-materials/${args.bill_of_materials_id}`),
      'deleteBillOfMaterials',
    );
    return this.enrichResponse(response.data);
  }

  async deleteWorkOrder(args: DeleteWorkOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/work-orders/${args.work_order_id}`),
      'deleteWorkOrder',
    );
    return this.enrichResponse(response.data);
  }

  async deleteManufacturerOrder(args: DeleteManufacturerOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/manufacturer-orders/${args.manufacturer_order_id}`),
      'deleteManufacturerOrder',
    );
    return this.enrichResponse(response.data);
  }

  async deleteInvoice(args: DeleteInvoiceArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/invoices/${args.invoice_id}`),
      'deleteInvoice',
    );
    return this.enrichResponse(response.data);
  }

  async deletePayment(args: DeletePaymentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/payments/${args.payment_id}`),
      'deletePayment',
    );
    return this.enrichResponse(response.data);
  }

  async listRMAs(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/rmas', { params: args }),
      'listRMAs',
    );
    return this.enrichListResponse(response.data);
  }

  async listOrders(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/orders', { params: args }),
      'listOrders',
    );
    return this.enrichListResponse(response.data);
  }

  async listWarranties(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/warranties', { params: args }),
      'listWarranties',
    );
    return this.enrichListResponse(response.data);
  }

  async listShipments(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/shipments', { params: args }),
      'listShipments',
    );
    return this.enrichListResponse(response.data);
  }

  async listBillOfMaterials(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/bill-of-materials', { params: args }),
      'listBillOfMaterials',
    );
    return this.enrichListResponse(response.data);
  }

  async listWorkOrders(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/work-orders', { params: args }),
      'listWorkOrders',
    );
    return this.enrichListResponse(response.data);
  }

  async listManufacturerOrders(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/manufacturer-orders', { params: args }),
      'listManufacturerOrders',
    );
    return this.enrichListResponse(response.data);
  }

  async listInvoices(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/invoices', { params: args }),
      'listInvoices',
    );
    return this.enrichListResponse(response.data);
  }

  async listPayments(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/payments', { params: args }),
      'listPayments',
    );
    return this.enrichListResponse(response.data);
  }

  async createProduct(args: CreateProductArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/products', args),
      'createProduct',
    );
    return this.enrichResponse(response.data);
  }

  async updateProduct(args: UpdateProductArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/products/${args.product_id}`, args),
      'updateProduct',
    );
    return this.enrichResponse(response.data);
  }

  async deleteProduct(args: DeleteProductArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/products/${args.product_id}`),
      'deleteProduct',
    );
    return this.enrichResponse(response.data);
  }

  async getProduct(productId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/products/${productId}`),
      'getProduct',
    );
    return this.enrichResponse(response.data);
  }

  async listProducts(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/products', { params: args }),
      'listProducts',
    );
    return this.enrichListResponse(response.data);
  }

  async createInventory(args: CreateInventoryArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/inventory', args),
      'createInventory',
    );
    return this.enrichResponse(response.data);
  }

  async updateInventory(args: UpdateInventoryArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/inventory/${args.inventory_id}`, args),
      'updateInventory',
    );
    return this.enrichResponse(response.data);
  }

  async deleteInventory(args: DeleteInventoryArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/inventory/${args.inventory_id}`),
      'deleteInventory',
    );
    return this.enrichResponse(response.data);
  }

  async getInventory(inventoryId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/inventory/${inventoryId}`),
      'getInventory',
    );
    return this.enrichResponse(response.data);
  }

  async listInventories(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/inventory', { params: args }),
      'listInventories',
    );
    return this.enrichListResponse(response.data);
  }

  getApiMetrics(): { apiMetrics: RateLimiterMetrics } {
    return { apiMetrics: this.rateLimiter.getMetrics() };
  }

  async healthCheck(includeDetails: boolean = false): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    uptime: number;
    components: {
      api: { status: string; latency?: number; error?: string };
      rateLimiter: { status: string; metrics?: RateLimiterMetrics };
      circuitBreaker: { status: string; state?: CircuitState; metrics?: any };
    };
  }> {
    const result: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      timestamp: string;
      version: string;
      uptime: number;
      components: {
        api: { status: string; latency?: number; error?: string };
        rateLimiter: { status: string; metrics?: RateLimiterMetrics };
        circuitBreaker: { status: string; state?: CircuitState; metrics?: any };
      };
    } = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      components: {
        api: { status: 'unknown' },
        rateLimiter: { status: 'unknown' },
        circuitBreaker: { status: 'unknown' },
      },
    };

    // Check API connectivity
    try {
      const apiStart = Date.now();
      await this.apiClient.get('/health', { timeout: 5000 });
      result.components.api = {
        status: 'healthy',
        latency: Date.now() - apiStart,
      };
    } catch (error) {
      result.components.api = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      result.status = 'degraded';
    }

    // Check rate limiter
    const rateLimiterMetrics = this.rateLimiter.getMetrics();
    const rateLimiterHealthy = rateLimiterMetrics.queueLength < 100;
    result.components.rateLimiter = {
      status: rateLimiterHealthy ? 'healthy' : 'degraded',
    };

    if (includeDetails) {
      result.components.rateLimiter.metrics = rateLimiterMetrics;
    }

    if (!rateLimiterHealthy) {
      result.status = result.status === 'healthy' ? 'degraded' : result.status;
    }

    // Check circuit breaker
    const cbStatus = this.getCircuitBreakerStatus();
    const cbHealthy = cbStatus.state === CircuitState.CLOSED;
    result.components.circuitBreaker = {
      status: cbHealthy
        ? 'healthy'
        : cbStatus.state === CircuitState.HALF_OPEN
          ? 'degraded'
          : 'unhealthy',
      state: cbStatus.state,
    };

    if (includeDetails) {
      result.components.circuitBreaker.metrics = cbStatus.metrics;
    }

    if (cbStatus.state === CircuitState.OPEN) {
      result.status = 'unhealthy';
    } else if (cbStatus.state === CircuitState.HALF_OPEN && result.status !== 'unhealthy') {
      result.status = 'degraded';
    }

    return result;
  }
}
