import axios, { AxiosInstance, AxiosError } from 'axios';
import { z } from 'zod';
import * as schemas from '../tools/schemas';
import { logger } from '../utils/logger';
import { RateLimiter } from '../core/server-rate-limiter';
import {
  createOperationTimeoutConfig,
  OperationTimeoutConfig,
  OperationType,
} from '../config/timeouts';
import { CircuitBreaker, CircuitState } from '../core/circuit-breaker';
import { cacheManager, CacheStats } from '../core/cache';
import { Config, RateLimiterMetrics, StateSetResponse } from '../types/mcp-api';

type CreateRMAArgs = z.infer<typeof schemas.CreateRMAArgsSchema>;
type UpdateRMAArgs = z.infer<typeof schemas.UpdateRMAArgsSchema>;
type DeleteRMAArgs = z.infer<typeof schemas.DeleteRMAArgsSchema>;

type CreateOrderArgs = z.infer<typeof schemas.CreateOrderArgsSchema>;
type UpdateOrderArgs = z.infer<typeof schemas.UpdateOrderArgsSchema>;
type DeleteOrderArgs = z.infer<typeof schemas.DeleteOrderArgsSchema>;

type CreateWarrantyArgs = z.infer<typeof schemas.CreateWarrantyArgsSchema>;
type UpdateWarrantyArgs = z.infer<typeof schemas.UpdateWarrantyArgsSchema>;
type DeleteWarrantyArgs = z.infer<typeof schemas.DeleteWarrantyArgsSchema>;

type CreateShipmentArgs = z.infer<typeof schemas.CreateShipmentArgsSchema>;
type UpdateShipmentArgs = z.infer<typeof schemas.UpdateShipmentArgsSchema>;
type DeleteShipmentArgs = z.infer<typeof schemas.DeleteShipmentArgsSchema>;

type CreateBillOfMaterialsArgs = z.infer<typeof schemas.CreateBillOfMaterialsArgsSchema>;
type UpdateBillOfMaterialsArgs = z.infer<typeof schemas.UpdateBillOfMaterialsArgsSchema>;
type DeleteBillOfMaterialsArgs = z.infer<typeof schemas.DeleteBillOfMaterialsArgsSchema>;

type CreateWorkOrderArgs = z.infer<typeof schemas.CreateWorkOrderArgsSchema>;
type UpdateWorkOrderArgs = z.infer<typeof schemas.UpdateWorkOrderArgsSchema>;
type DeleteWorkOrderArgs = z.infer<typeof schemas.DeleteWorkOrderArgsSchema>;

type CreateManufacturerOrderArgs = z.infer<typeof schemas.CreateManufacturerOrderArgsSchema>;
type UpdateManufacturerOrderArgs = z.infer<typeof schemas.UpdateManufacturerOrderArgsSchema>;
type DeleteManufacturerOrderArgs = z.infer<typeof schemas.DeleteManufacturerOrderArgsSchema>;

type CreatePurchaseOrderArgs = z.infer<typeof schemas.CreatePurchaseOrderArgsSchema>;
type UpdatePurchaseOrderArgs = z.infer<typeof schemas.UpdatePurchaseOrderArgsSchema>;
type DeletePurchaseOrderArgs = z.infer<typeof schemas.DeletePurchaseOrderArgsSchema>;

type CreateASNArgs = z.infer<typeof schemas.CreateASNArgsSchema>;
type UpdateASNArgs = z.infer<typeof schemas.UpdateASNArgsSchema>;
type DeleteASNArgs = z.infer<typeof schemas.DeleteASNArgsSchema>;

type CreateInvoiceArgs = z.infer<typeof schemas.CreateInvoiceArgsSchema>;
type UpdateInvoiceArgs = z.infer<typeof schemas.UpdateInvoiceArgsSchema>;
type DeleteInvoiceArgs = z.infer<typeof schemas.DeleteInvoiceArgsSchema>;

type CreatePaymentArgs = z.infer<typeof schemas.CreatePaymentArgsSchema>;
type UpdatePaymentArgs = z.infer<typeof schemas.UpdatePaymentArgsSchema>;
type DeletePaymentArgs = z.infer<typeof schemas.DeletePaymentArgsSchema>;

type CreateSalesOrderArgs = z.infer<typeof schemas.CreateSalesOrderArgsSchema>;
type UpdateSalesOrderArgs = z.infer<typeof schemas.UpdateSalesOrderArgsSchema>;
type DeleteSalesOrderArgs = z.infer<typeof schemas.DeleteSalesOrderArgsSchema>;

