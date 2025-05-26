#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  Tool,
  ResourceTemplate,
  Prompt,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosError, AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import { z, ZodError } from 'zod';
import pino from 'pino';

// Logger setup
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});


// Configuration
interface Config {
  apiKey: string;
  baseUrl: string;
  requestsPerHour: number;
}

// Type definitions
interface RateLimiterMetrics {
  totalRequests: number;
  requestsInLastHour: number;
  averageRequestTime: number;
  queueLength: number;
  lastRequestTime: string;
}

interface RMAItem {
  item_id: string;
  quantity: number;
}

interface OrderItem {
  item_id: string;
  quantity: number;
  price: number;
}

interface WarrantyItem {
  item_id: string;
  serial_number?: string;
  warranty_period_months: number;
}

interface ShipmentItem {
  item_id: string;
  quantity: number;
  tracking_number?: string;
}

interface Address {
  line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface StateSetResponse {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  url: string;
  [key: string]: any;
}

interface BillOfMaterialsItem {
  item_id: string;
  quantity: number;
  price: number;
}

interface WorkOrderItem {
  item_id: string;
  quantity: number;
}

interface ManufacturerOrderItem {
  item_id: string;
  quantity: number;
}

interface InvoiceItem {
  item_id: string;
  quantity: number;
}   

interface PaymentItem {
  item_id: string;
  quantity: number;
}

interface SalesOrderItem {
  item_id: string;
  quantity: number;
  price: number;
}

interface FulfillmentOrderItem {
  item_id: string;
  quantity: number;
  tracking_number?: string;
}

interface ItemReceiptItem {
  item_id: string;
  quantity: number;
}

interface CashSaleItem {
  item_id: string;
  quantity: number;
  price: number;
}

interface CreateCustomerArgs {
  email: string;
  name: string;
  address: Address;
}

interface UpdateCustomerArgs {
  customer_id: string;
  email?: string;
  name?: string;
  address?: Address;
}

interface DeleteCustomerArgs {
  customer_id: string;
}

interface GetCustomerArgs {
  customer_id: string;
}


interface CreateRMAArgs {
  order_id: string;
  customer_email: string;
  items: RMAItem[];
  notes?: string;
}

interface UpdateRMAArgs {
  rma_id: string;
  status?: string;
  notes?: string;
}   

interface CreateOrderArgs {
  customer_email: string;
  items: OrderItem[];
  shipping_address: Address;
  billing_address?: Address;
}

interface UpdateOrderArgs {
  order_id: string;
  status?: string;
  items?: OrderItem[];
  shipping_address?: Address;
  billing_address?: Address;
}

interface CreateWarrantyArgs {
  order_id: string;
  customer_email: string;
  items: WarrantyItem[];
  notes?: string;
}

interface UpdateWarrantyArgs {
  warranty_id: string;
  status?: string;
  notes?: string;
}

interface CreateShipmentArgs {
  order_id: string;
  customer_email: string;
  items: ShipmentItem[];
  carrier: string;
  destination_address: Address;
}

interface UpdateShipmentArgs {
  shipment_id: string;
  carrier?: string;
  status?: string;
  tracking_number?: string;
  destination_address?: Address;
}

interface CreateBillOfMaterialsArgs {
  order_id: string;
  customer_email: string;
  items: BillOfMaterialsItem[];
  notes?: string;
}

interface UpdateBillOfMaterialsArgs {
  bill_of_materials_id: string;
  items: BillOfMaterialsItem[];
  notes?: string;
}

interface CreateWorkOrderArgs {
  order_id: string;
  customer_email: string;
  items: WorkOrderItem[];
  notes?: string;
}

interface UpdateWorkOrderArgs {
  work_order_id: string;
  items: WorkOrderItem[];       
  notes?: string;
}

interface CreateManufacturerOrderArgs {
  order_id: string;
  customer_email: string;
  items: ManufacturerOrderItem[];
  notes?: string;
}

interface UpdateManufacturerOrderArgs {
  manufacturer_order_id: string;
  items: ManufacturerOrderItem[];   
  notes?: string;
}

interface CreateInvoiceArgs {
  order_id: string;
  customer_email: string;
  items: InvoiceItem[];
  notes?: string;
}

interface UpdateInvoiceArgs {
  invoice_id: string;
  items: InvoiceItem[];     
  notes?: string;
}

interface CreatePaymentArgs {
  order_id: string;
  customer_email: string;
  items: PaymentItem[];
  notes?: string;
}

interface UpdatePaymentArgs {
  payment_id: string;
  items: PaymentItem[];
  notes?: string;
}

interface DeleteRMAArgs {
  rma_id: string;
}

interface DeleteOrderArgs {
  order_id: string;
}

interface DeleteWarrantyArgs {
  warranty_id: string;
}

interface DeleteShipmentArgs {
  shipment_id: string;
}

interface DeleteBillOfMaterialsArgs {
  bill_of_materials_id: string;
}

interface DeleteWorkOrderArgs {
  work_order_id: string;
}

interface DeleteManufacturerOrderArgs {
  manufacturer_order_id: string;
}

interface DeleteInvoiceArgs {
  invoice_id: string;
}

interface DeletePaymentArgs {
  payment_id: string;
}

interface GetRMAArgs {
  rma_id: string;
}

interface GetOrderArgs {
  order_id: string;
}

interface GetWarrantyArgs {
  warranty_id: string;
}

interface GetShipmentArgs {
  shipment_id: string;
}

interface GetBillOfMaterialsArgs {
  bill_of_materials_id: string;
}

interface GetWorkOrderArgs {
  work_order_id: string;
}

interface GetManufacturerOrderArgs {
  manufacturer_order_id: string;
}

interface GetInvoiceArgs {
  invoice_id: string;
}

interface GetPaymentArgs {
  payment_id: string;
}

interface CreateSalesOrderArgs {
  customer_email: string;
  items: SalesOrderItem[];
  shipping_address: Address;
  billing_address?: Address;
}

interface UpdateSalesOrderArgs {
  sales_order_id: string;
  status?: string;
  items?: SalesOrderItem[];
  shipping_address?: Address;
  billing_address?: Address;
}

interface DeleteSalesOrderArgs {
  sales_order_id: string;
}

interface GetSalesOrderArgs {
  sales_order_id: string;
}

interface CreateFulfillmentOrderArgs {
  order_id: string;
  customer_email: string;
  items: FulfillmentOrderItem[];
  carrier: string;
  destination_address: Address;
}

interface UpdateFulfillmentOrderArgs {
  fulfillment_order_id: string;
  carrier?: string;
  status?: string;
  tracking_number?: string;
  destination_address?: Address;
}

interface DeleteFulfillmentOrderArgs {
  fulfillment_order_id: string;
}

interface GetFulfillmentOrderArgs {
  fulfillment_order_id: string;
}

interface CreateItemReceiptArgs {
  order_id: string;
  items: ItemReceiptItem[];
  notes?: string;
}

interface UpdateItemReceiptArgs {
  item_receipt_id: string;
  items: ItemReceiptItem[];
  notes?: string;
}

interface DeleteItemReceiptArgs {
  item_receipt_id: string;
}

interface GetItemReceiptArgs {
  item_receipt_id: string;
}

interface CreateCashSaleArgs {
  customer_email: string;
  items: CashSaleItem[];
  payment_method: string;
}

interface UpdateCashSaleArgs {
  cash_sale_id: string;
  items?: CashSaleItem[];
  payment_method?: string;
  status?: string;
}

interface DeleteCashSaleArgs {
  cash_sale_id: string;
}

interface GetCashSaleArgs {
  cash_sale_id: string;
}

interface CreateProductArgs {
  name: string;
  sku: string;
  description?: string;
  price: number;
}

interface UpdateProductArgs {
  product_id: string;
  name?: string;
  sku?: string;
  description?: string;
  price?: number;
}

interface DeleteProductArgs {
  product_id: string;
}

interface GetProductArgs {
  product_id: string;
}

interface CreateInventoryArgs {
  product_id: string;
  quantity: number;
  location: string;
}

interface UpdateInventoryArgs {
  inventory_id: string;
  quantity?: number;
  location?: string;
}

interface DeleteInventoryArgs {
  inventory_id: string;
}

interface GetInventoryArgs {
  inventory_id: string;
}

interface PurchaseOrderItem {
  item_id: string;
  quantity: number;
  price: number;
}

interface CreatePurchaseOrderArgs {
  vendor_id: string;
  items: PurchaseOrderItem[];
  notes?: string;
}

interface UpdatePurchaseOrderArgs {
  purchase_order_id: string;
  items?: PurchaseOrderItem[];
  notes?: string;
}

interface DeletePurchaseOrderArgs {
  purchase_order_id: string;
}

interface GetPurchaseOrderArgs {
  purchase_order_id: string;
}

interface CreateVendorArgs {
  email: string;
  name: string;
  address: Address;
}

interface UpdateVendorArgs {
  vendor_id: string;
  email?: string;
  name?: string;
  address?: Address;
}

interface DeleteVendorArgs {
  vendor_id: string;
}

interface GetVendorArgs {
  vendor_id: string;
}

interface ListArgs {
  page?: number;
  per_page?: number;
}

interface GetApiMetricsArgs {}

// Rate Limiter
class RateLimiter {
  private readonly requestsPerHour: number;
  private readonly minDelayMs: number;
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private requestTimes: number[] = [];
  private requestTimestamps: number[] = [];

  constructor(requestsPerHour: number) {
    this.requestsPerHour = requestsPerHour;
    this.minDelayMs = 3600000 / requestsPerHour;
  }

  async enqueue<T>(fn: () => Promise<T>, operation: string): Promise<T> {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          logger.debug({ operation }, 'Starting API request');
          const result = await fn();
          const duration = Date.now() - startTime;
          this.trackRequest(startTime, duration);
          logger.debug({ operation, duration }, 'Completed API request');
          resolve(result);
        } catch (error) {
          logger.error({ operation, error }, 'API request failed');
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const requestsInLastHour = this.requestTimestamps.filter(t => t > now - 3600000).length;
      
      if (requestsInLastHour >= this.requestsPerHour * 0.9) {
        const waitTime = this.minDelayMs - (now - this.lastRequestTime);
        if (waitTime > 0) await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      const fn = this.queue.shift();
      if (fn) {
        this.lastRequestTime = Date.now();
        await fn();
      }
    }
    this.processing = false;
  }

