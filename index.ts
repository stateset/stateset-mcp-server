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

interface CreateWarrantyArgs {
  order_id: string;
  customer_email: string;
  items: WarrantyItem[];
  notes?: string;
}

interface CreateShipmentArgs {
  order_id: string;
  customer_email: string;
  items: ShipmentItem[];
  carrier: string;
  destination_address: Address;
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

const createWarrantyTool: Tool = {
  name: "stateset_create_warranty",
  description: "Creates a warranty record",
  inputSchema: CreateWarrantyArgsSchema.shape as any,
};

const createShipmentTool: Tool = {
  name: "stateset_create_shipment",
  description: "Creates a shipment record",
  inputSchema: CreateShipmentArgsSchema.shape as any,
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
];

// Server Prompt
const serverPrompt: Prompt = {
  name: "stateset-server-prompt",
  description: "StateSet MCP server instructions",
  instructions: `Manages RMAs, orders, warranties, shipments, and other related tasks.

Capabilities:
- stateset_create_rma: Create returns
- stateset_update_rma: Update returns
- stateset_create_order: Create orders
- stateset_create_warranty: Register warranties
- stateset_create_shipment: Manage shipments
- stateset_create_bill_of_materials: Create bill of materials
- stateset_update_bill_of_materials: Update bill of materials
- stateset_create_work_order: Create work orders
- stateset_update_work_order: Update work orders
- stateset_create_manufacturer_order: Create manufacturer orders
- stateset_update_manufacturer_order: Update manufacturer orders
- stateset_create_invoice: Create invoices
- stateset_update_invoice: Update invoices
- stateset_create_payment: Create payments
- stateset_update_payment: Update payments

Best practices:
- Validate all IDs before use
- Include detailed notes
- Update statuses promptly`
};

// Main Function
async function main(): Promise<void> {
  try {
    dotenv.config();
    const config: Config = {
      apiKey: process.env.STATESET_API_KEY || '',
      baseUrl: process.env.STATESET_BASE_URL || 'https://api.stateset.io/v1',
      requestsPerHour: parseInt(process.env.REQUESTS_PER_HOUR || '1000'),
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
          case "stateset_create_warranty":
            return await client.createWarranty(CreateWarrantyArgsSchema.parse(request.params.arguments));
          case "stateset_create_shipment":
            return await client.createShipment(CreateShipmentArgsSchema.parse(request.params.arguments));
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
        default:
          throw new Error(`Unsupported URI: ${request.params.uri}`);
      }
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        createRMATool,
        updateRMATool,
        createOrderTool,
        createWarrantyTool,
        createShipmentTool,
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
