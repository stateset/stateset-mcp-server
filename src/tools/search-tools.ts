import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

// Search schemas - exported for use by consumers
export const SearchFilterSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'eq',
    'ne',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'nin',
    'contains',
    'starts_with',
    'ends_with',
  ]),
  value: z.any(),
});

export const SortSchema = z.object({
  field: z.string(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const DateRangeSchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

export const PriceRangeSchema = z.object({
  min: z.number().positive().optional(),
  max: z.number().positive().optional(),
});

// Advanced search tool
export const advancedSearchTool: Tool = {
  name: 'stateset_advanced_search',
  description: 'Search across resources with advanced filtering, sorting, and aggregation',
  inputSchema: {
    type: 'object',
    properties: {
      resource: {
        type: 'string',
        enum: ['orders', 'products', 'customers', 'inventory', 'rmas', 'invoices'],
        description: 'Resource type to search',
      },
      query: {
        type: 'string',
        description: 'Text search query',
      },
      filters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            operator: {
              type: 'string',
              enum: [
                'eq',
                'ne',
                'gt',
                'gte',
                'lt',
                'lte',
                'in',
                'nin',
                'contains',
                'starts_with',
                'ends_with',
              ],
            },
            value: {},
          },
          required: ['field', 'operator', 'value'],
        },
        description: 'Filter conditions',
      },
      sort: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            order: { type: 'string', enum: ['asc', 'desc'] },
          },
          required: ['field'],
        },
        description: 'Sort criteria',
      },
      page: {
        type: 'number',
        description: 'Page number (1-based)',
        default: 1,
      },
      per_page: {
        type: 'number',
        description: 'Results per page',
        default: 20,
      },
      include_aggregations: {
        type: 'boolean',
        description: 'Include aggregated statistics',
        default: false,
      },
    },
    required: ['resource'],
  },
};

// Order search with date range
export const searchOrdersByDateTool: Tool = {
  name: 'stateset_search_orders_by_date',
  description: 'Search orders within a date range with optional status filter',
  inputSchema: {
    type: 'object',
    properties: {
      date_range: {
        type: 'object',
        properties: {
          start: {
            type: 'string',
            format: 'date-time',
            description: 'Start date (ISO 8601)',
          },
          end: {
            type: 'string',
            format: 'date-time',
            description: 'End date (ISO 8601)',
          },
        },
      },
      status: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
        },
        description: 'Filter by order status',
      },
      customer_email: {
        type: 'string',
        description: 'Filter by customer email',
      },
      min_total: {
        type: 'number',
        description: 'Minimum order total',
      },
      max_total: {
        type: 'number',
        description: 'Maximum order total',
      },
      sort_by: {
        type: 'string',
        enum: ['created_at', 'updated_at', 'total_amount', 'customer_email'],
        default: 'created_at',
      },
      sort_order: {
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'desc',
      },
    },
  },
};

// Product search with inventory
export const searchProductsWithInventoryTool: Tool = {
  name: 'stateset_search_products_with_inventory',
  description: 'Search products with inventory levels and availability',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for product name or SKU',
      },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by categories',
      },
      price_range: {
        type: 'object',
        properties: {
          min: { type: 'number' },
          max: { type: 'number' },
        },
      },
      in_stock_only: {
        type: 'boolean',
        description: 'Only show products in stock',
        default: false,
      },
      min_stock_level: {
        type: 'number',
        description: 'Minimum stock level',
      },
      locations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by warehouse locations',
      },
      include_variants: {
        type: 'boolean',
        description: 'Include product variants',
        default: true,
      },
    },
  },
};

// Customer analytics search
export const searchCustomerAnalyticsTool: Tool = {
  name: 'stateset_search_customer_analytics',
  description: 'Search customers with order history and analytics',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search by name, email, or customer ID',
      },
      min_lifetime_value: {
        type: 'number',
        description: 'Minimum customer lifetime value',
      },
      min_order_count: {
        type: 'number',
        description: 'Minimum number of orders',
      },
      last_order_date_range: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date-time' },
          end: { type: 'string', format: 'date-time' },
        },
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Customer tags',
      },
      segment: {
        type: 'string',
        enum: ['vip', 'regular', 'new', 'at_risk', 'churned'],
        description: 'Customer segment',
      },
      include_metrics: {
        type: 'boolean',
        description: 'Include detailed metrics',
        default: true,
      },
    },
  },
};

