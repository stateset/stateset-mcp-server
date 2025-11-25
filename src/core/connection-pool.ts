import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

const logger = createLogger('connection-pool');

// Configuration type for connection pool
interface ConnectionPoolConfig {
  api: {
    key: string;
    baseUrl: string;
    timeout: number;
  };
  rateLimit: {
    requestsPerHour: number;
    retryAttempts: number;
    retryDelay: number;
  };
  server: {
    name: string;
    version: string;
  };
}

interface PoolConnection {
  id: string;
  instance: AxiosInstance;
  inUse: boolean;
  created: number;
  lastUsed: number;
  requestCount: number;
  errorCount: number;
  latency: number[];
}

interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalRequests: number;
  failedRequests: number;
  averageLatency: number;
  poolUtilization: number;
  connectionTurnover: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition: (error: AxiosError) => boolean;
}

interface RequestMetadata {
  requestId: string;
  connectionId: string;
  startTime: number;
}

type InstrumentedRequestConfig = InternalAxiosRequestConfig & { metadata?: RequestMetadata };

export class ConnectionPool extends EventEmitter {
  private connections = new Map<string, PoolConnection>();
  private config: ConnectionPoolConfig;
  private retryConfig: RetryConfig;
  private stats: PoolStats;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private baseAxiosConfig: AxiosRequestConfig;

  constructor(config: ConnectionPoolConfig) {
    super();
    this.config = config;

    this.retryConfig = {
      maxRetries: config.rateLimit.retryAttempts,
      baseDelay: config.rateLimit.retryDelay,
      maxDelay: 30000,
      backoffFactor: 2,
      retryCondition: (error: AxiosError) => {
        return (
          !error.response ||
          error.code === 'ECONNABORTED' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ECONNRESET' ||
          error.response.status >= 500 ||
          error.response.status === 429
        );
      },
    };

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      totalRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      poolUtilization: 0,
      connectionTurnover: 0,
    };

    this.baseAxiosConfig = {
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout,
      headers: {
        Authorization: `Bearer ${config.api.key}`,
        'Content-Type': 'application/json',
        'User-Agent': `${config.server.name}/${config.server.version}`,
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 500,
    };

    this.initializePool();
    this.startHealthChecks();
    this.startCleanup();

    logger.info('Connection pool initialized', {
      maxConnections: this.getMaxConnections(),
      retryConfig: this.retryConfig,
    });
  }

  private initializePool(): void {
    const minConnections = Math.max(2, Math.floor(this.getMaxConnections() * 0.2));

    for (let i = 0; i < minConnections; i++) {
      this.createConnection();
    }
  }

  private createConnection(): PoolConnection {
    const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const instance = axios.create({
      ...this.baseAxiosConfig,
      // Add connection-specific config
      headers: {
        ...this.baseAxiosConfig.headers,
        'X-Connection-ID': id,
      },
    });

    // Add interceptors for monitoring
    this.setupInterceptors(instance, id);

    const connection: PoolConnection = {
      id,
      instance,
      inUse: false,
      created: Date.now(),
      lastUsed: Date.now(),
      requestCount: 0,
      errorCount: 0,
      latency: [],
    };

    this.connections.set(id, connection);
    this.updateStats();

    logger.debug('Connection created', { id, totalConnections: this.connections.size });
    this.emit('connectionCreated', { id });

    return connection;
  }

  private setupInterceptors(instance: AxiosInstance, connectionId: string): void {
    // Request interceptor
    instance.interceptors.request.use(
      (config: InstrumentedRequestConfig) => {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        config.metadata = {
          requestId,
          connectionId,
          startTime: Date.now(),
        };

        logger.debug('Request sent', { requestId, connectionId, url: config.url });
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor
    instance.interceptors.response.use(
      (response) => {
        const connection = this.connections.get(connectionId);
        if (connection) {
          const metadata = (response.config as InstrumentedRequestConfig).metadata;
          const duration = Date.now() - (metadata?.startTime || 0);
          connection.latency.push(duration);
          connection.requestCount++;
          connection.lastUsed = Date.now();

          // Keep only last 100 latency measurements
          if (connection.latency.length > 100) {
            connection.latency.splice(0, connection.latency.length - 100);
          }

          this.stats.totalRequests++;
          this.updateAverageLatency();
        }

        return response;
      },
      (error) => {
        const connection = this.connections.get(connectionId);
        if (connection) {
          connection.errorCount++;
          this.stats.failedRequests++;
        }

        return Promise.reject(error);
      },
    );
  }

  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const connection = await this.acquireConnection();

    try {
      connection.inUse = true;
      this.updateStats();

      const response = await this.executeWithRetry(connection.instance, config);
      return response.data;
    } finally {
      connection.inUse = false;
      this.updateStats();
    }
  }

  private async executeWithRetry(
    instance: AxiosInstance,
    config: AxiosRequestConfig,
    attempt = 1,
  ): Promise<any> {
    try {
      return await instance.request(config);
    } catch (error) {
      if (
        attempt >= this.retryConfig.maxRetries ||
        !this.retryConfig.retryCondition(error as AxiosError)
      ) {
        throw error;
      }

      const delay = Math.min(
        this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1),
        this.retryConfig.maxDelay,
      );

      // Add jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * 1000;

      logger.warn('Request failed, retrying', {
        attempt,
        delay: jitteredDelay,
        error: (error as AxiosError).message,
      });

      await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
      return this.executeWithRetry(instance, config, attempt + 1);
    }
  }

