import { Tool, ResourceTemplate, Prompt } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as schemas from './schemas';
import { batchTools } from './batch-operations';
import { searchTools } from './search-tools';

type ToolDefinition = Omit<Tool, 'inputSchema'> & { inputSchema?: any };

const normalizeInputSchema = (schema: any) => {
  if (!schema) {
    return { type: 'object', properties: {} };
  }

  // Already JSON Schema
  if (schema.type) {
    return schema;
  }

  // Full Zod schema
  if (schema._def) {
    return zodToJsonSchema(schema as z.ZodTypeAny, { $refStrategy: 'none' });
  }

  // Zod shape object (e.g., schema.shape)
  if (
    typeof schema === 'object' &&
    Object.values(schema).every((value) => value && typeof value === 'object' && '_def' in value)
  ) {
    const zodSchema = z.object(schema as Record<string, z.ZodTypeAny>);
    return zodToJsonSchema(zodSchema, { $refStrategy: 'none' });
  }

  return schema;
};

// Tool Definitions with comprehensive descriptions for AI understanding
const toolDefinitions: ToolDefinition[] = [
  // ===================
  // CREATE OPERATIONS
  // ===================
  {
    name: 'stateset_create_rma',
    description:
      'Creates a new Return Merchandise Authorization (RMA) for processing customer returns. Use this when a customer wants to return a product. Requires the original order_id and a reason for the return. Returns the RMA ID which can be used to track the return process through approval and restocking.',
    inputSchema: schemas.CreateRMAArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_order',
    description:
      "Creates a new customer order with line items, shipping, and billing information. Use this to record a new purchase. The order will be created in 'pending' status. Returns the order ID and a dashboard URL for tracking. Required: customer_id and at least one item with product_id and quantity.",
    inputSchema: schemas.CreateOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_warranty',
    description:
      'Creates a warranty record for products. Links warranty coverage to specific items from an order. Specify warranty_period_months for each item to define coverage duration. Useful for tracking product warranties and handling warranty claims.',
    inputSchema: schemas.CreateWarrantyArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_shipment',
    description:
      "Creates a shipment record to track order delivery. Associates a tracking number with an order and specifies the carrier (e.g., 'UPS', 'FedEx', 'USPS'). Use stateset_mark_shipment_shipped and stateset_mark_shipment_delivered to update status as the shipment progresses.",
    inputSchema: schemas.CreateShipmentArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_bill_of_materials',
    description:
      'Creates a Bill of Materials (BOM) defining the components needed to manufacture a product. Lists all required parts with quantities and costs. Essential for manufacturing planning and cost estimation.',
    inputSchema: schemas.CreateBillOfMaterialsArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_work_order',
    description:
      'Creates a manufacturing work order to produce items. Specifies what products to make and quantities. Links to orders and can reference bill of materials. Use for production planning and tracking manufacturing jobs.',
    inputSchema: schemas.CreateWorkOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_manufacturer_order',
    description:
      'Creates an order to an external manufacturer. Use when outsourcing production to third-party manufacturers. Tracks items, quantities, and order status with the manufacturer.',
    inputSchema: schemas.CreateManufacturerOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_purchase_order',
    description:
      'Creates a purchase order (PO) to a vendor/supplier. Use to order raw materials, components, or finished goods from suppliers. Includes line items with quantities and negotiated prices. Tracks vendor fulfillment.',
    inputSchema: schemas.CreatePurchaseOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_asn',
    description:
      'Creates an Advance Shipping Notice (ASN) to notify of incoming shipments from suppliers. Links to a purchase order and provides early visibility of inbound inventory. Includes carrier and tracking information.',
    inputSchema: schemas.CreateASNArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_invoice',
    description:
      'Creates an invoice for a customer order. Generates a billing document with line items and amounts. Use for accounts receivable tracking and sending payment requests to customers.',
    inputSchema: schemas.CreateInvoiceArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_payment',
    description:
      "Records a payment transaction. Links payment to an order with amount and payment method (e.g., 'credit_card', 'bank_transfer', 'check'). Use for accounts receivable and payment reconciliation.",
    inputSchema: schemas.CreatePaymentArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_sales_order',
    description:
      'Creates a sales order representing a confirmed sale. More formal than a regular order - typically used in B2B contexts. Includes full customer details, line items, and addresses.',
    inputSchema: schemas.CreateSalesOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_fulfillment_order',
    description:
      'Creates a fulfillment order to pick, pack, and ship items. Represents the physical fulfillment process separate from the sales order. Includes warehouse/location details and carrier information.',
    inputSchema: schemas.CreateFulfillmentOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_item_receipt',
    description:
      'Creates an item receipt to record inventory received from a purchase order or transfer. Updates inventory quantities and links to the source document. Essential for inventory accuracy.',
    inputSchema: schemas.CreateItemReceiptArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_cash_sale',
    description:
      'Creates a cash sale for immediate payment transactions. Combines order and payment in one step - useful for point-of-sale (POS) or walk-in customer purchases where payment is collected immediately.',
    inputSchema: schemas.CreateCashSaleArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_product',
    description:
      "Creates a new product in the catalog. Define name, SKU (stock keeping unit), description, and price. The SKU should be unique and follow your naming convention (e.g., 'WIDGET-001'). Products can then be added to orders and inventory.",
    inputSchema: schemas.CreateProductArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_inventory',
    description:
      'Creates an inventory record to track stock levels for a product at a specific location. Sets initial quantity on hand. Use stateset_update_inventory to adjust quantities for receipts, sales, or adjustments.',
    inputSchema: schemas.CreateInventoryArgsSchema.shape as any,
  },
  {
    name: 'stateset_create_customer',
    description:
      'Creates a new customer record. Stores contact information (email, name) and address details. Customer ID is then used when creating orders. Essential for customer relationship management.',
    inputSchema: schemas.CreateCustomerArgsSchema.shape as any,
  },

  // ===================
  // UPDATE OPERATIONS
  // ===================
  {
    name: 'stateset_update_order',
    description:
      'Updates an existing order. Can modify shipping/billing addresses, payment method, and notes. Use order_id to identify the order. Does NOT modify line items - for that, consider canceling and creating a new order.',
    inputSchema: schemas.UpdateOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_warranty',
    description:
      'Updates warranty record details. Can change status and add notes. Use for warranty claims processing and status tracking.',
    inputSchema: schemas.UpdateWarrantyArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_bill_of_materials',
    description:
      'Updates a Bill of Materials. Can modify component items, quantities, and costs. Use when BOM requirements change during production planning.',
    inputSchema: schemas.UpdateBillOfMaterialsArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_work_order',
    description:
      'Updates a manufacturing work order. Can modify items, quantities, and add notes. Use to adjust production requirements or add instructions.',
    inputSchema: schemas.UpdateWorkOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_manufacturer_order',
    description:
      'Updates an order to an external manufacturer. Modify items, quantities, or add notes for communication with the manufacturer.',
    inputSchema: schemas.UpdateManufacturerOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_purchase_order',
    description:
      'Updates a purchase order to a vendor. Can change status, line items, quantities, prices, and addresses. Use for PO amendments and status updates.',
    inputSchema: schemas.UpdatePurchaseOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_asn',
    description:
      'Updates an Advance Shipping Notice. Can modify carrier, status, tracking number, and destination. Use when shipment details change.',
    inputSchema: schemas.UpdateASNArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_invoice',
    description:
      'Updates an invoice. Can modify line items and notes. Use for invoice corrections before sending to customer.',
    inputSchema: schemas.UpdateInvoiceArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_payment',
    description:
      'Updates a payment record. Can modify amount, payment method, items, and notes. Use for payment corrections and updates.',
    inputSchema: schemas.UpdatePaymentArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_sales_order',
    description:
      'Updates a sales order. Can change status, line items, addresses. Use for order modifications and status progression (pending → confirmed → shipped).',
    inputSchema: schemas.UpdateSalesOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_fulfillment_order',
    description:
      'Updates a fulfillment order. Can modify carrier, status, tracking, and destination. Use to update fulfillment progress.',
    inputSchema: schemas.UpdateFulfillmentOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_item_receipt',
    description:
      'Updates an item receipt. Can modify items received and add notes. Use for corrections to receiving records.',
    inputSchema: schemas.UpdateItemReceiptArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_cash_sale',
    description:
      'Updates a cash sale record. Can modify items, payment method, and status. Use for POS corrections.',
    inputSchema: schemas.UpdateCashSaleArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_product',
    description:
      'Updates product information. Can change name, SKU, description, and price. Use for product catalog maintenance. SKU changes may affect existing inventory records.',
    inputSchema: schemas.UpdateProductArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_inventory',
    description:
      'Updates inventory levels at a location. Use to adjust quantity_on_hand for receipts, shipments, adjustments, or cycle counts. Include a reason for audit trail.',
    inputSchema: schemas.UpdateInventoryArgsSchema.shape as any,
  },
  {
    name: 'stateset_update_customer',
    description:
      'Updates customer information. Can change email, name, and address. Use for customer data maintenance and address corrections.',
    inputSchema: schemas.UpdateCustomerArgsSchema.shape as any,
  },

  // =======================
  // WORKFLOW OPERATIONS
  // =======================
  {
    name: 'stateset_approve_return',
    description:
      'Approves a pending return (RMA) for processing. This is the first step after receiving a return request. After approval, use stateset_restock_return to add items back to inventory. Requires the rma_id.',
    inputSchema: schemas.GetRMAArgsSchema.shape as any,
  },
  {
    name: 'stateset_restock_return',
    description:
      'Restocks inventory from an approved return. Adds the returned items back to available inventory. Only use after the return has been approved with stateset_approve_return and items have been inspected. Requires the rma_id.',
    inputSchema: schemas.GetRMAArgsSchema.shape as any,
  },
  {
    name: 'stateset_mark_shipment_shipped',
    description:
      "Updates a shipment status to 'shipped'. Use when the package has been handed off to the carrier and is in transit. The tracking number should already be set on the shipment. Requires the shipment_id.",
    inputSchema: schemas.GetShipmentArgsSchema.shape as any,
  },
  {
    name: 'stateset_mark_shipment_delivered',
    description:
      "Updates a shipment status to 'delivered'. Use when delivery confirmation is received from the carrier. This completes the shipment lifecycle. Requires the shipment_id.",
    inputSchema: schemas.GetShipmentArgsSchema.shape as any,
  },

  // ===================
  // DELETE OPERATIONS
  // ===================
  // NOTE: Delete operations are permanent. Consider archiving or canceling records instead when possible.
  {
    name: 'stateset_delete_order',
    description:
      "Permanently deletes an order. WARNING: This cannot be undone. Consider updating status to 'cancelled' instead for audit purposes. Only delete test orders or orders created in error.",
    inputSchema: schemas.DeleteOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_warranty',
    description:
      'Permanently deletes a warranty record. Use with caution - warranty history may be needed for customer support.',
    inputSchema: schemas.DeleteWarrantyArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_bill_of_materials',
    description:
      'Permanently deletes a Bill of Materials. Only delete obsolete BOMs no longer needed for reference.',
    inputSchema: schemas.DeleteBillOfMaterialsArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_work_order',
    description:
      'Permanently deletes a work order. Only delete work orders created in error. Completed work orders should be kept for production history.',
    inputSchema: schemas.DeleteWorkOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_manufacturer_order',
    description:
      'Permanently deletes a manufacturer order. Use only for orders never submitted to the manufacturer.',
    inputSchema: schemas.DeleteManufacturerOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_purchase_order',
    description:
      'Permanently deletes a purchase order. Only delete POs not yet sent to vendors. For sent POs, cancel them instead.',
    inputSchema: schemas.DeletePurchaseOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_asn',
    description:
      'Permanently deletes an Advance Shipping Notice. Only delete ASNs created in error before goods are shipped.',
    inputSchema: schemas.DeleteASNArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_invoice',
    description:
      'Permanently deletes an invoice. Only delete draft invoices. For sent invoices, issue a credit memo instead.',
    inputSchema: schemas.DeleteInvoiceArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_payment',
    description:
      'Permanently deletes a payment record. Only delete payments entered in error. Actual payments should be voided or refunded, not deleted.',
    inputSchema: schemas.DeletePaymentArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_sales_order',
    description:
      'Permanently deletes a sales order. Only delete draft orders. For confirmed orders, cancel them instead.',
    inputSchema: schemas.DeleteSalesOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_fulfillment_order',
    description:
      'Permanently deletes a fulfillment order. Only delete before fulfillment begins. Do not delete once picking has started.',
    inputSchema: schemas.DeleteFulfillmentOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_item_receipt',
    description:
      'Permanently deletes an item receipt. WARNING: This affects inventory accuracy. Only delete receipts entered in error immediately after creation.',
    inputSchema: schemas.DeleteItemReceiptArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_cash_sale',
    description:
      'Permanently deletes a cash sale. Only delete sales entered in error. For actual sales, process a refund instead.',
    inputSchema: schemas.DeleteCashSaleArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_product',
    description:
      'Permanently deletes a product from the catalog. WARNING: May affect existing orders and inventory. Consider marking as inactive instead.',
    inputSchema: schemas.DeleteProductArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_inventory',
    description:
      'Permanently deletes an inventory record. WARNING: This removes inventory tracking for a product at a location. Usually not recommended - adjust quantity to zero instead.',
    inputSchema: schemas.DeleteInventoryArgsSchema.shape as any,
  },
  {
    name: 'stateset_delete_customer',
    description:
      'Permanently deletes a customer record. WARNING: May affect order history. Consider anonymizing customer data instead for GDPR compliance while retaining order records.',
    inputSchema: schemas.DeleteCustomerArgsSchema.shape as any,
  },

  // ================
  // GET OPERATIONS
  // ================
  // These retrieve a single record by ID. Fast and efficient for looking up specific items.
  {
    name: 'stateset_get_rma',
    description:
      'Retrieves a single RMA (return) by ID. Returns full details including status, items, reason, and timeline. Use to check return status or get details for processing.',
    inputSchema: schemas.GetRMAArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_order',
    description:
      'Retrieves a single order by ID. Returns complete order details including items, addresses, status, and amounts. Use to check order status or get details for fulfillment.',
    inputSchema: schemas.GetOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_warranty',
    description:
      'Retrieves a warranty record by ID. Returns coverage details, items, and expiration. Use to verify warranty status for customer support.',
    inputSchema: schemas.GetWarrantyArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_shipment',
    description:
      'Retrieves a shipment by ID. Returns tracking number, carrier, status, and addresses. Use to track delivery progress.',
    inputSchema: schemas.GetShipmentArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_bill_of_materials',
    description:
      'Retrieves a BOM by ID. Returns all components, quantities, and costs. Use for production planning.',
    inputSchema: schemas.GetBillOfMaterialsArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_work_order',
    description:
      'Retrieves a work order by ID. Returns production details, status, and items to manufacture.',
    inputSchema: schemas.GetWorkOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_manufacturer_order',
    description:
      'Retrieves a manufacturer order by ID. Returns items ordered and status with external manufacturer.',
    inputSchema: schemas.GetManufacturerOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_purchase_order',
    description:
      'Retrieves a purchase order by ID. Returns vendor details, line items, prices, and fulfillment status.',
    inputSchema: schemas.GetPurchaseOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_asn',
    description:
      'Retrieves an ASN by ID. Returns expected shipment details from supplier including items and tracking.',
    inputSchema: schemas.GetASNArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_invoice',
    description: 'Retrieves an invoice by ID. Returns line items, amounts, and payment status.',
    inputSchema: schemas.GetInvoiceArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_payment',
    description:
      'Retrieves a payment record by ID. Returns amount, method, and associated order/invoice.',
    inputSchema: schemas.GetPaymentArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_sales_order',
    description:
      'Retrieves a sales order by ID. Returns full B2B order details with customer and items.',
    inputSchema: schemas.GetSalesOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_fulfillment_order',
    description:
      'Retrieves a fulfillment order by ID. Returns picking/packing details and fulfillment status.',
    inputSchema: schemas.GetFulfillmentOrderArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_item_receipt',
    description:
      'Retrieves an item receipt by ID. Returns received items and quantities for inventory verification.',
    inputSchema: schemas.GetItemReceiptArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_cash_sale',
    description:
      'Retrieves a cash sale by ID. Returns POS transaction details including items and payment.',
    inputSchema: schemas.GetCashSaleArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_product',
    description:
      'Retrieves a product by ID. Returns name, SKU, description, and current price. Use to look up product details.',
    inputSchema: schemas.GetProductArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_inventory',
    description:
      'Retrieves inventory record by ID. Returns quantity on hand and location. Use to check stock levels.',
    inputSchema: schemas.GetInventoryArgsSchema.shape as any,
  },
  {
    name: 'stateset_get_customer',
    description: 'Retrieves a customer by ID. Returns contact info, address, and account details.',
    inputSchema: schemas.GetCustomerArgsSchema.shape as any,
  },

  // =================
  // LIST OPERATIONS
  // =================
  // These retrieve multiple records with pagination. Use page and per_page parameters.
  {
    name: 'stateset_list_rmas',
    description:
      'Lists all RMA (return) records with pagination. Use to see all returns, then filter by status if needed. For specific searches, use advanced search tools.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_orders',
    description:
      'Lists all orders with pagination. Returns order summaries. For finding specific orders, use stateset_advanced_search with filters.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_warranties',
    description:
      'Lists all warranty records with pagination. Use to review active warranties or find expiring coverage.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_shipments',
    description:
      'Lists all shipments with pagination. Use to monitor shipping activity and identify pending deliveries.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_bill_of_materials',
    description:
      'Lists all BOMs with pagination. Use to review product manufacturing specifications.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_work_orders',
    description:
      'Lists all work orders with pagination. Use to review production schedule and status.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_manufacturer_orders',
    description:
      'Lists all manufacturer orders with pagination. Use to track outsourced production.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_purchase_orders',
    description:
      'Lists all purchase orders with pagination. Use to review vendor orders and pending receipts.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_asns',
    description:
      'Lists all ASNs with pagination. Use to see expected incoming inventory from suppliers.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_invoices',
    description:
      'Lists all invoices with pagination. Use for accounts receivable review and aging reports.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_payments',
    description:
      'Lists all payment records with pagination. Use for payment reconciliation and cash flow review.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_sales_orders',
    description: 'Lists all sales orders with pagination. Use to review B2B order activity.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_fulfillment_orders',
    description:
      'Lists all fulfillment orders with pagination. Use to manage warehouse operations and picking queues.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_item_receipts',
    description:
      'Lists all item receipts with pagination. Use to review receiving history and pending receipts.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_cash_sales',
    description:
      'Lists all cash sales with pagination. Use for POS transaction review and reporting.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_products',
    description:
      'Lists all products in catalog with pagination. Use to browse product catalog or export for review.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_inventories',
    description:
      'Lists all inventory records with pagination. Use to review stock levels across all products and locations.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },
  {
    name: 'stateset_list_customers',
    description:
      'Lists all customers with pagination. Use to browse customer base or export for marketing.',
    inputSchema: schemas.ListArgsSchema.shape as any,
  },

  // ================================
  // MONITORING & ADMIN OPERATIONS
  // ================================
  {
    name: 'stateset_get_api_metrics',
    description:
      'Returns API usage metrics including request counts, response times, and error rates. Use to monitor API health and identify performance issues. Includes cache stats, rate limit status, and circuit breaker state.',
    inputSchema: schemas.GetApiMetricsArgsSchema.shape as any,
  },
  {
    name: 'stateset_tool_rate_limits',
    description:
      "Returns per-tool rate limit status. Shows token counts and throttle status by category: 'read' (high throughput), 'create' (moderate), 'update' (medium), 'delete' (conservative), 'batch' (very limited), 'admin' (moderate). Use to check if you're approaching rate limits before making requests.",
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['read', 'create', 'update', 'delete', 'batch', 'admin'],
          description: 'Optional: Get metrics for a specific operation category only',
        },
      },
    },
  },
  {
    name: 'stateset_timeout_config',
    description:
      'Returns timeout configuration for each operation type. Shows how long requests will wait before timing out. Useful for understanding expected response times and planning batch operations.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'stateset_health_check',
    description:
      'Checks overall server health and connectivity. Returns: API connection status, rate limiter state, circuit breaker state (open/closed/half-open), memory usage, and server info. Use to diagnose issues when operations are failing.',
    inputSchema: {
      type: 'object',
      properties: {
        include_details: {
          type: 'boolean',
          description: 'Set to true for detailed component-level health breakdown',
        },
      },
    },
  },
  {
    name: 'stateset_cache_stats',
    description:
      'Returns cache performance statistics: hit rate, miss rate, current size, eviction count, and items cached. High hit rate = good performance. Use to tune cache settings or identify caching issues.',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: {
          type: 'string',
          description:
            "Optional: Get stats for specific cache namespace (e.g., 'orders', 'products')",
        },
      },
    },
  },
  {
    name: 'stateset_clear_cache',
    description:
      "Clears cached data to force fresh API calls. Use after making changes that aren't reflected in responses, or to free memory. Can clear all caches or a specific namespace.",
    inputSchema: {
      type: 'object',
      properties: {
        namespace: {
          type: 'string',
          description: 'Optional: Clear only this cache namespace. If omitted, clears ALL caches',
        },
      },
    },
  },
  {
    name: 'stateset_websocket_stats',
    description:
      'Returns WebSocket real-time subscription statistics. Shows active connections, subscribed channels, and subscriber counts. Use to monitor live update delivery and connection health.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // Batch operations
  ...batchTools,

  // Search operations
  ...searchTools,
];