  private trackRequest(startTime: number, duration: number): void {
    this.requestTimes.push(duration);
    this.requestTimestamps.push(startTime);
    const oneHourAgo = Date.now() - 3600000;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneHourAgo);
    this.requestTimes = this.requestTimes.slice(-this.requestTimestamps.length);
  }

  getMetrics(): RateLimiterMetrics {
    const now = Date.now();
    const requestsInLastHour = this.requestTimestamps.filter(t => t > now - 3600000).length;
    return {
      totalRequests: this.requestTimestamps.length,
      requestsInLastHour,
      averageRequestTime: this.requestTimes.length > 0
        ? this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length
        : 0,
      queueLength: this.queue.length,
      lastRequestTime: new Date(this.lastRequestTime).toISOString(),
    };
  }
}

// Main Client
class StateSetMCPClient {
  private readonly apiClient: AxiosInstance;
  private readonly rateLimiter: RateLimiter;
  private readonly baseUrl: string;

  constructor(config: Config) {
    if (!config.apiKey) throw new Error('API key is required');
    
    this.baseUrl = config.baseUrl;
    this.rateLimiter = new RateLimiter(config.requestsPerHour);
    this.apiClient = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    this.apiClient.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        logger.error({ error: error.message, code: error.code }, 'API request failed');
        throw error;
      }
    );
  }

  private enrichResponse<T>(data: T): T & { metadata: { apiMetrics: RateLimiterMetrics } } {
    return {
      ...data,
      metadata: { apiMetrics: this.rateLimiter.getMetrics() },
    };
  }

  private enrichListResponse<T>(data: T[]): { items: T[]; metadata: { apiMetrics: RateLimiterMetrics } } {
    return {
      items: data,
      metadata: { apiMetrics: this.rateLimiter.getMetrics() },
    };
  }

  async createRMA(args: CreateRMAArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/rmas', args),
      'createRMA'
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
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/rmas/${args.rma_id}`, args),
      'updateRMA'
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
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/orders', args),
      'createOrder'
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
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/orders/${args.order_id}`, args),
      'updateOrder'
    );
    return this.enrichResponse(response.data);
  }

  async createWarranty(args: CreateWarrantyArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/warranties', args),
      'createWarranty'
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
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/warranties/${args.warranty_id}`, args),
      'updateWarranty'
    );
    return this.enrichResponse(response.data);
  }

  async createShipment(args: CreateShipmentArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/shipments', args),
      'createShipment'
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
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/shipments/${args.shipment_id}`, args),
      'updateShipment'
    );
    return this.enrichResponse(response.data);
  }

  async getRMA(rmaId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/rmas/${rmaId}`),
      'getRMA'
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

  async getOrder(orderId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/orders/${orderId}`),
      'getOrder'
    );
    return this.enrichResponse(response.data);
  }

  async getWarranty(warrantyId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/warranties/${warrantyId}`),
      'getWarranty'
    );
    return this.enrichResponse(response.data);
  }

  async getShipment(shipmentId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/shipments/${shipmentId}`),
      'getShipment'
    );
    return this.enrichResponse(response.data);
  }

  async getBillOfMaterials(bomId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/bill-of-materials/${bomId}`),
      'getBillOfMaterials'
    );
    return this.enrichResponse(response.data);
  }

  async getWorkOrder(workOrderId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/work-orders/${workOrderId}`),
      'getWorkOrder'
    );
    return this.enrichResponse(response.data);
  }

  async getManufacturerOrder(manufacturerOrderId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/manufacturer-orders/${manufacturerOrderId}`),
      'getManufacturerOrder'
    );
    return this.enrichResponse(response.data);
  }

  async getInvoice(invoiceId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/invoices/${invoiceId}`),
      'getInvoice'
    );
    return this.enrichResponse(response.data);
  }

  async getPayment(paymentId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/payments/${paymentId}`),
      'getPayment'
    );
    return this.enrichResponse(response.data);
  }

  async createBillOfMaterials(args: CreateBillOfMaterialsArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/bill-of-materials', args),
      'createBillOfMaterials'
    );
    return this.enrichResponse(response.data);
  }

  async updateBillOfMaterials(args: UpdateBillOfMaterialsArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/bill-of-materials/${args.bill_of_materials_id}`, args), 
      'updateBillOfMaterials'
    );
    return this.enrichResponse(response.data);
  }

  async createWorkOrder(args: CreateWorkOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/work-orders', args),
      'createWorkOrder'
    );
    return this.enrichResponse(response.data);
  }

  async updateWorkOrder(args: UpdateWorkOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/work-orders/${args.work_order_id}`, args),  
      'updateWorkOrder'
    );
    return this.enrichResponse(response.data);
  }

  async createManufacturerOrder(args: CreateManufacturerOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/manufacturer-orders', args),
      'createManufacturerOrder'
    );
    return this.enrichResponse(response.data);
  }

  async updateManufacturerOrder(args: UpdateManufacturerOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/manufacturer-orders/${args.manufacturer_order_id}`, args),
      'updateManufacturerOrder'
    );
    return this.enrichResponse(response.data);
  }

  async createInvoice(args: CreateInvoiceArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/invoices', args),
      'createInvoice'
    );
    return this.enrichResponse(response.data);
  }

  async updateInvoice(args: UpdateInvoiceArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/invoices/${args.invoice_id}`, args),
      'updateInvoice'
    );
    return this.enrichResponse(response.data);
  }

  async createPayment(args: CreatePaymentArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/payments', args),
      'createPayment'
    );
    return this.enrichResponse(response.data);
  }

  async updatePayment(args: UpdatePaymentArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/payments/${args.payment_id}`, args),
      'updatePayment'
    );
    return this.enrichResponse(response.data);
  }

  async createSalesOrder(args: CreateSalesOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/sales-orders', args),
      'createSalesOrder'
    );
    return this.enrichResponse(response.data);
  }

  async updateSalesOrder(args: UpdateSalesOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/sales-orders/${args.sales_order_id}`, args),
      'updateSalesOrder'
    );
    return this.enrichResponse(response.data);
  }

  async deleteSalesOrder(args: DeleteSalesOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/sales-orders/${args.sales_order_id}`),
      'deleteSalesOrder'
    );
    return this.enrichResponse(response.data);
  }

  async getSalesOrder(salesOrderId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/sales-orders/${salesOrderId}`),
      'getSalesOrder'
    );
    return this.enrichResponse(response.data);
  }

  async listSalesOrders(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/sales-orders', { params: args }),
      'listSalesOrders'
    );
    return this.enrichListResponse(response.data);
  }

  async createFulfillmentOrder(args: CreateFulfillmentOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/fulfillment-orders', args),
      'createFulfillmentOrder'
    );
    return this.enrichResponse(response.data);
  }

  async updateFulfillmentOrder(args: UpdateFulfillmentOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/fulfillment-orders/${args.fulfillment_order_id}`, args),
      'updateFulfillmentOrder'
    );
    return this.enrichResponse(response.data);
  }

  async deleteFulfillmentOrder(args: DeleteFulfillmentOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/fulfillment-orders/${args.fulfillment_order_id}`),
      'deleteFulfillmentOrder'
    );
    return this.enrichResponse(response.data);
  }

  async getFulfillmentOrder(fulfillmentOrderId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/fulfillment-orders/${fulfillmentOrderId}`),
      'getFulfillmentOrder'
    );
    return this.enrichResponse(response.data);
  }

  async listFulfillmentOrders(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/fulfillment-orders', { params: args }),
      'listFulfillmentOrders'
    );
    return this.enrichListResponse(response.data);
  }

  async createItemReceipt(args: CreateItemReceiptArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/item-receipts', args),
      'createItemReceipt'
    );
    return this.enrichResponse(response.data);
  }

  async updateItemReceipt(args: UpdateItemReceiptArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/item-receipts/${args.item_receipt_id}`, args),
      'updateItemReceipt'
    );
    return this.enrichResponse(response.data);
  }

  async deleteItemReceipt(args: DeleteItemReceiptArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/item-receipts/${args.item_receipt_id}`),
      'deleteItemReceipt'
    );
    return this.enrichResponse(response.data);
  }

  async getItemReceipt(itemReceiptId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/item-receipts/${itemReceiptId}`),
      'getItemReceipt'
    );
    return this.enrichResponse(response.data);
  }

  async listItemReceipts(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/item-receipts', { params: args }),
      'listItemReceipts'
    );
    return this.enrichListResponse(response.data);
  }

  async createCashSale(args: CreateCashSaleArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/cash-sales', args),
      'createCashSale'
    );
    return this.enrichResponse(response.data);
  }

  async updateCashSale(args: UpdateCashSaleArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/cash-sales/${args.cash_sale_id}`, args),
      'updateCashSale'
    );
    return this.enrichResponse(response.data);
  }

  async deleteCashSale(args: DeleteCashSaleArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/cash-sales/${args.cash_sale_id}`),
      'deleteCashSale'
    );
    return this.enrichResponse(response.data);
  }

  async getCashSale(cashSaleId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/cash-sales/${cashSaleId}`),
      'getCashSale'
    );
    return this.enrichResponse(response.data);
  }

  async listCashSales(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/cash-sales', { params: args }),
      'listCashSales'
    );
    return this.enrichListResponse(response.data);
  }

  async createCustomer(args: CreateCustomerArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/customers', args),
      'createCustomer'
    );
    return this.enrichResponse(response.data);
  }

  async updateCustomer(args: UpdateCustomerArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/customers/${args.customer_id}`, args),
      'updateCustomer'
    );
    return this.enrichResponse(response.data);
  }

  async deleteCustomer(args: DeleteCustomerArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/customers/${args.customer_id}`),
      'deleteCustomer'
    );
    return this.enrichResponse(response.data);
  }

  async getCustomer(customerId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/customers/${customerId}`),
      'getCustomer'
    );
    return this.enrichResponse(response.data);
  }

  async listCustomers(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/customers', { params: args }),
      'listCustomers'
    );
    return this.enrichListResponse(response.data);
  }

  async deleteRMA(args: DeleteRMAArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/rmas/${args.rma_id}`),
      'deleteRMA'
    );
    return this.enrichResponse(response.data);
  }

  async deleteOrder(args: DeleteOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/orders/${args.order_id}`),
      'deleteOrder'
    );
    return this.enrichResponse(response.data);
  }

  async deleteWarranty(args: DeleteWarrantyArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/warranties/${args.warranty_id}`),
      'deleteWarranty'
    );
    return this.enrichResponse(response.data);
  }

  async deleteShipment(args: DeleteShipmentArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/shipments/${args.shipment_id}`),
      'deleteShipment'
    );
    return this.enrichResponse(response.data);
  }

  async deleteBillOfMaterials(args: DeleteBillOfMaterialsArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/bill-of-materials/${args.bill_of_materials_id}`),
      'deleteBillOfMaterials'
    );
    return this.enrichResponse(response.data);
  }

  async deleteWorkOrder(args: DeleteWorkOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/work-orders/${args.work_order_id}`),
      'deleteWorkOrder'
    );
    return this.enrichResponse(response.data);
  }

  async deleteManufacturerOrder(args: DeleteManufacturerOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/manufacturer-orders/${args.manufacturer_order_id}`),
      'deleteManufacturerOrder'
    );
    return this.enrichResponse(response.data);
  }

  async deleteInvoice(args: DeleteInvoiceArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/invoices/${args.invoice_id}`),
      'deleteInvoice'
    );
    return this.enrichResponse(response.data);
  }

  async deletePayment(args: DeletePaymentArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/payments/${args.payment_id}`),
      'deletePayment'
    );
    return this.enrichResponse(response.data);
  }

  async listRMAs(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/rmas', { params: args }),
      'listRMAs'
    );
    return this.enrichListResponse(response.data);
  }

  async listOrders(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/orders', { params: args }),
      'listOrders'
    );
    return this.enrichListResponse(response.data);
  }

  async listWarranties(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/warranties', { params: args }),
      'listWarranties'
    );
    return this.enrichListResponse(response.data);
  }

  async listShipments(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/shipments', { params: args }),
      'listShipments'
    );
    return this.enrichListResponse(response.data);
  }

  async listBillOfMaterials(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/bill-of-materials', { params: args }),
      'listBillOfMaterials'
    );
    return this.enrichListResponse(response.data);
  }

  async listWorkOrders(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/work-orders', { params: args }),
      'listWorkOrders'
    );
    return this.enrichListResponse(response.data);
  }

  async listManufacturerOrders(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/manufacturer-orders', { params: args }),
      'listManufacturerOrders'
    );
    return this.enrichListResponse(response.data);
  }

  async listInvoices(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/invoices', { params: args }),
      'listInvoices'
    );
    return this.enrichListResponse(response.data);
  }

  async listPayments(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/payments', { params: args }),
      'listPayments'
    );
    return this.enrichListResponse(response.data);
  }

  async createProduct(args: CreateProductArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/products', args),
      'createProduct'
    );
    return this.enrichResponse(response.data);
  }

  async updateProduct(args: UpdateProductArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/products/${args.product_id}`, args),
      'updateProduct'
    );
    return this.enrichResponse(response.data);
  }

  async deleteProduct(args: DeleteProductArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/products/${args.product_id}`),
      'deleteProduct'
    );
    return this.enrichResponse(response.data);
  }

  async getProduct(productId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/products/${productId}`),
      'getProduct'
    );
    return this.enrichResponse(response.data);
  }

  async listProducts(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/products', { params: args }),
      'listProducts'
    );
    return this.enrichListResponse(response.data);
  }

  async createInventory(args: CreateInventoryArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/inventory', args),
      'createInventory'
    );
    return this.enrichResponse(response.data);
  }

  async updateInventory(args: UpdateInventoryArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/inventory/${args.inventory_id}`, args),
      'updateInventory'
    );
    return this.enrichResponse(response.data);
  }

  async deleteInventory(args: DeleteInventoryArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/inventory/${args.inventory_id}`),
      'deleteInventory'
    );
    return this.enrichResponse(response.data);
  }

  async getInventory(inventoryId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/inventory/${inventoryId}`),
      'getInventory'
    );
    return this.enrichResponse(response.data);
  }

  async listInventories(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/inventory', { params: args }),
      'listInventories'
    );
    return this.enrichListResponse(response.data);
  }

  async createPurchaseOrder(args: CreatePurchaseOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/purchase-orders', args),
      'createPurchaseOrder'
    );
    return this.enrichResponse(response.data);
  }

  async updatePurchaseOrder(args: UpdatePurchaseOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/purchase-orders/${args.purchase_order_id}`, args),
      'updatePurchaseOrder'
    );
    return this.enrichResponse(response.data);
  }

  async deletePurchaseOrder(args: DeletePurchaseOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/purchase-orders/${args.purchase_order_id}`),
      'deletePurchaseOrder'
    );
    return this.enrichResponse(response.data);
  }

  async getPurchaseOrder(purchaseOrderId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/purchase-orders/${purchaseOrderId}`),
      'getPurchaseOrder'
    );
    return this.enrichResponse(response.data);
  }

  async listPurchaseOrders(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/purchase-orders', { params: args }),
      'listPurchaseOrders'
    );
    return this.enrichListResponse(response.data);
  }

  async createVendor(args: CreateVendorArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post('/vendors', args),
      'createVendor'
    );
    return this.enrichResponse(response.data);
  }

  async updateVendor(args: UpdateVendorArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/vendors/${args.vendor_id}`, args),
      'updateVendor'
    );
    return this.enrichResponse(response.data);
  }

  async deleteVendor(args: DeleteVendorArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/vendors/${args.vendor_id}`),
      'deleteVendor'
    );
    return this.enrichResponse(response.data);
  }

  async getVendor(vendorId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/vendors/${vendorId}`),
      'getVendor'
    );
    return this.enrichResponse(response.data);
  }

  async listVendors(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/vendors', { params: args }),
      'listVendors'
    );
    return this.enrichListResponse(response.data);
  }

  getApiMetrics(): { apiMetrics: RateLimiterMetrics } {
    return { apiMetrics: this.rateLimiter.getMetrics() };
  }
}

