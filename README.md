# Stateset MCP Server

A Model Context Protocol server for the StateSet API.

This server provides integration with StateSet's issue operations system through MCP, allowing LLMs to interact with StateSet.

## Tools

The server exposes a variety of MCP tools for creating, updating and retrieving records:

- `stateset_create_rma`, `stateset_update_rma`, `stateset_get_rma`
- `stateset_create_order`, `stateset_get_order`
- `stateset_create_warranty`, `stateset_get_warranty`
- `stateset_create_shipment`, `stateset_get_shipment`
- `stateset_create_bill_of_materials`, `stateset_update_bill_of_materials`, `stateset_get_bill_of_materials`
- `stateset_create_work_order`, `stateset_update_work_order`, `stateset_get_work_order`
- `stateset_create_manufacturer_order`, `stateset_update_manufacturer_order`, `stateset_get_manufacturer_order`
- `stateset_create_invoice`, `stateset_update_invoice`, `stateset_get_invoice`
- `stateset_create_payment`, `stateset_update_payment`, `stateset_get_payment`

## Usage

Ensure the following environment variables are set before running the server:

- `STATESET_API_KEY` – your API key (required)
- `STATESET_BASE_URL` – base URL for the StateSet API (defaults to `https://api.stateset.io/v1`)
- `REQUESTS_PER_HOUR` – rate limit for outgoing requests (defaults to `1000`)

Install dependencies with `npm install` and start the server using:

```bash
npm start
```
