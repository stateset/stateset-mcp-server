#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema, 
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema 
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import axios, { AxiosInstance, AxiosError } from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Enhanced configuration with validation
const ConfigSchema = z.object({
  apiKey: z.string().min(1, "STATESET_API_KEY is required"),
  baseUrl: z.string().url().default('https://api.stateset.io/v1'),
  requestsPerHour: z.number().positive().default(1000),
  timeoutMs: z.number().positive().default(10000),
});

const config = ConfigSchema.parse({
  apiKey: process.env.STATESET_API_KEY || 'demo-key',
  baseUrl: process.env.STATESET_BASE_URL || 'https://api.stateset.io/v1',
  requestsPerHour: parseInt(process.env.REQUESTS_PER_HOUR || '1000'),
  timeoutMs: parseInt(process.env.API_TIMEOUT_MS || '10000'),
});

// Enhanced logging
class Logger {
  info(message: string, meta?: any) {
    console.log(`[INFO] ${new Date().toISOString()} ${message}`, meta ? JSON.stringify(meta) : '');
  }
  
  error(message: string, error?: any) {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`, error?.message || error || '');
  }
  
  debug(message: string, meta?: any) {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${new Date().toISOString()} ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }
}

const logger = new Logger();

// Enhanced schemas
const CreateRMASchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  reason: z.string().min(1, "Reason is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const CreateOrderSchema = z.object({
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

const CreateProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
});

const CreateCustomerSchema = z.object({
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

const UpdateInventorySchema = z.object({
  inventory_id: z.string().min(1, "Inventory ID is required"),
  quantity: z.number().nonnegative().optional(),
  location: z.string().min(1, "Location is required").optional(),
});

const ListSchema = z.object({
  page: z.number().positive().optional(),
  per_page: z.number().positive().max(100).optional(),
  search: z.string().optional(),
});

// Rate limiter with retry logic
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private requestTimestamps: number[] = [];

  constructor(private requestsPerHour: number) {}

  async enqueue<T>(fn: () => Promise<T>, operation: string): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          logger.debug(`Starting API request: ${operation}`);
          const result = await this.executeWithRetry(fn, operation);
          this.trackRequest();
          logger.debug(`Completed API request: ${operation}`);
          resolve(result);
        } catch (error) {
          logger.error(`API request failed: ${operation}`, error);
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, operation: string, retries = 3): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === retries || !this.isRetryableError(error)) {
          throw error;
        }
        const delay = Math.pow(2, attempt - 1) * 1000;
        logger.debug(`Retrying ${operation} (attempt ${attempt}/${retries}) after ${delay}ms`);
        await new Promise(res => setTimeout(res, delay));
      }
    }
    throw new Error('Should not reach here');
  }

  private isRetryableError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      return !error.response || 
             error.code === 'ECONNABORTED' ||
             (error.response.status >= 500 && error.response.status < 600) ||
             error.response.status === 429;
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
        const waitTime = Math.max(1000, 3600000 / this.requestsPerHour - (now - this.lastRequestTime));
        if (waitTime > 0) {
          logger.debug(`Rate limiting: waiting ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      const fn = this.queue.shift();
      if (fn) {
        this.lastRequestTime = Date.now();
        await fn();
      }
    }
    this.processing = false;
  }

  private trackRequest(): void {
    const now = Date.now();
    this.requestTimestamps.push(now);
    this.requestTimestamps = this.requestTimestamps.filter(t => t > now - 3600000);
  }

  getMetrics() {
    const now = Date.now();
    const requestsInLastHour = this.requestTimestamps.filter(t => t > now - 3600000).length;
    return {
      totalRequests: this.requestTimestamps.length,
      requestsInLastHour,
      queueLength: this.queue.length,
      lastRequestTime: new Date(this.lastRequestTime).toISOString(),
    };
  }
}

// Enhanced StateSet API Client
class StateSetClient {
  private apiClient: AxiosInstance;
  private rateLimiter: RateLimiter;

