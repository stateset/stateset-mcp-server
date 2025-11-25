# Inventory & Product Tools

Tools for managing products, inventory levels, and stock operations.

## Product Operations

### stateset_create_product
Adds a new product to the catalog.

**Parameters:**
- `name` (required): Product name
- `sku` (required): Stock keeping unit (unique identifier)
- `description`: Product description
- `price` (required): Product price
- `category`: Product category
- `attributes`: Additional product attributes (JSON)

**Returns:** Product ID and details

**Example:**
```json
{
  "name": "Premium Widget",
  "sku": "WID-PREM-001",
  "description": "High-quality premium widget",
  "price": 49.99,
  "category": "widgets",
  "attributes": {
    "color": "blue",
    "size": "large",
    "weight": "2.5kg"
  }
}
```

### stateset_update_product
Updates product information.

**Parameters:**
- `product_id` (required): Product identifier
- `name`: Updated product name
- `price`: Updated price
- `description`: Updated description
- `attributes`: Updated attributes (merged with existing)

**Returns:** Updated product details

### stateset_get_product
Retrieves product details.

**Parameters:**
- `product_id` (required): Product identifier

**Returns:** Complete product information including current inventory levels

### stateset_list_products
Lists products with filtering and pagination.

**Parameters:**
- `page`: Page number (default: 1)
- `per_page`: Results per page (default: 20)
- `category`: Filter by category
- `search`: Search term for name/description
- `min_price`: Minimum price filter
- `max_price`: Maximum price filter

**Returns:** Array of products with pagination metadata

## Inventory Operations

### stateset_create_inventory
Creates an inventory record for tracking stock levels.

**Parameters:**
- `product_id` (required): Product identifier
- `location_id` (required): Warehouse/location identifier
- `quantity` (required): Initial quantity
- `bin_location`: Specific bin/shelf location

**Returns:** Inventory record ID

**Example:**
```json
{
  "product_id": "PROD-123",
  "location_id": "WH-SF",
  "quantity": 500,
  "bin_location": "A-12-03"
}
```

### stateset_update_inventory
Updates inventory quantities.

**Parameters:**
- `inventory_id` (required): Inventory record identifier
- `quantity` (required): New quantity (can be negative for adjustments)
- `reason`: Reason for adjustment (restock, damage, theft, correction)
- `notes`: Additional notes

**Returns:** Updated inventory details

**Use Cases:**
- Receiving new stock: positive quantity adjustment
- Damage/loss: negative quantity adjustment
- Inventory correction: set exact quantity

### stateset_get_inventory
Retrieves inventory details.

**Parameters:**
- `inventory_id` (required): Inventory record identifier

**Returns:** Current inventory levels and location details

### stateset_list_inventory
Lists inventory across all locations.

**Parameters:**
- `product_id`: Filter by product
- `location_id`: Filter by location
- `min_quantity`: Show only items with at least this quantity
- `max_quantity`: Show only items with at most this quantity

**Returns:** Array of inventory records

## Advanced Operations

### stateset_inventory_transfer
Transfers inventory between locations.

**Parameters:**
- `product_id` (required): Product identifier
- `from_location_id` (required): Source location
- `to_location_id` (required): Destination location
- `quantity` (required): Quantity to transfer

**Returns:** Transfer record and updated inventory levels

### stateset_inventory_count
Records a physical inventory count.

**Parameters:**
- `location_id` (required): Location being counted
- `counts` (required): Array of product counts
  - `product_id`: Product identifier
  - `counted_quantity`: Physically counted quantity

**Returns:** Discrepancy report and adjustment records

**Example:**
```json
{
  "location_id": "WH-SF",
  "counts": [
    {
      "product_id": "PROD-123",
      "counted_quantity": 498
    },
    {
      "product_id": "PROD-456",
      "counted_quantity": 250
    }
  ]
}
```

### stateset_inventory_reserve
Reserves inventory for an order.

**Parameters:**
- `order_id` (required): Order identifier
- `items` (required): Items to reserve
  - `product_id`: Product identifier
  - `quantity`: Quantity to reserve

**Returns:** Reservation IDs and status

## Bill of Materials (BOM)

### stateset_create_bill_of_materials
Creates a BOM defining components needed for manufacturing.

**Parameters:**
- `product_id` (required): Finished product identifier
- `components` (required): Array of required components
  - `component_product_id`: Component product ID
  - `quantity`: Quantity needed per unit
  - `unit_cost`: Cost per component

**Returns:** BOM ID

**Example:**
```json
{
  "product_id": "PROD-ASSEMBLY-001",
  "components": [
    {
      "component_product_id": "PART-A",
      "quantity": 2,
      "unit_cost": 5.00
    },
    {
      "component_product_id": "PART-B",
      "quantity": 1,
      "unit_cost": 12.00
    }
  ]
}
```

### stateset_get_bill_of_materials
Retrieves BOM details.

**Parameters:**
- `bom_id` (required): BOM identifier

**Returns:** Complete BOM with component details and costs

## Best Practices

1. **Real-time Updates**: Update inventory immediately when orders are placed or received
2. **Location Tracking**: Always specify location_id for multi-warehouse operations
3. **Audit Trail**: Use the `reason` and `notes` fields for all inventory adjustments
4. **Negative Inventory**: Enable negative quantities only if you allow backorders
5. **Regular Counts**: Perform physical inventory counts periodically to maintain accuracy
6. **Reservations**: Reserve inventory when orders are placed to prevent overselling

## Inventory Strategies

### Just-in-Time (JIT)
- Minimal inventory levels
- Frequent reordering
- Use `stateset_get_inventory` to monitor stock levels
- Set up automated reorder triggers

### Safety Stock
- Maintain buffer inventory
- Configure minimum quantity alerts
- Use `min_quantity` filters to identify low stock

### ABC Analysis
- Categorize products by value/velocity
- Monitor high-value items more closely
- Adjust count frequencies accordingly

## Rate Limits

Inventory operations rate limits:
- Read operations: 120 requests/minute
- Write operations: 60 requests/minute
- Bulk operations: 30 requests/minute

## Common Errors

- `INSUFFICIENT_INVENTORY`: Requested quantity exceeds available stock
- `INVALID_LOCATION`: Location ID not found
- `DUPLICATE_SKU`: SKU already exists in system
- `NEGATIVE_QUANTITY_NOT_ALLOWED`: Negative quantities disabled