type CreateFulfillmentOrderArgs = z.infer<typeof schemas.CreateFulfillmentOrderArgsSchema>;
type UpdateFulfillmentOrderArgs = z.infer<typeof schemas.UpdateFulfillmentOrderArgsSchema>;
type DeleteFulfillmentOrderArgs = z.infer<typeof schemas.DeleteFulfillmentOrderArgsSchema>;

type CreateItemReceiptArgs = z.infer<typeof schemas.CreateItemReceiptArgsSchema>;
type UpdateItemReceiptArgs = z.infer<typeof schemas.UpdateItemReceiptArgsSchema>;
type DeleteItemReceiptArgs = z.infer<typeof schemas.DeleteItemReceiptArgsSchema>;

type CreateCashSaleArgs = z.infer<typeof schemas.CreateCashSaleArgsSchema>;
type UpdateCashSaleArgs = z.infer<typeof schemas.UpdateCashSaleArgsSchema>;
type DeleteCashSaleArgs = z.infer<typeof schemas.DeleteCashSaleArgsSchema>;

type CreateCustomerArgs = z.infer<typeof schemas.CreateCustomerArgsSchema>;
type UpdateCustomerArgs = z.infer<typeof schemas.UpdateCustomerArgsSchema>;
type DeleteCustomerArgs = z.infer<typeof schemas.DeleteCustomerArgsSchema>;

type CreateProductArgs = z.infer<typeof schemas.CreateProductArgsSchema>;
type UpdateProductArgs = z.infer<typeof schemas.UpdateProductArgsSchema>;
type DeleteProductArgs = z.infer<typeof schemas.DeleteProductArgsSchema>;

type CreateInventoryArgs = z.infer<typeof schemas.CreateInventoryArgsSchema>;
type UpdateInventoryArgs = z.infer<typeof schemas.UpdateInventoryArgsSchema>;
type DeleteInventoryArgs = z.infer<typeof schemas.DeleteInventoryArgsSchema>;

