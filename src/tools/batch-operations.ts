import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '../utils/logger';
import { metrics } from '../core/metrics';
import { wsManager } from '../core/websocket';

// Generic client interface for batch operations
export interface BatchClient {
  createOrder(data: any): Promise<any>;
  updateOrder(data: any): Promise<any>;
  deleteOrder(args: any): Promise<any>;
  createRMA(data: any): Promise<any>;
  createProduct(data: any): Promise<any>;
  updateProduct(data: any): Promise<any>;
  deleteProduct(args: any): Promise<any>;
  createInventory(data: any): Promise<any>;
  updateInventory(data: any): Promise<any>;
  deleteInventory(args: any): Promise<any>;
  createCustomer(data: any): Promise<any>;
  updateCustomer(data: any): Promise<any>;
  deleteCustomer(args: any): Promise<any>;
}

const logger = createLogger('batch-operations');

// Batch operation schemas - defined for documentation/reference
export const BatchOrderSchema = z.object({
  customer_email: z.string().email(),
  items: z.array(
    z.object({
      item_id: z.string(),
      quantity: z.number().positive(),
      price: z.number().positive(),
    }),
  ),
  shipping_address: z.object({
    line1: z.string(),
    city: z.string(),
    state: z.string(),
    postal_code: z.string(),
    country: z.string(),
  }),
});

export const BatchOperationSchema = z.object({
  operations: z.array(
    z.object({
      type: z.enum(['create', 'update', 'delete']),
      resource: z.enum(['order', 'rma', 'product', 'inventory', 'customer']),
      data: z.any(),
    }),
  ),
  options: z
    .object({
      parallel: z.boolean().default(false),
      stopOnError: z.boolean().default(false),
      chunkSize: z.number().positive().default(10),
    })
    .optional(),
});

export interface BatchResult {
  success: number;
  failed: number;
  results: Array<{
    index: number;
    success: boolean;
    data?: any;
    error?: string;
  }>;
  duration: number;
}

/**
 * Execute batch operations with configurable concurrency
 */
export async function executeBatchOperations(
  client: BatchClient,
  operations: any[],
  options: {
    parallel?: boolean;
    stopOnError?: boolean;
    chunkSize?: number;
  } = {},
): Promise<BatchResult> {
  const startTime = Date.now();
  const results: BatchResult['results'] = [];
  let success = 0;
  let failed = 0;

  const { parallel = false, stopOnError = false, chunkSize = 10 } = options;

  try {
    if (parallel) {
      // Process in chunks for parallel execution
      for (let i = 0; i < operations.length; i += chunkSize) {
        const chunk = operations.slice(i, i + chunkSize);
        const chunkPromises = chunk.map(async (op, idx) => {
          const index = i + idx;
          try {
            const result = await executeOperation(client, op);
            results[index] = { index, success: true, data: result };
            success++;

            // Broadcast progress
            wsManager.broadcast('batch-progress', {
              total: operations.length,
              completed: results.filter((r) => r !== undefined).length,
              success,
              failed,
            });

            return result;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results[index] = { index, success: false, error: errorMessage };
            failed++;

            if (stopOnError) {
              throw error;
            }
          }
        });

        await Promise.all(chunkPromises);
      }
    } else {
      // Sequential processing
      for (let i = 0; i < operations.length; i++) {
        try {
          const result = await executeOperation(client, operations[i]);
          results[i] = { index: i, success: true, data: result };
          success++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results[i] = { index: i, success: false, error: errorMessage };
          failed++;

          if (stopOnError) {
            break;
          }
        }

        // Broadcast progress
        wsManager.broadcast('batch-progress', {
          total: operations.length,
          completed: i + 1,
          success,
          failed,
        });
      }
    }

    const duration = Date.now() - startTime;

    // Record metrics
    metrics.increment('batch_operations_total', 1, { status: 'completed' });
    metrics.observe('batch_operations_duration', duration);
    metrics.observe('batch_operations_size', operations.length);

    logger.info('Batch operations completed', {
      total: operations.length,
      success,
      failed,
      duration,
      parallel,
    });

    return {
      success,
      failed,
      results,
      duration,
    };
  } catch (error) {
    logger.error('Batch operations failed', error);
    metrics.increment('batch_operations_total', 1, { status: 'failed' });
    throw error;
  }
}

/**
 * Execute a single operation
 */
