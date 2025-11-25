import { z } from 'zod';

// Common schemas
const AddressSchema = z.object({
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required"),
  postal_code: z.string().min(3, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
});

// RMA schemas
export const CreateRMAArgsSchema = z.object({
  order_id: z.string().uuid('Order ID must be a valid UUID'),
  reason: z.string().min(1, "Reason is required"),
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
  items: z.array(z.object({
    product_id: z.string().min(1, "Product ID is required"),
    quantity: z.number().int().positive("Quantity must be positive"),
    unit_price: z.number().positive("Unit price must be positive").optional(),
    tax_rate: z.number().nonnegative().optional(),
  })).min(1, "At least one item is required"),
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
  order_id: z.string().min(1, "Order ID is required"),
});

export const GetOrderArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
});

// Product schemas
export const CreateProductArgsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
});

export const UpdateProductArgsSchema = z.object({
  product_id: z.string().min(1, "Product ID is required"),
  name: z.string().min(1, "Name is required").optional(),
  sku: z.string().min(1, "SKU is required").optional(),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive").optional(),
});

export const DeleteProductArgsSchema = z.object({
  product_id: z.string().min(1, "Product ID is required"),
});

export const GetProductArgsSchema = z.object({
  product_id: z.string().min(1, "Product ID is required"),
});

// Customer schemas
export const CreateCustomerArgsSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required"),
  address: AddressSchema,
});

export const UpdateCustomerArgsSchema = z.object({
  customer_id: z.string().min(1, "Customer ID is required"),
  email: z.string().email("Invalid email format").optional(),
  name: z.string().min(1, "Name is required").optional(),
  address: AddressSchema.optional(),
});

export const DeleteCustomerArgsSchema = z.object({
  customer_id: z.string().min(1, "Customer ID is required"),
});

export const GetCustomerArgsSchema = z.object({
  customer_id: z.string().min(1, "Customer ID is required"),
});

// Inventory schemas
export const CreateInventoryArgsSchema = z.object({
  item_number: z.string().min(1, "Item number is required"),
  description: z.string().optional(),
  primary_uom_code: z.string().optional(),
  organization_id: z.number().int().positive().optional(),
  location_id: z.number().int().positive("Location ID is required"),
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
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    serial_number: z.string().optional(),
    warranty_period_months: z.number().positive("Warranty period must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export const UpdateWarrantyArgsSchema = z.object({
  warranty_id: z.string().min(1, "Warranty ID is required"),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export const DeleteWarrantyArgsSchema = z.object({
  warranty_id: z.string().min(1, "Warranty ID is required"),
});

export const GetWarrantyArgsSchema = z.object({
  warranty_id: z.string().min(1, "Warranty ID is required"),
});

// Shipment schemas
export const CreateShipmentArgsSchema = z.object({
  order_id: z.string().uuid('Order ID must be a valid UUID'),
  shipping_address: z.string().min(1, "Shipping address is required"),
  shipping_method: z.string().min(1, "Shipping method is required"),
  tracking_number: z.string().min(1, "Tracking number is required"),
  recipient_name: z.string().min(1, "Recipient name is required"),
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
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).min(1, "At least one item is required"),
  shipping_address: AddressSchema,
  billing_address: AddressSchema.optional(),
});

export const UpdateSalesOrderArgsSchema = z.object({
  sales_order_id: z.string().min(1, "Sales Order ID is required"),
  status: z.string().optional(),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).optional(),
  shipping_address: AddressSchema.optional(),
  billing_address: AddressSchema.optional(),
});

export const DeleteSalesOrderArgsSchema = z.object({
  sales_order_id: z.string().min(1, "Sales Order ID is required"),
});

export const GetSalesOrderArgsSchema = z.object({
  sales_order_id: z.string().min(1, "Sales Order ID is required"),
});

// Purchase Order schemas
export const CreatePurchaseOrderArgsSchema = z.object({
  vendor_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).min(1, "At least one item is required"),
  shipping_address: AddressSchema,
  billing_address: AddressSchema.optional(),
});

export const UpdatePurchaseOrderArgsSchema = z.object({
  purchase_order_id: z.string().min(1, "Purchase Order ID is required"),
  status: z.string().optional(),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).optional(),
  shipping_address: AddressSchema.optional(),
  billing_address: AddressSchema.optional(),
});

export const DeletePurchaseOrderArgsSchema = z.object({
  purchase_order_id: z.string().min(1, "Purchase Order ID is required"),
});

export const GetPurchaseOrderArgsSchema = z.object({
  purchase_order_id: z.string().min(1, "Purchase Order ID is required"),
});

// Invoice schemas
export const CreateInvoiceArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export const UpdateInvoiceArgsSchema = z.object({
  invoice_id: z.string().min(1, "Invoice ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export const DeleteInvoiceArgsSchema = z.object({
  invoice_id: z.string().min(1, "Invoice ID is required"),
});

export const GetInvoiceArgsSchema = z.object({
  invoice_id: z.string().min(1, "Invoice ID is required"),
});

// Payment schemas
export const CreatePaymentArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  amount: z.number().positive("Amount must be positive"),   
  payment_method: z.string().min(1, "Payment method is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export const UpdatePaymentArgsSchema = z.object({
  payment_id: z.string().min(1, "Payment ID is required"),
  amount: z.number().positive("Amount must be positive"),
  payment_method: z.string().min(1, "Payment method is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export const DeletePaymentArgsSchema = z.object({
  payment_id: z.string().min(1, "Payment ID is required"),
});

export const GetPaymentArgsSchema = z.object({
  payment_id: z.string().min(1, "Payment ID is required"),
});

// ASN (Advanced Shipment Notice) schemas
export const CreateASNArgsSchema = z.object({
  purchase_order_id: z.string().min(1, "Purchase Order ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    tracking_number: z.string().optional(),
  })).min(1, "At least one item is required"),
  carrier: z.string().min(1, "Carrier is required"),
  destination_address: AddressSchema,
});

