import { z } from 'zod';

// Common schemas
const AddressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postal_code: z.string().min(3, 'Postal code is required'),
  country: z.string().min(2, 'Country is required'),
});

// RMA schemas
export const CreateRMAArgsSchema = z.object({
  order_id: z.string().uuid('Order ID must be a valid UUID'),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional(),
});

export const UpdateRMAArgsSchema = z.object({
  rma_id: z.string().uuid('Return ID must be a valid UUID'),
  status: z.enum(['approved', 'restocked']).optional(),
  notes: z.string().optional(),
});

export const DeleteRMAArgsSchema = z.object({
  rma_id: z.string().uuid('Return ID must be a valid UUID'),
});

export const GetRMAArgsSchema = z.object({
  rma_id: z.string().uuid('Return ID must be a valid UUID'),
});

// Order schemas
export const CreateOrderArgsSchema = z.object({
  customer_id: z.string().uuid('Customer ID is required'),
  items: z
    .array(
      z.object({
        product_id: z.string().min(1, 'Product ID is required'),
        quantity: z.number().int().positive('Quantity must be positive'),
        unit_price: z.number().positive('Unit price must be positive').optional(),
        tax_rate: z.number().nonnegative().optional(),
      }),
    )
    .min(1, 'At least one item is required'),
  shipping_address: AddressSchema.optional(),
  billing_address: AddressSchema.optional(),
  payment_method_id: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateOrderArgsSchema = z.object({
  order_id: z.string().uuid('Order ID must be a valid UUID'),
  shipping_address: AddressSchema.optional(),
  billing_address: AddressSchema.optional(),
  payment_method_id: z.string().optional(),
  notes: z.string().optional(),
});

export const DeleteOrderArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
});

export const GetOrderArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
});

// Product schemas
export const CreateProductArgsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
});

export const UpdateProductArgsSchema = z.object({
  product_id: z.string().min(1, 'Product ID is required'),
  name: z.string().min(1, 'Name is required').optional(),
  sku: z.string().min(1, 'SKU is required').optional(),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive').optional(),
});

export const DeleteProductArgsSchema = z.object({
  product_id: z.string().min(1, 'Product ID is required'),
});

export const GetProductArgsSchema = z.object({
  product_id: z.string().min(1, 'Product ID is required'),
});

// Customer schemas
export const CreateCustomerArgsSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required'),
  address: AddressSchema,
});

export const UpdateCustomerArgsSchema = z.object({
  customer_id: z.string().min(1, 'Customer ID is required'),
  email: z.string().email('Invalid email format').optional(),
  name: z.string().min(1, 'Name is required').optional(),
  address: AddressSchema.optional(),
});

export const DeleteCustomerArgsSchema = z.object({
  customer_id: z.string().min(1, 'Customer ID is required'),
});

export const GetCustomerArgsSchema = z.object({
  customer_id: z.string().min(1, 'Customer ID is required'),
});

// Inventory schemas
export const CreateInventoryArgsSchema = z.object({
  item_number: z.string().min(1, 'Item number is required'),
  description: z.string().optional(),
  primary_uom_code: z.string().optional(),
  organization_id: z.number().int().positive().optional(),
  location_id: z.number().int().positive('Location ID is required'),
  quantity_on_hand: z.number().int(),
  reason: z.string().optional(),
});

export const UpdateInventoryArgsSchema = z.object({
  inventory_id: z.string().uuid('Inventory ID must be a valid UUID'),
  location_id: z.number().int().positive(),
  on_hand: z.number().int().optional(),
  description: z.string().optional(),
  primary_uom_code: z.string().optional(),
  organization_id: z.number().int().positive().optional(),
  reason: z.string().optional(),
});

export const DeleteInventoryArgsSchema = z.object({
  inventory_id: z.string().uuid('Inventory ID must be a valid UUID'),
});

export const GetInventoryArgsSchema = z.object({
  inventory_id: z.string().uuid('Inventory ID must be a valid UUID'),
});

// Warranty schemas
export const CreateWarrantyArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
  customer_email: z.string().email('Invalid email format'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        serial_number: z.string().optional(),
        warranty_period_months: z.number().positive('Warranty period must be positive'),
      }),
    )
    .min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

