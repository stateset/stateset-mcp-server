import type { ResourceTemplate } from '@modelcontextprotocol/sdk/types.js';

/**
 * Resource types supported by the server
 */
export enum ResourceType {
  RMA = 'rma',
  ORDER = 'order',
  WARRANTY = 'warranty',
  SHIPMENT = 'shipment',
  BILL_OF_MATERIALS = 'bill-of-materials',
  WORK_ORDER = 'work-order',
  MANUFACTURER_ORDER = 'manufacturer-order',
  PURCHASE_ORDER = 'purchase-order',
  ASN = 'asn',
  INVOICE = 'invoice',
  PAYMENT = 'payment',
  SALES_ORDER = 'sales-order',
  FULFILLMENT_ORDER = 'fulfillment-order',
  ITEM_RECEIPT = 'item-receipt',
  CASH_SALE = 'cash-sale',
  PRODUCT = 'product',
  INVENTORY = 'inventory',
  CUSTOMER = 'customer',
}

/**
 * Extended resource template with additional metadata
 */
export interface ExtendedResourceTemplate extends ResourceTemplate {
  resourceType: ResourceType;
  cacheable?: boolean;
  ttl?: number; // Time to live in seconds
}

/**
 * Resource fetch options
 */
export interface ResourceFetchOptions {
  includeRelated?: boolean;
  fields?: string[];
  expand?: string[];
}

/**
 * Resource cache entry
 */
export interface ResourceCacheEntry {
  uri: string;
  data: unknown;
  timestamp: Date;
  ttl: number;
}
