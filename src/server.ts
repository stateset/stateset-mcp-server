#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ReadResourceRequestSchema, ListToolsRequestSchema, ListResourceTemplatesRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import axios, { AxiosInstance, AxiosError } from 'axios';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { tools, resourceTemplates, serverPrompt } from './tools/definitions';
import * as schemas from './tools/schemas';
import { executeBatchOperations } from './tools/batch-operations';
import { handleError } from './middleware/error-handler';
import { buildSearchQuery } from './tools/search-tools';
import { sanitizeString, validateContentLength, validateNoSqlInjection } from './utils/validation';
import { CircuitBreaker, CircuitState } from './core/circuit-breaker';
import { cacheManager, CacheStats } from './core/cache';
import { wsManager } from './core/websocket';

// Configuration
interface Config {
  apiKey: string;
  baseUrl: string;
  requestsPerHour: number;
  timeoutMs: number;
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

interface PurchaseOrderItem {
  item_id: string;
  quantity: number;
  price: number;
}

interface ASNItem {
  item_id: string;
  quantity: number;
  tracking_number?: string;
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

/**
 * Sanitize and validate tool arguments for security
 * @param args The raw arguments from the tool call
 * @param toolName The name of the tool being called
 * @returns Sanitized arguments
 */
function sanitizeToolArguments(args: Record<string, unknown>, toolName: string): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      // Validate content length
      validateContentLength(value, 50000);

      // Check for SQL injection patterns in text fields
      if (key.includes('note') || key.includes('description') || key.includes('comment')) {
        validateNoSqlInjection(value);
      }