export const UpdateWarrantyArgsSchema = z.object({
  warranty_id: z.string().min(1, 'Warranty ID is required'),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export const DeleteWarrantyArgsSchema = z.object({
  warranty_id: z.string().min(1, 'Warranty ID is required'),
});

export const GetWarrantyArgsSchema = z.object({
  warranty_id: z.string().min(1, 'Warranty ID is required'),
});

// Shipment schemas
export const CreateShipmentArgsSchema = z.object({
  order_id: z.string().uuid('Order ID must be a valid UUID'),
  shipping_address: z.string().min(1, 'Shipping address is required'),
  shipping_method: z.string().min(1, 'Shipping method is required'),
  tracking_number: z.string().min(1, 'Tracking number is required'),
  recipient_name: z.string().min(1, 'Recipient name is required'),
});

export const UpdateShipmentArgsSchema = z.object({
  shipment_id: z.string().uuid('Shipment ID must be a valid UUID'),
  shipping_method: z.string().optional(),
  tracking_number: z.string().optional(),
  recipient_name: z.string().optional(),
  shipping_address: z.string().optional(),
});

export const DeleteShipmentArgsSchema = z.object({
  shipment_id: z.string().uuid('Shipment ID must be a valid UUID'),
});

export const GetShipmentArgsSchema = z.object({
  shipment_id: z.string().uuid('Shipment ID must be a valid UUID'),
});

// Sales Order schemas
export const CreateSalesOrderArgsSchema = z.object({
  customer_email: z.string().email('Invalid email format'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
        price: z.number().positive('Price must be positive'),
      }),
    )
    .min(1, 'At least one item is required'),
  shipping_address: AddressSchema,
  billing_address: AddressSchema.optional(),
});

export const UpdateSalesOrderArgsSchema = z.object({
  sales_order_id: z.string().min(1, 'Sales Order ID is required'),
  status: z.string().optional(),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
        price: z.number().positive('Price must be positive'),
      }),
    )
    .optional(),
  shipping_address: AddressSchema.optional(),
  billing_address: AddressSchema.optional(),
});

export const DeleteSalesOrderArgsSchema = z.object({
  sales_order_id: z.string().min(1, 'Sales Order ID is required'),
});

export const GetSalesOrderArgsSchema = z.object({
  sales_order_id: z.string().min(1, 'Sales Order ID is required'),
});

// Purchase Order schemas
export const CreatePurchaseOrderArgsSchema = z.object({
  vendor_email: z.string().email('Invalid email format'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
        price: z.number().positive('Price must be positive'),
      }),
    )
    .min(1, 'At least one item is required'),
  shipping_address: AddressSchema,
  billing_address: AddressSchema.optional(),
});

export const UpdatePurchaseOrderArgsSchema = z.object({
  purchase_order_id: z.string().min(1, 'Purchase Order ID is required'),
  status: z.string().optional(),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
        price: z.number().positive('Price must be positive'),
      }),
    )
    .optional(),
  shipping_address: AddressSchema.optional(),
  billing_address: AddressSchema.optional(),
});

export const DeletePurchaseOrderArgsSchema = z.object({
  purchase_order_id: z.string().min(1, 'Purchase Order ID is required'),
});

export const GetPurchaseOrderArgsSchema = z.object({
  purchase_order_id: z.string().min(1, 'Purchase Order ID is required'),
});

// Invoice schemas
export const CreateInvoiceArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
  customer_email: z.string().email('Invalid email format'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
      }),
    )
    .min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

export const UpdateInvoiceArgsSchema = z.object({
  invoice_id: z.string().min(1, 'Invoice ID is required'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
      }),
    )
    .min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

export const DeleteInvoiceArgsSchema = z.object({
  invoice_id: z.string().min(1, 'Invoice ID is required'),
});

export const GetInvoiceArgsSchema = z.object({
  invoice_id: z.string().min(1, 'Invoice ID is required'),
});

// Payment schemas
export const CreatePaymentArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
  customer_email: z.string().email('Invalid email format'),
  amount: z.number().positive('Amount must be positive'),
  payment_method: z.string().min(1, 'Payment method is required'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
      }),
    )
    .min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

