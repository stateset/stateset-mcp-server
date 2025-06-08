import type { Address, BaseItem, PricedItem, TrackedItem, WarrantyItem } from './common';

/**
 * Base StateSet API response
 */
export interface StateSetResponse {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  url: string;
  [key: string]: unknown;
}

// Customer types
export interface Customer extends StateSetResponse {
  email: string;
  name: string;
  address: Address;
  phone?: string;
  company?: string;
}

export interface CreateCustomerArgs {
  email: string;
  name: string;
  address: Address;
  phone?: string;
  company?: string;
}

export interface UpdateCustomerArgs {
  customer_id: string;
  email?: string;
  name?: string;
  address?: Address;
  phone?: string;
  company?: string;
}

// Order types
export interface Order extends StateSetResponse {
  customer_email: string;
  items: PricedItem[];
  shipping_address: Address;
  billing_address?: Address;
  total_amount: number;
  tax_amount?: number;
  shipping_amount?: number;
}

export interface CreateOrderArgs {
  customer_email: string;
  items: PricedItem[];
  shipping_address: Address;
  billing_address?: Address;
}

export interface UpdateOrderArgs {
  order_id: string;
  status?: string;
  items?: PricedItem[];
  shipping_address?: Address;
  billing_address?: Address;
}

// RMA types
export interface RMA extends StateSetResponse {
  order_id: string;
  customer_email: string;
  items: BaseItem[];
  reason: string;
  notes?: string;
  resolution?: string;
}

export interface CreateRMAArgs {
  order_id: string;
  customer_email: string;
  items: BaseItem[];
  reason: string;
  notes?: string;
}

export interface UpdateRMAArgs {
  rma_id: string;
  status?: string;
  resolution?: string;
  notes?: string;
}

// Product types
export interface Product extends StateSetResponse {
  name: string;
  sku: string;
  description?: string;
  price: number;
  cost?: number;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
}

export interface CreateProductArgs {
  name: string;
  sku: string;
  description?: string;
  price: number;
  cost?: number;
  weight?: number;
  dimensions?: Product['dimensions'];
}

export interface UpdateProductArgs {
  product_id: string;
  name?: string;
  sku?: string;
  description?: string;
  price?: number;
  cost?: number;
  weight?: number;
  dimensions?: Product['dimensions'];
}

// Inventory types
export interface Inventory extends StateSetResponse {
  product_id: string;
  quantity: number;
  location: string;
  reserved_quantity?: number;
  available_quantity?: number;
}

export interface CreateInventoryArgs {
  product_id: string;
  quantity: number;
  location: string;
}

export interface UpdateInventoryArgs {
  inventory_id: string;
  quantity?: number;
  location?: string;
  reserved_quantity?: number;
}

// Shipment types
export interface Shipment extends StateSetResponse {
  order_id: string;
  customer_email: string;
  items: TrackedItem[];
  carrier: string;
  destination_address: Address;
  tracking_number?: string;
  estimated_delivery?: string;
}

export interface CreateShipmentArgs {
  order_id: string;
  customer_email: string;
  items: TrackedItem[];
  carrier: string;
  destination_address: Address;
}

export interface UpdateShipmentArgs {
  shipment_id: string;
  carrier?: string;
  status?: string;
  tracking_number?: string;
  destination_address?: Address;
}

// Invoice types
export interface Invoice extends StateSetResponse {
  order_id: string;
  customer_email: string;
  items: BaseItem[];
  total_amount: number;
  tax_amount?: number;
  paid_amount?: number;
  due_date?: string;
  notes?: string;
}

export interface CreateInvoiceArgs {
  order_id: string;
  customer_email: string;
  items: BaseItem[];
  notes?: string;
}

export interface UpdateInvoiceArgs {
  invoice_id: string;
  items?: BaseItem[];
  notes?: string;
  status?: string;
}

// Payment types
export interface Payment extends StateSetResponse {
  order_id: string;
  customer_email: string;
  amount: number;
  payment_method: string;
  transaction_id?: string;
  notes?: string;
}

export interface CreatePaymentArgs {
  order_id: string;
  customer_email: string;
  amount: number;
  payment_method: string;
  items: BaseItem[];
  notes?: string;
}

export interface UpdatePaymentArgs {
  payment_id: string;
  amount?: number;
  payment_method?: string;
  items?: BaseItem[];
  notes?: string;
  status?: string;
}

// Generic delete and get args
export interface DeleteArgs {
  id: string;
}

export interface GetArgs {
  id: string;
} 