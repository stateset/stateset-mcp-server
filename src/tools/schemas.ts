import { z } from 'zod';

// Address schema
const AddressSchema = z.object({
  line1: z.string().min(1, "Address line 1 is required"),
  line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required"),
  postal_code: z.string().min(5, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
});

// Base item schemas
const BaseItemSchema = z.object({
  item_id: z.string().min(1, "Item ID is required"),
  quantity: z.number().positive("Quantity must be positive"),
});

const PricedItemSchema = BaseItemSchema.extend({
  price: z.number().positive("Price must be positive"),
});

const RMAItemSchema = BaseItemSchema.extend({
  reason: z.string().optional(),
});

// Helper function to convert Zod schema to JSON schema format
function zodToJsonSchema(schema: z.ZodType): any {
  // This is a simplified conversion for basic schemas
  // In a real implementation, you'd use a proper zod-to-json-schema library
  return {
    type: "object",
    properties: {
      // We'll define properties manually for now
    },
    additionalProperties: false,
  };
}

// List arguments
export const ListArgsSchema = {
  type: "object" as const,
  properties: {
    page: { type: "number", minimum: 1 },
    per_page: { type: "number", minimum: 1, maximum: 100 },
  },
  additionalProperties: false,
};

// RMA Schemas
export const CreateRMAArgsSchema = {
  type: "object" as const,
  properties: {
    order_id: { type: "string", minLength: 1 },
    customer_email: { type: "string", format: "email" },
    reason: { type: "string", minLength: 1 },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item_id: { type: "string", minLength: 1 },
          quantity: { type: "number", minimum: 1 },
          reason: { type: "string" },
        },
        required: ["item_id", "quantity"],
        additionalProperties: false,
      },
      minItems: 1,
    },
    notes: { type: "string" },
  },
  required: ["order_id", "customer_email", "reason", "items"],
  additionalProperties: false,
};

export const UpdateRMAArgsSchema = {
  type: "object" as const,
  properties: {
    rma_id: { type: "string", minLength: 1 },
    status: { type: "string" },
    resolution: { type: "string" },
    notes: { type: "string" },
  },
  required: ["rma_id"],
  additionalProperties: false,
};

export const DeleteRMAArgsSchema = {
  type: "object" as const,
  properties: {
    rma_id: { type: "string", minLength: 1 },
  },
  required: ["rma_id"],
  additionalProperties: false,
};

export const GetRMAArgsSchema = {
  type: "object" as const,
  properties: {
    rma_id: { type: "string", minLength: 1 },
  },
  required: ["rma_id"],
  additionalProperties: false,
};

// Order Schemas
export const CreateOrderArgsSchema = {
  type: "object" as const,
  properties: {
    customer_email: { type: "string", format: "email" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item_id: { type: "string", minLength: 1 },
          quantity: { type: "number", minimum: 1 },
          price: { type: "number", minimum: 0 },
        },
        required: ["item_id", "quantity", "price"],
        additionalProperties: false,
      },
      minItems: 1,
    },
    shipping_address: {
      type: "object",
      properties: {
        line1: { type: "string", minLength: 1 },
        line2: { type: "string" },
        city: { type: "string", minLength: 1 },
        state: { type: "string", minLength: 2 },
        postal_code: { type: "string", minLength: 5 },
        country: { type: "string", minLength: 2 },
      },
      required: ["line1", "city", "state", "postal_code", "country"],
      additionalProperties: false,
    },
    billing_address: {
      type: "object",
      properties: {
        line1: { type: "string", minLength: 1 },
        line2: { type: "string" },
        city: { type: "string", minLength: 1 },
        state: { type: "string", minLength: 2 },
        postal_code: { type: "string", minLength: 5 },
        country: { type: "string", minLength: 2 },
      },
      required: ["line1", "city", "state", "postal_code", "country"],
      additionalProperties: false,
    },
  },
  required: ["customer_email", "items", "shipping_address"],
  additionalProperties: false,
};

export const UpdateOrderArgsSchema = {
  type: "object" as const,
  properties: {
    order_id: { type: "string", minLength: 1 },
    status: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item_id: { type: "string", minLength: 1 },
          quantity: { type: "number", minimum: 1 },
          price: { type: "number", minimum: 0 },
        },
        required: ["item_id", "quantity", "price"],
        additionalProperties: false,
      },
    },
    shipping_address: {
      type: "object",
      properties: {
        line1: { type: "string", minLength: 1 },
        line2: { type: "string" },
        city: { type: "string", minLength: 1 },
        state: { type: "string", minLength: 2 },
        postal_code: { type: "string", minLength: 5 },
        country: { type: "string", minLength: 2 },
      },
      required: ["line1", "city", "state", "postal_code", "country"],
      additionalProperties: false,
    },
    billing_address: {
      type: "object",
      properties: {
        line1: { type: "string", minLength: 1 },
        line2: { type: "string" },
        city: { type: "string", minLength: 1 },
        state: { type: "string", minLength: 2 },
        postal_code: { type: "string", minLength: 5 },
        country: { type: "string", minLength: 2 },
      },
      required: ["line1", "city", "state", "postal_code", "country"],
      additionalProperties: false,
    },
  },
  required: ["order_id"],
  additionalProperties: false,
};

