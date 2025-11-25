import { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { logger } from '../utils/logger';
import { sanitizeToolArguments } from '../utils/validation';
import { toolRateLimiter } from '../core/server-rate-limiter';
import { StateSetMCPClient } from '../services/mcp-client';
import { broadcastResourceUpdate } from '../utils/broadcast';
import * as schemas from './schemas';
import { executeBatchOperations } from './batch-operations';

import { buildSearchQuery } from './search-tools';
import { wsManager } from '../core/websocket';

export async function handleToolCall(client: StateSetMCPClient, request: CallToolRequest): Promise<any> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log incoming request
  logger.debug('Tool request received', {
    requestId,
    tool: request.params.name,
    hasArguments: !!request.params.arguments,
  });

  // Sanitize input arguments for security
  const rawArgs = request.params.arguments || {};
  const sanitizedArgs = sanitizeToolArguments(rawArgs as Record<string, unknown>, request.params.name);

  // Create a modified request with sanitized arguments
  const safeRequest = {
    ...request,
    params: {
      ...request.params,
      arguments: sanitizedArgs,
    },
  };

  // Apply per-tool rate limiting
  const toolCategory = await toolRateLimiter.waitAndAcquire(safeRequest.params.name);
  logger.debug('Tool rate limit acquired', {
    requestId,
    tool: safeRequest.params.name,
    category: toolCategory,
  });

  switch (safeRequest.params.name) {
    case "stateset_create_rma": {
      const result = await client.createRMA(schemas.CreateRMAArgsSchema.parse(safeRequest.params.arguments) as any);
      broadcastResourceUpdate('rmas', result.id, 'created', result);
      return result;
    }
    case "stateset_update_rma": {
      const args = schemas.UpdateRMAArgsSchema.parse(safeRequest.params.arguments) as any;
      const result = await client.updateRMA(args);
      broadcastResourceUpdate('rmas', args.rma_id, 'updated', result);
      return result;
    }
    case "stateset_create_order": {
      const result = await client.createOrder(schemas.CreateOrderArgsSchema.parse(safeRequest.params.arguments) as any);
      broadcastResourceUpdate('orders', result.id, 'created', result);
      return result;
    }
    case "stateset_update_order": {
      const args = schemas.UpdateOrderArgsSchema.parse(safeRequest.params.arguments) as any;
      const result = await client.updateOrder(args);
      broadcastResourceUpdate('orders', args.order_id, 'updated', result);
      return result;
    }
    case "stateset_create_warranty":
      return await client.createWarranty(schemas.CreateWarrantyArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_warranty":
      return await client.updateWarranty(schemas.UpdateWarrantyArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_create_shipment": {
      const result = await client.createShipment(schemas.CreateShipmentArgsSchema.parse(safeRequest.params.arguments) as any);
      broadcastResourceUpdate('shipments', result.id, 'created', result);
      return result;
    }
    case "stateset_update_shipment": {
      const args = schemas.UpdateShipmentArgsSchema.parse(safeRequest.params.arguments) as any;
      const result = await client.updateShipment(args);
      broadcastResourceUpdate('shipments', args.shipment_id, 'updated', result);
      return result;
    }
    case "stateset_create_bill_of_materials":
      return await client.createBillOfMaterials(schemas.CreateBillOfMaterialsArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_bill_of_materials":
      return await client.updateBillOfMaterials(schemas.UpdateBillOfMaterialsArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_create_work_order":
      return await client.createWorkOrder(schemas.CreateWorkOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_work_order":
      return await client.updateWorkOrder(schemas.UpdateWorkOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_create_manufacturer_order":
      return await client.createManufacturerOrder(schemas.CreateManufacturerOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_manufacturer_order":
      return await client.updateManufacturerOrder(schemas.UpdateManufacturerOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_create_purchase_order":
      return await client.createPurchaseOrder(schemas.CreatePurchaseOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_purchase_order":
      return await client.updatePurchaseOrder(schemas.UpdatePurchaseOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_purchase_order":
      return await client.deletePurchaseOrder(schemas.DeletePurchaseOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_get_purchase_order":
      return await client.getPurchaseOrder(schemas.GetPurchaseOrderArgsSchema.parse(safeRequest.params.arguments).purchase_order_id);
    case "stateset_list_purchase_orders":
      return await client.listPurchaseOrders(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_create_asn":
      return await client.createASN(schemas.CreateASNArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_asn":
      return await client.updateASN(schemas.UpdateASNArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_asn":
      return await client.deleteASN(schemas.DeleteASNArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_get_asn":
      return await client.getASN(schemas.GetASNArgsSchema.parse(safeRequest.params.arguments).asn_id);
    case "stateset_list_asns":
      return await client.listASNs(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_create_invoice":
      return await client.createInvoice(schemas.CreateInvoiceArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_invoice":
      return await client.updateInvoice(schemas.UpdateInvoiceArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_create_payment":
      return await client.createPayment(schemas.CreatePaymentArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_payment":
      return await client.updatePayment(schemas.UpdatePaymentArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_create_sales_order":
      return await client.createSalesOrder(schemas.CreateSalesOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_sales_order":
      return await client.updateSalesOrder(schemas.UpdateSalesOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_create_fulfillment_order":
      return await client.createFulfillmentOrder(schemas.CreateFulfillmentOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_fulfillment_order":
      return await client.updateFulfillmentOrder(schemas.UpdateFulfillmentOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_create_item_receipt":
      return await client.createItemReceipt(schemas.CreateItemReceiptArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_item_receipt":
      return await client.updateItemReceipt(schemas.UpdateItemReceiptArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_create_cash_sale":
      return await client.createCashSale(schemas.CreateCashSaleArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_cash_sale":
      return await client.updateCashSale(schemas.UpdateCashSaleArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_create_product":
      return await client.createProduct(schemas.CreateProductArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_product":
      return await client.updateProduct(schemas.UpdateProductArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_create_inventory":
      return await client.createInventory(schemas.CreateInventoryArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_inventory":
      return await client.updateInventory(schemas.UpdateInventoryArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_create_customer":
      return await client.createCustomer(schemas.CreateCustomerArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_update_customer":
      return await client.updateCustomer(schemas.UpdateCustomerArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_rma":
      return await client.deleteRMA(schemas.DeleteRMAArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_order": {
      const args = schemas.DeleteOrderArgsSchema.parse(safeRequest.params.arguments) as any;
      const result = await client.deleteOrder(args);
      broadcastResourceUpdate('orders', args.order_id, 'deleted', { id: args.order_id });
      return result;
    }
    case "stateset_delete_sales_order":
      return await client.deleteSalesOrder(schemas.DeleteSalesOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_warranty":
      return await client.deleteWarranty(schemas.DeleteWarrantyArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_shipment":
      return await client.deleteShipment(schemas.DeleteShipmentArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_bill_of_materials":
      return await client.deleteBillOfMaterials(schemas.DeleteBillOfMaterialsArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_work_order":
      return await client.deleteWorkOrder(schemas.DeleteWorkOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_manufacturer_order":
      return await client.deleteManufacturerOrder(schemas.DeleteManufacturerOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_invoice":
      return await client.deleteInvoice(schemas.DeleteInvoiceArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_payment":
      return await client.deletePayment(schemas.DeletePaymentArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_fulfillment_order":
      return await client.deleteFulfillmentOrder(schemas.DeleteFulfillmentOrderArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_item_receipt":
      return await client.deleteItemReceipt(schemas.DeleteItemReceiptArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_cash_sale":
      return await client.deleteCashSale(schemas.DeleteCashSaleArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_product":
      return await client.deleteProduct(schemas.DeleteProductArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_inventory":
      return await client.deleteInventory(schemas.DeleteInventoryArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_delete_customer":
      return await client.deleteCustomer(schemas.DeleteCustomerArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_get_rma":
      return await client.getRMA(schemas.GetRMAArgsSchema.parse(safeRequest.params.arguments).rma_id);
    case "stateset_get_order":
      return await client.getOrder(schemas.GetOrderArgsSchema.parse(safeRequest.params.arguments).order_id);
    case "stateset_get_warranty":
      return await client.getWarranty(schemas.GetWarrantyArgsSchema.parse(safeRequest.params.arguments).warranty_id);
    case "stateset_get_shipment":
      return await client.getShipment(schemas.GetShipmentArgsSchema.parse(safeRequest.params.arguments).shipment_id);
    case "stateset_get_bill_of_materials":
      return await client.getBillOfMaterials(schemas.GetBillOfMaterialsArgsSchema.parse(safeRequest.params.arguments).bill_of_materials_id);
    case "stateset_get_work_order":
      return await client.getWorkOrder(schemas.GetWorkOrderArgsSchema.parse(safeRequest.params.arguments).work_order_id);
    case "stateset_get_manufacturer_order":
      return await client.getManufacturerOrder(schemas.GetManufacturerOrderArgsSchema.parse(safeRequest.params.arguments).manufacturer_order_id);
    case "stateset_get_invoice":
      return await client.getInvoice(schemas.GetInvoiceArgsSchema.parse(safeRequest.params.arguments).invoice_id);
    case "stateset_get_payment":
      return await client.getPayment(schemas.GetPaymentArgsSchema.parse(safeRequest.params.arguments).payment_id);
    case "stateset_get_sales_order":
      return await client.getSalesOrder(schemas.GetSalesOrderArgsSchema.parse(safeRequest.params.arguments).sales_order_id);
    case "stateset_get_fulfillment_order":
      return await client.getFulfillmentOrder(schemas.GetFulfillmentOrderArgsSchema.parse(safeRequest.params.arguments).fulfillment_order_id);
    case "stateset_get_item_receipt":
      return await client.getItemReceipt(schemas.GetItemReceiptArgsSchema.parse(safeRequest.params.arguments).item_receipt_id);
    case "stateset_get_cash_sale":
      return await client.getCashSale(schemas.GetCashSaleArgsSchema.parse(safeRequest.params.arguments).cash_sale_id);
    case "stateset_get_product":
      return await client.getProduct(schemas.GetProductArgsSchema.parse(safeRequest.params.arguments).product_id);
    case "stateset_get_inventory":
      return await client.getInventory(schemas.GetInventoryArgsSchema.parse(safeRequest.params.arguments).inventory_id);
    case "stateset_get_customer":
      return await client.getCustomer(schemas.GetCustomerArgsSchema.parse(safeRequest.params.arguments).customer_id);

    case "stateset_list_rmas":
      return await client.listRMAs(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_orders":
      return await client.listOrders(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_sales_orders":
      return await client.listSalesOrders(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_warranties":
      return await client.listWarranties(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_shipments":
      return await client.listShipments(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_fulfillment_orders":
      return await client.listFulfillmentOrders(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_item_receipts":
      return await client.listItemReceipts(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_cash_sales":
      return await client.listCashSales(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_bill_of_materials":
      return await client.listBillOfMaterials(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_work_orders":
      return await client.listWorkOrders(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_manufacturer_orders":
      return await client.listManufacturerOrders(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_invoices":
      return await client.listInvoices(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_payments":
      return await client.listPayments(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_products":
      return await client.listProducts(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_inventories":
      return await client.listInventories(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_list_customers":
      return await client.listCustomers(schemas.ListArgsSchema.parse(safeRequest.params.arguments) as any);
    case "stateset_get_api_metrics":
      return client.getApiMetrics();

    case "stateset_tool_rate_limits": {
      const args = safeRequest.params.arguments as { category?: string };
      const metrics = args.category
        ? toolRateLimiter.getMetrics(args.category as any)
        : toolRateLimiter.getMetrics();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            metrics,
            limits: toolRateLimiter.getLimits(),
            description: "Per-tool rate limits by category. Tokens refill continuously based on requestsPerMinute.",
          }, null, 2),
        }],
      };
    }

    case "stateset_timeout_config": {
      const timeouts = client.getTimeoutConfig();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            timeouts,
            description: "Per-operation timeout configuration in milliseconds. Batch operations have longest timeouts, read operations have shortest.",
            examples: {
              "getOrder (read)": `${timeouts.read}ms`,
              "createOrder (create)": `${timeouts.create}ms`,
              "batchCreateOrders (batch)": `${timeouts.batch}ms`,
              "searchOrders (search)": `${timeouts.search}ms`,
            },
          }, null, 2),
        }],
      };
    }

    case "stateset_health_check": {
      const args = safeRequest.params.arguments as any;
      const healthResult = await client.healthCheck(args.include_details || false);
      return {
        content: [{ type: "text", text: JSON.stringify(healthResult, null, 2) }],
      };
    }

    // Batch operations
    case "stateset_batch_operations": {
      const args = safeRequest.params.arguments as any;
      const result = await executeBatchOperations(client, args.operations, args.options);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    case "stateset_batch_create_orders": {
      const args = safeRequest.params.arguments as any;
      const operations = args.orders.map((order: any) => ({
        type: 'create',
        resource: 'orders',
        data: order
      }));
      const result = await executeBatchOperations(client, operations, args.options);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "stateset_csv_import": {
      const args = safeRequest.params.arguments as any;
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
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    // Cache operations
    case "stateset_cache_stats": {
      const args = safeRequest.params.arguments as any;
      const stats = client.getCacheStats();
      return {
        content: [{ type: "text", text: JSON.stringify(
          args.namespace ? (stats as any)[args.namespace] || {} : stats,
          null, 2
        ) }],
      };
    }

    case "stateset_clear_cache": {
      const args = safeRequest.params.arguments as any;
      if (args.namespace) {
        client.invalidateCache(args.namespace);
      } else {
        // Clear all known cache namespaces
        ['rmas', 'orders', 'warranties', 'shipments', 'bom', 'workorders', 'mfgorders', 'invoices', 'products', 'inventory', 'customers'].forEach(ns => {
          client.invalidateCache(ns);
        });
      }
      return {
        content: [{ type: "text", text: JSON.stringify({
          success: true,
          message: args.namespace
            ? `Cache namespace '${args.namespace}' cleared`
            : 'All caches cleared',
        }, null, 2) }],
      };
    }

    case "stateset_websocket_stats": {
      const stats = wsManager.getStats();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            ...stats,
            description: "WebSocket server statistics for real-time updates. Clients can subscribe to channels like 'orders', 'rmas', 'shipments' etc. to receive live updates.",
            availableChannels: [
              "orders", "rmas", "warranties", "shipments", "invoices",
              "products", "inventory", "customers", "work_orders",
              "manufacturer_orders", "purchase_orders", "asns"
            ],
          }, null, 2),
        }],
      };
    }

    // Search operations
    case "stateset_advanced_search": {
      const args = safeRequest.params.arguments as any;
      const searchQuery = buildSearchQuery(
        args.filters || [],
        args.sort || [],
        args.page || 1,
        args.per_page || 20
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
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }

    case "stateset_search_orders_by_date": {
      const args = safeRequest.params.arguments as any;
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
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }

    case "stateset_search_products_with_inventory": {
      const args = safeRequest.params.arguments as any;
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
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }

    case "stateset_search_customer_analytics": {
      const args = safeRequest.params.arguments as any;
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
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }

    case "stateset_full_text_search": {
      const args = safeRequest.params.arguments as any;
      const resources = args.resources?.includes('all') ? ['orders', 'products', 'customers', 'rmas', 'invoices'] : (args.resources || ['all']);
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
            logger.warn('Search failed for resource', { resource, error: error instanceof Error ? error.message : 'Unknown' });
            return { resource, data: { error: 'Search failed for this resource' }, success: false };
          }
        });

      const results = await Promise.all(searchPromises);

      // Convert array results back to object
      const searchResults = results.reduce((acc, { resource, data }) => {
        acc[resource] = data;
        return acc;
      }, {} as Record<string, any>);

      return {
        content: [{ type: "text", text: JSON.stringify(searchResults, null, 2) }],
      };
    }

    case "stateset_export_search_results": {
      const args = safeRequest.params.arguments as any;
      // Export functionality would typically write to a file
      // For MCP, we return the formatted data
      return {
        content: [{ type: "text", text: JSON.stringify({
          message: 'Export search results requires a search_id from a previous search. Use the advanced_search tool first.',
          search_id: args.search_id,
          format: args.format,
          file_path: args.file_path,
        }, null, 2) }],
      };
    }

    case "stateset_saved_search": {
      const args = safeRequest.params.arguments as any;
      // Saved search management - would typically require persistence
      return {
        content: [{ type: "text", text: JSON.stringify({
          action: args.action,
          message: `Saved search action '${args.action}' acknowledged. This feature requires server-side persistence configuration.`,
          config: args.search_config,
        }, null, 2) }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${safeRequest.params.name}`);
  }
}