export const UpdateASNArgsSchema = z.object({
  asn_id: z.string().min(1, "ASN ID is required"),
  carrier: z.string().optional(),
  status: z.string().optional(),
  tracking_number: z.string().optional(),
  destination_address: AddressSchema.optional(),
});

export const DeleteASNArgsSchema = z.object({
  asn_id: z.string().min(1, "ASN ID is required"),
});

export const GetASNArgsSchema = z.object({
  asn_id: z.string().min(1, "ASN ID is required"),
});

// Bill of Materials schemas
export const CreateBillOfMaterialsArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export const UpdateBillOfMaterialsArgsSchema = z.object({
  bill_of_materials_id: z.string().min(1, "Bill of Materials ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).optional(),
  notes: z.string().optional(),
});

export const DeleteBillOfMaterialsArgsSchema = z.object({
  bill_of_materials_id: z.string().min(1, "Bill of Materials ID is required"),
});

export const GetBillOfMaterialsArgsSchema = z.object({
  bill_of_materials_id: z.string().min(1, "Bill of Materials ID is required"),
});

// Work Order schemas
export const CreateWorkOrderArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export const UpdateWorkOrderArgsSchema = z.object({
  work_order_id: z.string().min(1, "Work Order ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).optional(),
  notes: z.string().optional(),
});

export const DeleteWorkOrderArgsSchema = z.object({
  work_order_id: z.string().min(1, "Work Order ID is required"),
});

export const GetWorkOrderArgsSchema = z.object({
  work_order_id: z.string().min(1, "Work Order ID is required"),
});

// Manufacturer Order schemas
export const CreateManufacturerOrderArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export const UpdateManufacturerOrderArgsSchema = z.object({
  manufacturer_order_id: z.string().min(1, "Manufacturer Order ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).optional(),
  notes: z.string().optional(),
});

export const DeleteManufacturerOrderArgsSchema = z.object({
  manufacturer_order_id: z.string().min(1, "Manufacturer Order ID is required"),
});

export const GetManufacturerOrderArgsSchema = z.object({
  manufacturer_order_id: z.string().min(1, "Manufacturer Order ID is required"),
});

// Fulfillment Order schemas
export const CreateFulfillmentOrderArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    tracking_number: z.string().optional(),
  })).min(1, "At least one item is required"),
  carrier: z.string().min(1, "Carrier is required"),
  destination_address: AddressSchema,
});

export const UpdateFulfillmentOrderArgsSchema = z.object({
  fulfillment_order_id: z.string().min(1, "Fulfillment Order ID is required"),
  carrier: z.string().optional(),
  status: z.string().optional(),
  tracking_number: z.string().optional(),
  destination_address: AddressSchema.optional(),
});

export const DeleteFulfillmentOrderArgsSchema = z.object({
  fulfillment_order_id: z.string().min(1, "Fulfillment Order ID is required"),
});

export const GetFulfillmentOrderArgsSchema = z.object({
  fulfillment_order_id: z.string().min(1, "Fulfillment Order ID is required"),
});

// Item Receipt schemas
export const CreateItemReceiptArgsSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export const UpdateItemReceiptArgsSchema = z.object({
  item_receipt_id: z.string().min(1, "Item Receipt ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
  })).optional(),
  notes: z.string().optional(),
});

export const DeleteItemReceiptArgsSchema = z.object({
  item_receipt_id: z.string().min(1, "Item Receipt ID is required"),
});

export const GetItemReceiptArgsSchema = z.object({
  item_receipt_id: z.string().min(1, "Item Receipt ID is required"),
});

// Cash Sale schemas
export const CreateCashSaleArgsSchema = z.object({
  customer_email: z.string().email("Invalid email format"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).min(1, "At least one item is required"),
  payment_method: z.string().min(1, "Payment method is required"),
});

export const UpdateCashSaleArgsSchema = z.object({
  cash_sale_id: z.string().min(1, "Cash Sale ID is required"),
  items: z.array(z.object({
    item_id: z.string().min(1, "Item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    price: z.number().positive("Price must be positive"),
  })).optional(),
  payment_method: z.string().optional(),
  status: z.string().optional(),
});

export const DeleteCashSaleArgsSchema = z.object({
  cash_sale_id: z.string().min(1, "Cash Sale ID is required"),
});

export const GetCashSaleArgsSchema = z.object({
  cash_sale_id: z.string().min(1, "Cash Sale ID is required"),
});

// Common schemas
export const ListArgsSchema = z.object({
  page: z.number().positive().optional(),
  per_page: z.number().positive().optional(),
});

export const GetApiMetricsArgsSchema = z.object({}); 