export const UpdatePaymentArgsSchema = z.object({
  payment_id: z.string().min(1, 'Payment ID is required'),
  amount: z.number().positive('Amount must be positive'),
  payment_method: z.string().min(1, 'Payment method is required'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
      }),
    )
    .min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

export const DeletePaymentArgsSchema = z.object({
  payment_id: z.string().min(1, 'Payment ID is required'),
});

export const GetPaymentArgsSchema = z.object({
  payment_id: z.string().min(1, 'Payment ID is required'),
});

// ASN (Advanced Shipment Notice) schemas
export const CreateASNArgsSchema = z.object({
  purchase_order_id: z.string().min(1, 'Purchase Order ID is required'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
        tracking_number: z.string().optional(),
      }),
    )
    .min(1, 'At least one item is required'),
  carrier: z.string().min(1, 'Carrier is required'),
  destination_address: AddressSchema,
});

export const UpdateASNArgsSchema = z.object({
  asn_id: z.string().min(1, 'ASN ID is required'),
  carrier: z.string().optional(),
  status: z.string().optional(),
  tracking_number: z.string().optional(),
  destination_address: AddressSchema.optional(),
});

export const DeleteASNArgsSchema = z.object({
  asn_id: z.string().min(1, 'ASN ID is required'),
});

export const GetASNArgsSchema = z.object({
  asn_id: z.string().min(1, 'ASN ID is required'),
});

// Bill of Materials schemas
export const CreateBillOfMaterialsArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
  customer_email: z.string().email('Invalid email format'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
        price: z.number().positive('Price must be positive'),
      }),
    )
    .min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

export const UpdateBillOfMaterialsArgsSchema = z.object({
  bill_of_materials_id: z.string().min(1, 'Bill of Materials ID is required'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
        price: z.number().positive('Price must be positive'),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

export const DeleteBillOfMaterialsArgsSchema = z.object({
  bill_of_materials_id: z.string().min(1, 'Bill of Materials ID is required'),
});

export const GetBillOfMaterialsArgsSchema = z.object({
  bill_of_materials_id: z.string().min(1, 'Bill of Materials ID is required'),
});

// Work Order schemas
export const CreateWorkOrderArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
  customer_email: z.string().email('Invalid email format'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
      }),
    )
    .min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

export const UpdateWorkOrderArgsSchema = z.object({
  work_order_id: z.string().min(1, 'Work Order ID is required'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

export const DeleteWorkOrderArgsSchema = z.object({
  work_order_id: z.string().min(1, 'Work Order ID is required'),
});

export const GetWorkOrderArgsSchema = z.object({
  work_order_id: z.string().min(1, 'Work Order ID is required'),
});

// Manufacturer Order schemas
export const CreateManufacturerOrderArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
  customer_email: z.string().email('Invalid email format'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
      }),
    )
    .min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

export const UpdateManufacturerOrderArgsSchema = z.object({
  manufacturer_order_id: z.string().min(1, 'Manufacturer Order ID is required'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

export const DeleteManufacturerOrderArgsSchema = z.object({
  manufacturer_order_id: z.string().min(1, 'Manufacturer Order ID is required'),
});

export const GetManufacturerOrderArgsSchema = z.object({
  manufacturer_order_id: z.string().min(1, 'Manufacturer Order ID is required'),
});

// Fulfillment Order schemas
export const CreateFulfillmentOrderArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
  customer_email: z.string().email('Invalid email format'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
        tracking_number: z.string().optional(),
      }),
    )
    .min(1, 'At least one item is required'),
  carrier: z.string().min(1, 'Carrier is required'),
  destination_address: AddressSchema,
});

export const UpdateFulfillmentOrderArgsSchema = z.object({
  fulfillment_order_id: z.string().min(1, 'Fulfillment Order ID is required'),
  carrier: z.string().optional(),
  status: z.string().optional(),
  tracking_number: z.string().optional(),
  destination_address: AddressSchema.optional(),
});

export const DeleteFulfillmentOrderArgsSchema = z.object({
  fulfillment_order_id: z.string().min(1, 'Fulfillment Order ID is required'),
});

export const GetFulfillmentOrderArgsSchema = z.object({
  fulfillment_order_id: z.string().min(1, 'Fulfillment Order ID is required'),
});

// Item Receipt schemas
export const CreateItemReceiptArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
      }),
    )
    .min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

