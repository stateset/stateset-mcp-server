import { StateSetMCPClient } from '../services/mcp-client';

export type ResourceHandler = (client: StateSetMCPClient, path: string) => Promise<any>;

export const resourceHandlers = new Map<string, ResourceHandler>();

resourceHandlers.set('stateset-rma:', (client, path) => client.getRMA(path));
resourceHandlers.set('stateset-order:', (client, path) => client.getOrder(path));
resourceHandlers.set('stateset-warranty:', (client, path) => client.getWarranty(path));
resourceHandlers.set('stateset-shipment:', (client, path) => client.getShipment(path));
resourceHandlers.set('stateset-bill-of-materials:', (client, path) =>
  client.getBillOfMaterials(path),
);
resourceHandlers.set('stateset-work-order:', (client, path) => client.getWorkOrder(path));
resourceHandlers.set('stateset-manufacturer-order:', (client, path) =>
  client.getManufacturerOrder(path),
);
resourceHandlers.set('stateset-purchase-order:', (client, path) => client.getPurchaseOrder(path));
resourceHandlers.set('stateset-asn:', (client, path) => client.getASN(path));
resourceHandlers.set('stateset-invoice:', (client, path) => client.getInvoice(path));
resourceHandlers.set('stateset-payment:', (client, path) => client.getPayment(path));
resourceHandlers.set('stateset-sales-order:', (client, path) => client.getSalesOrder(path));
resourceHandlers.set('stateset-fulfillment-order:', (client, path) =>
  client.getFulfillmentOrder(path),
);
resourceHandlers.set('stateset-item-receipt:', (client, path) => client.getItemReceipt(path));
resourceHandlers.set('stateset-cash-sale:', (client, path) => client.getCashSale(path));
resourceHandlers.set('stateset-inventory:', (client, path) => client.getInventory(path));
resourceHandlers.set('stateset-product:', (client, path) => client.getProduct(path));
resourceHandlers.set('stateset-customer:', (client, path) => client.getCustomer(path));