// Zod Schemas
const CreateRMAArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  reason: z.string().min(1, "Reason is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const UpdateRMAArgsSchema = z.object({
  rma_id: z.string().min(1, "RMA ID is required"),
  status: z.string().optional(),
  resolution: z.string().optional(),
  notes: z.string().optional(),
});

const CreateOrderArgsSchema = z.object({
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).min(1, "At least one item is required"),
  shipping_address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }),
  billing_address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }).optional(),
});

const UpdateOrderArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  status: z.string().optional(),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).optional(),
  shipping_address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }).optional(),
  billing_address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }).optional(),
});

const CreateWarrantyArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    serial_number: z.string().optional(),
    warranty_period_months: z.number().positive("Warranty period must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const UpdateWarrantyArgsSchema = z.object({
  warranty_id: z.string().min(1, "Warranty ID is required"),
  status: z.string().optional(),
  notes: z.string().optional(),
});

const CreateShipmentArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    tracking_number: z.string().optional(),
  })).min(1, "At least one item is required"),
  carrier: z.string().min(1, "Carrier is required"),
  destination_address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }),
});

const UpdateShipmentArgsSchema = z.object({
  shipment_id: z.string().min(1, "Shipment ID is required"),
  carrier: z.string().optional(),
  status: z.string().optional(),
  tracking_number: z.string().optional(),
  destination_address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }).optional(),
});

const CreateBillOfMaterialsArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const UpdateBillOfMaterialsArgsSchema = z.object({
  bill_of_materials_id: z.string().min(1, "Bill of Materials ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const CreateWorkOrderArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const UpdateWorkOrderArgsSchema = z.object({
  work_order_id: z.string().min(1, "Work Order ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  status: z.string().optional(),
  notes: z.string().optional(),
}); 

const CreateManufacturerOrderArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const UpdateManufacturerOrderArgsSchema = z.object({
  manufacturer_order_id: z.string().min(1, "Manufacturer Order ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  status: z.string().optional(),
  notes: z.string().optional(),
});

const CreateInvoiceArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const UpdateInvoiceArgsSchema = z.object({
  invoice_id: z.string().min(1, "Invoice ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const CreatePaymentArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  amount: z.number().positive("Amount must be positive"),   
  payment_method: z.string().min(1, "Payment method is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const UpdatePaymentArgsSchema = z.object({
  payment_id: z.string().min(1, "Payment ID is required"),
  amount: z.number().positive("Amount must be positive"),
  payment_method: z.string().min(1, "Payment method is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const CreateCustomerArgsSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required"),
  address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }),
});

const UpdateCustomerArgsSchema = z.object({
  customer_id: z.string().min(1, "Customer ID is required"),
  email: z.string().email("Invalid email format").optional(),
  name: z.string().min(1, "Name is required").optional(),
  address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }).optional(),
});

const DeleteCustomerArgsSchema = z.object({
  customer_id: z.string().min(1, "Customer ID is required"),
});

const GetCustomerArgsSchema = z.object({
  customer_id: z.string().min(1, "Customer ID is required"),
});

const DeleteRMAArgsSchema = z.object({
  rma_id: z.string().min(1, "RMA ID is required"),
});

const DeleteOrderArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
});

const DeleteWarrantyArgsSchema = z.object({
  warranty_id: z.string().min(1, "Warranty ID is required"),
});

