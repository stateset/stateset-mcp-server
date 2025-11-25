
// Basic types
export interface RateLimiterMetrics {
  totalRequests: number;
  requestsInLastHour: number;
  averageRequestTime: number;
  queueLength: number;
  lastRequestTime: string;
}

export interface RMAItem {
  item_id: string;
  quantity: number;
}

export interface OrderItem {
  item_id: string;
  quantity: number;
  price: number;
}

export interface WarrantyItem {
  item_id: string;
  serial_number?: string;
  warranty_period_months: number;
}

export interface ShipmentItem {
  item_id: string;
  quantity: number;
  tracking_number?: string;
}

export interface Address {
  line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface StateSetResponse {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  url: string;
  [key: string]: any;
}

export interface BillOfMaterialsItem {
  item_id: string;
  quantity: number;
  price: number;
}

export interface WorkOrderItem {
  item_id: string;
  quantity: number;
}

export interface ManufacturerOrderItem {
  item_id: string;
  quantity: number;
}

export interface InvoiceItem {
  item_id: string;
  quantity: number;
}   

export interface PaymentItem {
  item_id: string;
  quantity: number;
}

export interface PurchaseOrderItem {
  item_id: string;
  quantity: number;
  price: number;
}

export interface ASNItem {
  item_id: string;
  quantity: number;
  tracking_number?: string;
}

export interface SalesOrderItem {
  item_id: string;
  quantity: number;
  price: number;
}

export interface FulfillmentOrderItem {
  item_id: string;
  quantity: number;
  tracking_number?: string;
}

export interface ItemReceiptItem {
  item_id: string;
  quantity: number;
}

export interface CashSaleItem {
  item_id: string;
  quantity: number;
  price: number;
}

// Args interfaces

export interface CreateCustomerArgs {
  email: string;
  name: string;
  address: Address;
}

export interface UpdateCustomerArgs {
  customer_id: string;
  email?: string;
  name?: string;
  address?: Address;
}

export interface DeleteCustomerArgs {
  customer_id: string;
}

export interface CreateRMAArgs {
  order_id: string;
  customer_email: string;
  items: RMAItem[];
  notes?: string;
}

export interface UpdateRMAArgs {
  rma_id: string;
  status?: string;
  notes?: string;
}   

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

export interface CreateBillOfMaterialsArgs {
  order_id: string;
  customer_email: string;
  items: BillOfMaterialsItem[];
  notes?: string;
}

export interface UpdateBillOfMaterialsArgs {
  bill_of_materials_id: string;
  items: BillOfMaterialsItem[];
  notes?: string;
}

export interface CreateWorkOrderArgs {
  order_id: string;
  customer_email: string;
  items: WorkOrderItem[];
  notes?: string;
}

export interface UpdateWorkOrderArgs {
  work_order_id: string;
  items: WorkOrderItem[];       
  notes?: string;
}

export interface CreateManufacturerOrderArgs {
  order_id: string;
  customer_email: string;
  items: ManufacturerOrderItem[];
  notes?: string;
}

export interface UpdateManufacturerOrderArgs {
  manufacturer_order_id: string;
  items: ManufacturerOrderItem[];
  notes?: string;
}

export interface CreatePurchaseOrderArgs {
  vendor_email: string;
  items: PurchaseOrderItem[];
  shipping_address: Address;
  billing_address?: Address;
}

export interface UpdatePurchaseOrderArgs {
  purchase_order_id: string;
  status?: string;
  items?: PurchaseOrderItem[];
  shipping_address?: Address;
  billing_address?: Address;
}

export interface DeletePurchaseOrderArgs {
  purchase_order_id: string;
}

export interface CreateASNArgs {
  purchase_order_id: string;
  items: ASNItem[];
  carrier: string;
  destination_address: Address;
}

export interface UpdateASNArgs {
  asn_id: string;
  carrier?: string;
  status?: string;
  tracking_number?: string;
  destination_address?: Address;
}

export interface DeleteASNArgs {
  asn_id: string;
}

export interface CreateInvoiceArgs {
  order_id: string;
  customer_email: string;
  items: InvoiceItem[];
  notes?: string;
}

export interface UpdateInvoiceArgs {
  invoice_id: string;
  items: InvoiceItem[];     
  notes?: string;
}

export interface CreatePaymentArgs {
  order_id: string;
  customer_email: string;
  items: PaymentItem[];
  notes?: string;
}

export interface UpdatePaymentArgs {
  payment_id: string;
  items: PaymentItem[];
  notes?: string;
}

export interface DeleteRMAArgs {
  rma_id: string;
}

export interface DeleteOrderArgs {
  order_id: string;
}

export interface DeleteWarrantyArgs {
  warranty_id: string;
}

export interface DeleteShipmentArgs {
  shipment_id: string;
}

export interface DeleteBillOfMaterialsArgs {
  bill_of_materials_id: string;
}

export interface DeleteWorkOrderArgs {
  work_order_id: string;
}

export interface DeleteManufacturerOrderArgs {
  manufacturer_order_id: string;
}

export interface DeleteInvoiceArgs {
  invoice_id: string;
}

export interface DeletePaymentArgs {
  payment_id: string;
}

export interface CreateSalesOrderArgs {
  customer_email: string;
  items: SalesOrderItem[];
  shipping_address: Address;
  billing_address?: Address;
}

export interface UpdateSalesOrderArgs {
  sales_order_id: string;
  status?: string;
  items?: SalesOrderItem[];
  shipping_address?: Address;
  billing_address?: Address;
}

export interface DeleteSalesOrderArgs {
  sales_order_id: string;
}

export interface CreateFulfillmentOrderArgs {
  order_id: string;
  customer_email: string;
  items: FulfillmentOrderItem[];
  carrier: string;
  destination_address: Address;
}

export interface UpdateFulfillmentOrderArgs {
  fulfillment_order_id: string;
  carrier?: string;
  status?: string;
  tracking_number?: string;
  destination_address?: Address;
}

export interface DeleteFulfillmentOrderArgs {
  fulfillment_order_id: string;
}

export interface CreateItemReceiptArgs {
  order_id: string;
  items: ItemReceiptItem[];
  notes?: string;
}

export interface UpdateItemReceiptArgs {
  item_receipt_id: string;
  items: ItemReceiptItem[];
  notes?: string;
}

export interface DeleteItemReceiptArgs {
  item_receipt_id: string;
}

export interface CreateCashSaleArgs {
  customer_email: string;
  items: CashSaleItem[];
  payment_method: string;
}

export interface UpdateCashSaleArgs {
  cash_sale_id: string;
  items?: CashSaleItem[];
  payment_method?: string;
  status?: string;
}

export interface DeleteCashSaleArgs {
  cash_sale_id: string;
}

export interface CreateProductArgs {
  name: string;
  sku: string;
  description?: string;
  price: number;
}

export interface UpdateProductArgs {
  product_id: string;
  name?: string;
  sku?: string;
  description?: string;
  price?: number;
}

export interface DeleteProductArgs {
  product_id: string;
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

export interface DeleteInventoryArgs {
  inventory_id: string;
}

export interface GetRMAArgs { rma_id: string; }
export interface GetOrderArgs { order_id: string; }
export interface GetWarrantyArgs { warranty_id: string; }
export interface GetShipmentArgs { shipment_id: string; }
export interface GetBillOfMaterialsArgs { bill_of_materials_id: string; }
export interface GetWorkOrderArgs { work_order_id: string; }
export interface GetManufacturerOrderArgs { manufacturer_order_id: string; }
export interface GetPurchaseOrderArgs { purchase_order_id: string; }
export interface GetASNArgs { asn_id: string; }
export interface GetInvoiceArgs { invoice_id: string; }
export interface GetPaymentArgs { payment_id: string; }
export interface GetSalesOrderArgs { sales_order_id: string; }
export interface GetFulfillmentOrderArgs { fulfillment_order_id: string; }
export interface GetItemReceiptArgs { item_receipt_id: string; }
export interface GetCashSaleArgs { cash_sale_id: string; }
export interface GetProductArgs { product_id: string; }
export interface GetInventoryArgs { inventory_id: string; }
export interface GetCustomerArgs { customer_id: string; }

export interface ListArgs {
  page?: number;
  per_page?: number;
  limit?: number;
  offset?: number;
  [key: string]: any;
}

export interface Config {
  apiKey: string;
  baseUrl: string;
  requestsPerHour: number;
  timeoutMs: number;
}
