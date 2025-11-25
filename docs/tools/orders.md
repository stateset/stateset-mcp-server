# Order Tools

Comprehensive tools for managing orders, returns, and warranties in the StateSet API.

## Order Operations

### stateset_create_order
Creates a new customer order with line items, shipping, and billing information.

**Parameters:**
- `customer_id` (required): Customer identifier
- `items` (required): Array of order line items
  - `product_id`: Product identifier
  - `quantity`: Quantity ordered
  - `price`: Unit price
- `shipping_address`: Shipping address details
- `billing_address`: Billing address details
- `status`: Order status (default: 'pending')

**Returns:** Order ID and dashboard URL

**Example:**
```json
{
  "customer_id": "CUST-123",
  "items": [
    {
      "product_id": "PROD-456",
      "quantity": 2,
      "price": 29.99
    }
  ],
  "shipping_address": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105"
  }
}
```

### stateset_update_order
Updates an existing order's details.

**Parameters:**
- `order_id` (required): Order identifier
- `status`: New order status
- `tracking_number`: Shipping tracking number
- `notes`: Additional notes

**Returns:** Updated order details

### stateset_get_order
Retrieves detailed information about a specific order.

**Parameters:**
- `order_id` (required): Order identifier

**Returns:** Complete order details including line items, status, and shipping information

### stateset_list_orders
Lists orders with pagination and filtering.

**Parameters:**
- `page`: Page number (default: 1)
- `per_page`: Results per page (default: 20, max: 100)
- `status`: Filter by order status
- `customer_id`: Filter by customer

**Returns:** Array of orders with pagination metadata

## Return Operations

### stateset_create_rma
Creates a new Return Merchandise Authorization (RMA) for processing customer returns.

**Parameters:**
- `order_id` (required): Original order identifier
- `reason` (required): Return reason
- `items`: Items being returned with quantities
- `refund_method`: Preferred refund method

**Returns:** RMA ID and tracking details

**Example:**
```json
{
  "order_id": "ORDER-123",
  "reason": "defective",
  "items": [
    {
      "product_id": "PROD-456",
      "quantity": 1
    }
  ],
  "refund_method": "original_payment"
}
```

### stateset_update_rma
Updates an RMA status and details.

**Parameters:**
- `rma_id` (required): RMA identifier
- `status`: New RMA status (pending, approved, rejected, completed)
- `resolution`: Resolution details

**Returns:** Updated RMA details

### stateset_get_rma
Retrieves RMA details.

**Parameters:**
- `rma_id` (required): RMA identifier

**Returns:** Complete RMA information

### stateset_list_rmas
Lists RMAs with filtering.

**Parameters:**
- `page`: Page number
- `per_page`: Results per page
- `status`: Filter by RMA status
- `order_id`: Filter by original order

**Returns:** Array of RMAs with pagination

## Warranty Operations

### stateset_create_warranty
Creates warranty coverage for products.

**Parameters:**
- `order_id` (required): Order containing the products
- `items` (required): Array of items with warranty details
  - `product_id`: Product identifier
  - `warranty_period_months`: Coverage duration in months

**Returns:** Warranty record IDs

**Example:**
```json
{
  "order_id": "ORDER-123",
  "items": [
    {
      "product_id": "PROD-456",
      "warranty_period_months": 24
    }
  ]
}
```

### stateset_get_warranty
Retrieves warranty information.

**Parameters:**
- `warranty_id` (required): Warranty identifier

**Returns:** Warranty details including coverage dates and status

### stateset_check_warranty
Checks if a product is under warranty.

**Parameters:**
- `product_id` (required): Product identifier
- `order_id`: Order identifier

**Returns:** Warranty status and expiration date

## Best Practices

1. **Order Creation**: Always validate customer and product IDs before creating orders
2. **Returns**: Verify order exists and is eligible for return before creating RMA
3. **Warranties**: Link warranties to specific order line items for accurate tracking
4. **Error Handling**: Implement retry logic for transient failures
5. **Pagination**: Use appropriate page sizes to optimize API calls

## Common Workflows

### Complete Order Fulfillment
1. Create order with `stateset_create_order`
2. Create shipment with `stateset_create_shipment`
3. Update order status with `stateset_update_order`
4. Mark shipment shipped with `stateset_mark_shipment_shipped`

### Return Processing
1. Customer requests return
2. Create RMA with `stateset_create_rma`
3. Review and approve/reject with `stateset_update_rma`
4. Process refund if approved
5. Update inventory when item received

## Rate Limits

Order operations are subject to rate limiting:
- Standard: 60 requests/minute
- Burst: Up to 100 requests

Use exponential backoff when rate limited.