const DeleteShipmentArgsSchema = z.object({
  shipment_id: z.string().min(1, "Shipment ID is required"),
});

const DeleteBillOfMaterialsArgsSchema = z.object({
  bill_of_materials_id: z.string().min(1, "Bill of Materials ID is required"),
});

const DeleteWorkOrderArgsSchema = z.object({
  work_order_id: z.string().min(1, "Work Order ID is required"),
});

const DeleteManufacturerOrderArgsSchema = z.object({
  manufacturer_order_id: z.string().min(1, "Manufacturer Order ID is required"),
});

const DeleteInvoiceArgsSchema = z.object({
  invoice_id: z.string().min(1, "Invoice ID is required"),
});

const DeletePaymentArgsSchema = z.object({
  payment_id: z.string().min(1, "Payment ID is required"),
});

const GetRMAArgsSchema = z.object({
  rma_id: z.string().min(1, "RMA ID is required"),
});

const GetOrderArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
});

const GetWarrantyArgsSchema = z.object({
  warranty_id: z.string().min(1, "Warranty ID is required"),
});

const GetShipmentArgsSchema = z.object({
  shipment_id: z.string().min(1, "Shipment ID is required"),
});

const GetBillOfMaterialsArgsSchema = z.object({
  bill_of_materials_id: z.string().min(1, "Bill of Materials ID is required"),
});

const GetWorkOrderArgsSchema = z.object({
  work_order_id: z.string().min(1, "Work Order ID is required"),
});

const GetManufacturerOrderArgsSchema = z.object({
  manufacturer_order_id: z.string().min(1, "Manufacturer Order ID is required"),
});

const GetInvoiceArgsSchema = z.object({
  invoice_id: z.string().min(1, "Invoice ID is required"),
});

const GetPaymentArgsSchema = z.object({
  payment_id: z.string().min(1, "Payment ID is required"),
});

const CreateSalesOrderArgsSchema = z.object({
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).min(1, "At least one item is required"),
  shipping_address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }),
  billing_address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }).optional(),
});

const UpdateSalesOrderArgsSchema = z.object({
  sales_order_id: z.string().min(1, "Sales Order ID is required"),
  status: z.string().optional(),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).optional(),
  shipping_address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }).optional(),
  billing_address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }).optional(),
});

const DeleteSalesOrderArgsSchema = z.object({
  sales_order_id: z.string().min(1, "Sales Order ID is required"),
});

const GetSalesOrderArgsSchema = z.object({
  sales_order_id: z.string().min(1, "Sales Order ID is required"),
});

const CreateFulfillmentOrderArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    tracking_number: z.string().optional(),
  })).min(1, "At least one item is required"),
  carrier: z.string().min(1, "Carrier is required"),
  destination_address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }),
});

const UpdateFulfillmentOrderArgsSchema = z.object({
  fulfillment_order_id: z.string().min(1, "Fulfillment Order ID is required"),
  carrier: z.string().optional(),
  status: z.string().optional(),
  tracking_number: z.string().optional(),
  destination_address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }).optional(),
});

const DeleteFulfillmentOrderArgsSchema = z.object({
  fulfillment_order_id: z.string().min(1, "Fulfillment Order ID is required"),
});

const GetFulfillmentOrderArgsSchema = z.object({
  fulfillment_order_id: z.string().min(1, "Fulfillment Order ID is required"),
});

const CreateItemReceiptArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const UpdateItemReceiptArgsSchema = z.object({
  item_receipt_id: z.string().min(1, "Item Receipt ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const DeleteItemReceiptArgsSchema = z.object({
  item_receipt_id: z.string().min(1, "Item Receipt ID is required"),
});

const GetItemReceiptArgsSchema = z.object({
  item_receipt_id: z.string().min(1, "Item Receipt ID is required"),
});

const CreateCashSaleArgsSchema = z.object({
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).min(1, "At least one item is required"),
  payment_method: z.string().min(1, "Payment method is required"),
});

const UpdateCashSaleArgsSchema = z.object({
  cash_sale_id: z.string().min(1, "Cash Sale ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).optional(),
  payment_method: z.string().min(1, "Payment method is required").optional(),
  status: z.string().optional(),
});

const DeleteCashSaleArgsSchema = z.object({
  cash_sale_id: z.string().min(1, "Cash Sale ID is required"),
});

const GetCashSaleArgsSchema = z.object({
  cash_sale_id: z.string().min(1, "Cash Sale ID is required"),
});

const CreateProductArgsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
});

const UpdateProductArgsSchema = z.object({
  product_id: z.string().min(1, "Product ID is required"),
  name: z.string().min(1, "Name is required").optional(),
  sku: z.string().min(1, "SKU is required").optional(),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive").optional(),
});

const DeleteProductArgsSchema = z.object({
  product_id: z.string().min(1, "Product ID is required"),
});

const GetProductArgsSchema = z.object({
  product_id: z.string().min(1, "Product ID is required"),
});

const CreateInventoryArgsSchema = z.object({
  product_id: z.string().min(1, "Product ID is required"),
  quantity: z.number().nonnegative(),
  location: z.string().min(1, "Location is required"),
});

const UpdateInventoryArgsSchema = z.object({
  inventory_id: z.string().min(1, "Inventory ID is required"),
  quantity: z.number().nonnegative().optional(),
  location: z.string().min(1, "Location is required").optional(),
});

const DeleteInventoryArgsSchema = z.object({
  inventory_id: z.string().min(1, "Inventory ID is required"),
});

const GetInventoryArgsSchema = z.object({
  inventory_id: z.string().min(1, "Inventory ID is required"),
});

const PurchaseOrderItemSchema = z.object({
  item_id: z.string().min(1, "Item ID is required"),
  quantity: z.number().positive("Quantity must be positive"),
  price: z.number().positive("Price must be positive"),
});

const CreatePurchaseOrderArgsSchema = z.object({
  vendor_id: z.string().min(1, "Vendor ID is required"),
  items: z.array(PurchaseOrderItemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const UpdatePurchaseOrderArgsSchema = z.object({
  purchase_order_id: z.string().min(1, "Purchase Order ID is required"),
  items: z.array(PurchaseOrderItemSchema).min(1, "At least one item is required").optional(),
  notes: z.string().optional(),
});

const DeletePurchaseOrderArgsSchema = z.object({
  purchase_order_id: z.string().min(1, "Purchase Order ID is required"),
});

const GetPurchaseOrderArgsSchema = z.object({
  purchase_order_id: z.string().min(1, "Purchase Order ID is required"),
});

const CreateVendorArgsSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required"),
  address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }),
});

const UpdateVendorArgsSchema = z.object({
  vendor_id: z.string().min(1, "Vendor ID is required"),
  email: z.string().email("Invalid email format").optional(),
  name: z.string().min(1, "Name is required").optional(),
  address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    postal_code: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }).optional(),
});

const DeleteVendorArgsSchema = z.object({
  vendor_id: z.string().min(1, "Vendor ID is required"),
});

const GetVendorArgsSchema = z.object({
  vendor_id: z.string().min(1, "Vendor ID is required"),
});

const ListArgsSchema = z.object({
  page: z.number().positive().optional(),
  per_page: z.number().positive().optional(),
});

const GetApiMetricsArgsSchema = z.object({});


// Tool Definitions
const createRMATool: Tool = {
  name: "stateset_create_rma",
  description: "Creates a new RMA request",
  inputSchema: CreateRMAArgsSchema.shape as any,
};

const updateRMATool: Tool = {
  name: "stateset_update_rma",
  description: "Updates an existing RMA",
  inputSchema: UpdateRMAArgsSchema.shape as any,
};

const createOrderTool: Tool = {
  name: "stateset_create_order",
  description: "Creates a new customer order",
  inputSchema: CreateOrderArgsSchema.shape as any,
};

const updateOrderTool: Tool = {
  name: "stateset_update_order",
  description: "Updates an order record",
  inputSchema: UpdateOrderArgsSchema.shape as any,
};

const createWarrantyTool: Tool = {
  name: "stateset_create_warranty",
  description: "Creates a warranty record",
  inputSchema: CreateWarrantyArgsSchema.shape as any,
};

const updateWarrantyTool: Tool = {
  name: "stateset_update_warranty",
  description: "Updates a warranty record",
  inputSchema: UpdateWarrantyArgsSchema.shape as any,
};

const createShipmentTool: Tool = {
  name: "stateset_create_shipment",
  description: "Creates a shipment record",
  inputSchema: CreateShipmentArgsSchema.shape as any,
};

const updateShipmentTool: Tool = {
  name: "stateset_update_shipment",
  description: "Updates a shipment record",
  inputSchema: UpdateShipmentArgsSchema.shape as any,
};

const createBillOfMaterialsTool: Tool = {
  name: "stateset_create_bill_of_materials",
  description: "Creates a bill of materials record",
  inputSchema: CreateBillOfMaterialsArgsSchema.shape as any,
};

const updateBillOfMaterialsTool: Tool = {
  name: "stateset_update_bill_of_materials",
  description: "Updates a bill of materials record",
  inputSchema: UpdateBillOfMaterialsArgsSchema.shape as any,
};

const createWorkOrderTool: Tool = {
  name: "stateset_create_work_order",
  description: "Creates a work order record",
  inputSchema: CreateWorkOrderArgsSchema.shape as any,
};

const updateWorkOrderTool: Tool = {
  name: "stateset_update_work_order",
  description: "Updates a work order record",
  inputSchema: UpdateWorkOrderArgsSchema.shape as any,
};

const createManufacturerOrderTool: Tool = {
  name: "stateset_create_manufacturer_order",
  description: "Creates a manufacturer order record",
  inputSchema: CreateManufacturerOrderArgsSchema.shape as any,
};

const updateManufacturerOrderTool: Tool = {
  name: "stateset_update_manufacturer_order",
  description: "Updates a manufacturer order record",
  inputSchema: UpdateManufacturerOrderArgsSchema.shape as any,
};

