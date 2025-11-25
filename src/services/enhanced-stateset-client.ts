import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { logger } from '../utils/logger';
import { handleError, APIError } from '../middleware/error-handler';
import { validateAndSanitizeInput, SanitizedIdSchema } from '../utils/validation';
import { Config } from '../config/config';

interface RequestMetrics {
  totalRequests: number;
  requestsInLastHour: number;
  averageRequestTime: number;
  queueLength: number;
  lastRequestTime: string;
}

interface StateSetResponse {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  url: string;
  [key: string]: unknown;
}

export class EnhancedRateLimiter {
  private readonly requestsPerHour: number;
  private readonly minDelayMs: number;
  private queue: Array<() => Promise<unknown>> = [];
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
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          logger.debug({ operation, requestId }, 'Starting API request');
          const result = await this.executeWithRetry(fn, operation, retries, requestId);
          const duration = Date.now() - startTime;
          this.trackRequest(startTime, duration);
          logger.debug({ operation, duration, requestId }, 'Completed API request');
          resolve(result);
        } catch (error) {
          const apiError = handleError(error, { operation, requestId });
          logger.error({ operation, error: apiError.message, requestId }, 'API request failed');
          reject(apiError);
        }
      });
      this.processQueue();
    });
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>, 
    operation: string, 
    retries: number,
    requestId: string
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt > retries || !this.isRetryableError(error)) {
          throw error;
        }
        const delay = Math.min(Math.pow(2, attempt - 1) * 1000, 30000); // Max 30s delay
        logger.warn({ operation, attempt, delay, requestId }, 'Retrying API request');
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof AxiosError) {
      return !error.response || 
             error.code === 'ECONNABORTED' ||
             (error.response.status >= 500 && error.response.status < 600) ||
             error.response.status === 429; // Rate limited
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
        if (waitTime > 0) {
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

  private trackRequest(startTime: number, duration: number): void {
    this.requestTimes.push(duration);
    this.requestTimestamps.push(startTime);
    const oneHourAgo = Date.now() - 3600000;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneHourAgo);
    this.requestTimes = this.requestTimes.slice(-this.requestTimestamps.length);
  }

  getMetrics(): RequestMetrics {
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

export class EnhancedStateSetClient {
  private readonly apiClient: AxiosInstance;
  private readonly rateLimiter: EnhancedRateLimiter;
  private readonly baseUrl: string;

  constructor(config: Config) {
    if (!config.api.key) {
      throw new APIError('API key is required', 401, 'MISSING_API_KEY');
    }
    
    this.baseUrl = config.api.baseUrl;
    this.rateLimiter = new EnhancedRateLimiter(config.rateLimit.requestsPerHour);
    
    this.apiClient = axios.create({
      baseURL: config.api.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.api.key}`,
        'Content-Type': 'application/json',
        'User-Agent': `${config.server.name}/${config.server.version}`,
      },
      timeout: config.api.timeout,
      maxRedirects: 3,
      validateStatus: (status) => status < 500, // Don't throw for 4xx errors
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for logging and validation
    this.apiClient.interceptors.request.use(
      (config) => {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        config.metadata = { requestId, startTime: Date.now() };
        
        logger.debug({
          method: config.method?.toUpperCase(),
          url: config.url,
          requestId,
        }, 'Outgoing API request');
        
        return config;
      },
      (error) => Promise.reject(handleError(error))
    );

    // Response interceptor for logging and error handling
    this.apiClient.interceptors.response.use(
      (response) => {
        const requestId = response.config.metadata?.requestId;
        const duration = Date.now() - (response.config.metadata?.startTime || 0);
        
        logger.debug({
          status: response.status,
          duration,
          requestId,
        }, 'API response received');
        
        return response;
      },
      (error: AxiosError) => {
        const requestId = error.config?.metadata?.requestId;
        logger.error({
          error: error.message,
          status: error.response?.status,
          requestId,
        }, 'API request failed');
        
        return Promise.reject(handleError(error, { requestId }));
      }
    );
  }

  private enrichResponse<T>(data: T): T & { metadata: { apiMetrics: RequestMetrics } } {
    return {
      ...data,
      metadata: { apiMetrics: this.rateLimiter.getMetrics() },
    };
  }

  private enrichListResponse<T>(data: T[]): { items: T[]; metadata: { apiMetrics: RequestMetrics } } {
    return {
      items: data,
      metadata: { apiMetrics: this.rateLimiter.getMetrics() },
    };
  }

  // Generic CRUD operations
  async create<T>(endpoint: string, data: unknown): Promise<StateSetResponse> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.post(endpoint, data),
      `create_${endpoint.replace('/', '')}`
    );
    
    if (response.status >= 400) {
      throw new APIError(
        `Failed to create resource: ${response.statusText}`,
        response.status,
        'CREATE_FAILED'
      );
    }
    
    const result = response.data;
    return this.enrichResponse({
      id: result.id,
      status: result.status,
      created_at: result.created_at,
      updated_at: result.updated_at,
      url: `${this.baseUrl}/dashboard${endpoint}/${result.id}`,
      ...result,
    });
  }

  async update<T>(endpoint: string, id: string, data: unknown): Promise<StateSetResponse> {
    const sanitizedId = validateAndSanitizeInput(SanitizedIdSchema, id, 'resource ID');
    
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.patch(`${endpoint}/${sanitizedId}`, data),
      `update_${endpoint.replace('/', '')}`
    );
    
    if (response.status >= 400) {
      throw new APIError(
        `Failed to update resource: ${response.statusText}`,
        response.status,
        'UPDATE_FAILED'
      );
    }
    
    return this.enrichResponse(response.data);
  }

  async get(endpoint: string, id: string): Promise<StateSetResponse> {
    const sanitizedId = validateAndSanitizeInput(SanitizedIdSchema, id, 'resource ID');
    
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(`${endpoint}/${sanitizedId}`),
      `get_${endpoint.replace('/', '')}`
    );
    
    if (response.status === 404) {
      throw new APIError(
        `Resource not found: ${sanitizedId}`,
        404,
        'RESOURCE_NOT_FOUND'
      );
    }
    
    if (response.status >= 400) {
      throw new APIError(
        `Failed to get resource: ${response.statusText}`,
        response.status,
        'GET_FAILED'
      );
    }
    
    return this.enrichResponse(response.data);
  }

  async delete(endpoint: string, id: string): Promise<StateSetResponse> {
    const sanitizedId = validateAndSanitizeInput(SanitizedIdSchema, id, 'resource ID');
    
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.delete(`${endpoint}/${sanitizedId}`),
      `delete_${endpoint.replace('/', '')}`
    );
    
    if (response.status >= 400) {
      throw new APIError(
        `Failed to delete resource: ${response.statusText}`,
        response.status,
        'DELETE_FAILED'
      );
    }
    
    return this.enrichResponse(response.data);
  }

  async list(endpoint: string, params: Record<string, unknown> = {}): Promise<{ items: StateSetResponse[]; metadata: { apiMetrics: RequestMetrics } }> {
    const response = await this.rateLimiter.enqueue(
      () => this.apiClient.get(endpoint, { params }),
      `list_${endpoint.replace('/', '')}`
    );
    
    if (response.status >= 400) {
      throw new APIError(
        `Failed to list resources: ${response.statusText}`,
        response.status,
        'LIST_FAILED'
      );
    }
    
    return this.enrichListResponse(response.data);
  }

  getApiMetrics(): { apiMetrics: RequestMetrics } {
    return { apiMetrics: this.rateLimiter.getMetrics() };
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      logger.warn('API health check failed', { error });
      return false;
    }
  }
}