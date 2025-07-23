import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { StateSetClient } from '@services/stateset-client';
import type { MetricsCollector } from '@services/metrics';
import { tools } from '@tools/definitions';
import { resourceTemplates } from '@tools/definitions';
import { prompts } from '@tools/definitions';
import * as zodSchemas from '@tools/schemas';
import { createLogger } from '@utils/logger';

const logger = createLogger('handlers');

export function setupHandlers(
  server: Server,
  statesetClient: StateSetClient,
  metricsCollector?: MetricsCollector
): void {
  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('Listing tools');
    return { tools };
  });

  // List resource templates handler
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    logger.debug('Listing resource templates');
    return { resourceTemplates };
  });

  // List resources handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    logger.debug('Listing resources');
    // Return dynamic resources if needed
    return { resources: [] };
  });

  // Read resource handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    logger.debug(`Reading resource: ${uri}`);
    
    // Parse the URI to determine resource type and ID
    const match = uri.match(/^stateset-(\w+):\/\/\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }
    
    const [, resourceType, resourceId] = match;
    
    try {
      let data;
      switch (resourceType) {
        case 'rma':
          data = await statesetClient.getRMA(resourceId);
          break;
        case 'order':
          data = await statesetClient.getOrder(resourceId);
          break;
        case 'customer':
          data = await statesetClient.getCustomer(resourceId);
          break;
        default:
          throw new Error(`Unknown resource type: ${resourceType}`);
      }
      
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error(`Failed to read resource ${uri}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  });

  // List prompts handler
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    logger.debug('Listing prompts');
    return { prompts };
  });

  // Get prompt handler
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;
    logger.debug(`Getting prompt: ${name}`);
    
    const prompt = prompts.find(p => p.name === name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }
    
    return {
      description: prompt.description,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt.instructions || '',
          },
        },
      ],
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    const timer = metricsCollector?.startTimer('tool_execution', { tool: name });
    
    try {
      logger.debug(`Executing tool: ${name}`);
      
      let result;
      
      switch (name) {
        // RMA tools
        case 'stateset_create_rma':
          result = await statesetClient.createRMA(zodSchemas.CreateRMAZodSchema.parse(args));
          break;
        case 'stateset_update_rma':
          result = await statesetClient.updateRMA(zodSchemas.UpdateRMAZodSchema.parse(args));
          break;
        case 'stateset_delete_rma':
          result = await statesetClient.deleteRMA(zodSchemas.DeleteRMAZodSchema.parse(args));
          break;
        case 'stateset_get_rma':
          result = await statesetClient.getRMA(zodSchemas.GetRMAZodSchema.parse(args).rma_id);
          break;
        case 'stateset_list_rmas':
          result = await statesetClient.listRMAs(zodSchemas.ListZodSchema.parse(args));
          break;
          
        // Order tools
        case 'stateset_create_order':
          result = await statesetClient.createOrder(zodSchemas.CreateOrderZodSchema.parse(args));
          break;
        case 'stateset_update_order':
          result = await statesetClient.updateOrder(zodSchemas.UpdateOrderZodSchema.parse(args));
          break;
        case 'stateset_delete_order':
          result = await statesetClient.deleteOrder(zodSchemas.DeleteOrderZodSchema.parse(args));
          break;
        case 'stateset_get_order':
          result = await statesetClient.getOrder(zodSchemas.GetOrderZodSchema.parse(args).order_id);
          break;
        case 'stateset_list_orders':
          result = await statesetClient.listOrders(zodSchemas.ListZodSchema.parse(args));
          break;
          
        // Customer tools
        case 'stateset_create_customer':
          result = await statesetClient.createCustomer(zodSchemas.CreateCustomerZodSchema.parse(args));
          break;
        case 'stateset_update_customer':
          result = await statesetClient.updateCustomer(zodSchemas.UpdateCustomerZodSchema.parse(args));
          break;
        case 'stateset_delete_customer':
          result = await statesetClient.deleteCustomer(zodSchemas.DeleteCustomerZodSchema.parse(args));
          break;
        case 'stateset_get_customer':
          result = await statesetClient.getCustomer(zodSchemas.GetCustomerZodSchema.parse(args).customer_id);
          break;
        case 'stateset_list_customers':
          result = await statesetClient.listCustomers(zodSchemas.ListZodSchema.parse(args));
          break;
          
        // API metrics
        case 'stateset_get_api_metrics':
          result = statesetClient.getApiMetrics();
          break;
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
      
      // Record success metrics
      metricsCollector?.recordBusinessMetric('tool_execution', name, 'success');
      
      const duration = timer ? metricsCollector?.endTimer(timer) : 0;
      logger.debug(`Tool executed successfully: ${name} (${duration}ms)`);
      
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      
    } catch (error) {
      // Record error metrics
      metricsCollector?.recordBusinessMetric('tool_execution', name, 'error');
      
      if (timer) {
        metricsCollector?.endTimer(timer);
      }
      
      logger.error(`Tool execution failed: ${name} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });
  
  logger.info('Request handlers setup complete');
}