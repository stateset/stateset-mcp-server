import axios, { AxiosInstance, AxiosError } from 'axios';
import type { Config } from '@config/config';
import { createLogger } from '@utils/logger';
import { RateLimiter } from '@core/rate-limiter';
import type { 
  StateSetResponse, 
  CreateRMAArgs, 
  UpdateRMAArgs,
  CreateOrderArgs,
  UpdateOrderArgs,
  ListArgs,
  CreateCustomerArgs,
  UpdateCustomerArgs,
  DeleteCustomerArgs,
  DeleteRMAArgs,
  DeleteOrderArgs
} from '../types/api';

const logger = createLogger('stateset-client');

export class StateSetClient {
  private readonly apiClient: AxiosInstance;
  private readonly rateLimiter: RateLimiter;
  private readonly baseUrl: string;

  constructor(config: Config) {
    if (!config.api.key) {
      throw new Error('API key is required');
    }
    
    this.baseUrl = config.api.baseUrl;
    this.rateLimiter = new RateLimiter({
      requestsPerHour: config.rateLimit.requestsPerHour,
      retryAttempts: config.rateLimit.retryAttempts,
      retryDelay: config.rateLimit.retryDelay,
    });

    this.apiClient = axios.create({
      baseURL: config.api.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.api.key}`,
        'Content-Type': 'application/json',
        'User-Agent': `${config.server.name}/${config.server.version}`,
      },
      timeout: config.api.timeout,
    });

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        logger.error({ 
          error: error.message, 
          code: error.code,
          status: error.response?.status 
        }, 'API request failed');
        throw error;
      }
    );
  }

  private enrichResponse<T>(data: T): T & { metadata: { apiMetrics: any } } {
    return {
      ...data,
      metadata: { apiMetrics: this.rateLimiter.getMetrics() },
    };
  }

  private enrichListResponse<T>(data: T[]): { items: T[]; metadata: { apiMetrics: any } } {
    return {
      items: data,
      metadata: { apiMetrics: this.rateLimiter.getMetrics() },
    };
  }

  // RMA Operations
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

  async deleteRMA(args: DeleteRMAArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/rmas/${args.rma_id}`),
      'deleteRMA'
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

  async listRMAs(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: any } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/rmas', { params: args }),
      'listRMAs'
    );
    return this.enrichListResponse(response.data);
  }

  // Order Operations
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

  async deleteOrder(args: DeleteOrderArgs): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`/orders/${args.order_id}`),
      'deleteOrder'
    );
    return this.enrichResponse(response.data);
  }

  async getOrder(orderId: string): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`/orders/${orderId}`),
      'getOrder'
    );
    return this.enrichResponse(response.data);
  }

  async listOrders(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: any } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/orders', { params: args }),
      'listOrders'
    );
    return this.enrichListResponse(response.data);
  }

  // Customer Operations
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

  async listCustomers(args: ListArgs = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: any } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get('/customers', { params: args }),
      'listCustomers'
    );
    return this.enrichListResponse(response.data);
  }

  // Get API metrics
  getApiMetrics(): { apiMetrics: any } {
    return { apiMetrics: this.rateLimiter.getMetrics() };
  }
} 