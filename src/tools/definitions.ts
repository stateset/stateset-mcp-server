import { Tool, ResourceTemplate, Prompt } from "@modelcontextprotocol/sdk/types.js";
import * as schemas from './schemas';

// Tool Definitions
export const tools: Tool[] = [
  // RMA Tools
  {
    name: "stateset_create_rma",
    description: "Creates a new RMA request",
    inputSchema: schemas.CreateRMAArgsSchema.shape as any,
  },
  {
    name: "stateset_update_rma",
    description: "Updates an existing RMA",
    inputSchema: schemas.UpdateRMAArgsSchema.shape as any,
  },
  {
    name: "stateset_delete_rma",
    description: "Deletes an RMA record",
    inputSchema: schemas.DeleteRMAArgsSchema.shape as any,
  },
  {
    name: "stateset_get_rma",
    description: "Retrieves an RMA record",
    inputSchema: schemas.GetRMAArgsSchema.shape as any,
  },
  {
    name: "stateset_list_rmas",
    description: "Lists RMA records",
    inputSchema: schemas.ListArgsSchema.shape as any,
  },

  // Order Tools
  {
    name: "stateset_create_order",
    description: "Creates a new customer order",
    inputSchema: schemas.CreateOrderArgsSchema.shape as any,
  },
  {
    name: "stateset_update_order",
    description: "Updates an order record",
    inputSchema: schemas.UpdateOrderArgsSchema.shape as any,
  },
  {
    name: "stateset_delete_order",
    description: "Deletes an order record",
    inputSchema: schemas.DeleteOrderArgsSchema.shape as any,
  },
  {
    name: "stateset_get_order",
    description: "Retrieves an order record",
    inputSchema: schemas.GetOrderArgsSchema.shape as any,
  },
  {
    name: "stateset_list_orders",
    description: "Lists order records",
    inputSchema: schemas.ListArgsSchema.shape as any,
  },

  // Product Tools
  {
    name: "stateset_create_product",
    description: "Creates a product record",
    inputSchema: schemas.CreateProductArgsSchema.shape as any,
  },
  {
    name: "stateset_update_product",
    description: "Updates a product record",
    inputSchema: schemas.UpdateProductArgsSchema.shape as any,
  },
  {
    name: "stateset_delete_product",
    description: "Deletes a product record",
    inputSchema: schemas.DeleteProductArgsSchema.shape as any,
  },
  {
    name: "stateset_get_product",
    description: "Retrieves a product record",
    inputSchema: schemas.GetProductArgsSchema.shape as any,
  },
  {
    name: "stateset_list_products",
    description: "Lists product records",
    inputSchema: schemas.ListArgsSchema.shape as any,
  },

  // Customer Tools
  {
    name: "stateset_create_customer",
    description: "Creates a customer record",
    inputSchema: schemas.CreateCustomerArgsSchema.shape as any,
  },
  {
    name: "stateset_update_customer",
    description: "Updates a customer record",
    inputSchema: schemas.UpdateCustomerArgsSchema.shape as any,
  },
  {
    name: "stateset_delete_customer",
    description: "Deletes a customer record",
    inputSchema: schemas.DeleteCustomerArgsSchema.shape as any,
  },
  {
    name: "stateset_get_customer",
    description: "Retrieves a customer record",
    inputSchema: schemas.GetCustomerArgsSchema.shape as any,
  },
  {
    name: "stateset_list_customers",
    description: "Lists customer records",
    inputSchema: schemas.ListArgsSchema.shape as any,
  },

  // Inventory Tools
  {
    name: "stateset_create_inventory",
    description: "Creates an inventory record",
    inputSchema: schemas.CreateInventoryArgsSchema.shape as any,
  },
  {
    name: "stateset_update_inventory",
    description: "Updates an inventory record",
    inputSchema: schemas.UpdateInventoryArgsSchema.shape as any,
  },
  {
    name: "stateset_delete_inventory",
    description: "Deletes an inventory record",
    inputSchema: schemas.DeleteInventoryArgsSchema.shape as any,
  },
  {
    name: "stateset_get_inventory",
    description: "Retrieves an inventory record",
    inputSchema: schemas.GetInventoryArgsSchema.shape as any,
  },
  {
    name: "stateset_list_inventories",
    description: "Lists inventory records",
    inputSchema: schemas.ListArgsSchema.shape as any,
  },

  // Warranty Tools
  {
    name: "stateset_create_warranty",
    description: "Creates a warranty record",
    inputSchema: schemas.CreateWarrantyArgsSchema.shape as any,
  },
  {
    name: "stateset_update_warranty",
    description: "Updates a warranty record",
    inputSchema: schemas.UpdateWarrantyArgsSchema.shape as any,
  },
  {
    name: "stateset_delete_warranty",
    description: "Deletes a warranty record",
    inputSchema: schemas.DeleteWarrantyArgsSchema.shape as any,
  },
  {
    name: "stateset_get_warranty",
    description: "Retrieves a warranty record",
    inputSchema: schemas.GetWarrantyArgsSchema.shape as any,
  },
  {
    name: "stateset_list_warranties",
    description: "Lists warranty records",
    inputSchema: schemas.ListArgsSchema.shape as any,
  },

  // Shipment Tools
  {
    name: "stateset_create_shipment",
    description: "Creates a shipment record",
    inputSchema: schemas.CreateShipmentArgsSchema.shape as any,
  },
  {
    name: "stateset_update_shipment",
    description: "Updates a shipment record",
    inputSchema: schemas.UpdateShipmentArgsSchema.shape as any,
  },
  {
    name: "stateset_delete_shipment",
    description: "Deletes a shipment record",
    inputSchema: schemas.DeleteShipmentArgsSchema.shape as any,
  },
  {
    name: "stateset_get_shipment",
    description: "Retrieves a shipment record",
    inputSchema: schemas.GetShipmentArgsSchema.shape as any,
  },
  {
    name: "stateset_list_shipments",
    description: "Lists shipment records",
    inputSchema: schemas.ListArgsSchema.shape as any,
  },

  // Sales Order Tools
  {
    name: "stateset_create_sales_order",
    description: "Creates a sales order record",
    inputSchema: schemas.CreateSalesOrderArgsSchema.shape as any,
  },
  {
    name: "stateset_update_sales_order",
    description: "Updates a sales order record",
    inputSchema: schemas.UpdateSalesOrderArgsSchema.shape as any,
  },
  {
    name: "stateset_delete_sales_order",
    description: "Deletes a sales order record",
    inputSchema: schemas.DeleteSalesOrderArgsSchema.shape as any,
  },
  {
    name: "stateset_get_sales_order",
    description: "Retrieves a sales order record",
    inputSchema: schemas.GetSalesOrderArgsSchema.shape as any,
  },
  {
    name: "stateset_list_sales_orders",
    description: "Lists sales order records",
    inputSchema: schemas.ListArgsSchema.shape as any,
  },

  // Purchase Order Tools
  {
    name: "stateset_create_purchase_order",
    description: "Creates a purchase order record",
    inputSchema: schemas.CreatePurchaseOrderArgsSchema.shape as any,
  },
  {
    name: "stateset_update_purchase_order",
    description: "Updates a purchase order record",
    inputSchema: schemas.UpdatePurchaseOrderArgsSchema.shape as any,
  },
  {
    name: "stateset_delete_purchase_order",
    description: "Deletes a purchase order record",
    inputSchema: schemas.DeletePurchaseOrderArgsSchema.shape as any,
  },
  {
    name: "stateset_get_purchase_order",
    description: "Retrieves a purchase order record",
    inputSchema: schemas.GetPurchaseOrderArgsSchema.shape as any,
  },
  {
    name: "stateset_list_purchase_orders",
    description: "Lists purchase order records",
    inputSchema: schemas.ListArgsSchema.shape as any,
  },

  // Invoice Tools
  {
    name: "stateset_create_invoice",
    description: "Creates an invoice record",
    inputSchema: schemas.CreateInvoiceArgsSchema.shape as any,
  },
  {
    name: "stateset_update_invoice",
    description: "Updates an invoice record",
    inputSchema: schemas.UpdateInvoiceArgsSchema.shape as any,
  },
  {
    name: "stateset_delete_invoice",
    description: "Deletes an invoice record",
    inputSchema: schemas.DeleteInvoiceArgsSchema.shape as any,
  },
  {
    name: "stateset_get_invoice",
    description: "Retrieves an invoice record",
    inputSchema: schemas.GetInvoiceArgsSchema.shape as any,
  },
  {
    name: "stateset_list_invoices",
    description: "Lists invoice records",
    inputSchema: schemas.ListArgsSchema.shape as any,
  },

  // Payment Tools
  {
    name: "stateset_create_payment",
    description: "Creates a payment record",
    inputSchema: schemas.CreatePaymentArgsSchema.shape as any,
  },
  {
    name: "stateset_update_payment",
    description: "Updates a payment record",
    inputSchema: schemas.UpdatePaymentArgsSchema.shape as any,
  },
  {
    name: "stateset_delete_payment",
    description: "Deletes a payment record",
    inputSchema: schemas.DeletePaymentArgsSchema.shape as any,
  },
  {
    name: "stateset_get_payment",
    description: "Retrieves a payment record",
    inputSchema: schemas.GetPaymentArgsSchema.shape as any,
  },
  {
    name: "stateset_list_payments",
    description: "Lists payment records",
    inputSchema: schemas.ListArgsSchema.shape as any,
  },

  // Metrics Tool
  {
    name: "stateset_get_api_metrics",
    description: "Returns API rate limiter metrics",
    inputSchema: schemas.GetApiMetricsArgsSchema.shape as any,
  },
];

