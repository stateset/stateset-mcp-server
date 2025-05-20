# Stateset MCP Server

A Model Context Protocol server for the StateSet API.

This server provides integration with StateSet's issue operations system through MCP, allowing LLMs to interact with StateSet.

## Tools

The server exposes a variety of MCP tools for creating, updating, deleting and retrieving records:

- `stateset_create_rma`, `stateset_update_rma`, `stateset_delete_rma`, `stateset_get_rma`
- `stateset_create_order`, `stateset_update_order`, `stateset_delete_order`, `stateset_get_order`
- `stateset_create_warranty`, `stateset_update_warranty`, `stateset_delete_warranty`, `stateset_get_warranty`
- `stateset_create_shipment`, `stateset_update_shipment`, `stateset_delete_shipment`, `stateset_get_shipment`
- `stateset_create_bill_of_materials`, `stateset_update_bill_of_materials`, `stateset_delete_bill_of_materials`, `stateset_get_bill_of_materials`
- `stateset_create_work_order`, `stateset_update_work_order`, `stateset_delete_work_order`, `stateset_get_work_order`
- `stateset_create_manufacturer_order`, `stateset_update_manufacturer_order`, `stateset_delete_manufacturer_order`, `stateset_get_manufacturer_order`
- `stateset_create_invoice`, `stateset_update_invoice`, `stateset_delete_invoice`, `stateset_get_invoice`
- `stateset_create_payment`, `stateset_update_payment`, `stateset_delete_payment`, `stateset_get_payment`
- `stateset_create_product`, `stateset_update_product`, `stateset_delete_product`, `stateset_get_product`
- `stateset_create_customer`, `stateset_update_customer`, `stateset_delete_customer`, `stateset_get_customer`
- `stateset_list_rmas`, `stateset_list_orders`, `stateset_list_warranties`, `stateset_list_shipments`
- `stateset_list_bill_of_materials`, `stateset_list_work_orders`, `stateset_list_manufacturer_orders`
- `stateset_list_invoices`, `stateset_list_payments`, `stateset_list_products`, `stateset_list_customers`

## Usage

Ensure the following environment variables are set before running the server:

- `STATESET_API_KEY` – your API key (required)
- `STATESET_BASE_URL` – base URL for the StateSet API (defaults to `https://api.stateset.io/v1`)
- `REQUESTS_PER_HOUR` – rate limit for outgoing requests (defaults to `1000`)

Install dependencies with `npm install` and start the server using:

```bash
npm start
```