const createInvoiceTool: Tool = {
  name: "stateset_create_invoice",
  description: "Creates an invoice record",
  inputSchema: CreateInvoiceArgsSchema.shape as any,
};

const updateInvoiceTool: Tool = {
  name: "stateset_update_invoice",
  description: "Updates an invoice record",
  inputSchema: UpdateInvoiceArgsSchema.shape as any,
};

const createPaymentTool: Tool = {
  name: "stateset_create_payment",
  description: "Creates a payment record",
  inputSchema: CreatePaymentArgsSchema.shape as any,
};

const updatePaymentTool: Tool = {
  name: "stateset_update_payment",
  description: "Updates a payment record",
  inputSchema: UpdatePaymentArgsSchema.shape as any,
};

const createSalesOrderTool: Tool = {
  name: "stateset_create_sales_order",
  description: "Creates a sales order record",
  inputSchema: CreateSalesOrderArgsSchema.shape as any,
};

const updateSalesOrderTool: Tool = {
  name: "stateset_update_sales_order",
  description: "Updates a sales order record",
  inputSchema: UpdateSalesOrderArgsSchema.shape as any,
};

const deleteSalesOrderTool: Tool = {
  name: "stateset_delete_sales_order",
  description: "Deletes a sales order record",
  inputSchema: DeleteSalesOrderArgsSchema.shape as any,
};

const getSalesOrderTool: Tool = {
  name: "stateset_get_sales_order",
  description: "Retrieves a sales order record",
  inputSchema: GetSalesOrderArgsSchema.shape as any,
};

const listSalesOrdersTool: Tool = {
  name: "stateset_list_sales_orders",
  description: "Lists sales order records",
  inputSchema: ListArgsSchema.shape as any,
};

const createFulfillmentOrderTool: Tool = {
  name: "stateset_create_fulfillment_order",
  description: "Creates a fulfillment order record",
  inputSchema: CreateFulfillmentOrderArgsSchema.shape as any,
};

const updateFulfillmentOrderTool: Tool = {
  name: "stateset_update_fulfillment_order",
  description: "Updates a fulfillment order record",
  inputSchema: UpdateFulfillmentOrderArgsSchema.shape as any,
};

const deleteFulfillmentOrderTool: Tool = {
  name: "stateset_delete_fulfillment_order",
  description: "Deletes a fulfillment order record",
  inputSchema: DeleteFulfillmentOrderArgsSchema.shape as any,
};

const getFulfillmentOrderTool: Tool = {
  name: "stateset_get_fulfillment_order",
  description: "Retrieves a fulfillment order record",
  inputSchema: GetFulfillmentOrderArgsSchema.shape as any,
};

const listFulfillmentOrdersTool: Tool = {
  name: "stateset_list_fulfillment_orders",
  description: "Lists fulfillment order records",
  inputSchema: ListArgsSchema.shape as any,
};

const createItemReceiptTool: Tool = {
  name: "stateset_create_item_receipt",
  description: "Creates an item receipt record",
  inputSchema: CreateItemReceiptArgsSchema.shape as any,
};

const updateItemReceiptTool: Tool = {
  name: "stateset_update_item_receipt",
  description: "Updates an item receipt record",
  inputSchema: UpdateItemReceiptArgsSchema.shape as any,
};

const deleteItemReceiptTool: Tool = {
  name: "stateset_delete_item_receipt",
  description: "Deletes an item receipt record",
  inputSchema: DeleteItemReceiptArgsSchema.shape as any,
};

const getItemReceiptTool: Tool = {
  name: "stateset_get_item_receipt",
  description: "Retrieves an item receipt record",
  inputSchema: GetItemReceiptArgsSchema.shape as any,
};

const listItemReceiptsTool: Tool = {
  name: "stateset_list_item_receipts",
  description: "Lists item receipt records",
  inputSchema: ListArgsSchema.shape as any,
};

const createCashSaleTool: Tool = {
  name: "stateset_create_cash_sale",
  description: "Creates a cash sale record",
  inputSchema: CreateCashSaleArgsSchema.shape as any,
};

const updateCashSaleTool: Tool = {
  name: "stateset_update_cash_sale",
  description: "Updates a cash sale record",
  inputSchema: UpdateCashSaleArgsSchema.shape as any,
};

const deleteCashSaleTool: Tool = {
  name: "stateset_delete_cash_sale",
  description: "Deletes a cash sale record",
  inputSchema: DeleteCashSaleArgsSchema.shape as any,
};

const getCashSaleTool: Tool = {
  name: "stateset_get_cash_sale",
  description: "Retrieves a cash sale record",
  inputSchema: GetCashSaleArgsSchema.shape as any,
};

const listCashSalesTool: Tool = {
  name: "stateset_list_cash_sales",
  description: "Lists cash sale records",
  inputSchema: ListArgsSchema.shape as any,
};

const createProductTool: Tool = {
  name: "stateset_create_product",
  description: "Creates a product record",
  inputSchema: CreateProductArgsSchema.shape as any,
};

const updateProductTool: Tool = {
  name: "stateset_update_product",
  description: "Updates a product record",
  inputSchema: UpdateProductArgsSchema.shape as any,
};

const createInventoryTool: Tool = {
  name: "stateset_create_inventory",
  description: "Creates an inventory record",
  inputSchema: CreateInventoryArgsSchema.shape as any,
};

const updateInventoryTool: Tool = {
  name: "stateset_update_inventory",
  description: "Updates an inventory record",
  inputSchema: UpdateInventoryArgsSchema.shape as any,
};

const createCustomerTool: Tool = {
  name: "stateset_create_customer",
  description: "Creates a customer record",
  inputSchema: CreateCustomerArgsSchema.shape as any,
};

const updateCustomerTool: Tool = {
  name: "stateset_update_customer",
  description: "Updates a customer record",
  inputSchema: UpdateCustomerArgsSchema.shape as any,
};

const deleteRMATool: Tool = {
  name: "stateset_delete_rma",
  description: "Deletes an RMA record",
  inputSchema: DeleteRMAArgsSchema.shape as any,
};

const deleteOrderTool: Tool = {
  name: "stateset_delete_order",
  description: "Deletes an order record",
  inputSchema: DeleteOrderArgsSchema.shape as any,
};

const deleteWarrantyTool: Tool = {
  name: "stateset_delete_warranty",
  description: "Deletes a warranty record",
  inputSchema: DeleteWarrantyArgsSchema.shape as any,
};

const deleteShipmentTool: Tool = {
  name: "stateset_delete_shipment",
  description: "Deletes a shipment record",
  inputSchema: DeleteShipmentArgsSchema.shape as any,
};

const deleteBillOfMaterialsTool: Tool = {
  name: "stateset_delete_bill_of_materials",
  description: "Deletes a bill of materials record",
  inputSchema: DeleteBillOfMaterialsArgsSchema.shape as any,
};

const deleteWorkOrderTool: Tool = {
  name: "stateset_delete_work_order",
  description: "Deletes a work order record",
  inputSchema: DeleteWorkOrderArgsSchema.shape as any,
};

const deleteManufacturerOrderTool: Tool = {
  name: "stateset_delete_manufacturer_order",
  description: "Deletes a manufacturer order record",
  inputSchema: DeleteManufacturerOrderArgsSchema.shape as any,
};

const deleteInvoiceTool: Tool = {
  name: "stateset_delete_invoice",
  description: "Deletes an invoice record",
  inputSchema: DeleteInvoiceArgsSchema.shape as any,
};

const deletePaymentTool: Tool = {
  name: "stateset_delete_payment",
  description: "Deletes a payment record",
  inputSchema: DeletePaymentArgsSchema.shape as any,
};

const deleteProductTool: Tool = {
  name: "stateset_delete_product",
  description: "Deletes a product record",
  inputSchema: DeleteProductArgsSchema.shape as any,
};

const deleteInventoryTool: Tool = {
  name: "stateset_delete_inventory",
  description: "Deletes an inventory record",
  inputSchema: DeleteInventoryArgsSchema.shape as any,
};

const deleteCustomerTool: Tool = {
  name: "stateset_delete_customer",
  description: "Deletes a customer record",
  inputSchema: DeleteCustomerArgsSchema.shape as any,
};

const getRMATool: Tool = {
  name: "stateset_get_rma",
  description: "Retrieves an RMA record",
  inputSchema: GetRMAArgsSchema.shape as any,
};

const getOrderTool: Tool = {
  name: "stateset_get_order",
  description: "Retrieves an order record",
  inputSchema: GetOrderArgsSchema.shape as any,
};

const getWarrantyTool: Tool = {
  name: "stateset_get_warranty",
  description: "Retrieves a warranty record",
  inputSchema: GetWarrantyArgsSchema.shape as any,
};

const getShipmentTool: Tool = {
  name: "stateset_get_shipment",
  description: "Retrieves a shipment record",
  inputSchema: GetShipmentArgsSchema.shape as any,
};

const getBillOfMaterialsTool: Tool = {
  name: "stateset_get_bill_of_materials",
  description: "Retrieves a bill of materials record",
  inputSchema: GetBillOfMaterialsArgsSchema.shape as any,
};

const getWorkOrderTool: Tool = {
  name: "stateset_get_work_order",
  description: "Retrieves a work order record",
  inputSchema: GetWorkOrderArgsSchema.shape as any,
};

const getManufacturerOrderTool: Tool = {
  name: "stateset_get_manufacturer_order",
  description: "Retrieves a manufacturer order record",
  inputSchema: GetManufacturerOrderArgsSchema.shape as any,
};

const getInvoiceTool: Tool = {
  name: "stateset_get_invoice",
  description: "Retrieves an invoice record",
  inputSchema: GetInvoiceArgsSchema.shape as any,
};

const getPaymentTool: Tool = {
  name: "stateset_get_payment",
  description: "Retrieves a payment record",
  inputSchema: GetPaymentArgsSchema.shape as any,
};

const getProductTool: Tool = {
  name: "stateset_get_product",
  description: "Retrieves a product record",
  inputSchema: GetProductArgsSchema.shape as any,
};

