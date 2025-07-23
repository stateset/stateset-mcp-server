import type { Address, BaseItem, PricedItem, TrackedItem } from './common';

// Base response interface
export interface StateSetResponse {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  url: string;
  [key: string]: any;
}

// List operation arguments
export interface ListArgs {
  page?: number;
  per_page?: number;
}

// RMA interfaces
export interface RMAItem extends BaseItem {
  reason?: string;
}

export interface CreateRMAArgs {
  order_id: string;
  customer_email: string;
  items: RMAItem[];
  reason: string;
  notes?: string;
}

export interface UpdateRMAArgs {
  rma_id: string;
  status?: string;
  resolution?: string;
  notes?: string;
}

export interface DeleteRMAArgs {
  rma_id: string;
}

// Order interfaces
export interface OrderItem extends PricedItem {}

export interface CreateOrderArgs {
  customer_email: string;
  items: OrderItem[];
  shipping_address: Address;
  billing_address?: Address;
}

export interface UpdateOrderArgs {
  order_id: string;
  status?: string;
  items?: OrderItem[];
  shipping_address?: Address;
  billing_address?: Address;
}

export interface DeleteOrderArgs {
  order_id: string;
}

// Customer interfaces
export interface CreateCustomerArgs {
  email: string;
  name: string;
  address: Address;
  phone?: string;
  metadata?: Record<string, any>;
}

export interface UpdateCustomerArgs {
  customer_id: string;
  email?: string;
  name?: string;
  address?: Address;
  phone?: string;
  metadata?: Record<string, any>;
}

export interface DeleteCustomerArgs {
  customer_id: string;
}

// Product interfaces
export interface CreateProductArgs {
  name: string;
  sku: string;
  description?: string;
  price: number;
  category?: string;
  metadata?: Record<string, any>;
}

export interface UpdateProductArgs {
  product_id: string;
  name?: string;
  sku?: string;
  description?: string;
  price?: number;
  category?: string;
  metadata?: Record<string, any>;
}

export interface DeleteProductArgs {
  product_id: string;
}

// Inventory interfaces
export interface CreateInventoryArgs {
  product_id: string;
  quantity: number;
  location: string;
  warehouse?: string;
}

export interface UpdateInventoryArgs {
  inventory_id: string;
  quantity?: number;
  location?: string;
  warehouse?: string;
}

export interface DeleteInventoryArgs {
  inventory_id: string;
}

// Warranty interfaces
export interface WarrantyItem extends BaseItem {
  serial_number?: string;
  warranty_period_months: number;
}

export interface CreateWarrantyArgs {
  order_id: string;
  customer_email: string;
  items: WarrantyItem[];
  notes?: string;
}

export interface UpdateWarrantyArgs {
  warranty_id: string;
  status?: string;
  notes?: string;
}

export interface DeleteWarrantyArgs {
  warranty_id: string;
}

// Shipment interfaces
export interface ShipmentItem extends TrackedItem {}

export interface CreateShipmentArgs {
  order_id: string;
  customer_email: string;
  items: ShipmentItem[];
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

export interface DeleteShipmentArgs {
  shipment_id: string;
}

// API Metrics
export interface ApiMetrics {
  totalRequests: number;
  requestsInLastHour: number;
  averageRequestTime: number;
  queueLength: number;
  lastRequestTime: string;
}

// Error types
export class StateSetApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any,
    public requestId?: string
  ) {
    super(message);
    this.name = 'StateSetApiError';
  }
} 