export const UpdateItemReceiptArgsSchema = z.object({
  item_receipt_id: z.string().min(1, 'Item Receipt ID is required'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

export const DeleteItemReceiptArgsSchema = z.object({
  item_receipt_id: z.string().min(1, 'Item Receipt ID is required'),
});

export const GetItemReceiptArgsSchema = z.object({
  item_receipt_id: z.string().min(1, 'Item Receipt ID is required'),
});

// Cash Sale schemas
export const CreateCashSaleArgsSchema = z.object({
  customer_email: z.string().email('Invalid email format'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
        price: z.number().positive('Price must be positive'),
      }),
    )
    .min(1, 'At least one item is required'),
  payment_method: z.string().min(1, 'Payment method is required'),
});

export const UpdateCashSaleArgsSchema = z.object({
  cash_sale_id: z.string().min(1, 'Cash Sale ID is required'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
        price: z.number().positive('Price must be positive'),
      }),
    )
    .optional(),
  payment_method: z.string().optional(),
  status: z.string().optional(),
});

export const DeleteCashSaleArgsSchema = z.object({
  cash_sale_id: z.string().min(1, 'Cash Sale ID is required'),
});

export const GetCashSaleArgsSchema = z.object({
  cash_sale_id: z.string().min(1, 'Cash Sale ID is required'),
});

// Common schemas
export const ListArgsSchema = z.object({
  page: z.number().positive().optional(),
  per_page: z.number().positive().optional(),
});

export const GetApiMetricsArgsSchema = z.object({});

// ================================
// ORDER WORKFLOW SCHEMAS
// ================================
export const CancelOrderArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
  reason: z.string().optional(),
});

export const ArchiveOrderArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
});

export const UpdateOrderStatusArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']),
});

export const GetOrderItemsArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
});

export const AddOrderItemArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
  product_id: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unit_price: z.number().positive('Unit price must be positive').optional(),
});