export const tools: Tool[] = toolDefinitions.map(({ inputSchema, ...tool }) => ({
  ...tool,
  inputSchema: normalizeInputSchema(inputSchema),
}));

// Resource Templates
export const resourceTemplates: ResourceTemplate[] = [
  {
    uriTemplate: 'stateset-rma:///{rmaId}',
    name: 'StateSet RMA',
    description: 'RMA record',
    parameters: { rmaId: { type: 'string', description: 'RMA ID' } },
    examples: ['stateset-rma:///12345'],
  },
  {
    uriTemplate: 'stateset-order:///{orderId}',
    name: 'StateSet Order',
    description: 'Order record',
    parameters: { orderId: { type: 'string', description: 'Order ID' } },
    examples: ['stateset-order:///ORD-123'],
  },
  {
    uriTemplate: 'stateset-warranty:///{warrantyId}',
    name: 'StateSet Warranty',
    description: 'Warranty record',
    parameters: { warrantyId: { type: 'string', description: 'Warranty ID' } },
    examples: ['stateset-warranty:///WAR-123'],
  },
  {
    uriTemplate: 'stateset-shipment:///{shipmentId}',
    name: 'StateSet Shipment',
    description: 'Shipment record',
    parameters: { shipmentId: { type: 'string', description: 'Shipment ID' } },
    examples: ['stateset-shipment:///SHIP-123'],
  },
  {
    uriTemplate: 'stateset-product:///{productId}',
    name: 'StateSet Product',
    description: 'Product record',
    parameters: { productId: { type: 'string', description: 'Product ID' } },
    examples: ['stateset-product:///PROD-123'],
  },
  {
    uriTemplate: 'stateset-inventory:///{inventoryId}',
    name: 'StateSet Inventory',
    description: 'Inventory record',
    parameters: { inventoryId: { type: 'string', description: 'Inventory ID' } },
    examples: ['stateset-inventory:///INV-123'],
  },
  {
    uriTemplate: 'stateset-customer:///{customerId}',
    name: 'StateSet Customer',
    description: 'Customer record',
    parameters: { customerId: { type: 'string', description: 'Customer ID' } },
    examples: ['stateset-customer:///CUST-123'],
  },
  {
    uriTemplate: 'stateset-sales-order:///{salesOrderId}',
    name: 'StateSet Sales Order',
    description: 'Sales Order record',
    parameters: { salesOrderId: { type: 'string', description: 'Sales Order ID' } },
    examples: ['stateset-sales-order:///SO-123'],
  },
  {
    uriTemplate: 'stateset-purchase-order:///{purchaseOrderId}',
    name: 'StateSet Purchase Order',
    description: 'Purchase Order record',
    parameters: { purchaseOrderId: { type: 'string', description: 'Purchase Order ID' } },
    examples: ['stateset-purchase-order:///PO-123'],
  },
  {
    uriTemplate: 'stateset-invoice:///{invoiceId}',
    name: 'StateSet Invoice',
    description: 'Invoice record',
    parameters: { invoiceId: { type: 'string', description: 'Invoice ID' } },
    examples: ['stateset-invoice:///INV-123'],
  },
  {
    uriTemplate: 'stateset-payment:///{paymentId}',
    name: 'StateSet Payment',
    description: 'Payment record',
    parameters: { paymentId: { type: 'string', description: 'Payment ID' } },
    examples: ['stateset-payment:///PAY-123'],
  },
];