async function executeOperation(client: BatchClient, operation: any): Promise<any> {
  const { type, resource, data } = operation;

  switch (resource) {
    case 'order':
      switch (type) {
        case 'create':
          return client.createOrder(data);
        case 'update':
          return client.updateOrder(data);
        case 'delete':
          return client.deleteOrder({ order_id: data.order_id });
        default:
          throw new Error(`Unknown operation type: ${type}`);
      }

    case 'rma':
      switch (type) {
        case 'create':
          return client.createRMA(data);
        case 'update':
          // RMA update is not supported - use approve/restock instead
          throw new Error(
            'RMA update is not supported. Use approve_return or restock_return instead.',
          );
        case 'delete':
          // RMA deletion is not supported by the API
          throw new Error('RMA deletion is not supported');
        default:
          throw new Error(`Unknown operation type: ${type}`);
      }

    case 'product':
      switch (type) {
        case 'create':
          return client.createProduct(data);
        case 'update':
          return client.updateProduct(data);
        case 'delete':
          return client.deleteProduct({ product_id: data.product_id });
        default:
          throw new Error(`Unknown operation type: ${type}`);
      }

    case 'inventory':
      switch (type) {
        case 'create':
          return client.createInventory(data);
        case 'update':
          return client.updateInventory(data);
        case 'delete':
          return client.deleteInventory({ inventory_id: data.inventory_id });
        default:
          throw new Error(`Unknown operation type: ${type}`);
      }

    case 'customer':
      switch (type) {
        case 'create':
          return client.createCustomer(data);
        case 'update':
          return client.updateCustomer(data);
        case 'delete':
          return client.deleteCustomer({ customer_id: data.customer_id });
        default:
          throw new Error(`Unknown operation type: ${type}`);
      }

    default:
      throw new Error(`Unknown resource type: ${resource}`);
  }
}

// Batch operation tools
export const batchOperationsTool: Tool = {
  name: 'stateset_batch_operations',
  description: 'Execute multiple operations in batch with configurable concurrency',
  inputSchema: {
    type: 'object',
    properties: {
      operations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['create', 'update', 'delete'],
              description: 'Operation type',
            },
            resource: {
              type: 'string',
              enum: ['order', 'rma', 'product', 'inventory', 'customer'],
              description: 'Resource type',
            },
            data: {
              type: 'object',
              description: 'Operation data',
            },
          },
          required: ['type', 'resource', 'data'],
        },
        description: 'List of operations to execute',
      },
      options: {
        type: 'object',
        properties: {
          parallel: {
            type: 'boolean',
            description: 'Execute operations in parallel',
          },
          stopOnError: {
            type: 'boolean',
            description: 'Stop execution on first error',
          },
          chunkSize: {
            type: 'number',
            description: 'Number of parallel operations per chunk',
          },
        },
      },
    },
    required: ['operations'],
  },
};

export const batchCreateOrdersTool: Tool = {
  name: 'stateset_batch_create_orders',
  description: 'Create multiple orders in batch',
  inputSchema: {
    type: 'object',
    properties: {
      orders: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            customer_email: {
              type: 'string',
              format: 'email',
              description: 'Customer email address',
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item_id: { type: 'string' },
                  quantity: { type: 'number' },
                  price: { type: 'number' },
                },
                required: ['item_id', 'quantity', 'price'],
              },
              description: 'Order items',
            },
            shipping_address: {
              type: 'object',
              properties: {
                line1: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                postal_code: { type: 'string' },
                country: { type: 'string' },
              },
              required: ['line1', 'city', 'state', 'postal_code', 'country'],
            },
          },
          required: ['customer_email', 'items', 'shipping_address'],
        },
        description: 'List of orders to create',
      },
      parallel: {
        type: 'boolean',
        description: 'Create orders in parallel',
        default: true,
      },
    },
    required: ['orders'],
  },
};

export const batchUpdateInventoryTool: Tool = {
  name: 'stateset_batch_update_inventory',
  description: 'Update inventory levels for multiple products',
  inputSchema: {
    type: 'object',
    properties: {
      updates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            inventory_id: {
              type: 'string',
              description: 'Inventory ID',
            },
            quantity: {
              type: 'number',
              description: 'New quantity',
            },
            location: {
              type: 'string',
              description: 'Inventory location',
            },
          },
          required: ['inventory_id'],
        },
        description: 'List of inventory updates',
      },
      parallel: {
        type: 'boolean',
        description: 'Update inventory in parallel',
        default: true,
      },
    },
    required: ['updates'],
  },
};

// CSV import tool
export const csvImportTool: Tool = {
  name: 'stateset_csv_import',
  description: 'Import data from CSV file',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to CSV file',
      },
      resource_type: {
        type: 'string',
        enum: ['orders', 'products', 'customers', 'inventory'],
        description: 'Type of resource to import',
      },
      mapping: {
        type: 'object',
        description: 'Field mapping from CSV columns to resource fields',
        additionalProperties: { type: 'string' },
      },
      options: {
        type: 'object',
        properties: {
          skipHeader: {
            type: 'boolean',
            description: 'Skip first row as header',
            default: true,
          },
          delimiter: {
            type: 'string',
            description: 'CSV delimiter',
            default: ',',
          },
          batchSize: {
            type: 'number',
            description: 'Number of records per batch',
            default: 100,
          },
        },
      },
    },
    required: ['file_path', 'resource_type'],
  },
};

// Export tools
export const batchTools = [
  batchOperationsTool,
  batchCreateOrdersTool,
  batchUpdateInventoryTool,
  csvImportTool,
];