// ================================
// INVENTORY WORKFLOW SCHEMAS
// ================================
export const ReserveInventoryArgsSchema = z.object({
  inventory_id: z.string().uuid('Inventory ID must be a valid UUID'),
  location_id: z.number().int().positive('Location ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  reference_id: z.string().min(1, 'Reference ID is required'),
  reference_type: z.enum(['order', 'transfer', 'work_order']),
});

export const ReleaseInventoryArgsSchema = z.object({
  inventory_id: z.string().uuid('Inventory ID must be a valid UUID'),
  location_id: z.number().int().positive('Location ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
});

export const GetLowStockArgsSchema = z.object({
  threshold: z.number().int().nonnegative().optional(),
  location_id: z.number().int().positive().optional(),
});

// ================================
// SHIPMENT WORKFLOW SCHEMAS
// ================================
export const TrackShipmentArgsSchema = z.object({
  shipment_id: z.string().uuid('Shipment ID must be a valid UUID').optional(),
  tracking_number: z.string().min(1, 'Tracking number is required').optional(),
});

// ================================
// WARRANTY WORKFLOW SCHEMAS
// ================================
export const ExtendWarrantyArgsSchema = z.object({
  warranty_id: z.string().min(1, 'Warranty ID is required'),
  extension_months: z.number().int().positive('Extension months must be positive'),
});

export const CreateWarrantyClaimArgsSchema = z.object({
  warranty_id: z.string().min(1, 'Warranty ID is required'),
  claim_reason: z.string().min(1, 'Claim reason is required'),
  claim_amount: z.number().positive('Claim amount must be positive').optional(),
});

export const ApproveWarrantyClaimArgsSchema = z.object({
  claim_id: z.string().min(1, 'Claim ID is required'),
  approved_amount: z.number().positive('Approved amount must be positive').optional(),
  notes: z.string().optional(),
});

// ================================
// WORK ORDER WORKFLOW SCHEMAS
// ================================
export const AssignWorkOrderArgsSchema = z.object({
  work_order_id: z.string().min(1, 'Work Order ID is required'),
  assigned_to: z.string().min(1, 'Assignee is required'),
});

export const CompleteWorkOrderArgsSchema = z.object({
  work_order_id: z.string().min(1, 'Work Order ID is required'),
  notes: z.string().optional(),
});

export const StartWorkOrderArgsSchema = z.object({
  work_order_id: z.string().min(1, 'Work Order ID is required'),
});

export const HoldWorkOrderArgsSchema = z.object({
  work_order_id: z.string().min(1, 'Work Order ID is required'),
  reason: z.string().min(1, 'Hold reason is required'),
});

export const CancelWorkOrderArgsSchema = z.object({
  work_order_id: z.string().min(1, 'Work Order ID is required'),
  reason: z.string().optional(),
});

// ================================
// PRODUCT VARIANT SCHEMAS
// ================================
export const GetProductVariantsArgsSchema = z.object({
  product_id: z.string().min(1, 'Product ID is required'),
});

export const CreateProductVariantArgsSchema = z.object({
  product_id: z.string().min(1, 'Product ID is required'),
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  price: z.number().positive('Price must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('USD'),
  quantity: z.number().int().nonnegative().optional(),
  attributes: z.record(z.string()).optional(),
});

export const UpdateProductVariantPriceArgsSchema = z.object({
  variant_id: z.string().min(1, 'Variant ID is required'),
  price: z.number().positive('Price must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters').optional(),
});

export const DeleteProductVariantArgsSchema = z.object({
  variant_id: z.string().min(1, 'Variant ID is required'),
});

// ================================
// CART SCHEMAS
// ================================
export const CreateCartArgsSchema = z.object({
  customer_id: z.string().min(1, 'Customer ID is required'),
});

export const GetCartArgsSchema = z.object({
  cart_id: z.string().min(1, 'Cart ID is required'),
});

export const DeleteCartArgsSchema = z.object({
  cart_id: z.string().min(1, 'Cart ID is required'),
});

export const AddCartItemArgsSchema = z.object({
  cart_id: z.string().min(1, 'Cart ID is required'),
  product_variant_id: z.string().min(1, 'Product variant ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
});

export const UpdateCartItemArgsSchema = z.object({
  cart_id: z.string().min(1, 'Cart ID is required'),
  item_id: z.string().min(1, 'Item ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
});

export const RemoveCartItemArgsSchema = z.object({
  cart_id: z.string().min(1, 'Cart ID is required'),
  item_id: z.string().min(1, 'Item ID is required'),
});

export const ClearCartArgsSchema = z.object({
  cart_id: z.string().min(1, 'Cart ID is required'),
});

export const ListCartsArgsSchema = z.object({
  customer_id: z.string().min(1, 'Customer ID is required').optional(),
  page: z.number().positive().optional(),
  per_page: z.number().positive().optional(),
});

// ================================
// CHECKOUT SCHEMAS
// ================================
export const CreateCheckoutArgsSchema = z.object({
  cart_id: z.string().min(1, 'Cart ID is required'),
  shipping_method: z.string().min(1, 'Shipping method is required'),
  payment_method: z.string().min(1, 'Payment method is required'),
});

export const GetCheckoutArgsSchema = z.object({
  checkout_id: z.string().min(1, 'Checkout ID is required'),
});

export const UpdateCheckoutArgsSchema = z.object({
  checkout_id: z.string().min(1, 'Checkout ID is required'),
  shipping_address: z
    .object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(2),
      postal_code: z.string().min(3),
      country: z.string().min(2),
    })
    .optional(),
  billing_address: z
    .object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(2),
      postal_code: z.string().min(3),
      country: z.string().min(2),
    })
    .optional(),
  shipping_method: z.string().optional(),
  payment_method: z.string().optional(),
});

export const CompleteCheckoutArgsSchema = z.object({
  checkout_id: z.string().min(1, 'Checkout ID is required'),
});

export const CancelCheckoutArgsSchema = z.object({
  checkout_id: z.string().min(1, 'Checkout ID is required'),
});

// ================================
// PAYMENT WORKFLOW SCHEMAS
// ================================
export const RefundPaymentArgsSchema = z.object({
  payment_id: z.string().min(1, 'Payment ID is required'),
  refund_amount: z.number().positive('Refund amount must be positive'),
  refund_reason: z.string().min(1, 'Refund reason is required'),
});

export const GetPaymentsByOrderArgsSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required'),
});