// Resource Templates
export const resourceTemplates: ResourceTemplate[] = [
  {
    uriTemplate: "stateset-rma:///{rmaId}",
    name: "StateSet RMA",
    description: "RMA record",
    parameters: { rmaId: { type: "string", description: "RMA ID" } },
    examples: ["stateset-rma:///12345"],
  },
  {
    uriTemplate: "stateset-order:///{orderId}",
    name: "StateSet Order",
    description: "Order record",
    parameters: { orderId: { type: "string", description: "Order ID" } },
    examples: ["stateset-order:///ORD-123"],
  },
  {
    uriTemplate: "stateset-warranty:///{warrantyId}",
    name: "StateSet Warranty",
    description: "Warranty record",
    parameters: { warrantyId: { type: "string", description: "Warranty ID" } },
    examples: ["stateset-warranty:///WAR-123"],
  },
  {
    uriTemplate: "stateset-shipment:///{shipmentId}",
    name: "StateSet Shipment",
    description: "Shipment record",
    parameters: { shipmentId: { type: "string", description: "Shipment ID" } },
    examples: ["stateset-shipment:///SHIP-123"],
  },
  {
    uriTemplate: "stateset-product:///{productId}",
    name: "StateSet Product",
    description: "Product record",
    parameters: { productId: { type: "string", description: "Product ID" } },
    examples: ["stateset-product:///PROD-123"],
  },
  {
    uriTemplate: "stateset-inventory:///{inventoryId}",
    name: "StateSet Inventory",
    description: "Inventory record",
    parameters: { inventoryId: { type: "string", description: "Inventory ID" } },
    examples: ["stateset-inventory:///INV-123"],
  },
  {
    uriTemplate: "stateset-customer:///{customerId}",
    name: "StateSet Customer",
    description: "Customer record",
    parameters: { customerId: { type: "string", description: "Customer ID" } },
    examples: ["stateset-customer:///CUST-123"],
  },
  {
    uriTemplate: "stateset-sales-order:///{salesOrderId}",
    name: "StateSet Sales Order",
    description: "Sales Order record",
    parameters: { salesOrderId: { type: "string", description: "Sales Order ID" } },
    examples: ["stateset-sales-order:///SO-123"],
  },
  {
    uriTemplate: "stateset-purchase-order:///{purchaseOrderId}",
    name: "StateSet Purchase Order",
    description: "Purchase Order record",
    parameters: { purchaseOrderId: { type: "string", description: "Purchase Order ID" } },
    examples: ["stateset-purchase-order:///PO-123"],
  },
  {
    uriTemplate: "stateset-invoice:///{invoiceId}",
    name: "StateSet Invoice",
    description: "Invoice record",
    parameters: { invoiceId: { type: "string", description: "Invoice ID" } },
    examples: ["stateset-invoice:///INV-123"],
  },
  {
    uriTemplate: "stateset-payment:///{paymentId}",
    name: "StateSet Payment",
    description: "Payment record",
    parameters: { paymentId: { type: "string", description: "Payment ID" } },
    examples: ["stateset-payment:///PAY-123"],
  },
];

