import { Tool, ResourceTemplate, Prompt } from "@modelcontextprotocol/sdk/types.js";
import * as schemas from './schemas';

// Tool Definitions
export const tools: Tool[] = [
  // RMA Tools
  {
    name: "stateset_create_rma",
    description: "Creates a new RMA (Return Merchandise Authorization) request",
    inputSchema: schemas.CreateRMAArgsSchema,
  },
  {
    name: "stateset_update_rma",
    description: "Updates an existing RMA request",
    inputSchema: schemas.UpdateRMAArgsSchema,
  },
  {
    name: "stateset_delete_rma",
    description: "Deletes an RMA record",
    inputSchema: schemas.DeleteRMAArgsSchema,
  },
  {
    name: "stateset_get_rma",
    description: "Retrieves a specific RMA record",
    inputSchema: schemas.GetRMAArgsSchema,
  },
  {
    name: "stateset_list_rmas",
    description: "Lists RMA records with pagination",
    inputSchema: schemas.ListArgsSchema,
  },

  // Order Tools
  {
    name: "stateset_create_order",
    description: "Creates a new customer order",
    inputSchema: schemas.CreateOrderArgsSchema,
  },
  {
    name: "stateset_update_order",
    description: "Updates an existing order",
    inputSchema: schemas.UpdateOrderArgsSchema,
  },
  {
    name: "stateset_delete_order",
    description: "Deletes an order record",
    inputSchema: schemas.DeleteOrderArgsSchema,
  },
  {
    name: "stateset_get_order",
    description: "Retrieves a specific order record",
    inputSchema: schemas.GetOrderArgsSchema,
  },
  {
    name: "stateset_list_orders",
    description: "Lists order records with pagination",
    inputSchema: schemas.ListArgsSchema,
  },

  // Customer Tools
  {
    name: "stateset_create_customer",
    description: "Creates a new customer record",
    inputSchema: schemas.CreateCustomerArgsSchema,
  },
  {
    name: "stateset_update_customer",
    description: "Updates an existing customer record",
    inputSchema: schemas.UpdateCustomerArgsSchema,
  },
  {
    name: "stateset_delete_customer",
    description: "Deletes a customer record",
    inputSchema: schemas.DeleteCustomerArgsSchema,
  },
  {
    name: "stateset_get_customer",
    description: "Retrieves a specific customer record",
    inputSchema: schemas.GetCustomerArgsSchema,
  },
  {
    name: "stateset_list_customers",
    description: "Lists customer records with pagination",
    inputSchema: schemas.ListArgsSchema,
  },

  // API Metrics
  {
    name: "stateset_get_api_metrics",
    description: "Returns current API usage metrics and rate limiting information",
    inputSchema: schemas.GetApiMetricsArgsSchema,
  },
];

// Resource Templates
export const resourceTemplates: ResourceTemplate[] = [
  {
    uriTemplate: "stateset-rma:///{rmaId}",
    name: "StateSet RMA",
    description: "Return Merchandise Authorization record",
    parameters: { 
      rmaId: { 
        type: "string", 
        description: "RMA ID" 
      } 
    },
    examples: ["stateset-rma:///RMA-12345"],
  },
  {
    uriTemplate: "stateset-order:///{orderId}",
    name: "StateSet Order",
    description: "Customer order record",
    parameters: { 
      orderId: { 
        type: "string", 
        description: "Order ID" 
      } 
    },
    examples: ["stateset-order:///ORD-67890"],
  },
  {
    uriTemplate: "stateset-customer:///{customerId}",
    name: "StateSet Customer",
    description: "Customer record",
    parameters: { 
      customerId: { 
        type: "string", 
        description: "Customer ID" 
      } 
    },
    examples: ["stateset-customer:///CUST-11111"],
  },
];

// Prompts
export const prompts: Prompt[] = [
  {
    name: "order-fulfillment",
    description: "Complete order fulfillment workflow",
    instructions: `You are helping with order fulfillment. Follow these steps:

1. **Verify Order Details**: Use stateset_get_order to retrieve order information
2. **Check Inventory**: Verify product availability and quantities
3. **Process Payment**: Ensure payment is completed and valid
4. **Create Shipment**: Use stateset_create_shipment to create shipping record
5. **Update Order Status**: Mark order as fulfilled using stateset_update_order
6. **Customer Notification**: Provide tracking information to customer

Best practices:
- Always verify customer information before processing
- Double-check quantities and addresses
- Handle errors gracefully and notify appropriate teams
- Update order status at each step for transparency`,
  },
  {
    name: "return-processing",
    description: "Handle product return requests",
    instructions: `You are processing a product return. Follow this workflow:

1. **Validate Return Request**: Check return eligibility and timeframes
2. **Create RMA**: Use stateset_create_rma to create return authorization
3. **Generate Return Label**: Provide customer with prepaid shipping label
4. **Update Inventory**: Once item received, update inventory counts
5. **Process Refund**: Issue refund according to payment method
6. **Update Records**: Mark RMA as completed

Return policies to consider:
- Items must be returned within 30 days of purchase
- Items must be in original condition with tags
- Some items may be non-returnable (hygiene products, customized items)
- Check for damage or wear before accepting return`,
  },
  {
    name: "customer-support",
    description: "Provide comprehensive customer support",
    instructions: `You are a customer support representative for StateSet. Help customers with:

**Order Inquiries**:
- Order status and tracking information
- Delivery estimates and shipping details
- Order modifications (if possible)

**Returns & Exchanges**:
- Return policy explanation
- RMA creation and processing
- Refund status and timelines

**Product Information**:
- Product availability and specifications
- Pricing and promotions
- Inventory status

**Account Management**:
- Customer profile updates
- Order history review
- Payment method management

Communication guidelines:
- Be professional and empathetic
- Provide clear, actionable information
- Escalate complex issues to appropriate teams
- Always confirm customer identity before sharing sensitive information`,
  },
]; 