// ================================
// CUSTOMER WORKFLOW SCHEMAS
// ================================
export const GetCustomerAddressesArgsSchema = z.object({
  customer_id: z.string().min(1, 'Customer ID is required'),
});

export const AddCustomerAddressArgsSchema = z.object({
  customer_id: z.string().min(1, 'Customer ID is required'),
  address: z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(2, 'State is required'),
    postal_code: z.string().min(3, 'Postal code is required'),
    country: z.string().min(2, 'Country is required'),
    is_default: z.boolean().optional(),
    address_type: z.enum(['shipping', 'billing', 'both']).optional(),
  }),
});

// ================================
// PURCHASE ORDER WORKFLOW SCHEMAS
// ================================
export const ApprovePurchaseOrderArgsSchema = z.object({
  purchase_order_id: z.string().min(1, 'Purchase Order ID is required'),
});

export const CancelPurchaseOrderArgsSchema = z.object({
  purchase_order_id: z.string().min(1, 'Purchase Order ID is required'),
  reason: z.string().optional(),
});

export const ReceivePurchaseOrderArgsSchema = z.object({
  purchase_order_id: z.string().min(1, 'Purchase Order ID is required'),
  items: z
    .array(
      z.object({
        item_id: z.string().min(1, 'Item ID is required'),
        quantity_received: z.number().int().positive('Quantity must be positive'),
      }),
    )
    .min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

// ================================
// ASN WORKFLOW SCHEMAS
// ================================
export const MarkASNInTransitArgsSchema = z.object({
  asn_id: z.string().min(1, 'ASN ID is required'),
  tracking_number: z.string().optional(),
  estimated_delivery: z.string().datetime().optional(),
});

export const MarkASNDeliveredArgsSchema = z.object({
  asn_id: z.string().min(1, 'ASN ID is required'),
  delivery_date: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const CancelASNArgsSchema = z.object({
  asn_id: z.string().min(1, 'ASN ID is required'),
  reason: z.string().optional(),
});

// ================================
// BOM WORKFLOW SCHEMAS
// ================================
export const GetBOMComponentsArgsSchema = z.object({
  bill_of_materials_id: z.string().min(1, 'Bill of Materials ID is required'),
});

export const AddBOMComponentArgsSchema = z.object({
  bill_of_materials_id: z.string().min(1, 'Bill of Materials ID is required'),
  component_id: z.string().min(1, 'Component ID is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unit_of_measure: z.string().optional(),
  sequence: z.number().int().positive().optional(),
});

export const RemoveBOMComponentArgsSchema = z.object({
  bill_of_materials_id: z.string().min(1, 'Bill of Materials ID is required'),
  component_id: z.string().min(1, 'Component ID is required'),
});

// ================================
// ANALYTICS SCHEMAS
// ================================
export const GetDashboardMetricsArgsSchema = z.object({});

export const GetSalesTrendsArgsSchema = z.object({
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  interval: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
});

export const GetSalesMetricsArgsSchema = z.object({
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
});

export const GetInventoryMetricsArgsSchema = z.object({
  location_id: z.number().int().positive().optional(),
});

export const GetShipmentMetricsArgsSchema = z.object({
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
});

export const GetCartMetricsArgsSchema = z.object({
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
});

// ================================
// SUPPLIER SCHEMAS
// ================================
export const CreateSupplierArgsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional(),
  address: z
    .object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(2),
      postal_code: z.string().min(3),
      country: z.string().min(2),
    })
    .optional(),
  contact_name: z.string().optional(),
  payment_terms: z.string().optional(),
});

export const UpdateSupplierArgsSchema = z.object({
  supplier_id: z.string().min(1, 'Supplier ID is required'),
  name: z.string().optional(),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().optional(),
  address: z
    .object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(2),
      postal_code: z.string().min(3),
      country: z.string().min(2),
    })
    .optional(),
  contact_name: z.string().optional(),
  payment_terms: z.string().optional(),
});

export const GetSupplierArgsSchema = z.object({
  supplier_id: z.string().min(1, 'Supplier ID is required'),
});

export const DeleteSupplierArgsSchema = z.object({
  supplier_id: z.string().min(1, 'Supplier ID is required'),
});
