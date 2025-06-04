# Stateset MCP Server

A Model Context Protocol server for the StateSet API.

This server provides integration with StateSet's issue operations system through MCP, allowing LLMs to interact with StateSet.

## Tools

The server exposes a comprehensive set of MCP tools grouped by domain.

### Orders & Returns
- `stateset_create_order`, `stateset_update_order`, `stateset_delete_order`, `stateset_get_order`
- `stateset_create_sales_order`, `stateset_update_sales_order`, `stateset_delete_sales_order`, `stateset_get_sales_order`
- `stateset_create_rma`, `stateset_update_rma`, `stateset_delete_rma`, `stateset_get_rma`

### Fulfillment & Production
- `stateset_create_shipment`, `stateset_update_shipment`, `stateset_delete_shipment`, `stateset_get_shipment`
- `stateset_create_fulfillment_order`, `stateset_update_fulfillment_order`, `stateset_delete_fulfillment_order`, `stateset_get_fulfillment_order`
- `stateset_create_item_receipt`, `stateset_update_item_receipt`, `stateset_delete_item_receipt`, `stateset_get_item_receipt`
- `stateset_create_bill_of_materials`, `stateset_update_bill_of_materials`, `stateset_delete_bill_of_materials`, `stateset_get_bill_of_materials`
- `stateset_create_work_order`, `stateset_update_work_order`, `stateset_delete_work_order`, `stateset_get_work_order`
- `stateset_create_manufacturer_order`, `stateset_update_manufacturer_order`, `stateset_delete_manufacturer_order`, `stateset_get_manufacturer_order`

### Inventory & Products
- `stateset_create_product`, `stateset_update_product`, `stateset_delete_product`, `stateset_get_product`
- `stateset_create_inventory`, `stateset_update_inventory`, `stateset_delete_inventory`, `stateset_get_inventory`

### Financial
- `stateset_create_invoice`, `stateset_update_invoice`, `stateset_delete_invoice`, `stateset_get_invoice`
- `stateset_create_payment`, `stateset_update_payment`, `stateset_delete_payment`, `stateset_get_payment`
- `stateset_create_cash_sale`, `stateset_update_cash_sale`, `stateset_delete_cash_sale`, `stateset_get_cash_sale`

### Customers
- `stateset_create_customer`, `stateset_update_customer`, `stateset_delete_customer`, `stateset_get_customer`

### Listing Operations
- `stateset_list_rmas`, `stateset_list_orders`, `stateset_list_sales_orders`, `stateset_list_warranties`, `stateset_list_shipments`, `stateset_list_fulfillment_orders`, `stateset_list_item_receipts`, `stateset_list_cash_sales`
- `stateset_list_invoices`, `stateset_list_payments`, `stateset_list_products`, `stateset_list_inventories`, `stateset_list_customers`, `stateset_get_api_metrics`

## Usage

Ensure the following environment variables are set before running the server:

- `STATESET_API_KEY` – your API key (required)
- `STATESET_BASE_URL` – base URL for the StateSet API (defaults to `https://api.stateset.io/v1`)
- `REQUESTS_PER_HOUR` – rate limit for outgoing requests (defaults to `1000`)
- `API_TIMEOUT_MS` – request timeout in milliseconds (defaults to `10000`)

Install dependencies with `npm install` and start the server using:

```bash
npm start
```