// Full-text search
export const fullTextSearchTool: Tool = {
  name: 'stateset_full_text_search',
  description: 'Full-text search across all resources',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
      },
      resources: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['orders', 'products', 'customers', 'rmas', 'invoices', 'all'],
        },
        description: 'Resources to search in',
        default: ['all'],
      },
      limit: {
        type: 'number',
        description: 'Maximum results per resource',
        default: 10,
      },
      highlight: {
        type: 'boolean',
        description: 'Highlight matching text',
        default: true,
      },
    },
    required: ['query'],
  },
};

// Export search
export const exportSearchResultsTool: Tool = {
  name: 'stateset_export_search_results',
  description: 'Export search results to CSV or JSON',
  inputSchema: {
    type: 'object',
    properties: {
      search_id: {
        type: 'string',
        description: 'ID of a previous search to export',
      },
      format: {
        type: 'string',
        enum: ['csv', 'json', 'excel'],
        description: 'Export format',
        default: 'csv',
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Fields to include in export',
      },
      file_path: {
        type: 'string',
        description: 'Output file path',
      },
    },
    required: ['search_id', 'file_path'],
  },
};

// Saved search
export const savedSearchTool: Tool = {
  name: 'stateset_saved_search',
  description: 'Save and manage search queries',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'list', 'get', 'update', 'delete', 'execute'],
        description: 'Action to perform',
      },
      name: {
        type: 'string',
        description: 'Saved search name',
      },
      description: {
        type: 'string',
        description: 'Search description',
      },
      search_config: {
        type: 'object',
        description: 'Search configuration to save',
      },
      search_id: {
        type: 'string',
        description: 'ID of saved search (for get/update/delete/execute)',
      },
      schedule: {
        type: 'object',
        properties: {
          frequency: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly'],
          },
          email_results: {
            type: 'boolean',
            default: false,
          },
        },
        description: 'Schedule for automated search execution',
      },
    },
    required: ['action'],
  },
};

// Export all search tools
export const searchTools = [
  advancedSearchTool,
  searchOrdersByDateTool,
  searchProductsWithInventoryTool,
  searchCustomerAnalyticsTool,
  fullTextSearchTool,
  exportSearchResultsTool,
  savedSearchTool,
];

/**
 * Build search query from filters
 */
export function buildSearchQuery(filters: any[], sort: any[], page: number, perPage: number): any {
  const query: any = {
    filters: {},
    sort: {},
    pagination: {
      page,
      per_page: perPage,
    },
  };

  // Process filters
  filters.forEach((filter) => {
    const { field, operator, value } = filter;

    switch (operator) {
      case 'eq':
        query.filters[field] = value;
        break;
      case 'ne':
        query.filters[field] = { $ne: value };
        break;
      case 'gt':
        query.filters[field] = { $gt: value };
        break;
      case 'gte':
        query.filters[field] = { $gte: value };
        break;
      case 'lt':
        query.filters[field] = { $lt: value };
        break;
      case 'lte':
        query.filters[field] = { $lte: value };
        break;
      case 'in':
        query.filters[field] = { $in: value };
        break;
      case 'nin':
        query.filters[field] = { $nin: value };
        break;
      case 'contains':
        query.filters[field] = { $regex: value, $options: 'i' };
        break;
      case 'starts_with':
        query.filters[field] = { $regex: `^${value}`, $options: 'i' };
        break;
      case 'ends_with':
        query.filters[field] = { $regex: `${value}$`, $options: 'i' };
        break;
    }
  });

  // Process sort
  sort.forEach((s) => {
    query.sort[s.field] = s.order === 'desc' ? -1 : 1;
  });

  return query;
}