const getInventoryTool: Tool = {
  name: "stateset_get_inventory",
  description: "Retrieves an inventory record",
  inputSchema: GetInventoryArgsSchema.shape as any,
};

const getCustomerTool: Tool = {
  name: "stateset_get_customer",
  description: "Retrieves a customer record",
  inputSchema: GetCustomerArgsSchema.shape as any,
};

const listRMAsTool: Tool = {
  name: "stateset_list_rmas",
  description: "Lists RMA records",
  inputSchema: ListArgsSchema.shape as any,
};

const listOrdersTool: Tool = {
  name: "stateset_list_orders",
  description: "Lists order records",
  inputSchema: ListArgsSchema.shape as any,
};

const listWarrantiesTool: Tool = {
  name: "stateset_list_warranties",
  description: "Lists warranty records",
  inputSchema: ListArgsSchema.shape as any,
};

const listShipmentsTool: Tool = {
  name: "stateset_list_shipments",
  description: "Lists shipment records",
  inputSchema: ListArgsSchema.shape as any,
};

const listBillOfMaterialsTool: Tool = {
  name: "stateset_list_bill_of_materials",
  description: "Lists bill of materials records",
  inputSchema: ListArgsSchema.shape as any,
};

const listWorkOrdersTool: Tool = {
  name: "stateset_list_work_orders",
  description: "Lists work order records",
  inputSchema: ListArgsSchema.shape as any,
};

const listManufacturerOrdersTool: Tool = {
  name: "stateset_list_manufacturer_orders",
  description: "Lists manufacturer order records",
  inputSchema: ListArgsSchema.shape as any,
};

const listInvoicesTool: Tool = {
  name: "stateset_list_invoices",
  description: "Lists invoice records",
  inputSchema: ListArgsSchema.shape as any,
};

const listPaymentsTool: Tool = {
  name: "stateset_list_payments",
  description: "Lists payment records",
  inputSchema: ListArgsSchema.shape as any,
};

const listProductsTool: Tool = {
  name: "stateset_list_products",
  description: "Lists product records",
  inputSchema: ListArgsSchema.shape as any,
};

const listInventoriesTool: Tool = {
  name: "stateset_list_inventories",
  description: "Lists inventory records",
  inputSchema: ListArgsSchema.shape as any,
};

const createPurchaseOrderTool: Tool = {
  name: "stateset_create_purchase_order",
  description: "Creates a purchase order record",
  inputSchema: CreatePurchaseOrderArgsSchema.shape as any,
};

const updatePurchaseOrderTool: Tool = {
  name: "stateset_update_purchase_order",
  description: "Updates a purchase order record",
  inputSchema: UpdatePurchaseOrderArgsSchema.shape as any,
};

const deletePurchaseOrderTool: Tool = {
  name: "stateset_delete_purchase_order",
  description: "Deletes a purchase order record",
  inputSchema: DeletePurchaseOrderArgsSchema.shape as any,
};

const getPurchaseOrderTool: Tool = {
  name: "stateset_get_purchase_order",
  description: "Retrieves a purchase order record",
  inputSchema: GetPurchaseOrderArgsSchema.shape as any,
};

const listPurchaseOrdersTool: Tool = {
  name: "stateset_list_purchase_orders",
  description: "Lists purchase order records",
  inputSchema: ListArgsSchema.shape as any,
};

const createVendorTool: Tool = {
  name: "stateset_create_vendor",
  description: "Creates a vendor record",
  inputSchema: CreateVendorArgsSchema.shape as any,
};

const updateVendorTool: Tool = {
  name: "stateset_update_vendor",
  description: "Updates a vendor record",
  inputSchema: UpdateVendorArgsSchema.shape as any,
};

const deleteVendorTool: Tool = {
  name: "stateset_delete_vendor",
  description: "Deletes a vendor record",
  inputSchema: DeleteVendorArgsSchema.shape as any,
};

const getVendorTool: Tool = {
  name: "stateset_get_vendor",
  description: "Retrieves a vendor record",
  inputSchema: GetVendorArgsSchema.shape as any,
};

const listVendorsTool: Tool = {
  name: "stateset_list_vendors",
  description: "Lists vendor records",
  inputSchema: ListArgsSchema.shape as any,
};

const listCustomersTool: Tool = {
  name: "stateset_list_customers",
  description: "Lists customer records",
  inputSchema: ListArgsSchema.shape as any,
};

const getApiMetricsTool: Tool = {
  name: "stateset_get_api_metrics",
  description: "Returns API rate limiter metrics",
  inputSchema: GetApiMetricsArgsSchema.shape as any,
};


// Resource Templates
const resourceTemplates: ResourceTemplate[] = [
  {
    uriTemplate: "stateset-rma:///{rmaId}",
    name: "StateSet RMA",
    description: "RMA record",
    parameters: { rmaId: { type: "string", description: "RMA ID" } },
    examples: ["stateset-rma:///12345"],
  },
  {
    uriTemplate: "stateset-order:///{orderId}",
    name: "StateSet Order",
    description: "Order record",
    parameters: { orderId: { type: "string", description: "Order ID" } },
    examples: ["stateset-order:///ORD-123"],
  },
  {
    uriTemplate: "stateset-warranty:///{warrantyId}",
    name: "StateSet Warranty",
    description: "Warranty record",
    parameters: { warrantyId: { type: "string", description: "Warranty ID" } },
    examples: ["stateset-warranty:///WAR-123"],
  },
  {
    uriTemplate: "stateset-shipment:///{shipmentId}",
    name: "StateSet Shipment",
    description: "Shipment record",
    parameters: { shipmentId: { type: "string", description: "Shipment ID" } },
    examples: ["stateset-shipment:///SHIP-123"],
  },
  {
    uriTemplate: "stateset-bill-of-materials:///{billOfMaterialsId}",
    name: "StateSet Bill of Materials",
    description: "Bill of Materials record",
    parameters: { billOfMaterialsId: { type: "string", description: "Bill of Materials ID" } },
    examples: ["stateset-bill-of-materials:///BOM-123"],
  },
  {
    uriTemplate: "stateset-work-order:///{workOrderId}",
    name: "StateSet Work Order",
    description: "Work Order record",
    parameters: { workOrderId: { type: "string", description: "Work Order ID" } },
    examples: ["stateset-work-order:///WO-123"],
  },
  {
    uriTemplate: "stateset-manufacturer-order:///{manufacturerOrderId}",
    name: "StateSet Manufacturer Order",
    description: "Manufacturer Order record",
    parameters: { manufacturerOrderId: { type: "string", description: "Manufacturer Order ID" } },
    examples: ["stateset-manufacturer-order:///MO-123"],
  },
  {
    uriTemplate: "stateset-invoice:///{invoiceId}",
    name: "StateSet Invoice",
    description: "Invoice record",
    parameters: { invoiceId: { type: "string", description: "Invoice ID" } },
    examples: ["stateset-invoice:///INV-123"],
  },
  {
    uriTemplate: "stateset-payment:///{paymentId}",
    name: "StateSet Payment",
    description: "Payment record",
    parameters: { paymentId: { type: "string", description: "Payment ID" } },
    examples: ["stateset-payment:///PAY-123"],
  },
  {
    uriTemplate: "stateset-sales-order:///{salesOrderId}",
    name: "StateSet Sales Order",
    description: "Sales Order record",
    parameters: { salesOrderId: { type: "string", description: "Sales Order ID" } },
    examples: ["stateset-sales-order:///SO-123"],
  },
  {
    uriTemplate: "stateset-fulfillment-order:///{fulfillmentOrderId}",
    name: "StateSet Fulfillment Order",
    description: "Fulfillment Order record",
    parameters: { fulfillmentOrderId: { type: "string", description: "Fulfillment Order ID" } },
    examples: ["stateset-fulfillment-order:///FO-123"],
  },
  {
    uriTemplate: "stateset-item-receipt:///{itemReceiptId}",
    name: "StateSet Item Receipt",
    description: "Item Receipt record",
    parameters: { itemReceiptId: { type: "string", description: "Item Receipt ID" } },
    examples: ["stateset-item-receipt:///IR-123"],
  },
  {
    uriTemplate: "stateset-cash-sale:///{cashSaleId}",
    name: "StateSet Cash Sale",
    description: "Cash Sale record",
    parameters: { cashSaleId: { type: "string", description: "Cash Sale ID" } },
    examples: ["stateset-cash-sale:///CS-123"],
  },
  {
    uriTemplate: "stateset-product:///{productId}",
    name: "StateSet Product",
    description: "Product record",
    parameters: { productId: { type: "string", description: "Product ID" } },
    examples: ["stateset-product:///PROD-123"],
  },
  {
    uriTemplate: "stateset-inventory:///{inventoryId}",
    name: "StateSet Inventory",
    description: "Inventory record",
    parameters: { inventoryId: { type: "string", description: "Inventory ID" } },
    examples: ["stateset-inventory:///INV-123"],
  },
  {
    uriTemplate: "stateset-purchase-order:///{purchaseOrderId}",
    name: "StateSet Purchase Order",
    description: "Purchase Order record",
    parameters: { purchaseOrderId: { type: "string", description: "Purchase Order ID" } },
    examples: ["stateset-purchase-order:///PO-123"],
  },
  {
    uriTemplate: "stateset-vendor:///{vendorId}",
    name: "StateSet Vendor",
    description: "Vendor record",
    parameters: { vendorId: { type: "string", description: "Vendor ID" } },
    examples: ["stateset-vendor:///VEND-123"],
  },
  {
    uriTemplate: "stateset-customer:///{customerId}",
    name: "StateSet Customer",
    description: "Customer record",
    parameters: { customerId: { type: "string", description: "Customer ID" } },
    examples: ["stateset-customer:///CUST-123"],
  },
];

