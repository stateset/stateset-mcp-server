import { StateSetMCPClient } from '../services/mcp-client';
import { broadcastResourceUpdate } from '../utils/broadcast';
import * as schemas from './schemas';
import { executeBatchOperations } from './batch-operations';
import { buildSearchQuery } from './search-tools';
import { wsManager } from '../core/websocket';
import { toolRateLimiter } from '../core/server-rate-limiter';
import { logger } from '../utils/logger';

export type ToolHandler = (client: StateSetMCPClient, args: any) => Promise<any>;

export const toolHandlers = new Map<string, ToolHandler>();

// RMA operations
toolHandlers.set('stateset_create_rma', async (client, args) => {
  const result = await client.createRMA(schemas.CreateRMAArgsSchema.parse(args) as any);
  broadcastResourceUpdate('rmas', result.id, 'created', result);
  return result;
});

toolHandlers.set('stateset_update_rma', async (client, args) => {
  const parsedArgs = schemas.UpdateRMAArgsSchema.parse(args) as any;
  const result = await client.updateRMA(parsedArgs);
  broadcastResourceUpdate('rmas', parsedArgs.rma_id, 'updated', result);
  return result;
});

toolHandlers.set('stateset_delete_rma', async (client, args) => {
  return await client.deleteRMA(schemas.DeleteRMAArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_get_rma', async (client, args) => {
  return await client.getRMA(schemas.GetRMAArgsSchema.parse(args).rma_id);
});

toolHandlers.set('stateset_list_rmas', async (client, args) => {
  return await client.listRMAs(schemas.ListArgsSchema.parse(args) as any);
});

// Order operations
toolHandlers.set('stateset_create_order', async (client, args) => {
  const result = await client.createOrder(schemas.CreateOrderArgsSchema.parse(args) as any);
  broadcastResourceUpdate('orders', result.id, 'created', result);
  return result;
});

toolHandlers.set('stateset_update_order', async (client, args) => {
  const parsedArgs = schemas.UpdateOrderArgsSchema.parse(args) as any;
  const result = await client.updateOrder(parsedArgs);
  broadcastResourceUpdate('orders', parsedArgs.order_id, 'updated', result);
  return result;
});

toolHandlers.set('stateset_delete_order', async (client, args) => {
  const parsedArgs = schemas.DeleteOrderArgsSchema.parse(args) as any;
  const result = await client.deleteOrder(parsedArgs);
  broadcastResourceUpdate('orders', parsedArgs.order_id, 'deleted', { id: parsedArgs.order_id });
  return result;
});

toolHandlers.set('stateset_get_order', async (client, args) => {
  return await client.getOrder(schemas.GetOrderArgsSchema.parse(args).order_id);
});

toolHandlers.set('stateset_list_orders', async (client, args) => {
  return await client.listOrders(schemas.ListArgsSchema.parse(args) as any);
});

// Warranty operations
toolHandlers.set('stateset_create_warranty', async (client, args) => {
  return await client.createWarranty(schemas.CreateWarrantyArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_update_warranty', async (client, args) => {
  return await client.updateWarranty(schemas.UpdateWarrantyArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_delete_warranty', async (client, args) => {
  return await client.deleteWarranty(schemas.DeleteWarrantyArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_get_warranty', async (client, args) => {
  return await client.getWarranty(schemas.GetWarrantyArgsSchema.parse(args).warranty_id);
});

toolHandlers.set('stateset_list_warranties', async (client, args) => {
  return await client.listWarranties(schemas.ListArgsSchema.parse(args) as any);
});

// Shipment operations
toolHandlers.set('stateset_create_shipment', async (client, args) => {
  const result = await client.createShipment(schemas.CreateShipmentArgsSchema.parse(args) as any);
  broadcastResourceUpdate('shipments', result.id, 'created', result);
  return result;
});

toolHandlers.set('stateset_update_shipment', async (client, args) => {
  const parsedArgs = schemas.UpdateShipmentArgsSchema.parse(args) as any;
  const result = await client.updateShipment(parsedArgs);
  broadcastResourceUpdate('shipments', parsedArgs.shipment_id, 'updated', result);
  return result;
});

toolHandlers.set('stateset_delete_shipment', async (client, args) => {
  return await client.deleteShipment(schemas.DeleteShipmentArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_get_shipment', async (client, args) => {
  return await client.getShipment(schemas.GetShipmentArgsSchema.parse(args).shipment_id);
});

toolHandlers.set('stateset_list_shipments', async (client, args) => {
  return await client.listShipments(schemas.ListArgsSchema.parse(args) as any);
});

// Bill of Materials
toolHandlers.set('stateset_create_bill_of_materials', async (client, args) => {
  return await client.createBillOfMaterials(
    schemas.CreateBillOfMaterialsArgsSchema.parse(args) as any,
  );
});

toolHandlers.set('stateset_update_bill_of_materials', async (client, args) => {
  return await client.updateBillOfMaterials(
    schemas.UpdateBillOfMaterialsArgsSchema.parse(args) as any,
  );
});

toolHandlers.set('stateset_delete_bill_of_materials', async (client, args) => {
  return await client.deleteBillOfMaterials(
    schemas.DeleteBillOfMaterialsArgsSchema.parse(args) as any,
  );
});

toolHandlers.set('stateset_get_bill_of_materials', async (client, args) => {
  return await client.getBillOfMaterials(
    schemas.GetBillOfMaterialsArgsSchema.parse(args).bill_of_materials_id,
  );
});

toolHandlers.set('stateset_list_bill_of_materials', async (client, args) => {
  return await client.listBillOfMaterials(schemas.ListArgsSchema.parse(args) as any);
});

// Work Order
toolHandlers.set('stateset_create_work_order', async (client, args) => {
  return await client.createWorkOrder(schemas.CreateWorkOrderArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_update_work_order', async (client, args) => {
  return await client.updateWorkOrder(schemas.UpdateWorkOrderArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_delete_work_order', async (client, args) => {
  return await client.deleteWorkOrder(schemas.DeleteWorkOrderArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_get_work_order', async (client, args) => {
  return await client.getWorkOrder(schemas.GetWorkOrderArgsSchema.parse(args).work_order_id);
});

toolHandlers.set('stateset_list_work_orders', async (client, args) => {
  return await client.listWorkOrders(schemas.ListArgsSchema.parse(args) as any);
});

// Manufacturer Order
toolHandlers.set('stateset_create_manufacturer_order', async (client, args) => {
  return await client.createManufacturerOrder(
    schemas.CreateManufacturerOrderArgsSchema.parse(args) as any,
  );
});

toolHandlers.set('stateset_update_manufacturer_order', async (client, args) => {
  return await client.updateManufacturerOrder(
    schemas.UpdateManufacturerOrderArgsSchema.parse(args) as any,
  );
});

toolHandlers.set('stateset_delete_manufacturer_order', async (client, args) => {
  return await client.deleteManufacturerOrder(
    schemas.DeleteManufacturerOrderArgsSchema.parse(args) as any,
  );
});

toolHandlers.set('stateset_get_manufacturer_order', async (client, args) => {
  return await client.getManufacturerOrder(
    schemas.GetManufacturerOrderArgsSchema.parse(args).manufacturer_order_id,
  );
});

toolHandlers.set('stateset_list_manufacturer_orders', async (client, args) => {
  return await client.listManufacturerOrders(schemas.ListArgsSchema.parse(args) as any);
});

// Purchase Order
toolHandlers.set('stateset_create_purchase_order', async (client, args) => {
  return await client.createPurchaseOrder(schemas.CreatePurchaseOrderArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_update_purchase_order', async (client, args) => {
  return await client.updatePurchaseOrder(schemas.UpdatePurchaseOrderArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_delete_purchase_order', async (client, args) => {
  return await client.deletePurchaseOrder(schemas.DeletePurchaseOrderArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_get_purchase_order', async (client, args) => {
  return await client.getPurchaseOrder(
    schemas.GetPurchaseOrderArgsSchema.parse(args).purchase_order_id,
  );
});

toolHandlers.set('stateset_list_purchase_orders', async (client, args) => {
  return await client.listPurchaseOrders(schemas.ListArgsSchema.parse(args) as any);
});

// ASN
toolHandlers.set('stateset_create_asn', async (client, args) => {
  return await client.createASN(schemas.CreateASNArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_update_asn', async (client, args) => {
  return await client.updateASN(schemas.UpdateASNArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_delete_asn', async (client, args) => {
  return await client.deleteASN(schemas.DeleteASNArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_get_asn', async (client, args) => {
  return await client.getASN(schemas.GetASNArgsSchema.parse(args).asn_id);
});

toolHandlers.set('stateset_list_asns', async (client, args) => {
  return await client.listASNs(schemas.ListArgsSchema.parse(args) as any);
});

// Invoice
toolHandlers.set('stateset_create_invoice', async (client, args) => {
  return await client.createInvoice(schemas.CreateInvoiceArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_update_invoice', async (client, args) => {
  return await client.updateInvoice(schemas.UpdateInvoiceArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_delete_invoice', async (client, args) => {
  return await client.deleteInvoice(schemas.DeleteInvoiceArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_get_invoice', async (client, args) => {
  return await client.getInvoice(schemas.GetInvoiceArgsSchema.parse(args).invoice_id);
});

toolHandlers.set('stateset_list_invoices', async (client, args) => {
  return await client.listInvoices(schemas.ListArgsSchema.parse(args) as any);
});

// Payment
toolHandlers.set('stateset_create_payment', async (client, args) => {
  return await client.createPayment(schemas.CreatePaymentArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_update_payment', async (client, args) => {
  return await client.updatePayment(schemas.UpdatePaymentArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_delete_payment', async (client, args) => {
  return await client.deletePayment(schemas.DeletePaymentArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_get_payment', async (client, args) => {
  return await client.getPayment(schemas.GetPaymentArgsSchema.parse(args).payment_id);
});

toolHandlers.set('stateset_list_payments', async (client, args) => {
  return await client.listPayments(schemas.ListArgsSchema.parse(args) as any);
});

// Sales Order
toolHandlers.set('stateset_create_sales_order', async (client, args) => {
  return await client.createSalesOrder(schemas.CreateSalesOrderArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_update_sales_order', async (client, args) => {
  return await client.updateSalesOrder(schemas.UpdateSalesOrderArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_delete_sales_order', async (client, args) => {
  return await client.deleteSalesOrder(schemas.DeleteSalesOrderArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_get_sales_order', async (client, args) => {
  return await client.getSalesOrder(schemas.GetSalesOrderArgsSchema.parse(args).sales_order_id);
});

toolHandlers.set('stateset_list_sales_orders', async (client, args) => {
  return await client.listSalesOrders(schemas.ListArgsSchema.parse(args) as any);
});

// Fulfillment Order
toolHandlers.set('stateset_create_fulfillment_order', async (client, args) => {
  return await client.createFulfillmentOrder(
    schemas.CreateFulfillmentOrderArgsSchema.parse(args) as any,
  );
});

toolHandlers.set('stateset_update_fulfillment_order', async (client, args) => {
  return await client.updateFulfillmentOrder(
    schemas.UpdateFulfillmentOrderArgsSchema.parse(args) as any,
  );
});

toolHandlers.set('stateset_delete_fulfillment_order', async (client, args) => {
  return await client.deleteFulfillmentOrder(
    schemas.DeleteFulfillmentOrderArgsSchema.parse(args) as any,
  );
});

toolHandlers.set('stateset_get_fulfillment_order', async (client, args) => {
  return await client.getFulfillmentOrder(
    schemas.GetFulfillmentOrderArgsSchema.parse(args).fulfillment_order_id,
  );
});

toolHandlers.set('stateset_list_fulfillment_orders', async (client, args) => {
  return await client.listFulfillmentOrders(schemas.ListArgsSchema.parse(args) as any);
});

// Item Receipt
toolHandlers.set('stateset_create_item_receipt', async (client, args) => {
  return await client.createItemReceipt(schemas.CreateItemReceiptArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_update_item_receipt', async (client, args) => {
  return await client.updateItemReceipt(schemas.UpdateItemReceiptArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_delete_item_receipt', async (client, args) => {
  return await client.deleteItemReceipt(schemas.DeleteItemReceiptArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_get_item_receipt', async (client, args) => {
  return await client.getItemReceipt(schemas.GetItemReceiptArgsSchema.parse(args).item_receipt_id);
});

toolHandlers.set('stateset_list_item_receipts', async (client, args) => {
  return await client.listItemReceipts(schemas.ListArgsSchema.parse(args) as any);
});

// Cash Sale
toolHandlers.set('stateset_create_cash_sale', async (client, args) => {
  return await client.createCashSale(schemas.CreateCashSaleArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_update_cash_sale', async (client, args) => {
  return await client.updateCashSale(schemas.UpdateCashSaleArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_delete_cash_sale', async (client, args) => {
  return await client.deleteCashSale(schemas.DeleteCashSaleArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_get_cash_sale', async (client, args) => {
  return await client.getCashSale(schemas.GetCashSaleArgsSchema.parse(args).cash_sale_id);
});

toolHandlers.set('stateset_list_cash_sales', async (client, args) => {
  return await client.listCashSales(schemas.ListArgsSchema.parse(args) as any);
});

// Product
toolHandlers.set('stateset_create_product', async (client, args) => {
  return await client.createProduct(schemas.CreateProductArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_update_product', async (client, args) => {
  return await client.updateProduct(schemas.UpdateProductArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_delete_product', async (client, args) => {
  return await client.deleteProduct(schemas.DeleteProductArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_get_product', async (client, args) => {
  return await client.getProduct(schemas.GetProductArgsSchema.parse(args).product_id);
});

toolHandlers.set('stateset_list_products', async (client, args) => {
  return await client.listProducts(schemas.ListArgsSchema.parse(args) as any);
});

// Inventory
toolHandlers.set('stateset_create_inventory', async (client, args) => {
  return await client.createInventory(schemas.CreateInventoryArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_update_inventory', async (client, args) => {
  return await client.updateInventory(schemas.UpdateInventoryArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_delete_inventory', async (client, args) => {
  return await client.deleteInventory(schemas.DeleteInventoryArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_get_inventory', async (client, args) => {
  return await client.getInventory(schemas.GetInventoryArgsSchema.parse(args).inventory_id);
});

toolHandlers.set('stateset_list_inventories', async (client, args) => {
  return await client.listInventories(schemas.ListArgsSchema.parse(args) as any);
});

// Customer
toolHandlers.set('stateset_create_customer', async (client, args) => {
  return await client.createCustomer(schemas.CreateCustomerArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_update_customer', async (client, args) => {
  return await client.updateCustomer(schemas.UpdateCustomerArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_delete_customer', async (client, args) => {
  return await client.deleteCustomer(schemas.DeleteCustomerArgsSchema.parse(args) as any);
});

toolHandlers.set('stateset_get_customer', async (client, args) => {
  return await client.getCustomer(schemas.GetCustomerArgsSchema.parse(args).customer_id);
});

toolHandlers.set('stateset_list_customers', async (client, args) => {
  return await client.listCustomers(schemas.ListArgsSchema.parse(args) as any);
});

// Metrics
toolHandlers.set('stateset_get_api_metrics', async (client, _args) => {
  return client.getApiMetrics();
});

// Rate Limits
toolHandlers.set('stateset_tool_rate_limits', async (_client, args) => {
  const parsedArgs = args as { category?: string };
  const metrics = parsedArgs.category
    ? toolRateLimiter.getMetrics(parsedArgs.category as any)
    : toolRateLimiter.getMetrics();
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            metrics,
            limits: toolRateLimiter.getLimits(),
            description:
              'Per-tool rate limits by category. Tokens refill continuously based on requestsPerMinute.',
          },
          null,
          2,
        ),
      },
    ],
  };
});

// Timeout Config
toolHandlers.set('stateset_timeout_config', async (client, _args) => {
  const timeouts = client.getTimeoutConfig();
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            timeouts,
            description:
              'Per-operation timeout configuration in milliseconds. Batch operations have longest timeouts, read operations have shortest.',
            examples: {
              'getOrder (read)': `${timeouts.read}ms`,
              'createOrder (create)': `${timeouts.create}ms`,
              'batchCreateOrders (batch)': `${timeouts.batch}ms`,
              'searchOrders (search)': `${timeouts.search}ms`,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
});

// Health Check
toolHandlers.set('stateset_health_check', async (client, args) => {
  const healthResult = await client.healthCheck(args.include_details || false);
  return {
    content: [{ type: 'text', text: JSON.stringify(healthResult, null, 2) }],
  };
});

// Batch Operations
toolHandlers.set('stateset_batch_operations', async (client, args) => {
  const result = await executeBatchOperations(client, args.operations, args.options);
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

toolHandlers.set('stateset_batch_create_orders', async (client, args) => {
  const operations = args.orders.map((order: any) => ({
    type: 'create',
    resource: 'orders',
    data: order,
  }));
  const result = await executeBatchOperations(client, operations, args.options);
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

toolHandlers.set('stateset_csv_import', async (client, args) => {
  // Parse CSV content and create operations
  const rows = args.content.split('\n').filter((row: string) => row.trim());
  const headers = rows[0]?.split(',').map((h: string) => h.trim()) || [];
  const operations = rows.slice(1).map((row: string) => {
    const values = row.split(',').map((v: string) => v.trim());
    const data: any = {};
    headers.forEach((header: string, i: number) => {
      data[header] = values[i];
    });
    return {
      type: 'create',
      resource: args.resource,
      data,
    };
  });
  const result = await executeBatchOperations(client, operations, args.options);
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

// Cache Operations
toolHandlers.set('stateset_cache_stats', async (client, args) => {
  const stats = client.getCacheStats();
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          args.namespace ? (stats as any)[args.namespace] || {} : stats,
          null,
          2,
        ),
      },
    ],
  };
});

toolHandlers.set('stateset_clear_cache', async (client, args) => {
  if (args.namespace) {
    client.invalidateCache(args.namespace);
  } else {
    // Clear all known cache namespaces
    [
      'rmas',
      'orders',
      'warranties',
      'shipments',
      'bom',
      'workorders',
      'mfgorders',
      'invoices',
      'products',
      'inventory',
      'customers',
    ].forEach((ns) => {
      client.invalidateCache(ns);
    });
  }
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            message: args.namespace
              ? `Cache namespace '${args.namespace}' cleared`
              : 'All caches cleared',
          },
          null,
          2,
        ),
      },
    ],
  };
});

// WebSocket Stats
toolHandlers.set('stateset_websocket_stats', async (_client, _args) => {
  const stats = wsManager.getStats();
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ...stats,
            description:
              "WebSocket server statistics for real-time updates. Clients can subscribe to channels like 'orders', 'rmas', 'shipments' etc. to receive live updates.",
            availableChannels: [
              'orders',
              'rmas',
              'warranties',
              'shipments',
              'invoices',
              'products',
              'inventory',
              'customers',
              'work_orders',
              'manufacturer_orders',
              'purchase_orders',
              'asns',
            ],
          },
          null,
          2,
        ),
      },
    ],
  };
});

// Search Operations
toolHandlers.set('stateset_advanced_search', async (client, args) => {
  const searchQuery = buildSearchQuery(
    args.filters || [],
    args.sort || [],
    args.page || 1,
    args.per_page || 20,
  );

  // Map resource type to list method
  const resourceMap: Record<string, () => Promise<any>> = {
    orders: () => client.listOrders(searchQuery),
    products: () => client.listProducts(searchQuery),
    customers: () => client.listCustomers(searchQuery),
    inventory: () => client.listInventories(searchQuery),
    rmas: () => client.listRMAs(searchQuery),
    invoices: () => client.listInvoices(searchQuery),
  };

  const listFn = resourceMap[args.resource];
  if (!listFn) {
    throw new Error(`Unknown resource type: ${args.resource}`);
  }

  const results = await listFn();
  return {
    content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
  };
});

toolHandlers.set('stateset_search_orders_by_date', async (client, args) => {
  const filters: any[] = [];

  if (args.date_range?.start) {
    filters.push({ field: 'created_at', operator: 'gte', value: args.date_range.start });
  }
  if (args.date_range?.end) {
    filters.push({ field: 'created_at', operator: 'lte', value: args.date_range.end });
  }
  if (args.status?.length) {
    filters.push({ field: 'status', operator: 'in', value: args.status });
  }
  if (args.customer_email) {
    filters.push({ field: 'customer_email', operator: 'eq', value: args.customer_email });
  }
  if (args.min_total !== undefined) {
    filters.push({ field: 'total_amount', operator: 'gte', value: args.min_total });
  }
  if (args.max_total !== undefined) {
    filters.push({ field: 'total_amount', operator: 'lte', value: args.max_total });
  }

  const sort = args.sort_by ? [{ field: args.sort_by, order: args.sort_order || 'desc' }] : [];
  const searchQuery = buildSearchQuery(filters, sort, 1, 100);
  const results = await client.listOrders(searchQuery);

  return {
    content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
  };
});

toolHandlers.set('stateset_search_products_with_inventory', async (client, args) => {
  const filters: any[] = [];

  if (args.query) {
    filters.push({ field: 'name', operator: 'contains', value: args.query });
  }
  if (args.categories?.length) {
    filters.push({ field: 'category', operator: 'in', value: args.categories });
  }
  if (args.price_range?.min !== undefined) {
    filters.push({ field: 'price', operator: 'gte', value: args.price_range.min });
  }
  if (args.price_range?.max !== undefined) {
    filters.push({ field: 'price', operator: 'lte', value: args.price_range.max });
  }
  if (args.in_stock_only) {
    filters.push({ field: 'stock_quantity', operator: 'gt', value: 0 });
  }
  if (args.min_stock_level !== undefined) {
    filters.push({ field: 'stock_quantity', operator: 'gte', value: args.min_stock_level });
  }

  const searchQuery = buildSearchQuery(filters, [], 1, 100);
  const results = await client.listProducts(searchQuery);

  return {
    content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
  };
});

toolHandlers.set('stateset_search_customer_analytics', async (client, args) => {
  const filters: any[] = [];

  if (args.query) {
    filters.push({ field: 'email', operator: 'contains', value: args.query });
  }
  if (args.min_lifetime_value !== undefined) {
    filters.push({ field: 'lifetime_value', operator: 'gte', value: args.min_lifetime_value });
  }
  if (args.min_order_count !== undefined) {
    filters.push({ field: 'order_count', operator: 'gte', value: args.min_order_count });
  }
  if (args.tags?.length) {
    filters.push({ field: 'tags', operator: 'in', value: args.tags });
  }
  if (args.segment) {
    filters.push({ field: 'segment', operator: 'eq', value: args.segment });
  }

  const searchQuery = buildSearchQuery(filters, [], 1, 100);
  const results = await client.listCustomers(searchQuery);

  return {
    content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
  };
});

toolHandlers.set('stateset_full_text_search', async (client, args) => {
  const resources = args.resources?.includes('all')
    ? ['orders', 'products', 'customers', 'rmas', 'invoices']
    : args.resources || ['all'];
  const limit = args.limit || 10;

  const filters = [{ field: 'search', operator: 'contains', value: args.query }];
  const searchQuery = buildSearchQuery(filters, [], 1, limit);

  // Resource search functions mapping
  const resourceSearchers: Record<string, () => Promise<any>> = {
    orders: () => client.listOrders(searchQuery),
    products: () => client.listProducts(searchQuery),
    customers: () => client.listCustomers(searchQuery),
    rmas: () => client.listRMAs(searchQuery),
    invoices: () => client.listInvoices(searchQuery),
  };

  // Execute all searches in parallel for better performance
  const searchPromises = resources
    .filter((r: string) => resourceSearchers[r])
    .map(async (resource: string) => {
      try {
        const searcher = resourceSearchers[resource];
        if (!searcher) {
          return { resource, data: { error: 'Unknown resource type' }, success: false };
        }
        const data = await searcher();
        return { resource, data, success: true };
      } catch (error) {
        logger.warn('Search failed for resource', {
          resource,
          error: error instanceof Error ? error.message : 'Unknown',
        });
        return { resource, data: { error: 'Search failed for this resource' }, success: false };
      }
    });

  const results = await Promise.all(searchPromises);

  // Convert array results back to object
  const searchResults = results.reduce(
    (acc, { resource, data }) => {
      acc[resource] = data;
      return acc;
    },
    {} as Record<string, any>,
  );

  return {
    content: [{ type: 'text', text: JSON.stringify(searchResults, null, 2) }],
  };
});

toolHandlers.set('stateset_export_search_results', async (_client, args) => {
  // Export functionality would typically write to a file
  // For MCP, we return the formatted data
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            message:
              'Export search results requires a search_id from a previous search. Use the advanced_search tool first.',
            search_id: args.search_id,
            format: args.format,
            file_path: args.file_path,
          },
          null,
          2,
        ),
      },
    ],
  };
});

toolHandlers.set('stateset_saved_search', async (_client, args) => {
  // Saved search management - would typically require persistence
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            action: args.action,
            message: `Saved search action '${args.action}' acknowledged. This feature requires server-side persistence configuration.`,
            config: args.search_config,
          },
          null,
          2,
        ),
      },
    ],
  };
});