type ListArgs = z.infer<typeof schemas.ListArgsSchema>;

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
  private async executeWithProtection<T>(
    fn: (config: { timeout: number }) => Promise<T>,
    operationName: string,
  ): Promise<T> {
    const requestConfig = this.getRequestConfig(operationName);
    logger.debug('Executing operation with timeout', {
      operationName,
      timeoutMs: requestConfig.timeout,
    });

    return this.circuitBreaker.execute(async () => {
      return this.rateLimiter.enqueue(() => fn(requestConfig), operationName);
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
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/rmas', args, config),
      'createRMA',
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
      (config) => this.apiClient.patch(`/rmas/${args.rma_id}`, args, config),
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
      (config) => this.apiClient.post('/orders', args, config),
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
      (config) => this.apiClient.patch(`/orders/${args.order_id}`, args, config),
      'updateOrder',
    );
    return this.enrichResponse(response.data);
  }

  async createWarranty(args: CreateWarrantyArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/warranties', args, config),
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
      (config) => this.apiClient.patch(`/warranties/${args.warranty_id}`, args, config),
      'updateWarranty',
    );
    return this.enrichResponse(response.data);
  }

  async createShipment(args: CreateShipmentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/shipments', args, config),
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
      (config) => this.apiClient.patch(`/shipments/${args.shipment_id}`, args, config),
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
          (config) => this.apiClient.get(`/rmas/${rmaId}`, config),
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
          (config) => this.apiClient.get(`/orders/${orderId}`, config),
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
          (config) => this.apiClient.get(`/warranties/${warrantyId}`, config),
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
          (config) => this.apiClient.get(`/shipments/${shipmentId}`, config),
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
          (config) => this.apiClient.get(`/bill-of-materials/${bomId}`, config),
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
          (config) => this.apiClient.get(`/work-orders/${workOrderId}`, config),
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
          (config) => this.apiClient.get(`/manufacturer-orders/${manufacturerOrderId}`, config),
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
          (config) => this.apiClient.get(`/invoices/${invoiceId}`, config),
          'getInvoice',
        );
        return this.enrichResponse(response.data);
      },
      120000,
    );
  }

  async getPayment(paymentId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get(`/payments/${paymentId}`, config),
      'getPayment',
    );
    return this.enrichResponse(response.data);
  }

  async createBillOfMaterials(args: CreateBillOfMaterialsArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/bill-of-materials', args, config),
      'createBillOfMaterials',
    );
    return this.enrichResponse(response.data);
  }

  async updateBillOfMaterials(args: UpdateBillOfMaterialsArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) =>
        this.apiClient.patch(`/bill-of-materials/${args.bill_of_materials_id}`, args, config),
      'updateBillOfMaterials',
    );
    return this.enrichResponse(response.data);
  }

  async createWorkOrder(args: CreateWorkOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/work-orders', args, config),
      'createWorkOrder',
    );
    return this.enrichResponse(response.data);
  }

  async updateWorkOrder(args: UpdateWorkOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.patch(`/work-orders/${args.work_order_id}`, args, config),
      'updateWorkOrder',
    );
    return this.enrichResponse(response.data);
  }

  async createManufacturerOrder(args: CreateManufacturerOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/manufacturer-orders', args, config),
      'createManufacturerOrder',
    );
    return this.enrichResponse(response.data);
  }

  async updateManufacturerOrder(args: UpdateManufacturerOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) =>
        this.apiClient.patch(`/manufacturer-orders/${args.manufacturer_order_id}`, args, config),
      'updateManufacturerOrder',
    );
    return this.enrichResponse(response.data);
  }

  async createPurchaseOrder(args: CreatePurchaseOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/purchase-orders', args, config),
      'createPurchaseOrder',
    );
    return this.enrichResponse(response.data);
  }

  async updatePurchaseOrder(args: UpdatePurchaseOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.patch(`/purchase-orders/${args.purchase_order_id}`, args, config),
      'updatePurchaseOrder',
    );
    return this.enrichResponse(response.data);
  }

  async deletePurchaseOrder(args: DeletePurchaseOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/purchase-orders/${args.purchase_order_id}`, config),
      'deletePurchaseOrder',
    );
    return this.enrichResponse(response.data);
  }

  async getPurchaseOrder(purchaseOrderId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get(`/purchase-orders/${purchaseOrderId}`, config),
      'getPurchaseOrder',
    );
    return this.enrichResponse(response.data);
  }

  async listPurchaseOrders(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/purchase-orders', { ...config, params: args }),
      'listPurchaseOrders',
    );
    return this.enrichListResponse(response.data);
  }

  async createASN(args: CreateASNArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/asns', args, config),
      'createASN',
    );
    return this.enrichResponse(response.data);
  }

  async updateASN(args: UpdateASNArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.patch(`/asns/${args.asn_id}`, args, config),
      'updateASN',
    );
    return this.enrichResponse(response.data);
  }

  async deleteASN(args: DeleteASNArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/asns/${args.asn_id}`, config),
      'deleteASN',
    );
    return this.enrichResponse(response.data);
  }

  async getASN(asnId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get(`/asns/${asnId}`, config),
      'getASN',
    );
    return this.enrichResponse(response.data);
  }

  async listASNs(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/asns', { ...config, params: args }),
      'listASNs',
    );
    return this.enrichListResponse(response.data);
  }

  async createInvoice(args: CreateInvoiceArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/invoices', args, config),
      'createInvoice',
    );
    return this.enrichResponse(response.data);
  }

  async updateInvoice(args: UpdateInvoiceArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.patch(`/invoices/${args.invoice_id}`, args, config),
      'updateInvoice',
    );
    return this.enrichResponse(response.data);
  }

  async createPayment(args: CreatePaymentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/payments', args, config),
      'createPayment',
    );
    return this.enrichResponse(response.data);
  }

  async updatePayment(args: UpdatePaymentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.patch(`/payments/${args.payment_id}`, args, config),
      'updatePayment',
    );
    return this.enrichResponse(response.data);
  }

  async createSalesOrder(args: CreateSalesOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/sales-orders', args, config),
      'createSalesOrder',
    );
    return this.enrichResponse(response.data);
  }

  async updateSalesOrder(args: UpdateSalesOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.patch(`/sales-orders/${args.sales_order_id}`, args, config),
      'updateSalesOrder',
    );
    return this.enrichResponse(response.data);
  }

  async deleteSalesOrder(args: DeleteSalesOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/sales-orders/${args.sales_order_id}`, config),
      'deleteSalesOrder',
    );
    return this.enrichResponse(response.data);
  }

  async getSalesOrder(salesOrderId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get(`/sales-orders/${salesOrderId}`, config),
      'getSalesOrder',
    );
    return this.enrichResponse(response.data);
  }

  async listSalesOrders(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/sales-orders', { ...config, params: args }),
      'listSalesOrders',
    );
    return this.enrichListResponse(response.data);
  }

  async createFulfillmentOrder(args: CreateFulfillmentOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/fulfillment-orders', args, config),
      'createFulfillmentOrder',
    );
    return this.enrichResponse(response.data);
  }

  async updateFulfillmentOrder(args: UpdateFulfillmentOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) =>
        this.apiClient.patch(`/fulfillment-orders/${args.fulfillment_order_id}`, args, config),
      'updateFulfillmentOrder',
    );
    return this.enrichResponse(response.data);
  }

  async deleteFulfillmentOrder(args: DeleteFulfillmentOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/fulfillment-orders/${args.fulfillment_order_id}`, config),
      'deleteFulfillmentOrder',
    );
    return this.enrichResponse(response.data);
  }

  async getFulfillmentOrder(fulfillmentOrderId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get(`/fulfillment-orders/${fulfillmentOrderId}`, config),
      'getFulfillmentOrder',
    );
    return this.enrichResponse(response.data);
  }

  async listFulfillmentOrders(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/fulfillment-orders', { ...config, params: args }),
      'listFulfillmentOrders',
    );
    return this.enrichListResponse(response.data);
  }

  async createItemReceipt(args: CreateItemReceiptArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/item-receipts', args, config),
      'createItemReceipt',
    );
    return this.enrichResponse(response.data);
  }

  async updateItemReceipt(args: UpdateItemReceiptArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.patch(`/item-receipts/${args.item_receipt_id}`, args, config),
      'updateItemReceipt',
    );
    return this.enrichResponse(response.data);
  }

  async deleteItemReceipt(args: DeleteItemReceiptArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/item-receipts/${args.item_receipt_id}`, config),
      'deleteItemReceipt',
    );
    return this.enrichResponse(response.data);
  }

  async getItemReceipt(itemReceiptId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get(`/item-receipts/${itemReceiptId}`, config),
      'getItemReceipt',
    );
    return this.enrichResponse(response.data);
  }

  async listItemReceipts(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/item-receipts', { ...config, params: args }),
      'listItemReceipts',
    );
    return this.enrichListResponse(response.data);
  }

  async createCashSale(args: CreateCashSaleArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/cash-sales', args, config),
      'createCashSale',
    );
    return this.enrichResponse(response.data);
  }

  async updateCashSale(args: UpdateCashSaleArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.patch(`/cash-sales/${args.cash_sale_id}`, args, config),
      'updateCashSale',
    );
    return this.enrichResponse(response.data);
  }

  async deleteCashSale(args: DeleteCashSaleArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/cash-sales/${args.cash_sale_id}`, config),
      'deleteCashSale',
    );
    return this.enrichResponse(response.data);
  }

  async getCashSale(cashSaleId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get(`/cash-sales/${cashSaleId}`, config),
      'getCashSale',
    );
    return this.enrichResponse(response.data);
  }

  async listCashSales(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/cash-sales', { ...config, params: args }),
      'listCashSales',
    );
    return this.enrichListResponse(response.data);
  }

  async createCustomer(args: CreateCustomerArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/customers', args, config),
      'createCustomer',
    );
    return this.enrichResponse(response.data);
  }

  async updateCustomer(args: UpdateCustomerArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.patch(`/customers/${args.customer_id}`, args, config),
      'updateCustomer',
    );
    return this.enrichResponse(response.data);
  }

  async deleteCustomer(args: DeleteCustomerArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/customers/${args.customer_id}`, config),
      'deleteCustomer',
    );
    return this.enrichResponse(response.data);
  }

  async getCustomer(customerId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get(`/customers/${customerId}`, config),
      'getCustomer',
    );
    return this.enrichResponse(response.data);
  }

  async listCustomers(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/customers', { ...config, params: args }),
      'listCustomers',
    );
    return this.enrichListResponse(response.data);
  }

  async deleteRMA(args: DeleteRMAArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/rmas/${args.rma_id}`, config),
      'deleteRMA',
    );
    return this.enrichResponse(response.data);
  }

  async deleteOrder(args: DeleteOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/orders/${args.order_id}`, config),
      'deleteOrder',
    );
    return this.enrichResponse(response.data);
  }

  async deleteWarranty(args: DeleteWarrantyArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/warranties/${args.warranty_id}`, config),
      'deleteWarranty',
    );
    return this.enrichResponse(response.data);
  }

  async deleteShipment(args: DeleteShipmentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/shipments/${args.shipment_id}`, config),
      'deleteShipment',
    );
    return this.enrichResponse(response.data);
  }

  async deleteBillOfMaterials(args: DeleteBillOfMaterialsArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/bill-of-materials/${args.bill_of_materials_id}`, config),
      'deleteBillOfMaterials',
    );
    return this.enrichResponse(response.data);
  }

  async deleteWorkOrder(args: DeleteWorkOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/work-orders/${args.work_order_id}`, config),
      'deleteWorkOrder',
    );
    return this.enrichResponse(response.data);
  }

  async deleteManufacturerOrder(args: DeleteManufacturerOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) =>
        this.apiClient.delete(`/manufacturer-orders/${args.manufacturer_order_id}`, config),
      'deleteManufacturerOrder',
    );
    return this.enrichResponse(response.data);
  }

  async deleteInvoice(args: DeleteInvoiceArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/invoices/${args.invoice_id}`, config),
      'deleteInvoice',
    );
    return this.enrichResponse(response.data);
  }

  async deletePayment(args: DeletePaymentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/payments/${args.payment_id}`, config),
      'deletePayment',
    );
    return this.enrichResponse(response.data);
  }

  async listRMAs(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/rmas', { ...config, params: args }),
      'listRMAs',
    );
    return this.enrichListResponse(response.data);
  }

  async listOrders(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/orders', { ...config, params: args }),
      'listOrders',
    );
    return this.enrichListResponse(response.data);
  }

  async listWarranties(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/warranties', { ...config, params: args }),
      'listWarranties',
    );
    return this.enrichListResponse(response.data);
  }

  async listShipments(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/shipments', { ...config, params: args }),
      'listShipments',
    );
    return this.enrichListResponse(response.data);
  }

  async listBillOfMaterials(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/bill-of-materials', { ...config, params: args }),
      'listBillOfMaterials',
    );
    return this.enrichListResponse(response.data);
  }

  async listWorkOrders(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/work-orders', { ...config, params: args }),
      'listWorkOrders',
    );
    return this.enrichListResponse(response.data);
  }

  async listManufacturerOrders(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/manufacturer-orders', { ...config, params: args }),
      'listManufacturerOrders',
    );
    return this.enrichListResponse(response.data);
  }

  async listInvoices(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/invoices', { ...config, params: args }),
      'listInvoices',
    );
    return this.enrichListResponse(response.data);
  }

  async listPayments(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/payments', { ...config, params: args }),
      'listPayments',
    );
    return this.enrichListResponse(response.data);
  }

  async createProduct(args: CreateProductArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/products', args, config),
      'createProduct',
    );
    return this.enrichResponse(response.data);
  }

  async updateProduct(args: UpdateProductArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.patch(`/products/${args.product_id}`, args, config),
      'updateProduct',
    );
    return this.enrichResponse(response.data);
  }

  async deleteProduct(args: DeleteProductArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/products/${args.product_id}`, config),
      'deleteProduct',
    );
    return this.enrichResponse(response.data);
  }

  async getProduct(productId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get(`/products/${productId}`, config),
      'getProduct',
    );
    return this.enrichResponse(response.data);
  }

  async listProducts(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/products', { ...config, params: args }),
      'listProducts',
    );
    return this.enrichListResponse(response.data);
  }

  async createInventory(args: CreateInventoryArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.post('/inventory', args, config),
      'createInventory',
    );
    return this.enrichResponse(response.data);
  }

  async updateInventory(args: UpdateInventoryArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.patch(`/inventory/${args.inventory_id}`, args, config),
      'updateInventory',
    );
    return this.enrichResponse(response.data);
  }

  async deleteInventory(args: DeleteInventoryArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.delete(`/inventory/${args.inventory_id}`, config),
      'deleteInventory',
    );
    return this.enrichResponse(response.data);
  }

  async getInventory(inventoryId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get(`/inventory/${inventoryId}`, config),
      'getInventory',
    );
    return this.enrichResponse(response.data);
  }

  async listInventories(
    args: ListArgs = {},
  ): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      (config) => this.apiClient.get('/inventory', { ...config, params: args }),
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
