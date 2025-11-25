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
import { handleToolCall } from './tools/handlers';
import { EnhancedStateSetClient } from './services/enhanced-stateset-client';
import { handleError, sanitizeError } from './middleware/error-handler';
import { validateAndSanitizeInput, SanitizedIdSchema } from './utils/validation';

class StateSetMCPServer {
  private server: Server;
  private client: EnhancedStateSetClient;
  private transport: StdioServerTransport;

  constructor() {
    this.client = new EnhancedStateSetClient(config);
    this.server = this.createServer();
    this.transport = new StdioServerTransport();
    this.setupHandlers();
  }

  private createServer(): Server {
    return new Server(
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
  }

  private setupHandlers(): void {
    // Tool call handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const toolName = request.params.name;
        const args = request.params.arguments || {};

        logger.info({ toolName, args }, 'Processing tool call');

        // Route to appropriate handler based on tool name pattern
        if (toolName.startsWith('stateset_')) {
          return await this.handleStateSetTool(toolName, args);
        }

        throw new Error(`Unknown tool: ${toolName}`);
      } catch (error) {
        const apiError = handleError(error, { 
          operation: request.params.name,
          requestId: `tool_${Date.now()}` 
        });
        
        logger.error({ 
          tool: request.params.name, 
          error: apiError.message 
        }, 'Tool call failed');
        
        throw apiError;
      }
    });

    // Resource handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const uri = new URL(request.params.uri);
        const resourceId = validateAndSanitizeInput(
          SanitizedIdSchema, 
          uri.pathname.replace(/^\//, ''), 
          'resource ID'
        );
        
        logger.debug({ uri: request.params.uri, resourceId }, 'Reading resource');

        const endpoint = this.getEndpointFromProtocol(uri.protocol);
        const resource = await this.client.get(endpoint, resourceId);
        
        return {
          contents: [{
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(resource, null, 2)
          }]
        };
      } catch (error) {
        const apiError = handleError(error, { 
          operation: 'read_resource',
          requestId: `resource_${Date.now()}` 
        });
        throw apiError;
      }
    });

    // Tools list handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Listing available tools');
      return { tools };
    });

    // Resource templates handler
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      logger.debug('Listing resource templates');
      return { templates: resourceTemplates };
    });
  }

  private async handleStateSetTool(toolName: string, args: Record<string, unknown>) {
    const parts = toolName.split('_');
    if (parts.length < 3) {
      throw new Error(`Invalid tool name format: ${toolName}`);
    }

    const operation = parts[1]; // create, update, delete, get, list
    const resourceType = parts.slice(2).join('_'); // rma, order, etc.
    const endpoint = this.getEndpointFromResourceType(resourceType);

    switch (operation) {
      case 'create':
        return await this.client.create(endpoint, args);
      
      case 'update':
        const updateId = this.extractId(args, resourceType);
        return await this.client.update(endpoint, updateId, args);
      
      case 'delete':
        const deleteId = this.extractId(args, resourceType);
        return await this.client.delete(endpoint, deleteId);
      
      case 'get':
        const getId = this.extractId(args, resourceType);
        return await this.client.get(endpoint, getId);
      
      case 'list':
        return await this.client.list(endpoint, args);
      
      default:
        if (toolName === 'stateset_get_api_metrics') {
          return this.client.getApiMetrics();
        }
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private extractId(args: Record<string, unknown>, resourceType: string): string {
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
      'bill_of_materials': '/bill-of-materials',
      'work_order': '/work-orders',
      'manufacturer_order': '/manufacturer-orders',
      'purchase_order': '/purchase-orders',
      'asn': '/asns',
      'invoice': '/invoices',
      'payment': '/payments',
      'sales_order': '/sales-orders',
      'fulfillment_order': '/fulfillment-orders',
      'item_receipt': '/item-receipts',
      'cash_sale': '/cash-sales',
      'product': '/products',
      'inventory': '/inventory',
      'customer': '/customers',
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
      'stateset-warranty:': '/warranties',
      'stateset-shipment:': '/shipments',
      'stateset-bill-of-materials:': '/bill-of-materials',
      'stateset-work-order:': '/work-orders',
      'stateset-manufacturer-order:': '/manufacturer-orders',
      'stateset-purchase-order:': '/purchase-orders',
      'stateset-asn:': '/asns',
      'stateset-invoice:': '/invoices',
      'stateset-payment:': '/payments',
      'stateset-sales-order:': '/sales-orders',
      'stateset-fulfillment-order:': '/fulfillment-orders',
      'stateset-item-receipt:': '/item-receipts',
      'stateset-cash-sale:': '/cash-sales',
      'stateset-inventory:': '/inventory',
      'stateset-product:': '/products',
      'stateset-customer:': '/customers',
    };

    const endpoint = protocolMap[protocol];
    if (!endpoint) {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
    
    return endpoint;
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting StateSet MCP Server');
      
      // Health check
      const isHealthy = await this.client.healthCheck();
      if (!isHealthy) {
        logger.warn('API health check failed, but continuing...');
      }
      
      await this.server.connect(this.transport);
      logger.info('StateSet MCP Server started successfully');
    } catch (error) {
      const apiError = handleError(error, { operation: 'server_start' });
      logger.error({ error: apiError.message }, 'Failed to start server');
      throw apiError;
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping StateSet MCP Server');
      await this.transport.close();
      logger.info('StateSet MCP Server stopped successfully');
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
    
    const server = new StateSetMCPServer();
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

export { StateSetMCPServer };