// Server Prompt
export const serverPrompt: Prompt = {
  name: "stateset-server-prompt",
  description: "StateSet MCP server instructions",
  instructions: `Manages eCommerce operations for StateSet.

Capabilities are grouped by domain:

Orders & Returns
- stateset_create_order / stateset_update_order / stateset_delete_order / stateset_get_order
- stateset_create_sales_order / stateset_update_sales_order / stateset_delete_sales_order / stateset_get_sales_order
- stateset_create_rma / stateset_update_rma / stateset_delete_rma / stateset_get_rma

Fulfillment & Shipping
- stateset_create_shipment / stateset_update_shipment / stateset_delete_shipment / stateset_get_shipment

Inventory & Products
- stateset_create_product / stateset_update_product / stateset_delete_product / stateset_get_product
- stateset_create_inventory / stateset_update_inventory / stateset_delete_inventory / stateset_get_inventory

Financial
- stateset_create_invoice / stateset_update_invoice / stateset_delete_invoice / stateset_get_invoice
- stateset_create_payment / stateset_update_payment / stateset_delete_payment / stateset_get_payment

Customers
- stateset_create_customer / stateset_update_customer / stateset_delete_customer / stateset_get_customer

Listing
- stateset_list_rmas / stateset_list_orders / stateset_list_sales_orders / stateset_list_warranties
- stateset_list_shipments / stateset_list_products / stateset_list_inventories / stateset_list_customers
- stateset_list_invoices / stateset_list_payments / stateset_list_purchase_orders

Best practices:
- Validate all IDs before use
- Include detailed notes
- Update statuses promptly
- Use appropriate priority levels for operations
- Monitor rate limits and circuit breaker status`
}; 