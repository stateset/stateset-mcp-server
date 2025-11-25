import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { batchTools } from './batch-operations';
import { searchTools } from './search-tools';
import { aiInsightsTools } from './ai-insights';

/**
 * Enhanced tools for StateSet MCP Server
 * These are additional tools that extend the basic CRUD operations
 */

// WebSocket monitoring tool
export const websocketMonitorTool: Tool = {
  name: 'stateset_websocket_monitor',
  description: 'Monitor WebSocket connections and subscriptions',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['status', 'subscribe', 'unsubscribe', 'broadcast'],
        description: 'Action to perform',
      },
      channel: {
        type: 'string',
        description: 'Channel name for subscribe/unsubscribe/broadcast',
      },
      message: {
        type: 'object',
        description: 'Message to broadcast',
      },
    },
    required: ['action'],
  },
};

// System health tool
export const systemHealthTool: Tool = {
  name: 'stateset_system_health',
  description: 'Get comprehensive system health and performance metrics',
  inputSchema: {
    type: 'object',
    properties: {
      include_dependencies: {
        type: 'boolean',
        description: 'Include dependency health checks',
        default: true,
      },
      include_metrics: {
        type: 'boolean',
        description: 'Include performance metrics',
        default: true,
      },
      include_cache_stats: {
        type: 'boolean',
        description: 'Include cache statistics',
        default: true,
      },
      include_circuit_breaker: {
        type: 'boolean',
        description: 'Include circuit breaker status',
        default: true,
      },
    },
  },
};

// Cache management tool
export const cacheManagementTool: Tool = {
  name: 'stateset_cache_management',
  description: 'Manage cache operations',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get_stats', 'clear', 'warm', 'set_strategy'],
        description: 'Cache management action',
      },
      namespace: {
        type: 'string',
        description: 'Cache namespace',
      },
      strategy: {
        type: 'string',
        enum: ['lru', 'lfu', 'fifo'],
        description: 'Cache eviction strategy',
      },
    },
    required: ['action'],
  },
};

// Export all enhanced tools
export const enhancedTools: Tool[] = [
  ...batchTools,
  ...searchTools,
  ...aiInsightsTools,
  websocketMonitorTool,
  systemHealthTool,
  cacheManagementTool,
];

// Export individual tool categories for selective import
export { batchTools, searchTools, aiInsightsTools };