      // Sanitize string values
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      // Recursively sanitize array items
      sanitized[key] = value.map((item: unknown) => {
        if (typeof item === 'object' && item !== null) {
          return sanitizeToolArguments(item as Record<string, unknown>, toolName);
        }
        if (typeof item === 'string') {
          return sanitizeString(item);
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeToolArguments(value as Record<string, unknown>, toolName);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
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

interface CreatePurchaseOrderArgs {
  vendor_email: string;
  items: PurchaseOrderItem[];
  shipping_address: Address;
  billing_address?: Address;
}

interface UpdatePurchaseOrderArgs {
  purchase_order_id: string;
  status?: string;
  items?: PurchaseOrderItem[];
  shipping_address?: Address;
  billing_address?: Address;
}

interface DeletePurchaseOrderArgs {
  purchase_order_id: string;
}


interface CreateASNArgs {
  purchase_order_id: string;
  items: ASNItem[];
  carrier: string;
  destination_address: Address;
}

interface UpdateASNArgs {
  asn_id: string;
  carrier?: string;
  status?: string;
  tracking_number?: string;
  destination_address?: Address;
}

interface DeleteASNArgs {
  asn_id: string;
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


interface ListArgs {
  page?: number;
  per_page?: number;
}

// GetApiMetricsArgs removed - unused

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

  async enqueue<T>(fn: () => Promise<T>, operation: string, retries = 3): Promise<T> {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          logger.debug('Starting API request', { operation });
          const result = await this.executeWithRetry(fn, operation, retries);
          const duration = Date.now() - startTime;
          this.trackRequest(startTime, duration);
          logger.debug('Completed API request', { operation, duration });
          resolve(result);
        } catch (error) {
          logger.error('API request failed', error, { operation });
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, operation: string, retries: number): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt > retries || !this.isRetryableError(error)) {
          throw error;
        }
        const delay = Math.pow(2, attempt - 1) * 1000;
        logger.warn('Retrying API request', { operation, attempt, delay });
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  private isRetryableError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      return !error.response || error.code === 'ECONNABORTED' ||
             (error.response.status >= 500 && error.response.status < 600);
    }
    return false;
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

// Tool Rate Limit Categories
type ToolCategory = 'read' | 'create' | 'update' | 'delete' | 'batch' | 'admin';

interface ToolRateLimitConfig {
  requestsPerMinute: number;
  burstSize: number;
}

interface ToolRateLimitMetrics {
  category: ToolCategory;
  requestsInLastMinute: number;
  tokensRemaining: number;
  isThrottled: boolean;
  lastRequestTime: string;
}

// Per-Tool Rate Limiter with Token Bucket Algorithm
class ToolRateLimiter {
  private readonly limits: Record<ToolCategory, ToolRateLimitConfig> = {
    read: { requestsPerMinute: 120, burstSize: 20 },      // High throughput for reads
    create: { requestsPerMinute: 30, burstSize: 5 },      // Moderate for creates
    update: { requestsPerMinute: 60, burstSize: 10 },     // Medium for updates
    delete: { requestsPerMinute: 20, burstSize: 3 },      // Conservative for deletes
    batch: { requestsPerMinute: 10, burstSize: 2 },       // Very limited for batch operations
    admin: { requestsPerMinute: 30, burstSize: 5 },       // Moderate for admin/metrics
  };

  private readonly buckets: Map<ToolCategory, {
    tokens: number;
    lastRefill: number;
    requestTimestamps: number[];
  }> = new Map();

  constructor(customLimits?: Partial<Record<ToolCategory, ToolRateLimitConfig>>) {
    // Apply custom limits if provided
    if (customLimits) {
      for (const [category, config] of Object.entries(customLimits)) {
        if (this.limits[category as ToolCategory]) {
          this.limits[category as ToolCategory] = { ...this.limits[category as ToolCategory], ...config };
        }
      }
    }

    // Initialize buckets for each category
    for (const category of Object.keys(this.limits) as ToolCategory[]) {
      this.buckets.set(category, {
        tokens: this.limits[category].burstSize,
        lastRefill: Date.now(),
        requestTimestamps: [],
      });
    }
  }

  // Categorize a tool based on its name
  private categorize(toolName: string): ToolCategory {
    if (toolName.includes('batch') || toolName.includes('csv_import')) {
      return 'batch';
    }
    if (toolName.includes('_delete_')) {
      return 'delete';
    }
    if (toolName.includes('_create_')) {
      return 'create';
    }
    if (toolName.includes('_update_')) {
      return 'update';
    }
    if (toolName.includes('_get_') || toolName.includes('_list_') || toolName.includes('_search')) {
      return 'read';
    }
    // Admin tools: health_check, cache_stats, clear_cache, metrics
    if (toolName.includes('health') || toolName.includes('cache') || toolName.includes('metrics')) {
      return 'admin';
    }
    // Default to create for unknown operations (conservative)
    return 'create';
  }

  // Refill tokens based on elapsed time
  private refillTokens(category: ToolCategory): void {
    const bucket = this.buckets.get(category)!;
    const config = this.limits[category];
    const now = Date.now();
    const elapsedMs = now - bucket.lastRefill;
    const tokensToAdd = (elapsedMs / 60000) * config.requestsPerMinute;

    bucket.tokens = Math.min(config.burstSize, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Clean up old timestamps (older than 1 minute)
    const oneMinuteAgo = now - 60000;
    bucket.requestTimestamps = bucket.requestTimestamps.filter(t => t > oneMinuteAgo);
  }

  // Check if a tool can be executed (acquire token)
  async acquire(toolName: string): Promise<{ allowed: boolean; waitTimeMs: number; category: ToolCategory }> {
    const category = this.categorize(toolName);
    this.refillTokens(category);

    const bucket = this.buckets.get(category)!;
    const config = this.limits[category];

    // Check if we have tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      bucket.requestTimestamps.push(Date.now());
      return { allowed: true, waitTimeMs: 0, category };
    }

    // Calculate wait time until next token is available
    const msPerToken = 60000 / config.requestsPerMinute;
    const waitTimeMs = Math.ceil(msPerToken - ((Date.now() - bucket.lastRefill) % msPerToken));

    return { allowed: false, waitTimeMs, category };
  }

  // Wait for rate limit and then proceed
  async waitAndAcquire(toolName: string): Promise<ToolCategory> {
    let result = await this.acquire(toolName);

    while (!result.allowed) {
      logger.debug('Tool rate limited, waiting', {
        toolName,
        category: result.category,
        waitTimeMs: result.waitTimeMs,
      });
      await new Promise(resolve => setTimeout(resolve, result.waitTimeMs));
      result = await this.acquire(toolName);
    }

    return result.category;
  }

  // Get metrics for a specific category or all categories
  getMetrics(category?: ToolCategory): ToolRateLimitMetrics | Record<ToolCategory, ToolRateLimitMetrics> {
    if (category) {
      this.refillTokens(category);
      const bucket = this.buckets.get(category)!;
      const lastTimestamp = bucket.requestTimestamps[bucket.requestTimestamps.length - 1];
      return {
        category,
        requestsInLastMinute: bucket.requestTimestamps.length,
        tokensRemaining: Math.floor(bucket.tokens),
        isThrottled: bucket.tokens < 1,
        lastRequestTime: lastTimestamp !== undefined
          ? new Date(lastTimestamp).toISOString()
          : 'never',
      };
    }

    const allMetrics: Record<ToolCategory, ToolRateLimitMetrics> = {} as any;
    for (const cat of Object.keys(this.limits) as ToolCategory[]) {
      allMetrics[cat] = this.getMetrics(cat) as ToolRateLimitMetrics;
    }
    return allMetrics;
  }

  // Get limit configuration
  getLimits(): Record<ToolCategory, ToolRateLimitConfig> {
    return { ...this.limits };
  }
}

// Singleton tool rate limiter
const toolRateLimiter = new ToolRateLimiter();

// Operation Timeout Configuration
type OperationType = 'read' | 'create' | 'update' | 'delete' | 'batch' | 'search' | 'default';

interface OperationTimeoutConfig {
  timeouts: Record<OperationType, number>;
  getTimeout(operationName: string): number;
}

function createOperationTimeoutConfig(defaultTimeoutMs: number): OperationTimeoutConfig {
  const timeouts: Record<OperationType, number> = {
    read: defaultTimeoutMs,                    // Standard read operations
    create: defaultTimeoutMs * 1.5,            // Create operations may take longer
    update: defaultTimeoutMs * 1.5,            // Update operations may take longer
    delete: defaultTimeoutMs,                  // Delete operations are usually quick
    batch: defaultTimeoutMs * 5,               // Batch operations need much more time
    search: defaultTimeoutMs * 2,              // Search operations may involve complex queries
    default: defaultTimeoutMs,
  };

  return {
    timeouts,
    getTimeout(operationName: string): number {
      const lowerName = operationName.toLowerCase();

      if (lowerName.includes('batch') || lowerName.includes('csv')) {
        return timeouts.batch;
      }
      if (lowerName.includes('search') || lowerName.includes('list') || lowerName.includes('query')) {
        return timeouts.search;
      }
      if (lowerName.includes('create')) {
        return timeouts.create;
      }
      if (lowerName.includes('update') || lowerName.includes('patch')) {
        return timeouts.update;
      }
      if (lowerName.includes('delete')) {
        return timeouts.delete;
      }
      if (lowerName.includes('get')) {
        return timeouts.read;
      }
      return timeouts.default;
    },
  };
}

// Main Client
class StateSetMCPClient {
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
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: config.timeoutMs, // Default timeout, will be overridden per-request
    });

    this.apiClient.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        logger.error('API request failed', { message: error.message, code: error.code });
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

  /**
   * Execute an API call with circuit breaker protection and rate limiting
   */
  private async executeWithProtection<T>(
    fn: () => Promise<T>,
    operationName: string
  ): Promise<T> {
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
    ttlMs: number = 60000 // 1 minute default
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
      operationName
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
    const response = await this.executeWithProtection(
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
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/orders/${args.order_id}`, args),
      'updateOrder'
    );
    return this.enrichResponse(response.data);
  }

  async createWarranty(args: CreateWarrantyArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
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
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/warranties/${args.warranty_id}`, args),
      'updateWarranty'
    );
    return this.enrichResponse(response.data);
  }