  private async acquireConnection(): Promise<PoolConnection> {
    // Try to find an idle connection
    const idleConnection = Array.from(this.connections.values()).find(
      (conn) => !conn.inUse && this.isConnectionHealthy(conn),
    );

    if (idleConnection) {
      return idleConnection;
    }

    // Create new connection if under limit
    if (this.connections.size < this.getMaxConnections()) {
      return this.createConnection();
    }

    // Wait for connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection pool timeout'));
      }, 30000); // 30 second timeout

      const checkForConnection = () => {
        const available = Array.from(this.connections.values()).find(
          (conn) => !conn.inUse && this.isConnectionHealthy(conn),
        );

        if (available) {
          clearTimeout(timeout);
          resolve(available);
        } else {
          setTimeout(checkForConnection, 100); // Check every 100ms
        }
      };

      checkForConnection();
    });
  }

  private isConnectionHealthy(connection: PoolConnection): boolean {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const maxErrors = 10;
    const maxErrorRate = 0.1; // 10%

    const age = Date.now() - connection.created;
    const errorRate =
      connection.requestCount > 0 ? connection.errorCount / connection.requestCount : 0;

    return age < maxAge && connection.errorCount < maxErrors && errorRate < maxErrorRate;
  }

  private getMaxConnections(): number {
    // Dynamic based on rate limit configuration
    return Math.max(5, Math.floor(this.config.rateLimit.requestsPerHour / 100));
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 60000); // Every minute
  }

  private async performHealthChecks(): Promise<void> {
    const healthPromises = Array.from(this.connections.values())
      .filter((conn) => !conn.inUse)
      .map(async (connection) => {
        try {
          // Simple health check request
          await connection.instance.get('/health', { timeout: 5000 });
          return { id: connection.id, healthy: true };
        } catch (error) {
          logger.warn('Connection health check failed', {
            id: connection.id,
            error: (error as Error).message,
          });
          return { id: connection.id, healthy: false };
        }
      });

    const results = await Promise.allSettled(healthPromises);

    results.forEach((result) => {
      if (result.status === 'fulfilled' && !result.value.healthy) {
        this.removeConnection(result.value.id);
      }
    });
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000); // Every 5 minutes
  }

  private cleanup(): void {
    const now = Date.now();
    const maxIdleTime = 10 * 60 * 1000; // 10 minutes
    const minConnections = Math.max(2, Math.floor(this.getMaxConnections() * 0.2));

    let removedCount = 0;

    for (const [id, connection] of this.connections) {
      const idleTime = now - connection.lastUsed;

      if (!connection.inUse && idleTime > maxIdleTime && this.connections.size > minConnections) {
        this.removeConnection(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug('Connection cleanup completed', {
        removed: removedCount,
        remaining: this.connections.size,
      });
    }
  }

  private removeConnection(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      this.connections.delete(id);
      this.updateStats();
      this.emit('connectionRemoved', { id });
      logger.debug('Connection removed', { id });
    }
  }

  private updateStats(): void {
    const connections = Array.from(this.connections.values());

    this.stats.totalConnections = connections.length;
    this.stats.activeConnections = connections.filter((c) => c.inUse).length;
    this.stats.idleConnections = connections.filter((c) => !c.inUse).length;
    this.stats.poolUtilization =
      this.stats.totalConnections > 0
        ? this.stats.activeConnections / this.stats.totalConnections
        : 0;
  }

  private updateAverageLatency(): void {
    const allLatencies = Array.from(this.connections.values()).flatMap((conn) => conn.latency);

    if (allLatencies.length > 0) {
      this.stats.averageLatency = allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length;
    }
  }

  // Batch operations
  async batchRequest<T>(requests: AxiosRequestConfig[]): Promise<(T | Error)[]> {
    const batchSize = Math.min(requests.length, this.stats.idleConnections + 5);
    const results: (T | Error)[] = [];

    // Process in batches to avoid overwhelming the pool
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      const batchPromises = batch.map(async (config) => {
        try {
          return await this.request<T>(config);
        } catch (error) {
          return error as Error;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  getStats(): PoolStats {
    return { ...this.stats };
  }

  getConnectionDetails(): Array<{
    id: string;
    inUse: boolean;
    age: number;
    requestCount: number;
    errorCount: number;
    averageLatency: number;
  }> {
    return Array.from(this.connections.values()).map((conn) => ({
      id: conn.id,
      inUse: conn.inUse,
      age: Date.now() - conn.created,
      requestCount: conn.requestCount,
      errorCount: conn.errorCount,
      averageLatency:
        conn.latency.length > 0 ? conn.latency.reduce((a, b) => a + b, 0) / conn.latency.length : 0,
    }));
  }

  async drain(): Promise<void> {
    logger.info('Draining connection pool');

    // Wait for active connections to finish
    while (this.stats.activeConnections > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Clear all connections
    this.connections.clear();
    this.updateStats();

    logger.info('Connection pool drained');
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.connections.clear();
    this.removeAllListeners();

    logger.info('Connection pool destroyed');
  }
}