export const DeleteOrderArgsSchema = {
  type: "object" as const,
  properties: {
    order_id: { type: "string", minLength: 1 },
  },
  required: ["order_id"],
  additionalProperties: false,
};

export const GetOrderArgsSchema = {
  type: "object" as const,
  properties: {
    order_id: { type: "string", minLength: 1 },
  },
  required: ["order_id"],
  additionalProperties: false,
};

// Customer Schemas
export const CreateCustomerArgsSchema = {
  type: "object" as const,
  properties: {
    email: { type: "string", format: "email" },
    name: { type: "string", minLength: 1 },
    address: {
      type: "object",
      properties: {
        line1: { type: "string", minLength: 1 },
        line2: { type: "string" },
        city: { type: "string", minLength: 1 },
        state: { type: "string", minLength: 2 },
        postal_code: { type: "string", minLength: 5 },
        country: { type: "string", minLength: 2 },
      },
      required: ["line1", "city", "state", "postal_code", "country"],
      additionalProperties: false,
    },
    phone: { type: "string" },
    metadata: { type: "object" },
  },
  required: ["email", "name", "address"],
  additionalProperties: false,
};

export const UpdateCustomerArgsSchema = {
  type: "object" as const,
  properties: {
    customer_id: { type: "string", minLength: 1 },
    email: { type: "string", format: "email" },
    name: { type: "string", minLength: 1 },
    address: {
      type: "object",
      properties: {
        line1: { type: "string", minLength: 1 },
        line2: { type: "string" },
        city: { type: "string", minLength: 1 },
        state: { type: "string", minLength: 2 },
        postal_code: { type: "string", minLength: 5 },
        country: { type: "string", minLength: 2 },
      },
      required: ["line1", "city", "state", "postal_code", "country"],
      additionalProperties: false,
    },
    phone: { type: "string" },
    metadata: { type: "object" },
  },
  required: ["customer_id"],
  additionalProperties: false,
};

export const DeleteCustomerArgsSchema = {
  type: "object" as const,
  properties: {
    customer_id: { type: "string", minLength: 1 },
  },
  required: ["customer_id"],
  additionalProperties: false,
};

export const GetCustomerArgsSchema = {
  type: "object" as const,
  properties: {
    customer_id: { type: "string", minLength: 1 },
  },
  required: ["customer_id"],
  additionalProperties: false,
};

// API Metrics Schema
export const GetApiMetricsArgsSchema = {
  type: "object" as const,
  properties: {},
  additionalProperties: false,
};

// Zod schemas for validation (these are used for runtime validation)
export const CreateRMAZodSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  customer_email: z.string().email("Invalid email format"),
  reason: z.string().min(1, "Reason is required"),
  items: z.array(RMAItemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export const UpdateRMAZodSchema = z.object({
  rma_id: z.string().min(1, "RMA ID is required"),
  status: z.string().optional(),
  resolution: z.string().optional(),
  notes: z.string().optional(),
});

export const DeleteRMAZodSchema = z.object({
  rma_id: z.string().min(1, "RMA ID is required"),
});

export const GetRMAZodSchema = z.object({
  rma_id: z.string().min(1, "RMA ID is required"),
});

export const CreateOrderZodSchema = z.object({
  customer_email: z.string().email("Invalid email format"),
  items: z.array(PricedItemSchema).min(1, "At least one item is required"),
  shipping_address: AddressSchema,
  billing_address: AddressSchema.optional(),
});

export const UpdateOrderZodSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  status: z.string().optional(),
  items: z.array(PricedItemSchema).optional(),
  shipping_address: AddressSchema.optional(),
  billing_address: AddressSchema.optional(),
});

export const DeleteOrderZodSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
});

export const GetOrderZodSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
});

export const CreateCustomerZodSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required"),
  address: AddressSchema,
  phone: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateCustomerZodSchema = z.object({
  customer_id: z.string().min(1, "Customer ID is required"),
  email: z.string().email("Invalid email format").optional(),
  name: z.string().min(1, "Name is required").optional(),
  address: AddressSchema.optional(),
  phone: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const DeleteCustomerZodSchema = z.object({
  customer_id: z.string().min(1, "Customer ID is required"),
});

export const GetCustomerZodSchema = z.object({
  customer_id: z.string().min(1, "Customer ID is required"),
});

export const ListZodSchema = z.object({
  page: z.number().positive().optional(),
  per_page: z.number().positive().max(100).optional(),
}); 