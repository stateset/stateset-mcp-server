import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool categories for organization
 */
export enum ToolCategory {
  ORDERS = 'orders',
  RETURNS = 'returns',
  FULFILLMENT = 'fulfillment',
  PRODUCTION = 'production',
  INVENTORY = 'inventory',
  PRODUCTS = 'products',
  FINANCIAL = 'financial',
  CUSTOMERS = 'customers',
  ANALYTICS = 'analytics',
}

/**
 * Extended tool definition with category
 */
export interface CategorizedTool extends Tool {
  category: ToolCategory;
  tags?: string[];
}

/**
 * Tool execution context
 */
export interface ToolContext {
  requestId: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  duration: number;
  context: ToolContext;
}

/**
 * Tool registry entry
 */
export interface ToolRegistryEntry {
  tool: CategorizedTool;
  handler: (args: unknown, context: ToolContext) => Promise<unknown>;
  validator?: (args: unknown) => boolean;
  middleware?: Array<(args: unknown, context: ToolContext) => Promise<void>>;
}
