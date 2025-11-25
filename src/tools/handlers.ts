import { statesetClient } from '../services/stateset-client';
import * as schemas from './schemas';

export async function handleToolCall(toolName: string, args: any): Promise<any> {
  switch (toolName) {
    // RMA operations
    case "stateset_create_rma":
      return statesetClient.createRMA(schemas.CreateRMAArgsSchema.parse(args));
    case "stateset_update_rma":
      throw new Error('Updating returns is no longer supported. Use stateset_approve_return or stateset_restock_return.');
    case "stateset_delete_rma":
      throw new Error('Deleting returns is not supported by the StateSet API.');
    case "stateset_get_rma": {
      const { rma_id } = schemas.GetRMAArgsSchema.parse(args);
      return statesetClient.getRMA(rma_id);
    }
    case "stateset_list_rmas":
      return statesetClient.listRMAs(schemas.ListArgsSchema.parse(args));
    case "stateset_approve_return": {
      const { rma_id } = schemas.GetRMAArgsSchema.parse(args);
      return statesetClient.approveReturn(rma_id);
    }
    case "stateset_restock_return": {
      const { rma_id } = schemas.GetRMAArgsSchema.parse(args);
      return statesetClient.restockReturn(rma_id);
    }

    // Order operations
    case "stateset_create_order":
      return statesetClient.createOrder(schemas.CreateOrderArgsSchema.parse(args));
    case "stateset_update_order":
      return statesetClient.updateOrder(schemas.UpdateOrderArgsSchema.parse(args));
    case "stateset_delete_order": {
      const { order_id } = schemas.DeleteOrderArgsSchema.parse(args);
      return statesetClient.deleteOrder(order_id);
    }
    case "stateset_get_order": {
      const { order_id } = schemas.GetOrderArgsSchema.parse(args);
      return statesetClient.getOrder(order_id);
    }
    case "stateset_list_orders":
      return statesetClient.listOrders(schemas.ListArgsSchema.parse(args));

    // Product operations
    case "stateset_create_product":
      return statesetClient.createProduct(schemas.CreateProductArgsSchema.parse(args));
    case "stateset_update_product":
      return statesetClient.updateProduct(schemas.UpdateProductArgsSchema.parse(args));
    case "stateset_delete_product": {
      const { product_id } = schemas.DeleteProductArgsSchema.parse(args);
      return statesetClient.deleteProduct(product_id);
    }
    case "stateset_get_product": {
      const { product_id } = schemas.GetProductArgsSchema.parse(args);
      return statesetClient.getProduct(product_id);
    }
    case "stateset_list_products":
      return statesetClient.listProducts(schemas.ListArgsSchema.parse(args));

    // Customer operations
    case "stateset_create_customer":
      return statesetClient.createCustomer(schemas.CreateCustomerArgsSchema.parse(args));
    case "stateset_update_customer":
      return statesetClient.updateCustomer(schemas.UpdateCustomerArgsSchema.parse(args));
    case "stateset_delete_customer": {
      const { customer_id } = schemas.DeleteCustomerArgsSchema.parse(args);
      return statesetClient.deleteCustomer(customer_id);
    }
    case "stateset_get_customer": {
      const { customer_id } = schemas.GetCustomerArgsSchema.parse(args);
      return statesetClient.getCustomer(customer_id);
    }
    case "stateset_list_customers":
      return statesetClient.listCustomers(schemas.ListArgsSchema.parse(args));

    // Inventory operations
    case "stateset_create_inventory":
      return statesetClient.createInventory(schemas.CreateInventoryArgsSchema.parse(args));
    case "stateset_update_inventory":
      return statesetClient.updateInventory(schemas.UpdateInventoryArgsSchema.parse(args));
    case "stateset_delete_inventory": {
      const { inventory_id } = schemas.DeleteInventoryArgsSchema.parse(args);
      return statesetClient.deleteInventory(inventory_id);
    }
    case "stateset_get_inventory": {
      const { inventory_id } = schemas.GetInventoryArgsSchema.parse(args);
      return statesetClient.getInventory(inventory_id);
    }
    case "stateset_list_inventories":
      return statesetClient.listInventories(schemas.ListArgsSchema.parse(args));

    // Warranty operations
    case "stateset_create_warranty":
      return statesetClient.createWarranty(schemas.CreateWarrantyArgsSchema.parse(args));
    case "stateset_update_warranty":
      return statesetClient.updateWarranty(schemas.UpdateWarrantyArgsSchema.parse(args));
    case "stateset_delete_warranty": {
      const { warranty_id } = schemas.DeleteWarrantyArgsSchema.parse(args);
      return statesetClient.deleteWarranty(warranty_id);
    }
    case "stateset_get_warranty": {
      const { warranty_id } = schemas.GetWarrantyArgsSchema.parse(args);
      return statesetClient.getWarranty(warranty_id);
    }
    case "stateset_list_warranties":
      return statesetClient.listWarranties(schemas.ListArgsSchema.parse(args));

    // Shipment operations
    case "stateset_create_shipment":
      return statesetClient.createShipment(schemas.CreateShipmentArgsSchema.parse(args));
    case "stateset_update_shipment":
      throw new Error('Shipment updates are not supported. Use stateset_mark_shipment_shipped or stateset_mark_shipment_delivered.');
    case "stateset_delete_shipment":
      throw new Error('Deleting shipments is not supported by the StateSet API.');
    case "stateset_get_shipment": {
      const { shipment_id } = schemas.GetShipmentArgsSchema.parse(args);
      return statesetClient.getShipment(shipment_id);
    }
    case "stateset_list_shipments":
      return statesetClient.listShipments(schemas.ListArgsSchema.parse(args));
    case "stateset_mark_shipment_shipped": {
      const { shipment_id } = schemas.GetShipmentArgsSchema.parse(args);
      return statesetClient.markShipmentShipped(shipment_id);
    }
    case "stateset_mark_shipment_delivered": {
      const { shipment_id } = schemas.GetShipmentArgsSchema.parse(args);
      return statesetClient.markShipmentDelivered(shipment_id);
    }

    // Sales Order operations
    case "stateset_create_sales_order":
      return statesetClient.createSalesOrder(schemas.CreateSalesOrderArgsSchema.parse(args));
    case "stateset_update_sales_order":
      return statesetClient.updateSalesOrder(schemas.UpdateSalesOrderArgsSchema.parse(args));
    case "stateset_delete_sales_order": {
      const { sales_order_id } = schemas.DeleteSalesOrderArgsSchema.parse(args);
      return statesetClient.deleteSalesOrder(sales_order_id);
    }
    case "stateset_get_sales_order": {
      const { sales_order_id } = schemas.GetSalesOrderArgsSchema.parse(args);
      return statesetClient.getSalesOrder(sales_order_id);
    }
    case "stateset_list_sales_orders":
      return statesetClient.listSalesOrders(schemas.ListArgsSchema.parse(args));

    // Purchase Order operations
    case "stateset_create_purchase_order":
      return statesetClient.createPurchaseOrder(schemas.CreatePurchaseOrderArgsSchema.parse(args));
    case "stateset_update_purchase_order":
      return statesetClient.updatePurchaseOrder(schemas.UpdatePurchaseOrderArgsSchema.parse(args));
    case "stateset_delete_purchase_order": {
      const { purchase_order_id } = schemas.DeletePurchaseOrderArgsSchema.parse(args);
      return statesetClient.deletePurchaseOrder(purchase_order_id);
    }
    case "stateset_get_purchase_order": {
      const { purchase_order_id } = schemas.GetPurchaseOrderArgsSchema.parse(args);
      return statesetClient.getPurchaseOrder(purchase_order_id);
    }
    case "stateset_list_purchase_orders":
      return statesetClient.listPurchaseOrders(schemas.ListArgsSchema.parse(args));

    // Invoice operations
    case "stateset_create_invoice":
      return statesetClient.createInvoice(schemas.CreateInvoiceArgsSchema.parse(args));
    case "stateset_update_invoice":
      return statesetClient.updateInvoice(schemas.UpdateInvoiceArgsSchema.parse(args));
    case "stateset_delete_invoice": {
      const { invoice_id } = schemas.DeleteInvoiceArgsSchema.parse(args);
      return statesetClient.deleteInvoice(invoice_id);
    }
    case "stateset_get_invoice": {
      const { invoice_id } = schemas.GetInvoiceArgsSchema.parse(args);
      return statesetClient.getInvoice(invoice_id);
    }
    case "stateset_list_invoices":
      return statesetClient.listInvoices(schemas.ListArgsSchema.parse(args));

    // Payment operations
    case "stateset_create_payment":
      return statesetClient.createPayment(schemas.CreatePaymentArgsSchema.parse(args));
    case "stateset_update_payment":
      return statesetClient.updatePayment(schemas.UpdatePaymentArgsSchema.parse(args));
    case "stateset_delete_payment": {
      const { payment_id } = schemas.DeletePaymentArgsSchema.parse(args);
      return statesetClient.deletePayment(payment_id);
    }
    case "stateset_get_payment": {
      const { payment_id } = schemas.GetPaymentArgsSchema.parse(args);
      return statesetClient.getPayment(payment_id);
    }
    case "stateset_list_payments":
      return statesetClient.listPayments(schemas.ListArgsSchema.parse(args));

    // Metrics
    case "stateset_get_api_metrics":
      return statesetClient.getMetrics();

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
} 