// Server Prompt
export const serverPrompt: Prompt = {
  name: 'stateset-server-prompt',
  description: 'StateSet MCP server instructions',
  instructions: `StateSet MCP Server - Enterprise eCommerce Operations Platform

This server provides comprehensive tools for managing eCommerce operations through the StateSet API.

=== CORE CAPABILITIES ===

📦 Orders & Returns
  - stateset_create_order: Create new customer orders with items and shipping
  - stateset_update_order: Modify order status, addresses, and details
  - stateset_delete_order: Remove orders from the system
  - stateset_get_order: Retrieve order details by ID
  - stateset_list_orders: List all orders with pagination
  - stateset_create_rma: Create return merchandise authorization
  - stateset_approve_return: Approve pending return requests
  - stateset_restock_return: Restock inventory from approved returns

🚚 Fulfillment & Shipping
  - stateset_create_shipment: Create shipment records
  - stateset_mark_shipment_shipped: Update shipment to shipped status
  - stateset_mark_shipment_delivered: Mark shipment as delivered
  - stateset_list_shipments: List all shipments

📋 Manufacturing & Supply Chain
  - stateset_create_work_order: Create manufacturing work orders
  - stateset_create_bill_of_materials: Define component requirements
  - stateset_create_purchase_order: Create vendor purchase orders
  - stateset_create_asn: Create advance shipping notices
  - stateset_create_manufacturer_order: Orders to manufacturers

📦 Inventory & Products
  - stateset_create_product: Add new products to catalog
  - stateset_update_product: Modify product details and pricing
  - stateset_create_inventory: Set up inventory tracking
  - stateset_update_inventory: Adjust inventory levels
  - stateset_list_products: List all products
  - stateset_list_inventories: View inventory across locations

💰 Financial
  - stateset_create_invoice: Generate customer invoices
  - stateset_create_payment: Record payment transactions
  - stateset_create_cash_sale: Direct cash sales
  - stateset_list_invoices: List all invoices
  - stateset_list_payments: View payment history

👤 Customers
  - stateset_create_customer: Add new customer records
  - stateset_update_customer: Update customer information
  - stateset_list_customers: List all customers

🔍 Advanced Search
  - stateset_advanced_search: Search with filters, sorting, pagination
  - stateset_search_orders_by_date: Find orders in date ranges
  - stateset_search_products_with_inventory: Search products by stock
  - stateset_search_customer_analytics: Analyze customer segments
  - stateset_full_text_search: Search across all resources

⚡ Batch Operations
  - stateset_batch_operations: Execute multiple operations atomically
  - stateset_batch_create_orders: Create many orders at once
  - stateset_batch_update_inventory: Bulk inventory adjustments
  - stateset_csv_import: Import data from CSV files

📊 Monitoring & Health
  - stateset_health_check: Check server and API health status
  - stateset_get_api_metrics: View rate limiter and request metrics

=== BEST PRACTICES ===

1. Input Validation
   - All inputs are sanitized and validated
   - Use UUIDs for IDs where required
   - Check email formats for customer fields

2. Rate Limiting
   - Server implements automatic rate limiting
   - Use batch operations for bulk updates
   - Check metrics to monitor API usage

3. Error Handling
   - Errors include detailed context
   - Retry logic is built into the client
   - Use health check to diagnose issues

4. Search & Filtering
   - Use advanced search for complex queries
   - Apply filters to reduce result sets
   - Enable aggregations for analytics

5. Batch Processing
   - Group related operations together
   - Use parallel mode for independent operations
   - Set stopOnError for critical workflows`,
};
