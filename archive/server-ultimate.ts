#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ReadResourceRequestSchema, 
  ListToolsRequestSchema, 
  ListResourceTemplatesRequestSchema 
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from 'dotenv';

import { config } from './config/index';
import { logger } from './utils/logger';
import { tools, resourceTemplates, serverPrompt } from './tools/definitions';
import { IntelligentCache } from './core/intelligent-cache';
import { ConnectionPool } from './core/connection-pool';
import { AdvancedMetrics } from './core/advanced-metrics';
import { BatchProcessor } from './core/batch-processor';
import { RealtimeManager } from './core/realtime-manager';
import { PerformanceOptimizer } from './core/performance-optimizer';
import { handleError, sanitizeError } from './middleware/error-handler';
import { validateAndSanitizeInput, SanitizedIdSchema } from './utils/validation';

interface ServerStats {
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  connectionPoolStats: any;
  realtimeConnections: number;
  memoryUsage: any;
}

class UltimateStateSetMCPServer {
  private server: Server;
  private transport: StdioServerTransport;
  private cache: IntelligentCache<any>;
  private connectionPool: ConnectionPool;
  private metrics: AdvancedMetrics;
  private batchProcessor: BatchProcessor<any, any>;
  private realtimeManager: RealtimeManager;
  private performanceOptimizer: PerformanceOptimizer;
  private startTime: number;
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    responseTimes: [] as number[],
  };

  constructor() {
    this.startTime = Date.now();
    this.initializeComponents();
    this.setupServer();
    this.setupHandlers();
    this.setupOptimizations();
    this.setupRealtimeIntegration();
  }

  private initializeComponents(): void {
    // Initialize core components with advanced features
    this.metrics = new AdvancedMetrics();
    
    this.cache = new IntelligentCache({
      maxSize: 10000,
      defaultTTL: 300000, // 5 minutes
      maxMemoryMB: 100,
      strategy: 'adaptive',
      enablePredictive: true,
      compressionThreshold: 1024,
    }, this.metrics);

    this.connectionPool = new ConnectionPool(config);
    
    this.batchProcessor = new BatchProcessor(
      async (items: any[]) => {
        return this.processBatchItems(items);
      },
      {
        maxBatchSize: 50,
        maxWaitTime: 1000,
        maxConcurrency: 10,
        enablePrioritization: true,
        enableAdaptiveBatching: true,
      },
      this.metrics
    );

    this.realtimeManager = new RealtimeManager(8080, this.metrics);
    
    this.performanceOptimizer = new PerformanceOptimizer({
      enableGCOptimization: true,
      enableMemoryCompaction: true,
      enableObjectPooling: true,
      gcThresholdMB: 100,
      memoryWarningThresholdMB: 200,
    }, this.metrics);

    logger.info('Ultimate MCP server components initialized');
  }

  private setupServer(): void {
    this.server = new Server(
      { 
        name: config.server.name, 
        version: config.server.version 
      },
      {
        capabilities: {
          prompts: { default: serverPrompt },
          resources: { templates: true, read: true },
          tools: {},
        },
      }
    );

    this.transport = new StdioServerTransport();
  }

  private setupHandlers(): void {
    // Enhanced tool call handler with caching, batching, and metrics
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();
      
      try {
        this.stats.totalRequests++;
        this.metrics.incrementCounter('mcp_requests_total', 1, {
          tool: request.params.name,
        });

        const toolName = request.params.name;
        const args = request.params.arguments || {};

        logger.info({ toolName, args, requestId }, 'Processing tool call');

        // Check cache first
        const cacheKey = this.generateCacheKey(toolName, args);
        const cachedResult = await this.cache.get(cacheKey);
        
        if (cachedResult) {
          this.metrics.incrementCounter('cache_hits', 1, { tool: toolName });
          this.recordResponseTime(startTime);
          return cachedResult;
        }

        // Handle different tool types
        let result;
        if (this.isBatchable(toolName)) {
          // Use batch processor for batchable operations
          result = await this.batchProcessor.add(
            { toolName, args },
            {
              operation: toolName,
              priority: this.getToolPriority(toolName),
              timeout: 30000,
            }
          );
        } else {
          // Handle directly for non-batchable operations
          result = await this.handleToolDirect(toolName, args, requestId);
        }

        // Cache successful results
        if (result && this.isCacheable(toolName)) {
          await this.cache.set(cacheKey, result, {
            ttl: this.getCacheTTL(toolName),
            tags: this.getCacheTags(toolName, args),
            priority: this.getToolPriority(toolName),
          });
        }

        // Broadcast realtime updates for certain operations
        if (this.shouldBroadcast(toolName, result)) {
          this.broadcastUpdate(toolName, args, result);
        }

        this.stats.successfulRequests++;
        this.recordResponseTime(startTime);
        
        return result;

      } catch (error) {
        this.stats.failedRequests++;
        this.recordResponseTime(startTime);
        
        const apiError = handleError(error, { 
          operation: request.params.name,
          requestId 
        });
        
        this.metrics.incrementCounter('mcp_requests_failed', 1, {
          tool: request.params.name,
          error: apiError.code,
        });
        
        logger.error({ 
          tool: request.params.name, 
          error: apiError.message,
          requestId 
        }, 'Tool call failed');
        
        throw apiError;
      }
    });

    // Enhanced resource handler with caching
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const uri = new URL(request.params.uri);
        const resourceId = validateAndSanitizeInput(
          SanitizedIdSchema, 
          uri.pathname.replace(/^\//, ''), 
          'resource ID'
        );
        
        const cacheKey = `resource:${uri.protocol}:${resourceId}`;
        const cached = await this.cache.get(cacheKey);
        
        if (cached) {
          this.metrics.incrementCounter('resource_cache_hits');
          return cached;
        }

        const endpoint = this.getEndpointFromProtocol(uri.protocol);
        const resource = await this.connectionPool.request({
          method: 'GET',
          url: `${endpoint}/${resourceId}`,
        });
        
        const result = {
          contents: [{
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(resource, null, 2)
          }]
        };

        // Cache resource data
        await this.cache.set(cacheKey, result, {
          ttl: 300000, // 5 minutes
          tags: ['resource', uri.protocol.replace(':', '')],
        });

        return result;
      } catch (error) {
        const apiError = handleError(error, { 
          operation: 'read_resource',
          requestId: `resource_${Date.now()}` 
        });
        throw apiError;
      }
    });

    // Tools and templates handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.metrics.incrementCounter('list_tools_requests');
      return { tools };
    });

    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      this.metrics.incrementCounter('list_templates_requests');
      return { templates: resourceTemplates };
    });
  }

  private setupOptimizations(): void {
    // Set up performance monitoring alerts
    this.metrics.addAlert({
      id: 'high_memory_usage',
      metric: 'process_memory_heap_used_bytes',
      condition: 'gt',
      threshold: 200 * 1024 * 1024, // 200MB
      duration: 60000, // 1 minute
      enabled: true,
      callback: (snapshot) => {
        logger.warn('High memory usage alert', { 
          memoryMB: Math.round((snapshot.value as number) / 1024 / 1024) 
        });
        this.performanceOptimizer.triggerOptimization('high_memory');
      },
    });

    this.metrics.addAlert({
      id: 'high_error_rate',
      metric: 'mcp_requests_failed',
      condition: 'gt',
      threshold: 10,
      duration: 30000, // 30 seconds
      enabled: true,
      callback: () => {
        logger.warn('High error rate detected');
        this.realtimeManager.broadcastToAll({
          type: 'event',
          data: { alert: 'high_error_rate', timestamp: Date.now() },
        });
      },
    });

    // Predictive cache warming
    setInterval(() => {
      this.warmPopularCaches();
    }, 300000); // Every 5 minutes

    logger.info('Performance optimizations configured');
  }

  private setupRealtimeIntegration(): void {
    // Subscribe to cache events for realtime updates
    this.cache.on('set', (event) => {
      if (event.key.includes('order') || event.key.includes('customer')) {
        this.realtimeManager.broadcastEvent({
          resourceType: 'cache',
          resourceId: event.key,
          eventType: 'updated',
          data: { type: 'cache_update', key: event.key },
          timestamp: Date.now(),
        });
      }
    });

    // Subscribe to connection pool events
    this.connectionPool.on('connectionCreated', (event) => {
      this.realtimeManager.broadcastEvent({
        resourceType: 'connection',
        resourceId: event.id,
        eventType: 'created',
        data: event,
        timestamp: Date.now(),
      });
    });

    logger.info('Realtime integration configured');
  }

  private async handleToolDirect(toolName: string, args: any, requestId: string): Promise<any> {
    const parts = toolName.split('_');
    if (parts.length < 3) {
      throw new Error(`Invalid tool name format: ${toolName}`);
    }

    const operation = parts[1]; // create, update, delete, get, list
    const resourceType = parts.slice(2).join('_'); // rma, order, etc.
    const endpoint = this.getEndpointFromResourceType(resourceType);

    // Use performance profiling
    return this.performanceOptimizer.profileFunction(
      `tool_${toolName}`,
      async () => {
        switch (operation) {
          case 'create':
            return await this.connectionPool.request({
              method: 'POST',
              url: endpoint,
              data: args,
            });
          
          case 'update':
            const updateId = this.extractId(args, resourceType);
            return await this.connectionPool.request({
              method: 'PATCH',
              url: `${endpoint}/${updateId}`,
              data: args,
            });
          
          case 'delete':
            const deleteId = this.extractId(args, resourceType);
            return await this.connectionPool.request({
              method: 'DELETE',
              url: `${endpoint}/${deleteId}`,
            });
          
          case 'get':
            const getId = this.extractId(args, resourceType);
            return await this.connectionPool.request({
              method: 'GET',
              url: `${endpoint}/${getId}`,
            });
          
          case 'list':
            return await this.connectionPool.request({
              method: 'GET',
              url: endpoint,
              params: args,
            });
          
          default:
            if (toolName === 'stateset_get_api_metrics') {
              return this.getAdvancedMetrics();
            }
            throw new Error(`Unknown operation: ${operation}`);
        }
      }
    );
  }

  private async processBatchItems(items: any[]): Promise<any[]> {
    // Group items by operation type for efficient processing
    const grouped = new Map<string, any[]>();
    
    for (const item of items) {
      const key = `${item.toolName}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }

    const results: any[] = [];
    
    // Process each group
    for (const [toolName, groupItems] of grouped) {
      try {
        const batchResults = await this.processBatchGroup(toolName, groupItems);
        results.push(...batchResults);
      } catch (error) {
        // Add error results for all items in the failed group
        for (const item of groupItems) {
          results.push(error);
        }
      }
    }

    return results;
  }

  private async processBatchGroup(toolName: string, items: any[]): Promise<any[]> {
    // For list operations, we can batch the requests
    if (toolName.includes('_list_')) {
      const requests = items.map(item => ({
        method: 'GET' as const,
        url: this.getEndpointFromResourceType(toolName.split('_')[2]),
        params: item.args,
      }));
      
      return this.connectionPool.batchRequest(requests);
    }

    // For other operations, process individually but in parallel
    const promises = items.map(item => 
      this.handleToolDirect(item.toolName, item.args, `batch_${Date.now()}`)
    );
    
    return Promise.all(promises);
  }

  private async warmPopularCaches(): Promise<void> {
    try {
      // Warm caches for frequently accessed resources
      const popularResources = [
        { endpoint: '/orders', params: { limit: 10 } },
        { endpoint: '/customers', params: { limit: 10 } },
        { endpoint: '/products', params: { limit: 20 } },
      ];

      await this.cache.warm(
        popularResources.map(resource => ({
          key: `list:${resource.endpoint}:${JSON.stringify(resource.params)}`,
          fetcher: () => this.connectionPool.request({
            method: 'GET',
            url: resource.endpoint,
            params: resource.params,
          }),
          options: { 
            ttl: 600000, // 10 minutes
            tags: ['popular', 'list'],
            priority: 0.8,
          },
        }))
      );

      logger.debug('Cache warming completed');
    } catch (error) {
      logger.warn('Cache warming failed', { error });
    }
  }

  // Utility methods
  private generateCacheKey(toolName: string, args: any): string {
    const argsHash = Buffer.from(JSON.stringify(args)).toString('base64');
    return `tool:${toolName}:${argsHash}`;
  }

  private isBatchable(toolName: string): boolean {
    const batchableOperations = ['list', 'get'];
    return batchableOperations.some(op => toolName.includes(`_${op}_`));
  }

  private isCacheable(toolName: string): boolean {
    const nonCacheableOperations = ['create', 'update', 'delete'];
    return !nonCacheableOperations.some(op => toolName.includes(`_${op}_`));
  }

  private getCacheTTL(toolName: string): number {
    if (toolName.includes('_list_')) return 300000; // 5 minutes for lists
    if (toolName.includes('_get_')) return 600000;  // 10 minutes for individual items
    return 300000; // Default 5 minutes
  }

  private getCacheTags(toolName: string, args: any): string[] {
    const parts = toolName.split('_');
    const operation = parts[1];
    const resourceType = parts.slice(2).join('_');
    
    const tags = [operation, resourceType];
    
    // Add specific tags based on arguments
    if (args.customer_id) tags.push(`customer:${args.customer_id}`);
    if (args.order_id) tags.push(`order:${args.order_id}`);
    
    return tags;
  }

  private getToolPriority(toolName: string): number {
    if (toolName.includes('order') || toolName.includes('payment')) return 0.9;
    if (toolName.includes('customer')) return 0.8;
    if (toolName.includes('product') || toolName.includes('inventory')) return 0.6;
    return 0.4;
  }

  private shouldBroadcast(toolName: string, result: any): boolean {
    const broadcastOperations = ['create', 'update', 'delete'];
    const importantResources = ['order', 'payment', 'shipment', 'customer'];
    
    return broadcastOperations.some(op => toolName.includes(`_${op}_`)) &&
           importantResources.some(resource => toolName.includes(resource));
  }

  private broadcastUpdate(toolName: string, args: any, result: any): void {
    const parts = toolName.split('_');
    const operation = parts[1];
    const resourceType = parts.slice(2).join('_');
    
    let eventType: 'created' | 'updated' | 'deleted';
    switch (operation) {
      case 'create': eventType = 'created'; break;
      case 'update': eventType = 'updated'; break;
      case 'delete': eventType = 'deleted'; break;
      default: return;
    }

    const resourceId = result?.id || this.extractId(args, resourceType);
    
    this.realtimeManager.broadcastEvent({
      resourceType,
      resourceId,
      eventType,
      data: result,
      timestamp: Date.now(),
    });
  }

  private extractId(args: any, resourceType: string): string {
    const idField = `${resourceType}_id`;
    const id = args[idField];
    
    if (!id || typeof id !== 'string') {
      throw new Error(`Missing or invalid ${idField}`);
    }
    
    return validateAndSanitizeInput(SanitizedIdSchema, id, idField);
  }

  private getEndpointFromResourceType(resourceType: string): string {
    const endpoints: Record<string, string> = {
      'rma': '/rmas',
      'order': '/orders',
      'warranty': '/warranties',
      'shipment': '/shipments',
      'product': '/products',
      'inventory': '/inventory',
      'customer': '/customers',
      'invoice': '/invoices',
      'payment': '/payments',
    };

    const endpoint = endpoints[resourceType];
    if (!endpoint) {
      throw new Error(`Unknown resource type: ${resourceType}`);
    }
    
    return endpoint;
  }

  private getEndpointFromProtocol(protocol: string): string {
    const protocolMap: Record<string, string> = {
      'stateset-rma:': '/rmas',
      'stateset-order:': '/orders',
      'stateset-customer:': '/customers',
      'stateset-product:': '/products',
      'stateset-inventory:': '/inventory',
    };

    const endpoint = protocolMap[protocol];
    if (!endpoint) {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
    
    return endpoint;
  }

  private recordResponseTime(startTime: number): void {
    const responseTime = Date.now() - startTime;
    this.stats.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times
    if (this.stats.responseTimes.length > 1000) {
      this.stats.responseTimes.splice(0, this.stats.responseTimes.length - 1000);
    }
    
    this.metrics.recordHistogram('mcp_request_duration_ms', responseTime);
  }

  private getAdvancedMetrics(): any {
    const cacheStats = this.cache.getStats();
    const poolStats = this.connectionPool.getStats();
    const batchStats = this.batchProcessor.getStats();
    const realtimeStats = this.realtimeManager.getStats();
    const optimizerStats = this.performanceOptimizer.getOptimizationStats();
    
    return {
      server: this.getServerStats(),
      cache: cacheStats,
      connectionPool: poolStats,
      batchProcessor: batchStats,
      realtime: realtimeStats,
      performance: optimizerStats,
      metrics: this.metrics.getAllMetrics().length,
    };
  }

  private getServerStats(): ServerStats {
    const avgResponseTime = this.stats.responseTimes.length > 0
      ? this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length
      : 0;

    return {
      uptime: Date.now() - this.startTime,
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      averageResponseTime: avgResponseTime,
      cacheHitRate: this.cache.getStats().hitRate,
      connectionPoolStats: this.connectionPool.getStats(),
      realtimeConnections: this.realtimeManager.getStats().activeConnections,
      memoryUsage: process.memoryUsage(),
    };
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting Ultimate StateSet MCP Server');
      
      // Start all services
      await this.server.connect(this.transport);
      
      logger.info('Ultimate StateSet MCP Server started successfully', {
        features: {
          intelligentCaching: true,
          connectionPooling: true,
          advancedMetrics: true,
          batchProcessing: true,
          realtimeUpdates: true,
          performanceOptimization: true,
        },
        endpoints: {
          realtime: 'ws://localhost:8080',
          metrics: 'internal',
        },
      });
      
    } catch (error) {
      const apiError = handleError(error, { operation: 'server_start' });
      logger.error({ error: apiError.message }, 'Failed to start server');
      throw apiError;
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping Ultimate StateSet MCP Server');
      
      // Graceful shutdown
      await this.batchProcessor.drain();
      await this.connectionPool.drain();
      await this.transport.close();
      
      this.cache.destroy();
      this.metrics.destroy();
      this.realtimeManager.destroy();
      this.performanceOptimizer.destroy();
      
      logger.info('Ultimate StateSet MCP Server stopped successfully');
    } catch (error) {
      const apiError = handleError(error, { operation: 'server_stop' });
      logger.error({ error: apiError.message }, 'Error stopping server');
      throw apiError;
    }
  }
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled promise rejection');
  process.exit(1);
});

// Main execution
async function main(): Promise<void> {
  try {
    dotenv.config();
    
    const server = new UltimateStateSetMCPServer();
    await server.start();
  } catch (error) {
    const apiError = handleError(error);
    logger.fatal({ error: sanitizeError(apiError) }, 'Failed to start application');
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { UltimateStateSetMCPServer };