  constructor(config: typeof ConfigSchema._type) {
    this.rateLimiter = new RateLimiter(config.requestsPerHour);
    this.apiClient = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'StateSet-MCP-Server/1.0.0',
      },
      timeout: config.timeoutMs,
    });

    this.apiClient.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        logger.error(`API request failed: ${error.message}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
        throw error;
      }
    );
  }

  async createRMA(args: z.infer<typeof CreateRMASchema>) {
    return this.rateLimiter.enqueue(
      () => this.apiClient.post('/rmas', args),
      'createRMA'
    );
  }

  async listRMAs(args: z.infer<typeof ListSchema> = {}) {
    return this.rateLimiter.enqueue(
      () => this.apiClient.get('/rmas', { params: args }),
      'listRMAs'
    );
  }

  async getRMA(id: string) {
    return this.rateLimiter.enqueue(
      () => this.apiClient.get(`/rmas/${id}`),
      'getRMA'
    );
  }

  async createOrder(args: z.infer<typeof CreateOrderSchema>) {
    return this.rateLimiter.enqueue(
      () => this.apiClient.post('/orders', args),
      'createOrder'
    );
  }

  async listOrders(args: z.infer<typeof ListSchema> = {}) {
    return this.rateLimiter.enqueue(
      () => this.apiClient.get('/orders', { params: args }),
      'listOrders'
    );
  }

  async getOrder(id: string) {
    return this.rateLimiter.enqueue(
      () => this.apiClient.get(`/orders/${id}`),
      'getOrder'
    );
  }

  async createProduct(args: z.infer<typeof CreateProductSchema>) {
    return this.rateLimiter.enqueue(
      () => this.apiClient.post('/products', args),
      'createProduct'
    );
  }

  async listProducts(args: z.infer<typeof ListSchema> = {}) {
    return this.rateLimiter.enqueue(
      () => this.apiClient.get('/products', { params: args }),
      'listProducts'
    );
  }

  async getProduct(id: string) {
    return this.rateLimiter.enqueue(
      () => this.apiClient.get(`/products/${id}`),
      'getProduct'
    );
  }

  async createCustomer(args: z.infer<typeof CreateCustomerSchema>) {
    return this.rateLimiter.enqueue(
      () => this.apiClient.post('/customers', args),
      'createCustomer'
    );
  }

  async listCustomers(args: z.infer<typeof ListSchema> = {}) {
    return this.rateLimiter.enqueue(
      () => this.apiClient.get('/customers', { params: args }),
      'listCustomers'
    );
  }

  async getCustomer(id: string) {
    return this.rateLimiter.enqueue(
      () => this.apiClient.get(`/customers/${id}`),
      'getCustomer'
    );
  }

  async updateInventory(args: z.infer<typeof UpdateInventorySchema>) {
    return this.rateLimiter.enqueue(
      () => this.apiClient.patch(`/inventory/${args.inventory_id}`, args),
      'updateInventory'
    );
  }

  async listInventory(args: z.infer<typeof ListSchema> = {}) {
    return this.rateLimiter.enqueue(
      () => this.apiClient.get('/inventory', { params: args }),
      'listInventory'
    );
  }

  getMetrics() {
    return this.rateLimiter.getMetrics();
  }
}

// Enhanced MCP Server
async function main(): Promise<void> {
  try {
    logger.info('Starting Enhanced StateSet MCP Server', { 
      version: '1.0.0',
      apiBaseUrl: config.baseUrl,
      hasApiKey: !!config.apiKey && config.apiKey !== 'demo-key'
    });
    
    const client = new StateSetClient(config);
    const server = new Server(
      { name: "stateset-mcp-server", version: "1.0.0" },
      {
        capabilities: {
          tools: {},
          resources: {},
          resourceTemplates: {},
        },
      }
    );

    // Tool definitions with comprehensive StateSet API coverage
    const tools = [
      {
        name: "stateset_create_rma",
        description: "Create a new Return Merchandise Authorization (RMA)",
        inputSchema: {
          type: "object",
          properties: {
            order_id: { type: "string", description: "Order ID" },
            customer_email: { type: "string", description: "Customer email" },
            reason: { type: "string", description: "Reason for RMA" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item_id: { type: "string" },
                  quantity: { type: "number" }
                },
                required: ["item_id", "quantity"]
              }
            },
            notes: { type: "string", description: "Additional notes" }
          },
          required: ["order_id", "customer_email", "reason", "items"]
        }
      },
      {
        name: "stateset_list_rmas",
        description: "List RMAs with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number" },
            per_page: { type: "number", description: "Items per page (max 100)" },
            search: { type: "string", description: "Search term" }
          }
        }
      },
      {
        name: "stateset_get_rma",
        description: "Get a specific RMA by ID",
        inputSchema: {
          type: "object",
          properties: {
            rma_id: { type: "string", description: "RMA ID" }
          },
          required: ["rma_id"]
        }
      },
      {
        name: "stateset_create_order",
        description: "Create a new order",
        inputSchema: {
          type: "object",
          properties: {
            customer_email: { type: "string", description: "Customer email" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item_id: { type: "string" },
                  quantity: { type: "number" },
                  price: { type: "number" }
                },
                required: ["item_id", "quantity", "price"]
              }
            },
            shipping_address: {
              type: "object",
              properties: {
                line1: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                postal_code: { type: "string" },
                country: { type: "string" }
              },
              required: ["line1", "city", "state", "postal_code", "country"]
            },
            billing_address: {
              type: "object",
              properties: {
                line1: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                postal_code: { type: "string" },
                country: { type: "string" }
              }
            }
          },
          required: ["customer_email", "items", "shipping_address"]
        }
      },
      {
        name: "stateset_list_orders",
        description: "List orders with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number" },
            per_page: { type: "number", description: "Items per page (max 100)" },
            search: { type: "string", description: "Search term" }
          }
        }
      },
      {
        name: "stateset_get_order",
        description: "Get a specific order by ID",
        inputSchema: {
          type: "object",
          properties: {
            order_id: { type: "string", description: "Order ID" }
          },
          required: ["order_id"]
        }
      },
      {
        name: "stateset_create_product",
        description: "Create a new product",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Product name" },
            sku: { type: "string", description: "Product SKU" },
            description: { type: "string", description: "Product description" },
            price: { type: "number", description: "Product price" }
          },
          required: ["name", "sku", "price"]
        }
      },
      {
        name: "stateset_list_products",
        description: "List products with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number" },
            per_page: { type: "number", description: "Items per page (max 100)" },
            search: { type: "string", description: "Search term" }
          }
        }
      },
      {
        name: "stateset_get_product",
        description: "Get a specific product by ID",
        inputSchema: {
          type: "object",
          properties: {
            product_id: { type: "string", description: "Product ID" }
          },
          required: ["product_id"]
        }
      },
      {
        name: "stateset_create_customer",
        description: "Create a new customer",
        inputSchema: {
          type: "object",
          properties: {
            email: { type: "string", description: "Customer email" },
            name: { type: "string", description: "Customer name" },
            address: {
              type: "object",
              properties: {
                line1: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                postal_code: { type: "string" },
                country: { type: "string" }
              },
              required: ["line1", "city", "state", "postal_code", "country"]
            }
          },
          required: ["email", "name", "address"]
        }
      },
      {
        name: "stateset_list_customers",
        description: "List customers with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number" },
            per_page: { type: "number", description: "Items per page (max 100)" },
            search: { type: "string", description: "Search term" }
          }
        }
      },
      {
        name: "stateset_get_customer",
        description: "Get a specific customer by ID",
        inputSchema: {
          type: "object",
          properties: {
            customer_id: { type: "string", description: "Customer ID" }
          },
          required: ["customer_id"]
        }
      },
      {
        name: "stateset_update_inventory",
        description: "Update inventory levels",
        inputSchema: {
          type: "object",
          properties: {
            inventory_id: { type: "string", description: "Inventory ID" },
            quantity: { type: "number", description: "New quantity" },
            location: { type: "string", description: "Storage location" }
          },
          required: ["inventory_id"]
        }
      },
      {
        name: "stateset_list_inventory",
        description: "List inventory with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number" },
            per_page: { type: "number", description: "Items per page (max 100)" },
            search: { type: "string", description: "Search term" }
          }
        }
      },
      {
        name: "stateset_get_metrics",
        description: "Get API usage metrics and server status",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ];

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

    // Enhanced tool execution with proper error handling
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        logger.debug(`Executing tool: ${name}`, args);

        let result: any;
        let response: any;

        switch (name) {
          case "stateset_create_rma":
            const createRMAArgs = CreateRMASchema.parse(args);
            if (config.apiKey === 'demo-key') {
              result = {
                id: `rma_${Date.now()}`,
                order_id: createRMAArgs.order_id,
                customer_email: createRMAArgs.customer_email,
                reason: createRMAArgs.reason,
                status: 'pending',
                created_at: new Date().toISOString(),
                url: `${config.baseUrl}/dashboard/rmas/rma_${Date.now()}`
              };
            } else {
              response = await client.createRMA(createRMAArgs);
              result = response.data;
            }
            break;

          case "stateset_list_rmas":
            const listRMAArgs = ListSchema.parse(args);
            if (config.apiKey === 'demo-key') {
              result = {
                data: [
                  { id: 'rma_1', order_id: 'order_123', status: 'pending', reason: 'Defective item' },
                  { id: 'rma_2', order_id: 'order_124', status: 'approved', reason: 'Wrong size' }
                ],
                pagination: { page: 1, per_page: 20, total: 2 }
              };
            } else {
              response = await client.listRMAs(listRMAArgs);
              result = response.data;
            }
            break;

          case "stateset_get_rma":
            const getRMAId = z.object({ rma_id: z.string() }).parse(args).rma_id;
            if (config.apiKey === 'demo-key') {
              result = {
                id: getRMAId,
                order_id: 'order_123',
                customer_email: 'customer@example.com',
                reason: 'Defective item',
                status: 'pending',
                created_at: new Date().toISOString()
              };
            } else {
              response = await client.getRMA(getRMAId);
              result = response.data;
            }
            break;

          case "stateset_create_order":
            const createOrderArgs = CreateOrderSchema.parse(args);
            if (config.apiKey === 'demo-key') {
              result = {
                id: `order_${Date.now()}`,
                customer_email: createOrderArgs.customer_email,
                status: 'pending',
                total_amount: createOrderArgs.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                created_at: new Date().toISOString(),
                url: `${config.baseUrl}/dashboard/orders/order_${Date.now()}`
              };
            } else {
              response = await client.createOrder(createOrderArgs);
              result = response.data;
            }
            break;

          case "stateset_list_orders":
            const listOrderArgs = ListSchema.parse(args);
            if (config.apiKey === 'demo-key') {
              result = {
                data: [
                  { id: 'order_1', customer_email: 'customer1@example.com', status: 'completed', total_amount: 99.99 },
                  { id: 'order_2', customer_email: 'customer2@example.com', status: 'pending', total_amount: 149.99 }
                ],
                pagination: { page: 1, per_page: 20, total: 2 }
              };
            } else {
              response = await client.listOrders(listOrderArgs);
              result = response.data;
            }
            break;

          case "stateset_get_order":
            const getOrderId = z.object({ order_id: z.string() }).parse(args).order_id;
            if (config.apiKey === 'demo-key') {
              result = {
                id: getOrderId,
                customer_email: 'customer@example.com',
                status: 'pending',
                total_amount: 99.99,
                created_at: new Date().toISOString()
              };
            } else {
              response = await client.getOrder(getOrderId);
              result = response.data;
            }
            break;

          case "stateset_create_product":
            const createProductArgs = CreateProductSchema.parse(args);
            if (config.apiKey === 'demo-key') {
              result = {
                id: `prod_${Date.now()}`,
                name: createProductArgs.name,
                sku: createProductArgs.sku,
                price: createProductArgs.price,
                created_at: new Date().toISOString()
              };
            } else {
              response = await client.createProduct(createProductArgs);
              result = response.data;
            }
            break;

          case "stateset_list_products":
            const listProductArgs = ListSchema.parse(args);
            if (config.apiKey === 'demo-key') {
              result = {
                data: [
                  { id: 'prod_1', name: 'Widget A', sku: 'WID-001', price: 29.99 },
                  { id: 'prod_2', name: 'Widget B', sku: 'WID-002', price: 39.99 }
                ],
                pagination: { page: 1, per_page: 20, total: 2 }
              };
            } else {
              response = await client.listProducts(listProductArgs);
              result = response.data;
            }
            break;

          case "stateset_get_product":
            const getProductId = z.object({ product_id: z.string() }).parse(args).product_id;
            if (config.apiKey === 'demo-key') {
              result = {
                id: getProductId,
                name: 'Sample Product',
                sku: 'SAMPLE-001',
                price: 29.99,
                description: 'A sample product'
              };
            } else {
              response = await client.getProduct(getProductId);
              result = response.data;
            }
            break;

          case "stateset_create_customer":
            const createCustomerArgs = CreateCustomerSchema.parse(args);
            if (config.apiKey === 'demo-key') {
              result = {
                id: `cust_${Date.now()}`,
                email: createCustomerArgs.email,
                name: createCustomerArgs.name,
                created_at: new Date().toISOString()
              };
            } else {
              response = await client.createCustomer(createCustomerArgs);
              result = response.data;
            }
            break;

          case "stateset_list_customers":
            const listCustomerArgs = ListSchema.parse(args);
            if (config.apiKey === 'demo-key') {
              result = {
                data: [
                  { id: 'cust_1', email: 'john@example.com', name: 'John Doe' },
                  { id: 'cust_2', email: 'jane@example.com', name: 'Jane Smith' }
                ],
                pagination: { page: 1, per_page: 20, total: 2 }
              };
            } else {
              response = await client.listCustomers(listCustomerArgs);
              result = response.data;
            }
            break;

          case "stateset_get_customer":
            const getCustomerId = z.object({ customer_id: z.string() }).parse(args).customer_id;
            if (config.apiKey === 'demo-key') {
              result = {
                id: getCustomerId,
                email: 'customer@example.com',
                name: 'Sample Customer',
                address: {
                  line1: '123 Main St',
                  city: 'Anytown',
                  state: 'ST',
                  postal_code: '12345',
                  country: 'US'
                }
              };
            } else {
              response = await client.getCustomer(getCustomerId);
              result = response.data;
            }
            break;

          case "stateset_update_inventory":
            const updateInventoryArgs = UpdateInventorySchema.parse(args);
            if (config.apiKey === 'demo-key') {
              result = {
                id: updateInventoryArgs.inventory_id,
                quantity: updateInventoryArgs.quantity,
                location: updateInventoryArgs.location,
                updated_at: new Date().toISOString()
              };
            } else {
              response = await client.updateInventory(updateInventoryArgs);
              result = response.data;
            }
            break;

          case "stateset_list_inventory":
            const listInventoryArgs = ListSchema.parse(args);
            if (config.apiKey === 'demo-key') {
              result = {
                data: [
                  { id: 'inv_1', product_id: 'prod_1', quantity: 100, location: 'Warehouse A' },
                  { id: 'inv_2', product_id: 'prod_2', quantity: 50, location: 'Warehouse B' }
                ],
                pagination: { page: 1, per_page: 20, total: 2 }
              };
            } else {
              response = await client.listInventory(listInventoryArgs);
              result = response.data;
            }
            break;

          case "stateset_get_metrics":
            const metrics = client.getMetrics();
            result = {
              ...metrics,
              server_status: 'healthy',
              api_status: config.apiKey === 'demo-key' ? 'demo_mode' : 'connected',
              timestamp: new Date().toISOString()
            };
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        logger.debug(`Tool execution completed: ${name}`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };

      } catch (error) {
        logger.error(`Tool execution failed: ${request.params.name}`, error);
        
        if (error instanceof z.ZodError) {
          return {
            content: [{
              type: "text",
              text: `Validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
            }],
            isError: true
          };
        }

        return {
          content: [{
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
          }],
          isError: true
        };
      }
    });

    // Resource templates for browsing StateSet data
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: [
        {
          uriTemplate: "stateset://rmas/{rma_id}",
          name: "StateSet RMA",
          description: "Access RMA details",
          mimeType: "application/json"
        },
        {
          uriTemplate: "stateset://orders/{order_id}",
          name: "StateSet Order",
          description: "Access order details",
          mimeType: "application/json"
        },
        {
          uriTemplate: "stateset://products/{product_id}",
          name: "StateSet Product",
          description: "Access product details",
          mimeType: "application/json"
        },
        {
          uriTemplate: "stateset://customers/{customer_id}",
          name: "StateSet Customer",
          description: "Access customer details",
          mimeType: "application/json"
        }
      ]
    }));

    // Resource reading
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = new URL(request.params.uri);
      const [, type, id] = uri.pathname.split('/');

      let data: any;
      
      try {
        switch (type) {
          case 'rmas':
            data = config.apiKey === 'demo-key' 
              ? { id, type: 'rma', status: 'demo' }
              : (await client.getRMA(id)).data;
            break;
          case 'orders':
            data = config.apiKey === 'demo-key'
              ? { id, type: 'order', status: 'demo' }
              : (await client.getOrder(id)).data;
            break;
          case 'products':
            data = config.apiKey === 'demo-key'
              ? { id, type: 'product', name: 'Demo Product' }
              : (await client.getProduct(id)).data;
            break;
          case 'customers':
            data = config.apiKey === 'demo-key'
              ? { id, type: 'customer', name: 'Demo Customer' }
              : (await client.getCustomer(id)).data;
            break;
          default:
            throw new Error(`Unknown resource type: ${type}`);
        }

        return {
          contents: [{
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(data, null, 2)
          }]
        };
      } catch (error) {
        logger.error(`Resource read failed: ${request.params.uri}`, error);
        throw error;
      }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info('Enhanced StateSet MCP Server is running successfully!', {
      toolCount: tools.length,
      features: ['rate_limiting', 'retry_logic', 'comprehensive_api', 'resource_templates']
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

main().catch((error) => {
  logger.error('Unhandled error in main', error);
  process.exit(1);
});