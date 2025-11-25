#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ReadResourceRequestSchema, ListToolsRequestSchema, ListResourceTemplatesRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { tools, resourceTemplates, serverPrompt } from './tools/definitions';
import { handleError } from './middleware/error-handler';
import { wsManager } from './core/websocket';
import { cacheManager } from './core/cache';
import { StateSetMCPClient } from './services/mcp-client';
import { handleToolCall } from './tools/dispatcher';
import { Config } from './types/mcp-api';

// Main Function
async function main(): Promise<void> {
  try {
    dotenv.config();
    const env = z.object({
      STATESET_API_KEY: z.string().min(1, 'STATESET_API_KEY is required'),
      STATESET_BASE_URL: z.string().url().default('https://api.stateset.io/v1'),
      REQUESTS_PER_HOUR: z.coerce.number().positive().default(1000),
      API_TIMEOUT_MS: z.coerce.number().positive().default(10000),
      WEBSOCKET_PORT: z.coerce.number().positive().default(8081),
    }).parse(process.env);

    const config: Config = {
      apiKey: env.STATESET_API_KEY,
      baseUrl: env.STATESET_BASE_URL,
      requestsPerHour: env.REQUESTS_PER_HOUR,
      timeoutMs: env.API_TIMEOUT_MS,
    };

    const client = new StateSetMCPClient(config);

    // Start WebSocket server for real-time updates
    try {
      wsManager.start(env.WEBSOCKET_PORT);
      logger.info('WebSocket server started', { port: env.WEBSOCKET_PORT });
    } catch (wsError) {
      logger.warn('Failed to start WebSocket server - real-time updates will be unavailable', {
        error: wsError instanceof Error ? wsError.message : String(wsError),
      });
    }

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

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        return await handleToolCall(client, request);
      } catch (error) {
        // Use the error handler for better error messages
        const apiError = handleError(error, { operation: request.params.name });
        throw new Error(apiError.message);
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
        case 'stateset-warranty:':
          const warranty = await client.getWarranty(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(warranty, null, 2) }] };
        case 'stateset-shipment:':
          const shipment = await client.getShipment(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(shipment, null, 2) }] };
        case 'stateset-bill-of-materials:':
          const bom = await client.getBillOfMaterials(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(bom, null, 2) }] };
        case 'stateset-work-order:':
          const wo = await client.getWorkOrder(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(wo, null, 2) }] };
        case 'stateset-manufacturer-order:':
          const mo = await client.getManufacturerOrder(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(mo, null, 2) }] };
        case 'stateset-purchase-order:':
          const po = await client.getPurchaseOrder(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(po, null, 2) }] };
        case 'stateset-asn:':
          const asn = await client.getASN(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(asn, null, 2) }] };
        case 'stateset-invoice:':
          const invoice = await client.getInvoice(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(invoice, null, 2) }] };
        case 'stateset-payment:':
          const payment = await client.getPayment(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(payment, null, 2) }] };
        case 'stateset-sales-order:':
          const salesOrder = await client.getSalesOrder(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(salesOrder, null, 2) }] };
        case 'stateset-fulfillment-order:':
          const fo = await client.getFulfillmentOrder(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(fo, null, 2) }] };
        case 'stateset-item-receipt:':
          const ir = await client.getItemReceipt(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(ir, null, 2) }] };
        case 'stateset-cash-sale:':
          const cs = await client.getCashSale(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(cs, null, 2) }] };
        case 'stateset-inventory:':
          const inventory = await client.getInventory(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(inventory, null, 2) }] };
        case 'stateset-product:':
          const product = await client.getProduct(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(product, null, 2) }] };
        case 'stateset-customer:':
          const customer = await client.getCustomer(path);
          return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(customer, null, 2) }] };
        default:
          throw new Error(`Unsupported URI: ${request.params.uri}`);
      }
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools,
    }));

    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      templates: resourceTemplates,
    }));

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('Server started successfully');

    // Graceful shutdown handling
    let isShuttingDown = false;

    const gracefulShutdown = async (signal: string) => {
      if (isShuttingDown) {
        logger.warn('Shutdown already in progress, forcing exit');
        process.exit(1);
      }

      isShuttingDown = true;
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Close WebSocket connections
        logger.info('Closing WebSocket connections...');
        wsManager.stop();

        // Clear caches
        logger.info('Clearing caches...');
        cacheManager.clear();

        // Close server transport
        logger.info('Closing server transport...');
        await server.close();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

main().catch(console.error);