// Server Prompt
const serverPrompt: Prompt = {
  name: "stateset-server-prompt",
  description: "StateSet MCP server instructions",
  instructions: `Manages eCommerce operations for StateSet.

Capabilities are grouped by domain:

Orders & Returns
- stateset_create_order / stateset_update_order / stateset_delete_order / stateset_get_order
- stateset_create_sales_order / stateset_update_sales_order / stateset_delete_sales_order / stateset_get_sales_order
- stateset_create_rma / stateset_update_rma / stateset_delete_rma / stateset_get_rma

Fulfillment & Production
- stateset_create_shipment / stateset_update_shipment / stateset_delete_shipment / stateset_get_shipment
- stateset_create_fulfillment_order / stateset_update_fulfillment_order / stateset_delete_fulfillment_order / stateset_get_fulfillment_order
- stateset_create_item_receipt / stateset_update_item_receipt / stateset_delete_item_receipt / stateset_get_item_receipt
- stateset_create_bill_of_materials / stateset_update_bill_of_materials / stateset_delete_bill_of_materials / stateset_get_bill_of_materials
- stateset_create_work_order / stateset_update_work_order / stateset_delete_work_order / stateset_get_work_order
- stateset_create_manufacturer_order / stateset_update_manufacturer_order / stateset_delete_manufacturer_order / stateset_get_manufacturer_order

Inventory & Products
- stateset_create_product / stateset_update_product / stateset_delete_product / stateset_get_product
- stateset_create_inventory / stateset_update_inventory / stateset_delete_inventory / stateset_get_inventory

Purchasing & Vendors
- stateset_create_purchase_order / stateset_update_purchase_order / stateset_delete_purchase_order / stateset_get_purchase_order
- stateset_create_vendor / stateset_update_vendor / stateset_delete_vendor / stateset_get_vendor

Financial
- stateset_create_invoice / stateset_update_invoice / stateset_delete_invoice / stateset_get_invoice
- stateset_create_payment / stateset_update_payment / stateset_delete_payment / stateset_get_payment
- stateset_create_cash_sale / stateset_update_cash_sale / stateset_delete_cash_sale / stateset_get_cash_sale

Customers
- stateset_create_customer / stateset_update_customer / stateset_delete_customer / stateset_get_customer

Listing
- stateset_list_rmas / stateset_list_orders / stateset_list_sales_orders / stateset_list_warranties
- stateset_list_shipments / stateset_list_fulfillment_orders / stateset_list_item_receipts / stateset_list_cash_sales
- stateset_list_bill_of_materials / stateset_list_work_orders / stateset_list_manufacturer_orders
- stateset_list_invoices / stateset_list_payments / stateset_list_products / stateset_list_inventories / stateset_list_customers
- stateset_list_purchase_orders / stateset_list_vendors

Best practices:
- Validate all IDs before use
- Include detailed notes
- Update statuses promptly`
};