  async createShipment(args: CreateShipmentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
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
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/shipments/${args.shipment_id}`, args),
      'updateShipment'
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
      },
      120000 // 2 minute TTL
    );
  }

  async getOrder(orderId: string): Promise<StateSetResponse> {
    return this.getCached(
      `order:${orderId}`,
      'orders',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/orders/${orderId}`),
          'getOrder'
        );
        return this.enrichResponse(response.data);
      },
      120000
    );
  }

  async getWarranty(warrantyId: string): Promise<StateSetResponse> {
    return this.getCached(
      `warranty:${warrantyId}`,
      'warranties',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/warranties/${warrantyId}`),
          'getWarranty'
        );
        return this.enrichResponse(response.data);
      },
      120000
    );
  }

  async getShipment(shipmentId: string): Promise<StateSetResponse> {
    return this.getCached(
      `shipment:${shipmentId}`,
      'shipments',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/shipments/${shipmentId}`),
          'getShipment'
        );
        return this.enrichResponse(response.data);
      },
      60000 // 1 minute TTL for shipments (they change more frequently)
    );
  }

  async getBillOfMaterials(bomId: string): Promise<StateSetResponse> {
    return this.getCached(
      `bom:${bomId}`,
      'bom',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/bill-of-materials/${bomId}`),
          'getBillOfMaterials'
        );
        return this.enrichResponse(response.data);
      },
      300000 // 5 minute TTL for BOMs (they change infrequently)
    );
  }

  async getWorkOrder(workOrderId: string): Promise<StateSetResponse> {
    return this.getCached(
      `workorder:${workOrderId}`,
      'workorders',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/work-orders/${workOrderId}`),
          'getWorkOrder'
        );
        return this.enrichResponse(response.data);
      },
      60000
    );
  }

  async getManufacturerOrder(manufacturerOrderId: string): Promise<StateSetResponse> {
    return this.getCached(
      `mfgorder:${manufacturerOrderId}`,
      'mfgorders',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/manufacturer-orders/${manufacturerOrderId}`),
          'getManufacturerOrder'
        );
        return this.enrichResponse(response.data);
      },
      120000
    );
  }

  async getInvoice(invoiceId: string): Promise<StateSetResponse> {
    return this.getCached(
      `invoice:${invoiceId}`,
      'invoices',
      async () => {
        const response = await this.executeWithProtection(
          () => this.apiClient.get(`/invoices/${invoiceId}`),
          'getInvoice'
        );
        return this.enrichResponse(response.data);
      },
      120000
    );
  }

  async getPayment(paymentId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/payments/${paymentId}`),
      'getPayment'
    );
    return this.enrichResponse(response.data);
  }

  async createBillOfMaterials(args: CreateBillOfMaterialsArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/bill-of-materials', args),
      'createBillOfMaterials'
    );
    return this.enrichResponse(response.data);
  }

  async updateBillOfMaterials(args: UpdateBillOfMaterialsArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/bill-of-materials/${args.bill_of_materials_id}`, args), 
      'updateBillOfMaterials'
    );
    return this.enrichResponse(response.data);
  }

  async createWorkOrder(args: CreateWorkOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/work-orders', args),
      'createWorkOrder'
    );
    return this.enrichResponse(response.data);
  }

  async updateWorkOrder(args: UpdateWorkOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/work-orders/${args.work_order_id}`, args),  
      'updateWorkOrder'
    );
    return this.enrichResponse(response.data);
  }

  async createManufacturerOrder(args: CreateManufacturerOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/manufacturer-orders', args),
      'createManufacturerOrder'
    );
    return this.enrichResponse(response.data);
  }

  async updateManufacturerOrder(args: UpdateManufacturerOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/manufacturer-orders/${args.manufacturer_order_id}`, args),
      'updateManufacturerOrder'
    );
    return this.enrichResponse(response.data);
  }

  async createPurchaseOrder(args: CreatePurchaseOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/purchase-orders', args),
      'createPurchaseOrder'
    );
    return this.enrichResponse(response.data);
  }

  async updatePurchaseOrder(args: UpdatePurchaseOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/purchase-orders/${args.purchase_order_id}`, args),
      'updatePurchaseOrder'
    );
    return this.enrichResponse(response.data);
  }

  async deletePurchaseOrder(args: DeletePurchaseOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/purchase-orders/${args.purchase_order_id}`),
      'deletePurchaseOrder'
    );
    return this.enrichResponse(response.data);
  }

  async getPurchaseOrder(purchaseOrderId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/purchase-orders/${purchaseOrderId}`),
      'getPurchaseOrder'
    );
    return this.enrichResponse(response.data);
  }

  async listPurchaseOrders(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/purchase-orders', { params: args }),
      'listPurchaseOrders'
    );
    return this.enrichListResponse(response.data);
  }

  async createASN(args: CreateASNArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/asns', args),
      'createASN'
    );
    return this.enrichResponse(response.data);
  }

  async updateASN(args: UpdateASNArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/asns/${args.asn_id}`, args),
      'updateASN'
    );
    return this.enrichResponse(response.data);
  }

  async deleteASN(args: DeleteASNArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/asns/${args.asn_id}`),
      'deleteASN'
    );
    return this.enrichResponse(response.data);
  }

  async getASN(asnId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/asns/${asnId}`),
      'getASN'
    );
    return this.enrichResponse(response.data);
  }

  async listASNs(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/asns', { params: args }),
      'listASNs'
    );
    return this.enrichListResponse(response.data);
  }

  async createInvoice(args: CreateInvoiceArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/invoices', args),
      'createInvoice'
    );
    return this.enrichResponse(response.data);
  }

  async updateInvoice(args: UpdateInvoiceArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/invoices/${args.invoice_id}`, args),
      'updateInvoice'
    );
    return this.enrichResponse(response.data);
  }

  async createPayment(args: CreatePaymentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/payments', args),
      'createPayment'
    );
    return this.enrichResponse(response.data);
  }

  async updatePayment(args: UpdatePaymentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/payments/${args.payment_id}`, args),
      'updatePayment'
    );
    return this.enrichResponse(response.data);
  }

  async createSalesOrder(args: CreateSalesOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/sales-orders', args),
      'createSalesOrder'
    );
    return this.enrichResponse(response.data);
  }

  async updateSalesOrder(args: UpdateSalesOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/sales-orders/${args.sales_order_id}`, args),
      'updateSalesOrder'
    );
    return this.enrichResponse(response.data);
  }

  async deleteSalesOrder(args: DeleteSalesOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/sales-orders/${args.sales_order_id}`),
      'deleteSalesOrder'
    );
    return this.enrichResponse(response.data);
  }

  async getSalesOrder(salesOrderId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/sales-orders/${salesOrderId}`),
      'getSalesOrder'
    );
    return this.enrichResponse(response.data);
  }

  async listSalesOrders(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/sales-orders', { params: args }),
      'listSalesOrders'
    );
    return this.enrichListResponse(response.data);
  }

  async createFulfillmentOrder(args: CreateFulfillmentOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/fulfillment-orders', args),
      'createFulfillmentOrder'
    );
    return this.enrichResponse(response.data);
  }

  async updateFulfillmentOrder(args: UpdateFulfillmentOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/fulfillment-orders/${args.fulfillment_order_id}`, args),
      'updateFulfillmentOrder'
    );
    return this.enrichResponse(response.data);
  }

  async deleteFulfillmentOrder(args: DeleteFulfillmentOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/fulfillment-orders/${args.fulfillment_order_id}`),
      'deleteFulfillmentOrder'
    );
    return this.enrichResponse(response.data);
  }

  async getFulfillmentOrder(fulfillmentOrderId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/fulfillment-orders/${fulfillmentOrderId}`),
      'getFulfillmentOrder'
    );
    return this.enrichResponse(response.data);
  }

  async listFulfillmentOrders(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/fulfillment-orders', { params: args }),
      'listFulfillmentOrders'
    );
    return this.enrichListResponse(response.data);
  }

  async createItemReceipt(args: CreateItemReceiptArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/item-receipts', args),
      'createItemReceipt'
    );
    return this.enrichResponse(response.data);
  }

  async updateItemReceipt(args: UpdateItemReceiptArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/item-receipts/${args.item_receipt_id}`, args),
      'updateItemReceipt'
    );
    return this.enrichResponse(response.data);
  }

  async deleteItemReceipt(args: DeleteItemReceiptArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/item-receipts/${args.item_receipt_id}`),
      'deleteItemReceipt'
    );
    return this.enrichResponse(response.data);
  }

  async getItemReceipt(itemReceiptId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/item-receipts/${itemReceiptId}`),
      'getItemReceipt'
    );
    return this.enrichResponse(response.data);
  }

  async listItemReceipts(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/item-receipts', { params: args }),
      'listItemReceipts'
    );
    return this.enrichListResponse(response.data);
  }

  async createCashSale(args: CreateCashSaleArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/cash-sales', args),
      'createCashSale'
    );
    return this.enrichResponse(response.data);
  }

  async updateCashSale(args: UpdateCashSaleArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/cash-sales/${args.cash_sale_id}`, args),
      'updateCashSale'
    );
    return this.enrichResponse(response.data);
  }

  async deleteCashSale(args: DeleteCashSaleArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/cash-sales/${args.cash_sale_id}`),
      'deleteCashSale'
    );
    return this.enrichResponse(response.data);
  }

  async getCashSale(cashSaleId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/cash-sales/${cashSaleId}`),
      'getCashSale'
    );
    return this.enrichResponse(response.data);
  }

  async listCashSales(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/cash-sales', { params: args }),
      'listCashSales'
    );
    return this.enrichListResponse(response.data);
  }

  async createCustomer(args: CreateCustomerArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/customers', args),
      'createCustomer'
    );
    return this.enrichResponse(response.data);
  }

  async updateCustomer(args: UpdateCustomerArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/customers/${args.customer_id}`, args),
      'updateCustomer'
    );
    return this.enrichResponse(response.data);
  }

  async deleteCustomer(args: DeleteCustomerArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/customers/${args.customer_id}`),
      'deleteCustomer'
    );
    return this.enrichResponse(response.data);
  }

  async getCustomer(customerId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/customers/${customerId}`),
      'getCustomer'
    );
    return this.enrichResponse(response.data);
  }

  async listCustomers(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/customers', { params: args }),
      'listCustomers'
    );
    return this.enrichListResponse(response.data);
  }

  async deleteRMA(args: DeleteRMAArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/rmas/${args.rma_id}`),
      'deleteRMA'
    );
    return this.enrichResponse(response.data);
  }

  async deleteOrder(args: DeleteOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/orders/${args.order_id}`),
      'deleteOrder'
    );
    return this.enrichResponse(response.data);
  }

  async deleteWarranty(args: DeleteWarrantyArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/warranties/${args.warranty_id}`),
      'deleteWarranty'
    );
    return this.enrichResponse(response.data);
  }

  async deleteShipment(args: DeleteShipmentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/shipments/${args.shipment_id}`),
      'deleteShipment'
    );
    return this.enrichResponse(response.data);
  }

  async deleteBillOfMaterials(args: DeleteBillOfMaterialsArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/bill-of-materials/${args.bill_of_materials_id}`),
      'deleteBillOfMaterials'
    );
    return this.enrichResponse(response.data);
  }

  async deleteWorkOrder(args: DeleteWorkOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/work-orders/${args.work_order_id}`),
      'deleteWorkOrder'
    );
    return this.enrichResponse(response.data);
  }

  async deleteManufacturerOrder(args: DeleteManufacturerOrderArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/manufacturer-orders/${args.manufacturer_order_id}`),
      'deleteManufacturerOrder'
    );
    return this.enrichResponse(response.data);
  }

  async deleteInvoice(args: DeleteInvoiceArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/invoices/${args.invoice_id}`),
      'deleteInvoice'
    );
    return this.enrichResponse(response.data);
  }

  async deletePayment(args: DeletePaymentArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/payments/${args.payment_id}`),
      'deletePayment'
    );
    return this.enrichResponse(response.data);
  }

  async listRMAs(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/rmas', { params: args }),
      'listRMAs'
    );
    return this.enrichListResponse(response.data);
  }

  async listOrders(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/orders', { params: args }),
      'listOrders'
    );
    return this.enrichListResponse(response.data);
  }

  async listWarranties(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/warranties', { params: args }),
      'listWarranties'
    );
    return this.enrichListResponse(response.data);
  }

  async listShipments(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/shipments', { params: args }),
      'listShipments'
    );
    return this.enrichListResponse(response.data);
  }

  async listBillOfMaterials(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/bill-of-materials', { params: args }),
      'listBillOfMaterials'
    );
    return this.enrichListResponse(response.data);
  }

  async listWorkOrders(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/work-orders', { params: args }),
      'listWorkOrders'
    );
    return this.enrichListResponse(response.data);
  }

  async listManufacturerOrders(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/manufacturer-orders', { params: args }),
      'listManufacturerOrders'
    );
    return this.enrichListResponse(response.data);
  }

  async listInvoices(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/invoices', { params: args }),
      'listInvoices'
    );
    return this.enrichListResponse(response.data);
  }

  async listPayments(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/payments', { params: args }),
      'listPayments'
    );
    return this.enrichListResponse(response.data);
  }

  async createProduct(args: CreateProductArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/products', args),
      'createProduct'
    );
    return this.enrichResponse(response.data);
  }

  async updateProduct(args: UpdateProductArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/products/${args.product_id}`, args),
      'updateProduct'
    );
    return this.enrichResponse(response.data);
  }

  async deleteProduct(args: DeleteProductArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/products/${args.product_id}`),
      'deleteProduct'
    );
    return this.enrichResponse(response.data);
  }

  async getProduct(productId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/products/${productId}`),
      'getProduct'
    );
    return this.enrichResponse(response.data);
  }

  async listProducts(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/products', { params: args }),
      'listProducts'
    );
    return this.enrichListResponse(response.data);
  }

  async createInventory(args: CreateInventoryArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.post('/inventory', args),
      'createInventory'
    );
    return this.enrichResponse(response.data);
  }

  async updateInventory(args: UpdateInventoryArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.patch(`/inventory/${args.inventory_id}`, args),
      'updateInventory'
    );
    return this.enrichResponse(response.data);
  }

  async deleteInventory(args: DeleteInventoryArgs): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.delete(`/inventory/${args.inventory_id}`),
      'deleteInventory'
    );
    return this.enrichResponse(response.data);
  }

  async getInventory(inventoryId: string): Promise<StateSetResponse> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get(`/inventory/${inventoryId}`),
      'getInventory'
    );
    return this.enrichResponse(response.data);
  }

  async listInventories(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RateLimiterMetrics } }> {
    const response = await this.executeWithProtection(
      () => this.apiClient.get('/inventory', { params: args }),
      'listInventories'
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
      status: cbHealthy ? 'healthy' : (cbStatus.state === CircuitState.HALF_OPEN ? 'degraded' : 'unhealthy'),
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

// Real-time update broadcaster
function broadcastResourceUpdate(
  resourceType: string,
  resourceId: string,
  action: 'created' | 'updated' | 'deleted',
  data: any
): void {
  // Broadcast to resource-specific channel (e.g., "orders" or "orders:123")
  wsManager.broadcast(resourceType, {
    action,
    resourceId,
    data,
    timestamp: new Date().toISOString(),
  });

  // Also broadcast to the specific resource channel
  wsManager.broadcast(`${resourceType}:${resourceId}`, {
    action,
    resourceId,
    data,
    timestamp: new Date().toISOString(),
  });

  logger.debug('Real-time update broadcasted', {
    resourceType,
    resourceId,
    action,
  });
}

// Main Function
async function main(): Promise<void> {
  try {
    dotenv.config();
    const env = z.object({
      STATESET_API_KEY: z.string().min(1, 'STATESET_API_KEY is required'),
      STATESET_BASE_URL: z.string().url().default('https://api.stateset.io/v1'),
      REQUESTS_PER_HOUR: z.coerce.number().positive().default(1000),
      API_TIMEOUT_MS: z.coerce.number().positive().default(10000),
      WEBSOCKET_PORT: z.coerce.number().positive().default(8081),
    }).parse(process.env);

    const config: Config = {
      apiKey: env.STATESET_API_KEY,
      baseUrl: env.STATESET_BASE_URL,
      requestsPerHour: env.REQUESTS_PER_HOUR,
      timeoutMs: env.API_TIMEOUT_MS,
    };

    const client = new StateSetMCPClient(config);

    // Start WebSocket server for real-time updates
    try {
      wsManager.start(env.WEBSOCKET_PORT);
      logger.info('WebSocket server started', { port: env.WEBSOCKET_PORT });
    } catch (wsError) {
      logger.warn('Failed to start WebSocket server - real-time updates will be unavailable', {
        error: wsError instanceof Error ? wsError.message : String(wsError),
      });
    }

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

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();

      // Log incoming request
      logger.debug('Tool request received', {
        requestId,
        tool: request.params.name,
        hasArguments: !!request.params.arguments,
      });

      try {
        // Sanitize input arguments for security
        const rawArgs = request.params.arguments || {};
        const sanitizedArgs = sanitizeToolArguments(rawArgs as Record<string, unknown>, request.params.name);

        // Create a modified request with sanitized arguments
        const safeRequest = {
          ...request,
          params: {
            ...request.params,
            arguments: sanitizedArgs,
          },
        };

        // Apply per-tool rate limiting
        const toolCategory = await toolRateLimiter.waitAndAcquire(safeRequest.params.name);
        logger.debug('Tool rate limit acquired', {
          requestId,
          tool: safeRequest.params.name,
          category: toolCategory,
        });

        switch (safeRequest.params.name) {
          case "stateset_create_rma": {
            const result = await client.createRMA(schemas.CreateRMAArgsSchema.parse(safeRequest.params.arguments) as any);
            broadcastResourceUpdate('rmas', result.id, 'created', result);
            return result;
          }
          case "stateset_update_rma": {
            const args = schemas.UpdateRMAArgsSchema.parse(safeRequest.params.arguments) as any;
            const result = await client.updateRMA(args);
            broadcastResourceUpdate('rmas', args.rma_id, 'updated', result);
            return result;
          }
          case "stateset_create_order": {
            const result = await client.createOrder(schemas.CreateOrderArgsSchema.parse(safeRequest.params.arguments) as any);
            broadcastResourceUpdate('orders', result.id, 'created', result);
            return result;
          }
          case "stateset_update_order": {
            const args = schemas.UpdateOrderArgsSchema.parse(safeRequest.params.arguments) as any;
            const result = await client.updateOrder(args);
            broadcastResourceUpdate('orders', args.order_id, 'updated', result);
            return result;
          }
          case "stateset_create_warranty":
            return await client.createWarranty(schemas.CreateWarrantyArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_update_warranty":
            return await client.updateWarranty(schemas.UpdateWarrantyArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_create_shipment": {
            const result = await client.createShipment(schemas.CreateShipmentArgsSchema.parse(safeRequest.params.arguments) as any);
            broadcastResourceUpdate('shipments', result.id, 'created', result);
            return result;
          }
          case "stateset_update_shipment": {
            const args = schemas.UpdateShipmentArgsSchema.parse(safeRequest.params.arguments) as any;
            const result = await client.updateShipment(args);
            broadcastResourceUpdate('shipments', args.shipment_id, 'updated', result);
            return result;
          }
          case "stateset_create_bill_of_materials":
            return await client.createBillOfMaterials(schemas.CreateBillOfMaterialsArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_update_bill_of_materials":
            return await client.updateBillOfMaterials(schemas.UpdateBillOfMaterialsArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_create_work_order":
            return await client.createWorkOrder(schemas.CreateWorkOrderArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_update_work_order":
            return await client.updateWorkOrder(schemas.UpdateWorkOrderArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_create_manufacturer_order":
            return await client.createManufacturerOrder(schemas.CreateManufacturerOrderArgsSchema.parse(safeRequest.params.arguments) as any);
        case "stateset_update_manufacturer_order":
          return await client.updateManufacturerOrder(schemas.UpdateManufacturerOrderArgsSchema.parse(safeRequest.params.arguments) as any);
        case "stateset_create_purchase_order":
          return await client.createPurchaseOrder(schemas.CreatePurchaseOrderArgsSchema.parse(safeRequest.params.arguments) as any);
        case "stateset_update_purchase_order":
          return await client.updatePurchaseOrder(schemas.UpdatePurchaseOrderArgsSchema.parse(safeRequest.params.arguments) as any);
        case "stateset_delete_purchase_order":
          return await client.deletePurchaseOrder(schemas.DeletePurchaseOrderArgsSchema.parse(safeRequest.params.arguments) as any);
        case "stateset_get_purchase_order":
          return await client.getPurchaseOrder(schemas.GetPurchaseOrderArgsSchema.parse(safeRequest.params.arguments).purchase_order_id);
        case "stateset_list_purchase_orders":
          return await client.listPurchaseOrders(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
        case "stateset_create_asn":
          return await client.createASN(schemas.CreateASNArgsSchema.parse(safeRequest.params.arguments) as any);
        case "stateset_update_asn":
          return await client.updateASN(schemas.UpdateASNArgsSchema.parse(safeRequest.params.arguments) as any);
        case "stateset_delete_asn":
          return await client.deleteASN(schemas.DeleteASNArgsSchema.parse(safeRequest.params.arguments) as any);
        case "stateset_get_asn":
          return await client.getASN(schemas.GetASNArgsSchema.parse(safeRequest.params.arguments).asn_id);
        case "stateset_list_asns":
          return await client.listASNs(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
        case "stateset_create_invoice":
          return await client.createInvoice(schemas.CreateInvoiceArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_update_invoice":
            return await client.updateInvoice(schemas.UpdateInvoiceArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_create_payment":
            return await client.createPayment(schemas.CreatePaymentArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_update_payment":
            return await client.updatePayment(schemas.UpdatePaymentArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_create_sales_order":
            return await client.createSalesOrder(schemas.CreateSalesOrderArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_update_sales_order":
            return await client.updateSalesOrder(schemas.UpdateSalesOrderArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_create_fulfillment_order":
            return await client.createFulfillmentOrder(schemas.CreateFulfillmentOrderArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_update_fulfillment_order":
            return await client.updateFulfillmentOrder(schemas.UpdateFulfillmentOrderArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_create_item_receipt":
            return await client.createItemReceipt(schemas.CreateItemReceiptArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_update_item_receipt":
            return await client.updateItemReceipt(schemas.UpdateItemReceiptArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_create_cash_sale":
            return await client.createCashSale(schemas.CreateCashSaleArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_update_cash_sale":
            return await client.updateCashSale(schemas.UpdateCashSaleArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_create_product":
            return await client.createProduct(schemas.CreateProductArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_update_product":
            return await client.updateProduct(schemas.UpdateProductArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_create_inventory":
            return await client.createInventory(schemas.CreateInventoryArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_update_inventory":
            return await client.updateInventory(schemas.UpdateInventoryArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_create_customer":
            return await client.createCustomer(schemas.CreateCustomerArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_update_customer":
            return await client.updateCustomer(schemas.UpdateCustomerArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_rma":
            return await client.deleteRMA(schemas.DeleteRMAArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_order": {
            const args = schemas.DeleteOrderArgsSchema.parse(safeRequest.params.arguments) as any;
            const result = await client.deleteOrder(args);
            broadcastResourceUpdate('orders', args.order_id, 'deleted', { id: args.order_id });
            return result;
          }
          case "stateset_delete_sales_order":
            return await client.deleteSalesOrder(schemas.DeleteSalesOrderArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_warranty":
            return await client.deleteWarranty(schemas.DeleteWarrantyArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_shipment":
            return await client.deleteShipment(schemas.DeleteShipmentArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_bill_of_materials":
            return await client.deleteBillOfMaterials(schemas.DeleteBillOfMaterialsArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_work_order":
            return await client.deleteWorkOrder(schemas.DeleteWorkOrderArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_manufacturer_order":
            return await client.deleteManufacturerOrder(schemas.DeleteManufacturerOrderArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_invoice":
            return await client.deleteInvoice(schemas.DeleteInvoiceArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_payment":
            return await client.deletePayment(schemas.DeletePaymentArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_fulfillment_order":
            return await client.deleteFulfillmentOrder(schemas.DeleteFulfillmentOrderArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_item_receipt":
            return await client.deleteItemReceipt(schemas.DeleteItemReceiptArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_cash_sale":
            return await client.deleteCashSale(schemas.DeleteCashSaleArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_product":
            return await client.deleteProduct(schemas.DeleteProductArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_inventory":
            return await client.deleteInventory(schemas.DeleteInventoryArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_delete_customer":
            return await client.deleteCustomer(schemas.DeleteCustomerArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_get_rma":
            return await client.getRMA(schemas.GetRMAArgsSchema.parse(safeRequest.params.arguments).rma_id);
          case "stateset_get_order":
            return await client.getOrder(schemas.GetOrderArgsSchema.parse(safeRequest.params.arguments).order_id);
          case "stateset_get_warranty":
            return await client.getWarranty(schemas.GetWarrantyArgsSchema.parse(safeRequest.params.arguments).warranty_id);
          case "stateset_get_shipment":
            return await client.getShipment(schemas.GetShipmentArgsSchema.parse(safeRequest.params.arguments).shipment_id);
          case "stateset_get_bill_of_materials":
            return await client.getBillOfMaterials(schemas.GetBillOfMaterialsArgsSchema.parse(safeRequest.params.arguments).bill_of_materials_id);
          case "stateset_get_work_order":
            return await client.getWorkOrder(schemas.GetWorkOrderArgsSchema.parse(safeRequest.params.arguments).work_order_id);
          case "stateset_get_manufacturer_order":
            return await client.getManufacturerOrder(schemas.GetManufacturerOrderArgsSchema.parse(safeRequest.params.arguments).manufacturer_order_id);
          case "stateset_get_invoice":
            return await client.getInvoice(schemas.GetInvoiceArgsSchema.parse(safeRequest.params.arguments).invoice_id);
          case "stateset_get_payment":
            return await client.getPayment(schemas.GetPaymentArgsSchema.parse(safeRequest.params.arguments).payment_id);
          case "stateset_get_sales_order":
            return await client.getSalesOrder(schemas.GetSalesOrderArgsSchema.parse(safeRequest.params.arguments).sales_order_id);
          case "stateset_get_fulfillment_order":
            return await client.getFulfillmentOrder(schemas.GetFulfillmentOrderArgsSchema.parse(safeRequest.params.arguments).fulfillment_order_id);
          case "stateset_get_item_receipt":
            return await client.getItemReceipt(schemas.GetItemReceiptArgsSchema.parse(safeRequest.params.arguments).item_receipt_id);
          case "stateset_get_cash_sale":
            return await client.getCashSale(schemas.GetCashSaleArgsSchema.parse(safeRequest.params.arguments).cash_sale_id);
          case "stateset_get_product":
            return await client.getProduct(schemas.GetProductArgsSchema.parse(safeRequest.params.arguments).product_id);
          case "stateset_get_inventory":
            return await client.getInventory(schemas.GetInventoryArgsSchema.parse(safeRequest.params.arguments).inventory_id);
          case "stateset_get_customer":
            return await client.getCustomer(schemas.GetCustomerArgsSchema.parse(safeRequest.params.arguments).customer_id);

          case "stateset_list_rmas":
            return await client.listRMAs(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_orders":
            return await client.listOrders(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_sales_orders":
            return await client.listSalesOrders(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_warranties":
            return await client.listWarranties(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_shipments":
            return await client.listShipments(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_fulfillment_orders":
            return await client.listFulfillmentOrders(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_item_receipts":
            return await client.listItemReceipts(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_cash_sales":
            return await client.listCashSales(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_bill_of_materials":
            return await client.listBillOfMaterials(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_work_orders":
            return await client.listWorkOrders(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_manufacturer_orders":
            return await client.listManufacturerOrders(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_invoices":
            return await client.listInvoices(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_payments":
            return await client.listPayments(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_products":
            return await client.listProducts(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_inventories":
            return await client.listInventories(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_list_customers":
            return await client.listCustomers(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
          case "stateset_get_api_metrics":
            return client.getApiMetrics();

          case "stateset_tool_rate_limits": {
            const args = safeRequest.params.arguments as { category?: string };
            const metrics = args.category
              ? toolRateLimiter.getMetrics(args.category as any)
              : toolRateLimiter.getMetrics();
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  metrics,
                  limits: toolRateLimiter.getLimits(),
                  description: "Per-tool rate limits by category. Tokens refill continuously based on requestsPerMinute.",
                }, null, 2),
              }],
            };
          }

          case "stateset_timeout_config": {
            const timeouts = client.getTimeoutConfig();
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  timeouts,
                  description: "Per-operation timeout configuration in milliseconds. Batch operations have longest timeouts, read operations have shortest.",
                  examples: {
                    "getOrder (read)": `${timeouts.read}ms`,
                    "createOrder (create)": `${timeouts.create}ms`,
                    "batchCreateOrders (batch)": `${timeouts.batch}ms`,
                    "searchOrders (search)": `${timeouts.search}ms`,
                  },
                }, null, 2),
              }],
            };
          }

          case "stateset_health_check": {
            const args = safeRequest.params.arguments as any;
            const healthResult = await client.healthCheck(args.include_details || false);
            return {
              content: [{ type: "text", text: JSON.stringify(healthResult, null, 2) }],
            };
          }

          // Batch operations
          case "stateset_batch_operations": {
            const args = safeRequest.params.arguments as any;
            const result = await executeBatchOperations(client, args.operations, args.options);
            return {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
          }
          case "stateset_batch_create_orders": {
            const args = safeRequest.params.arguments as any;
            const operations = args.orders.map((order: any) => ({
              type: 'create',
              resource: 'order',
              data: order,
            }));
            const result = await executeBatchOperations(client, operations, args.options);
            return {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
          }
          case "stateset_batch_update_inventory": {
            const args = safeRequest.params.arguments as any;
            const operations = args.items.map((item: any) => ({
              type: 'update',
              resource: 'inventory',
              data: item,
            }));
            const result = await executeBatchOperations(client, operations, args.options);
            return {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
          }
          case "stateset_csv_import": {
            const args = safeRequest.params.arguments as any;
            // Parse CSV content and create operations
            const rows = args.content.split('\n').filter((row: string) => row.trim());
            const headers = rows[0]?.split(',').map((h: string) => h.trim()) || [];
            const operations = rows.slice(1).map((row: string) => {
              const values = row.split(',').map((v: string) => v.trim());
              const data: any = {};
              headers.forEach((header: string, i: number) => {
                data[header] = values[i];
              });
              return {
                type: 'create',
                resource: args.resource,
                data,
              };
            });
            const result = await executeBatchOperations(client, operations, args.options);
            return {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
          }

          // Cache operations
          case "stateset_cache_stats": {
            const args = safeRequest.params.arguments as any;
            const stats = client.getCacheStats();
            return {
              content: [{ type: "text", text: JSON.stringify(
                args.namespace ? (stats as any)[args.namespace] || {} : stats,
                null, 2
              ) }],
            };
          }

          case "stateset_clear_cache": {
            const args = safeRequest.params.arguments as any;
            if (args.namespace) {
              client.invalidateCache(args.namespace);
            } else {
              // Clear all known cache namespaces
              ['rmas', 'orders', 'warranties', 'shipments', 'bom', 'workorders', 'mfgorders', 'invoices', 'products', 'inventory', 'customers'].forEach(ns => {
                client.invalidateCache(ns);
              });
            }
            return {
              content: [{ type: "text", text: JSON.stringify({
                success: true,
                message: args.namespace
                  ? `Cache namespace '${args.namespace}' cleared`
                  : 'All caches cleared',
              }, null, 2) }],
            };
          }

          case "stateset_websocket_stats": {
            const stats = wsManager.getStats();
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  ...stats,
                  description: "WebSocket server statistics for real-time updates. Clients can subscribe to channels like 'orders', 'rmas', 'shipments' etc. to receive live updates.",
                  availableChannels: [
                    "orders", "rmas", "warranties", "shipments", "invoices",
                    "products", "inventory", "customers", "work_orders",
                    "manufacturer_orders", "purchase_orders", "asns"
                  ],
                }, null, 2),
              }],
            };
          }

          // Search operations
          case "stateset_advanced_search": {
            const args = safeRequest.params.arguments as any;
            const searchQuery = buildSearchQuery(
              args.filters || [],
              args.sort || [],
              args.page || 1,
              args.per_page || 20
            );

            // Map resource type to list method
            const resourceMap: Record<string, () => Promise<any>> = {
              orders: () => client.listOrders(searchQuery),
              products: () => client.listProducts(searchQuery),
              customers: () => client.listCustomers(searchQuery),
              inventory: () => client.listInventories(searchQuery),
              rmas: () => client.listRMAs(searchQuery),
              invoices: () => client.listInvoices(searchQuery),
            };

            const listFn = resourceMap[args.resource];
            if (!listFn) {
              throw new Error(`Unknown resource type: ${args.resource}`);
            }

            const results = await listFn();
            return {
              content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
            };
          }

          case "stateset_search_orders_by_date": {
            const args = safeRequest.params.arguments as any;
            const filters: any[] = [];

            if (args.date_range?.start) {
              filters.push({ field: 'created_at', operator: 'gte', value: args.date_range.start });
            }
            if (args.date_range?.end) {
              filters.push({ field: 'created_at', operator: 'lte', value: args.date_range.end });
            }
            if (args.status?.length) {
              filters.push({ field: 'status', operator: 'in', value: args.status });
            }
            if (args.customer_email) {
              filters.push({ field: 'customer_email', operator: 'eq', value: args.customer_email });
            }
            if (args.min_total !== undefined) {
              filters.push({ field: 'total_amount', operator: 'gte', value: args.min_total });
            }
            if (args.max_total !== undefined) {
              filters.push({ field: 'total_amount', operator: 'lte', value: args.max_total });
            }

            const sort = args.sort_by ? [{ field: args.sort_by, order: args.sort_order || 'desc' }] : [];
            const searchQuery = buildSearchQuery(filters, sort, 1, 100);
            const results = await client.listOrders(searchQuery);

            return {
              content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
            };
          }

          case "stateset_search_products_with_inventory": {
            const args = safeRequest.params.arguments as any;
            const filters: any[] = [];

            if (args.query) {
              filters.push({ field: 'name', operator: 'contains', value: args.query });
            }
            if (args.categories?.length) {
              filters.push({ field: 'category', operator: 'in', value: args.categories });
            }
            if (args.price_range?.min !== undefined) {
              filters.push({ field: 'price', operator: 'gte', value: args.price_range.min });
            }
            if (args.price_range?.max !== undefined) {
              filters.push({ field: 'price', operator: 'lte', value: args.price_range.max });
            }
            if (args.in_stock_only) {
              filters.push({ field: 'stock_quantity', operator: 'gt', value: 0 });
            }
            if (args.min_stock_level !== undefined) {
              filters.push({ field: 'stock_quantity', operator: 'gte', value: args.min_stock_level });
            }

            const searchQuery = buildSearchQuery(filters, [], 1, 100);
            const results = await client.listProducts(searchQuery);

            return {
              content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
            };
          }

          case "stateset_search_customer_analytics": {
            const args = safeRequest.params.arguments as any;
            const filters: any[] = [];

            if (args.query) {
              filters.push({ field: 'email', operator: 'contains', value: args.query });
            }
            if (args.min_lifetime_value !== undefined) {
              filters.push({ field: 'lifetime_value', operator: 'gte', value: args.min_lifetime_value });
            }
            if (args.min_order_count !== undefined) {
              filters.push({ field: 'order_count', operator: 'gte', value: args.min_order_count });
            }
            if (args.tags?.length) {
              filters.push({ field: 'tags', operator: 'in', value: args.tags });
            }
            if (args.segment) {
              filters.push({ field: 'segment', operator: 'eq', value: args.segment });
            }

            const searchQuery = buildSearchQuery(filters, [], 1, 100);
            const results = await client.listCustomers(searchQuery);

            return {
              content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
            };
          }

          case "stateset_full_text_search": {
            const args = safeRequest.params.arguments as any;
            const resources = args.resources?.includes('all') ? ['orders', 'products', 'customers', 'rmas', 'invoices'] : (args.resources || ['all']);
            const limit = args.limit || 10;

            const filters = [{ field: 'search', operator: 'contains', value: args.query }];
            const searchQuery = buildSearchQuery(filters, [], 1, limit);

            // Resource search functions mapping
            const resourceSearchers: Record<string, () => Promise<any>> = {
              orders: () => client.listOrders(searchQuery),
              products: () => client.listProducts(searchQuery),
              customers: () => client.listCustomers(searchQuery),
              rmas: () => client.listRMAs(searchQuery),
              invoices: () => client.listInvoices(searchQuery),
            };

            // Execute all searches in parallel for better performance
            const searchPromises = resources
              .filter((r: string) => resourceSearchers[r])
              .map(async (resource: string) => {
                try {
                  const searcher = resourceSearchers[resource];
                  if (!searcher) {
                    return { resource, data: { error: 'Unknown resource type' }, success: false };
                  }
                  const data = await searcher();
                  return { resource, data, success: true };
                } catch (error) {
                  logger.warn('Search failed for resource', { resource, error: error instanceof Error ? error.message : 'Unknown' });
                  return { resource, data: { error: 'Search failed for this resource' }, success: false };
                }
              });

            const results = await Promise.all(searchPromises);

            // Convert array results back to object
            const searchResults = results.reduce((acc, { resource, data }) => {
              acc[resource] = data;
              return acc;
            }, {} as Record<string, any>);

            return {
              content: [{ type: "text", text: JSON.stringify(searchResults, null, 2) }],
            };
          }

          case "stateset_export_search_results": {
            const args = safeRequest.params.arguments as any;
            // Export functionality would typically write to a file
            // For MCP, we return the formatted data
            return {
              content: [{ type: "text", text: JSON.stringify({
                message: 'Export search results requires a search_id from a previous search. Use the advanced_search tool first.',
                search_id: args.search_id,
                format: args.format,
                file_path: args.file_path,
              }, null, 2) }],
            };
          }

          case "stateset_saved_search": {
            const args = safeRequest.params.arguments as any;
            // Saved search management - would typically require persistence
            return {
              content: [{ type: "text", text: JSON.stringify({
                action: args.action,
                message: `Saved search action '${args.action}' acknowledged. This feature requires server-side persistence configuration.`,
                config: args.search_config,
              }, null, 2) }],
            };
          }

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        const duration = Date.now() - startTime;

        // Log failed request
        logger.warn('Tool request failed', {
          requestId,
          tool: request.params.name,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Use the error handler for better error messages
        const apiError = handleError(error, { operation: request.params.name });
        throw new Error(apiError.message);
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
        case 'stateset-purchase-order:':
          const po = await client.getPurchaseOrder(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(po, null, 2) }] };
        case 'stateset-asn:':
          const asn = await client.getASN(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(asn, null, 2) }] };
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
        default:
          throw new Error(`Unsupported URI: ${request.params.uri}`);
      }
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools,
    }));

    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      templates: resourceTemplates,
    }));

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('Server started successfully');

    // Graceful shutdown handling
    let isShuttingDown = false;

    const gracefulShutdown = async (signal: string) => {
      if (isShuttingDown) {
        logger.warn('Shutdown already in progress, forcing exit');
        process.exit(1);
      }

      isShuttingDown = true;
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Close WebSocket connections
        logger.info('Closing WebSocket connections...');
        wsManager.stop();

        // Clear caches
        logger.info('Clearing caches...');
        cacheManager.clear();

        // Close server transport
        logger.info('Closing server transport...');
        await server.close();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

main().catch(console.error);
