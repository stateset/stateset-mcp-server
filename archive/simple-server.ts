#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const config = {
  apiKey: process.env.STATESET_API_KEY || 'demo-key',
  baseUrl: process.env.STATESET_BASE_URL || 'https://api.stateset.io/v1',
  requestsPerHour: parseInt(process.env.REQUESTS_PER_HOUR || '1000'),
  timeoutMs: parseInt(process.env.API_TIMEOUT_MS || '10000'),
};

// Basic schemas
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

const GetRMAArgsSchema = z.object({
  rma_id: z.string().min(1, "RMA ID is required"),
});

const ListArgsSchema = z.object({
  page: z.number().positive().optional(),
  per_page: z.number().positive().optional(),
});

// Simple MCP Server
async function main(): Promise<void> {
  console.log('Starting StateSet MCP Server...');
  
  const server = new Server(
    { name: "stateset-mcp-server", version: "1.0.0" },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "stateset_list_rmas",
        description: "List RMAs from StateSet",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number" },
            per_page: { type: "number", description: "Items per page" }
          }
        }
      },
      {
        name: "stateset_get_rma",
        description: "Get a specific RMA by ID",
        inputSchema: {
          type: "object",
          properties: {
            rma_id: { type: "string", description: "RMA ID" }
          },
          required: ["rma_id"]
        }
      },
      {
        name: "stateset_create_rma",
        description: "Create a new RMA",
        inputSchema: {
          type: "object",
          properties: {
            order_id: { type: "string", description: "Order ID" },
            customer_email: { type: "string", description: "Customer email" },
            reason: { type: "string", description: "Reason for RMA" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item_id: { type: "string" },
                  quantity: { type: "number" }
                },
                required: ["item_id", "quantity"]
              }
            },
            notes: { type: "string", description: "Additional notes" }
          },
          required: ["order_id", "customer_email", "reason", "items"]
        }
      }
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "stateset_list_rmas":
          return {
            content: [{
              type: "text",
              text: `Listing RMAs with StateSet API (API Key: ${config.apiKey.substring(0, 8)}...)\nThis is a demo response - connect to real API with valid credentials.`
            }]
          };

        case "stateset_get_rma":
          const getRMAArgs = GetRMAArgsSchema.parse(args);
          return {
            content: [{
              type: "text", 
              text: `Getting RMA ${getRMAArgs.rma_id} from StateSet API\nThis is a demo response - connect to real API with valid credentials.`
            }]
          };

        case "stateset_create_rma":
          const createRMAArgs = CreateRMAArgsSchema.parse(args);
          return {
            content: [{
              type: "text",
              text: `Creating RMA for order ${createRMAArgs.order_id}, customer: ${createRMAArgs.customer_email}\nReason: ${createRMAArgs.reason}\nItems: ${createRMAArgs.items.length}\nThis is a demo response - connect to real API with valid credentials.`
            }]
          };

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log('StateSet MCP Server is running successfully!');
}

main().catch(console.error);