// Main Function
async function main(): Promise<void> {
  try {
    dotenv.config();
    const env = z.object({
      STATESET_API_KEY: z.string().min(1, 'STATESET_API_KEY is required'),
      STATESET_BASE_URL: z.string().url().default('https://api.stateset.io/v1'),
      REQUESTS_PER_HOUR: z.coerce.number().positive().default(1000),
    }).parse(process.env);

    const config: Config = {
      apiKey: env.STATESET_API_KEY,
      baseUrl: env.STATESET_BASE_URL,
      requestsPerHour: env.REQUESTS_PER_HOUR,
    };

    const client = new StateSetMCPClient(config);
    const server = new Server(
      { name: "stateset-mcp-server", version: "1.0.0" },
      {
        capabilities: {
          prompts: { default: serverPrompt },
          resources: { templates: true, read: true },
          tools: {},
        },
      }
    );

    server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      try {
        switch (request.params.name) {
          case "stateset_create_rma":
            return await client.createRMA(CreateRMAArgsSchema.parse(request.params.arguments));
          case "stateset_update_rma":
            return await client.updateRMA(UpdateRMAArgsSchema.parse(request.params.arguments));
          case "stateset_create_order":
            return await client.createOrder(CreateOrderArgsSchema.parse(request.params.arguments));
          case "stateset_update_order":
            return await client.updateOrder(UpdateOrderArgsSchema.parse(request.params.arguments));
          case "stateset_create_warranty":
            return await client.createWarranty(CreateWarrantyArgsSchema.parse(request.params.arguments));
          case "stateset_update_warranty":
            return await client.updateWarranty(UpdateWarrantyArgsSchema.parse(request.params.arguments));
          case "stateset_create_shipment":
            return await client.createShipment(CreateShipmentArgsSchema.parse(request.params.arguments));
          case "stateset_update_shipment":
            return await client.updateShipment(UpdateShipmentArgsSchema.parse(request.params.arguments));
          case "stateset_create_bill_of_materials":
            return await client.createBillOfMaterials(CreateBillOfMaterialsArgsSchema.parse(request.params.arguments));
          case "stateset_update_bill_of_materials":
            return await client.updateBillOfMaterials(UpdateBillOfMaterialsArgsSchema.parse(request.params.arguments));
          case "stateset_create_work_order":
            return await client.createWorkOrder(CreateWorkOrderArgsSchema.parse(request.params.arguments));
          case "stateset_update_work_order":
            return await client.updateWorkOrder(UpdateWorkOrderArgsSchema.parse(request.params.arguments));
          case "stateset_create_manufacturer_order":
            return await client.createManufacturerOrder(CreateManufacturerOrderArgsSchema.parse(request.params.arguments));
          case "stateset_update_manufacturer_order":
            return await client.updateManufacturerOrder(UpdateManufacturerOrderArgsSchema.parse(request.params.arguments));
          case "stateset_create_invoice":
            return await client.createInvoice(CreateInvoiceArgsSchema.parse(request.params.arguments));
          case "stateset_update_invoice":
            return await client.updateInvoice(UpdateInvoiceArgsSchema.parse(request.params.arguments));
          case "stateset_create_payment":
            return await client.createPayment(CreatePaymentArgsSchema.parse(request.params.arguments));
          case "stateset_update_payment":
            return await client.updatePayment(UpdatePaymentArgsSchema.parse(request.params.arguments));
          case "stateset_create_sales_order":
            return await client.createSalesOrder(CreateSalesOrderArgsSchema.parse(request.params.arguments));
          case "stateset_update_sales_order":
            return await client.updateSalesOrder(UpdateSalesOrderArgsSchema.parse(request.params.arguments));
          case "stateset_create_fulfillment_order":
            return await client.createFulfillmentOrder(CreateFulfillmentOrderArgsSchema.parse(request.params.arguments));
          case "stateset_update_fulfillment_order":
            return await client.updateFulfillmentOrder(UpdateFulfillmentOrderArgsSchema.parse(request.params.arguments));
          case "stateset_create_item_receipt":
            return await client.createItemReceipt(CreateItemReceiptArgsSchema.parse(request.params.arguments));
          case "stateset_update_item_receipt":
            return await client.updateItemReceipt(UpdateItemReceiptArgsSchema.parse(request.params.arguments));
          case "stateset_create_cash_sale":
            return await client.createCashSale(CreateCashSaleArgsSchema.parse(request.params.arguments));
          case "stateset_update_cash_sale":
            return await client.updateCashSale(UpdateCashSaleArgsSchema.parse(request.params.arguments));
          case "stateset_create_product":
            return await client.createProduct(CreateProductArgsSchema.parse(request.params.arguments));
          case "stateset_update_product":
            return await client.updateProduct(UpdateProductArgsSchema.parse(request.params.arguments));
          case "stateset_create_inventory":
            return await client.createInventory(CreateInventoryArgsSchema.parse(request.params.arguments));
          case "stateset_update_inventory":
            return await client.updateInventory(UpdateInventoryArgsSchema.parse(request.params.arguments));
          case "stateset_create_purchase_order":
            return await client.createPurchaseOrder(CreatePurchaseOrderArgsSchema.parse(request.params.arguments));
          case "stateset_update_purchase_order":
            return await client.updatePurchaseOrder(UpdatePurchaseOrderArgsSchema.parse(request.params.arguments));
          case "stateset_create_vendor":
            return await client.createVendor(CreateVendorArgsSchema.parse(request.params.arguments));
          case "stateset_update_vendor":
            return await client.updateVendor(UpdateVendorArgsSchema.parse(request.params.arguments));
          case "stateset_create_customer":
            return await client.createCustomer(CreateCustomerArgsSchema.parse(request.params.arguments));
          case "stateset_update_customer":
            return await client.updateCustomer(UpdateCustomerArgsSchema.parse(request.params.arguments));
          case "stateset_delete_rma":
            return await client.deleteRMA(DeleteRMAArgsSchema.parse(request.params.arguments));
          case "stateset_delete_order":
            return await client.deleteOrder(DeleteOrderArgsSchema.parse(request.params.arguments));
          case "stateset_delete_sales_order":
            return await client.deleteSalesOrder(DeleteSalesOrderArgsSchema.parse(request.params.arguments));
          case "stateset_delete_warranty":
            return await client.deleteWarranty(DeleteWarrantyArgsSchema.parse(request.params.arguments));
          case "stateset_delete_shipment":
            return await client.deleteShipment(DeleteShipmentArgsSchema.parse(request.params.arguments));
          case "stateset_delete_bill_of_materials":
            return await client.deleteBillOfMaterials(DeleteBillOfMaterialsArgsSchema.parse(request.params.arguments));
          case "stateset_delete_work_order":
            return await client.deleteWorkOrder(DeleteWorkOrderArgsSchema.parse(request.params.arguments));
          case "stateset_delete_manufacturer_order":
            return await client.deleteManufacturerOrder(DeleteManufacturerOrderArgsSchema.parse(request.params.arguments));
          case "stateset_delete_invoice":
            return await client.deleteInvoice(DeleteInvoiceArgsSchema.parse(request.params.arguments));
          case "stateset_delete_payment":
            return await client.deletePayment(DeletePaymentArgsSchema.parse(request.params.arguments));
          case "stateset_delete_fulfillment_order":
            return await client.deleteFulfillmentOrder(DeleteFulfillmentOrderArgsSchema.parse(request.params.arguments));
          case "stateset_delete_item_receipt":
            return await client.deleteItemReceipt(DeleteItemReceiptArgsSchema.parse(request.params.arguments));
          case "stateset_delete_cash_sale":
            return await client.deleteCashSale(DeleteCashSaleArgsSchema.parse(request.params.arguments));
          case "stateset_delete_product":
            return await client.deleteProduct(DeleteProductArgsSchema.parse(request.params.arguments));
          case "stateset_delete_inventory":
            return await client.deleteInventory(DeleteInventoryArgsSchema.parse(request.params.arguments));
          case "stateset_delete_purchase_order":
            return await client.deletePurchaseOrder(DeletePurchaseOrderArgsSchema.parse(request.params.arguments));
          case "stateset_delete_vendor":
            return await client.deleteVendor(DeleteVendorArgsSchema.parse(request.params.arguments));
          case "stateset_delete_customer":
            return await client.deleteCustomer(DeleteCustomerArgsSchema.parse(request.params.arguments));
          case "stateset_get_rma":
            return await client.getRMA(GetRMAArgsSchema.parse(request.params.arguments).rma_id);
          case "stateset_get_order":
            return await client.getOrder(GetOrderArgsSchema.parse(request.params.arguments).order_id);
          case "stateset_get_warranty":
            return await client.getWarranty(GetWarrantyArgsSchema.parse(request.params.arguments).warranty_id);
          case "stateset_get_shipment":
            return await client.getShipment(GetShipmentArgsSchema.parse(request.params.arguments).shipment_id);
          case "stateset_get_bill_of_materials":
            return await client.getBillOfMaterials(GetBillOfMaterialsArgsSchema.parse(request.params.arguments).bill_of_materials_id);
          case "stateset_get_work_order":
            return await client.getWorkOrder(GetWorkOrderArgsSchema.parse(request.params.arguments).work_order_id);
          case "stateset_get_manufacturer_order":
            return await client.getManufacturerOrder(GetManufacturerOrderArgsSchema.parse(request.params.arguments).manufacturer_order_id);
          case "stateset_get_invoice":
            return await client.getInvoice(GetInvoiceArgsSchema.parse(request.params.arguments).invoice_id);
          case "stateset_get_payment":
            return await client.getPayment(GetPaymentArgsSchema.parse(request.params.arguments).payment_id);
          case "stateset_get_sales_order":
            return await client.getSalesOrder(GetSalesOrderArgsSchema.parse(request.params.arguments).sales_order_id);
          case "stateset_get_fulfillment_order":
            return await client.getFulfillmentOrder(GetFulfillmentOrderArgsSchema.parse(request.params.arguments).fulfillment_order_id);
          case "stateset_get_item_receipt":
            return await client.getItemReceipt(GetItemReceiptArgsSchema.parse(request.params.arguments).item_receipt_id);
          case "stateset_get_cash_sale":
            return await client.getCashSale(GetCashSaleArgsSchema.parse(request.params.arguments).cash_sale_id);
          case "stateset_get_product":
            return await client.getProduct(GetProductArgsSchema.parse(request.params.arguments).product_id);
          case "stateset_get_inventory":
            return await client.getInventory(GetInventoryArgsSchema.parse(request.params.arguments).inventory_id);
          case "stateset_get_customer":
            return await client.getCustomer(GetCustomerArgsSchema.parse(request.params.arguments).customer_id);
          case "stateset_get_purchase_order":
            return await client.getPurchaseOrder(GetPurchaseOrderArgsSchema.parse(request.params.arguments).purchase_order_id);
          case "stateset_get_vendor":
            return await client.getVendor(GetVendorArgsSchema.parse(request.params.arguments).vendor_id);

          case "stateset_list_rmas":
            return await client.listRMAs(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_orders":
            return await client.listOrders(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_sales_orders":
            return await client.listSalesOrders(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_warranties":
            return await client.listWarranties(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_shipments":
            return await client.listShipments(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_fulfillment_orders":
            return await client.listFulfillmentOrders(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_item_receipts":
            return await client.listItemReceipts(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_cash_sales":
            return await client.listCashSales(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_bill_of_materials":
            return await client.listBillOfMaterials(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_work_orders":
            return await client.listWorkOrders(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_manufacturer_orders":
            return await client.listManufacturerOrders(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_invoices":
            return await client.listInvoices(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_payments":
            return await client.listPayments(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_products":
            return await client.listProducts(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_inventories":
            return await client.listInventories(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_customers":
            return await client.listCustomers(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_purchase_orders":
            return await client.listPurchaseOrders(ListArgsSchema.parse(request.params.arguments));
          case "stateset_list_vendors":
            return await client.listVendors(ListArgsSchema.parse(request.params.arguments));
          case "stateset_get_api_metrics":
            return client.getApiMetrics();

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        if (error instanceof ZodError) throw new Error(`Invalid arguments: ${error.message}`);
        throw error;
      }
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = new URL(request.params.uri);
      const path = uri.pathname.replace(/^\//, '');
      
      switch (uri.protocol) {
        case 'stateset-rma:':
          const rma = await client.getRMA(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(rma, null, 2) }] };
        case 'stateset-order:':
          const order = await client.getOrder(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(order, null, 2) }] };
        case 'stateset-warranty:':
          const warranty = await client.getWarranty(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(warranty, null, 2) }] };
        case 'stateset-shipment:':
          const shipment = await client.getShipment(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(shipment, null, 2) }] };
        case 'stateset-bill-of-materials:':
          const bom = await client.getBillOfMaterials(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(bom, null, 2) }] };
        case 'stateset-work-order:':
          const wo = await client.getWorkOrder(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(wo, null, 2) }] };
        case 'stateset-manufacturer-order:':
          const mo = await client.getManufacturerOrder(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(mo, null, 2) }] };
        case 'stateset-invoice:':
          const invoice = await client.getInvoice(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(invoice, null, 2) }] };
        case 'stateset-payment:':
          const payment = await client.getPayment(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(payment, null, 2) }] };
        case 'stateset-sales-order:':
          const salesOrder = await client.getSalesOrder(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(salesOrder, null, 2) }] };
        case 'stateset-fulfillment-order:':
          const fo = await client.getFulfillmentOrder(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(fo, null, 2) }] };
        case 'stateset-item-receipt:':
          const ir = await client.getItemReceipt(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(ir, null, 2) }] };
        case 'stateset-cash-sale:':
          const cs = await client.getCashSale(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(cs, null, 2) }] };
        case 'stateset-inventory:':
          const inventory = await client.getInventory(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(inventory, null, 2) }] };
        case 'stateset-product:':
          const product = await client.getProduct(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(product, null, 2) }] };
        case 'stateset-customer:':
          const customer = await client.getCustomer(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(customer, null, 2) }] };
        case 'stateset-purchase-order:':
          const po = await client.getPurchaseOrder(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(po, null, 2) }] };
        case 'stateset-vendor:':
          const vendor = await client.getVendor(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(vendor, null, 2) }] };
        default:
          throw new Error(`Unsupported URI: ${request.params.uri}`);
      }
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        createRMATool,
        updateRMATool,
        createOrderTool,
        updateOrderTool,
        createWarrantyTool,
        updateWarrantyTool,
        createShipmentTool,
        updateShipmentTool,
        createBillOfMaterialsTool,
        updateBillOfMaterialsTool,
        createWorkOrderTool,
        updateWorkOrderTool,
        createManufacturerOrderTool,
        updateManufacturerOrderTool,
        createInvoiceTool,
        updateInvoiceTool,
        createPaymentTool,
        updatePaymentTool,
        createSalesOrderTool,
        updateSalesOrderTool,
        createFulfillmentOrderTool,
        updateFulfillmentOrderTool,
        createItemReceiptTool,
        updateItemReceiptTool,
        createCashSaleTool,
        updateCashSaleTool,
        createProductTool,
        updateProductTool,
        createInventoryTool,
        updateInventoryTool,
        createPurchaseOrderTool,
        updatePurchaseOrderTool,
        createVendorTool,
        updateVendorTool,
        createCustomerTool,
        updateCustomerTool,
        deleteRMATool,
        deleteOrderTool,
        deleteSalesOrderTool,
        deleteWarrantyTool,
        deleteShipmentTool,
        deleteBillOfMaterialsTool,
        deleteWorkOrderTool,
        deleteManufacturerOrderTool,
        deleteInvoiceTool,
        deletePaymentTool,
        deleteFulfillmentOrderTool,
        deleteItemReceiptTool,
        deleteCashSaleTool,
        deleteProductTool,
        deleteInventoryTool,
        deleteCustomerTool,
        deletePurchaseOrderTool,
        deleteVendorTool,
        getRMATool,
        getOrderTool,
        getSalesOrderTool,
        getWarrantyTool,
        getShipmentTool,
        getFulfillmentOrderTool,
        getItemReceiptTool,
        getCashSaleTool,
        getBillOfMaterialsTool,
        getWorkOrderTool,
        getManufacturerOrderTool,
        getInvoiceTool,
        getPaymentTool,
        getProductTool,
        getInventoryTool,
        getCustomerTool,
        getPurchaseOrderTool,
        getVendorTool,
        listRMAsTool,
        listOrdersTool,
        listSalesOrdersTool,
        listWarrantiesTool,
        listShipmentsTool,
        listFulfillmentOrdersTool,
        listItemReceiptsTool,
        listCashSalesTool,
        listBillOfMaterialsTool,
        listWorkOrdersTool,
        listManufacturerOrdersTool,
        listInvoicesTool,
        listPaymentsTool,
        listProductsTool,
        listInventoriesTool,
        listCustomersTool,
        listPurchaseOrdersTool,
        listVendorsTool,
        getApiMetricsTool,
      ],
    }));

    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      templates: resourceTemplates,
    }));

    const transport = new StdioServerTransport();
    await server.listen(transport);
    
    logger.info('Server started successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

main().catch(console.error);
