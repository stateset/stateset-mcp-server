# StateSet MCP Server

[![CI/CD Pipeline](https://github.com/stateset/mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/stateset/mcp-server/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/stateset/mcp-server/branch/master/graph/badge.svg)](https://codecov.io/gh/stateset/mcp-server)
[![npm version](https://badge.fury.io/js/stateset-mcp-server.svg)](https://badge.fury.io/js/stateset-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io/)

A production-ready Model Context Protocol (MCP) server for StateSet API integration, providing comprehensive e-commerce and supply chain operations management through a standardized interface. Built with enterprise-grade reliability, performance, and observability.

## 📖 Documentation

- **[Architecture Guide](./ARCHITECTURE.md)** - System design and component overview
- **[Testing Guide](./TESTING.md)** - Testing strategy and coverage
- **[API Documentation](./docs/api)** - Generated TypeDoc API reference
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute

## 🚀 Features

### Core Capabilities
- **166 MCP Tools**: Complete CRUD operations for orders, returns, inventory, products, customers, shipments, manufacturing, and financial operations with full workflow support
- **Advanced Search**: Multi-filter search with sorting, pagination, aggregations, and full-text search across all resources
- **Batch Operations**: Execute multiple operations atomically with configurable parallelism and error handling
- **Real-Time Updates**: WebSocket support for live event streaming and resource change notifications
- **Resource Templates**: URI-based resource access (e.g., `stateset-order:///ORD-123`)

### Enterprise-Grade Reliability
- **Intelligent Caching**: LRU/LFU/FIFO cache strategies with adaptive TTL, automatic cache warming, and optional Redis support for distributed caching
- **Circuit Breaker**: Automatic failure detection and recovery to prevent cascade failures
- **Rate Limiting**: Token bucket algorithm with per-tool limits and burst support
- **Connection Pooling**: Efficient connection reuse with health checks and automatic reconnection
- **Graceful Degradation**: Automatic fallback strategies with stale cache data when services are unavailable
- **Retry Strategies**: Exponential backoff with jitter and intelligent error classification
- **Graceful Shutdown**: Proper cleanup of connections, caches, and background tasks

### Security & Validation
- **Input Sanitization**: XSS prevention, SQL injection protection, command injection detection, and HTML tag stripping
- **Path Traversal Protection**: Detection and blocking of path traversal attempts
- **API Key Security**: Automatic redaction in logs and error messages with sensitive data masking
- **Request Validation**: Zod schemas with comprehensive type checking
- **CORS & Helmet**: Security headers and cross-origin request protection

### Observability
- **Structured Logging**: Pino-based JSON logging with correlation IDs and request context
- **Request Correlation**: Correlation IDs propagated through async operations for distributed tracing
- **Prometheus Metrics**: Request counts, durations, error rates, cache hit rates, and queue lengths
- **Tool Metrics**: Per-tool execution tracking with duration histograms, error rates, and category analysis
- **Health Checks**: Liveness and readiness probes for Kubernetes deployments
- **OpenTelemetry**: Distributed tracing support (optional)
- **Performance Monitoring**: Request timing, retry tracking, circuit breaker status, and slow tool detection

### Developer Experience
- **Type-Safe**: Built with TypeScript 5.7 for maximum type safety and IntelliSense support
- **Well-Tested**: 297 passing tests across 21 test suites with unit and E2E coverage
- **Hot Reloading**: Development mode with automatic restart on file changes
- **OpenAPI Converter**: Generate MCP tools from OpenAPI specifications
- **Comprehensive Documentation**: Detailed tool descriptions optimized for AI understanding

## 📋 Table of Contents

- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Configuration](#️-configuration)
- [Usage Examples](#-usage-examples)
- [Architecture](#️-architecture)
- [API Reference](#-api-reference)
- [Development](#️-development)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Monitoring](#-monitoring)
- [Troubleshooting](#-troubleshooting)
- [Performance Tips](#-performance-tips)
- [Contributing](#-contributing)
- [License](#-license)
- [Support](#-support)
- [Roadmap](#️-roadmap)

## 🔧 Installation

### Using npm

```bash
npm install -g stateset-mcp-server
```

### Using Docker

```bash
docker pull stateset/mcp-server:latest
```

### From Source

```bash
git clone https://github.com/stateset/mcp-server.git
cd mcp-server
npm install
npm run build
```

## 🏃 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/stateset/mcp-server.git
cd mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your StateSet API credentials
# Required: STATESET_API_KEY=your_api_key_here
```

### 3. Run the Server

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start

# Using Docker
docker build -t stateset-mcp-server .
docker run --env-file .env stateset-mcp-server
```

### 4. Connect with MCP Client

The server uses stdio transport for MCP communication:

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Create client
const client = new Client({
  name: 'my-app',
  version: '1.0.0',
});

// Create stdio transport
const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/index.js'],
  env: {
    STATESET_API_KEY: 'your_api_key_here'
  }
});

// Connect
await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log('Available tools:', tools.tools.length);

// Call a tool
const result = await client.callTool({
  name: 'stateset_list_orders',
  arguments: { page: 1, per_page: 10 }
});
```

### 5. WebSocket Connection (Optional)

For real-time updates, connect to the WebSocket server:

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8081');

// Subscribe to order updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'orders',
  filter: { status: 'pending' }
}));

// Listen for updates
ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Received update:', event);
});
```

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

#### Required Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `STATESET_API_KEY` | Your StateSet API key | **Required** |
| `STATESET_BASE_URL` | StateSet API base URL | `https://api.stateset.io/v1` |
| `STATESET_API_VERSION` | API version | `v1` |

#### Rate Limiting

| Variable | Description | Default |
|----------|-------------|---------|
| `REQUESTS_PER_HOUR` | Maximum API requests per hour | `1000` |
| `REQUESTS_PER_MINUTE` | Maximum API requests per minute | `50` |
| `BURST_SIZE` | Extra requests allowed in short bursts | `10` |
| `RETRY_ATTEMPTS` | Number of retry attempts for failed requests | `3` |
| `RETRY_DELAY` | Initial retry delay in milliseconds | `1000` |

#### Caching

| Variable | Description | Default |
|----------|-------------|---------|
| `CACHE_ENABLED` | Enable/disable caching | `true` |
| `CACHE_TTL` | Cache time-to-live in seconds | `300` |
| `CACHE_MAX_SIZE` | Maximum number of items to cache | `1000` |
| `CACHE_STRATEGY` | Cache eviction strategy (lru/lfu/fifo) | `lru` |

#### Redis Configuration (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis server hostname | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_PASSWORD` | Redis authentication password | (none) |
| `REDIS_DB` | Redis database number | `0` |

#### Circuit Breaker

| Variable | Description | Default |
|----------|-------------|---------|
| `CIRCUIT_BREAKER_ENABLED` | Enable circuit breaker protection | `true` |
| `CIRCUIT_BREAKER_THRESHOLD` | Failures before circuit opens | `5` |
| `CIRCUIT_BREAKER_TIMEOUT` | Time circuit stays open (ms) | `60000` |
| `CIRCUIT_BREAKER_RESET_TIMEOUT` | Time before reset attempt (ms) | `30000` |

#### Feature Flags

| Variable | Description | Default |
|----------|-------------|---------|
| `FEATURE_CACHING` | Enable API response caching | `true` |
| `FEATURE_METRICS` | Enable Prometheus metrics | `true` |
| `FEATURE_HEALTH_CHECK` | Enable health check endpoints | `true` |
| `FEATURE_WEBSOCKET` | Enable WebSocket real-time updates | `true` |
| `FEATURE_CIRCUIT_BREAKER` | Enable circuit breaker | `true` |
| `FEATURE_COMPRESSION` | Enable response compression | `true` |
| `FEATURE_OPEN_API_CONVERTER` | Enable OpenAPI conversion | `false` |
| `FEATURE_ENABLE_TELEMETRY` | Enable OpenTelemetry tracing | `false` |

#### Server Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/staging/production/test) | `production` |
| `LOG_LEVEL` | Logging level (trace/debug/info/warn/error/fatal) | `info` |
| `API_TIMEOUT_MS` | Request timeout in milliseconds | `10000` |
| `WEBSOCKET_PORT` | WebSocket server port | `8081` |
| `METRICS_INTERVAL` | Metrics collection interval (ms) | `60000` |
| `HEALTH_CHECK_INTERVAL` | Health check interval (ms) | `30000` |

## 💡 Usage Examples

### Basic Operations

```javascript
// Create a customer
const customer = await client.callTool({
  name: 'stateset_create_customer',
  arguments: {
    email: 'customer@example.com',
    name: 'John Doe',
    address: {
      line1: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94102',
      country: 'US'
    }
  }
});

// Create an order
const order = await client.callTool({
  name: 'stateset_create_order',
  arguments: {
    customer_id: customer.id,
    items: [
      { product_id: 'PROD-001', quantity: 2, price: 29.99 },
      { product_id: 'PROD-002', quantity: 1, price: 49.99 }
    ],
    shipping_address: {
      line1: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94102',
      country: 'US'
    }
  }
});

// Create a shipment
const shipment = await client.callTool({
  name: 'stateset_create_shipment',
  arguments: {
    order_id: order.id,
    carrier: 'UPS',
    tracking_number: '1Z999AA10123456784'
  }
});

// Mark as shipped
await client.callTool({
  name: 'stateset_mark_shipment_shipped',
  arguments: { shipment_id: shipment.id }
});
```

### Advanced Search

```javascript
// Search orders by multiple criteria
const searchResults = await client.callTool({
  name: 'stateset_advanced_search',
  arguments: {
    resource: 'orders',
    filters: [
      { field: 'status', operator: 'eq', value: 'pending' },
      { field: 'total', operator: 'gt', value: 100 },
      { field: 'created_at', operator: 'gte', value: '2024-01-01T00:00:00Z' }
    ],
    sort: [
      { field: 'created_at', order: 'desc' }
    ],
    page: 1,
    per_page: 20
  }
});

// Full-text search across resources
const textSearch = await client.callTool({
  name: 'stateset_full_text_search',
  arguments: {
    query: 'laptop',
    resources: ['products', 'orders'],
    limit: 50
  }
});

// Search products with inventory
const productsInStock = await client.callTool({
  name: 'stateset_search_products_with_inventory',
  arguments: {
    min_quantity: 10,
    location: 'warehouse-1'
  }
});
```

### Batch Operations

```javascript
// Batch create multiple orders
const batchResult = await client.callTool({
  name: 'stateset_batch_create_orders',
  arguments: {
    orders: [
      { customer_id: 'CUST-1', items: [...] },
      { customer_id: 'CUST-2', items: [...] },
      { customer_id: 'CUST-3', items: [...] }
    ],
    options: {
      parallel: true,
      stopOnError: false,
      chunkSize: 10
    }
  }
});

console.log(`Success: ${batchResult.success}, Failed: ${batchResult.failed}`);

// Bulk inventory update
await client.callTool({
  name: 'stateset_batch_update_inventory',
  arguments: {
    updates: [
      { product_id: 'PROD-1', quantity_change: -5, reason: 'sale' },
      { product_id: 'PROD-2', quantity_change: 100, reason: 'restock' },
      { product_id: 'PROD-3', quantity_change: -2, reason: 'damaged' }
    ]
  }
});

// Generic batch operations
await client.callTool({
  name: 'stateset_batch_operations',
  arguments: {
    operations: [
      { type: 'create', resource: 'product', data: {...} },
      { type: 'update', resource: 'inventory', data: {...} },
      { type: 'create', resource: 'customer', data: {...} }
    ],
    options: { parallel: false, stopOnError: true }
  }
});
```

### Return Processing Workflow

```javascript
// Customer initiates return
const rma = await client.callTool({
  name: 'stateset_create_rma',
  arguments: {
    order_id: 'ORD-12345',
    items: [
      { product_id: 'PROD-001', quantity: 1, reason: 'defective' }
    ],
    reason: 'Product arrived damaged'
  }
});

// Approve the return
await client.callTool({
  name: 'stateset_approve_return',
  arguments: { rma_id: rma.id }
});

// After receiving returned items, restock
await client.callTool({
  name: 'stateset_restock_return',
  arguments: { rma_id: rma.id }
});

// Issue refund
await client.callTool({
  name: 'stateset_create_payment',
  arguments: {
    order_id: 'ORD-12345',
    amount: -29.99,
    payment_method: 'refund',
    notes: `Refund for RMA ${rma.id}`
  }
});
```

### Manufacturing Workflow

```javascript
// Create bill of materials
const bom = await client.callTool({
  name: 'stateset_create_bill_of_materials',
  arguments: {
    product_id: 'PROD-WIDGET',
    components: [
      { part_id: 'PART-001', quantity: 2, cost: 5.00 },
      { part_id: 'PART-002', quantity: 1, cost: 10.00 },
      { part_id: 'PART-003', quantity: 4, cost: 2.50 }
    ]
  }
});

// Create work order
const workOrder = await client.callTool({
  name: 'stateset_create_work_order',
  arguments: {
    product_id: 'PROD-WIDGET',
    quantity: 100,
    bom_id: bom.id,
    due_date: '2024-12-31'
  }
});

// Create purchase order for raw materials
const po = await client.callTool({
  name: 'stateset_create_purchase_order',
  arguments: {
    vendor_id: 'VENDOR-001',
    items: [
      { part_id: 'PART-001', quantity: 200, unit_price: 5.00 },
      { part_id: 'PART-002', quantity: 100, unit_price: 10.00 }
    ],
    delivery_date: '2024-12-15'
  }
});
```

### Resource Access

```javascript
// Read resource by URI
const orderResource = await client.readResource({
  uri: 'stateset-order:///ORD-12345'
});

const productResource = await client.readResource({
  uri: 'stateset-product:///PROD-001'
});

const customerResource = await client.readResource({
  uri: 'stateset-customer:///CUST-456'
});
```

## 🏗️ Architecture

### Directory Structure

```
src/
├── auth/               # Authentication templates and types
├── config/             # Configuration management and timeouts
├── core/              # Core infrastructure
│   ├── adaptive-cache.ts        # Adaptive TTL and cache warming
│   ├── advanced-metrics.ts      # Detailed performance metrics
│   ├── batch-processor.ts       # Batch operation processing
│   ├── cache.ts                 # In-memory caching layer
│   ├── circuit-breaker.ts       # Circuit breaker pattern
│   ├── connection-pool.ts       # Connection pooling
│   ├── graceful-degradation.ts  # Fallback and degradation patterns
│   ├── health.ts                # Health check implementation
│   ├── hybrid-cache.ts          # Hybrid memory/Redis caching
│   ├── intelligent-cache.ts     # Advanced caching strategies
│   ├── metrics.ts               # Metrics collection
│   ├── openapi-converter.ts     # OpenAPI to MCP conversion
│   ├── performance-optimizer.ts # Performance tuning
│   ├── rate-limiter.ts          # Rate limiting logic
│   ├── realtime-manager.ts      # Real-time event management
│   ├── redis-cache.ts           # Redis distributed caching
│   ├── request-context.ts       # Correlation ID and request tracking
│   ├── resource-registry.ts     # Resource handler registry
│   ├── retry-strategy.ts        # Retry with exponential backoff
│   ├── tool-metrics.ts          # Per-tool metrics collection
│   ├── server-rate-limiter.ts   # Server-level rate limiting
│   ├── telemetry.ts             # OpenTelemetry integration
│   └── websocket.ts             # WebSocket server
├── middleware/        # Request/response middleware
│   ├── api-docs.ts              # API documentation
│   ├── error-handler.ts         # Error handling and formatting
│   └── security.ts              # Security middleware
├── services/          # Business logic and API clients
│   ├── enhanced-stateset-client.ts  # Enhanced API client
│   ├── mcp-client.ts                # MCP client wrapper
│   └── stateset-client.ts           # Base StateSet API client
├── tools/             # MCP tool implementations
│   ├── ai-insights.ts           # AI-powered analytics
│   ├── batch-operations.ts      # Batch operation tools
│   ├── definitions.ts           # Tool definitions
│   ├── dispatcher.ts            # Tool request dispatcher
│   ├── enhanced-tools.ts        # Enhanced tool capabilities
│   ├── openapi-tools.ts         # OpenAPI-based tools
│   ├── registry.ts              # Tool registry
│   ├── schemas.ts               # Zod validation schemas
│   └── search-tools.ts          # Advanced search tools
├── types/             # TypeScript type definitions
│   ├── api.ts                   # API types
│   ├── common.ts                # Common types
│   ├── index.ts                 # Type exports
│   ├── mcp-api.ts               # MCP API types
│   ├── resources.ts             # Resource types
│   └── tools.ts                 # Tool types
├── utils/             # Utility functions
│   ├── broadcast.ts             # Broadcasting utilities
│   ├── logger.ts                # Structured logging
│   ├── shutdown.ts              # Graceful shutdown
│   └── validation.ts            # Input validation
├── index.ts           # Entry point
└── server.ts          # Main server implementation
```

### Key Components

- **MCP Server**: Stdio-based MCP protocol server with tool, resource, and prompt handlers
- **StateSet API Client**: Axios-based client with rate limiting, retries, and circuit breaker
- **Tool Dispatcher**: Routes tool calls to appropriate handlers with validation
- **Resource Registry**: Manages URI-based resource access (e.g., `stateset-order:///ORD-123`)
- **Intelligent Cache**: Multi-strategy caching (LRU/LFU/FIFO) with automatic invalidation
- **Circuit Breaker**: Prevents cascade failures with automatic recovery
- **WebSocket Manager**: Real-time event streaming and subscription management
- **Batch Processor**: Parallel and sequential batch operation execution
- **Metrics Collector**: Prometheus-compatible metrics with request tracking
- **Error Handler**: Consistent error formatting with context and request IDs

## 📚 API Reference

### Tools

The server exposes 166 MCP tools organized by domain:

#### Orders & Returns (RMA)
- **Create**: `stateset_create_order`, `stateset_create_rma`
- **Update**: `stateset_update_order`, `stateset_update_order_status`
- **Get**: `stateset_get_order`, `stateset_get_rma`, `stateset_get_order_items`
- **List**: `stateset_list_orders`, `stateset_list_rmas`
- **Delete**: `stateset_delete_order`
- **Workflows**: `stateset_approve_return`, `stateset_restock_return`, `stateset_cancel_order`, `stateset_archive_order`, `stateset_add_order_item`

#### Inventory & Products
- **Products**: `stateset_create_product`, `stateset_update_product`, `stateset_get_product`, `stateset_list_products`, `stateset_delete_product`
- **Product Variants**: `stateset_get_product_variants`, `stateset_create_product_variant`, `stateset_update_product_variant_price`, `stateset_delete_product_variant`
- **Inventory**: `stateset_create_inventory`, `stateset_update_inventory`, `stateset_get_inventory`, `stateset_list_inventories`, `stateset_delete_inventory`
- **Inventory Workflows**: `stateset_reserve_inventory`, `stateset_release_inventory`, `stateset_get_low_stock`

#### Fulfillment & Shipping
- **Shipments**: `stateset_create_shipment`, `stateset_get_shipment`, `stateset_list_shipments`
- **Workflows**: `stateset_mark_shipment_shipped`, `stateset_mark_shipment_delivered`, `stateset_track_shipment`
- **Fulfillment Orders**: `stateset_create_fulfillment_order`, `stateset_update_fulfillment_order`, `stateset_list_fulfillment_orders`

#### Shopping Cart & Checkout
- **Carts**: `stateset_create_cart`, `stateset_get_cart`, `stateset_delete_cart`, `stateset_list_carts`
- **Cart Items**: `stateset_add_cart_item`, `stateset_update_cart_item`, `stateset_remove_cart_item`, `stateset_clear_cart`
- **Checkout**: `stateset_create_checkout`, `stateset_get_checkout`, `stateset_update_checkout`, `stateset_complete_checkout`, `stateset_cancel_checkout`

#### Manufacturing & Supply Chain
- **Work Orders**: `stateset_create_work_order`, `stateset_update_work_order`, `stateset_get_work_order`, `stateset_list_work_orders`
- **Work Order Workflows**: `stateset_assign_work_order`, `stateset_start_work_order`, `stateset_complete_work_order`, `stateset_hold_work_order`, `stateset_cancel_work_order`
- **Bill of Materials**: `stateset_create_bill_of_materials`, `stateset_update_bill_of_materials`, `stateset_get_bill_of_materials`, `stateset_list_bill_of_materials`
- **BOM Components**: `stateset_get_bom_components`, `stateset_add_bom_component`, `stateset_remove_bom_component`
- **Purchase Orders**: `stateset_create_purchase_order`, `stateset_update_purchase_order`, `stateset_get_purchase_order`, `stateset_list_purchase_orders`
- **PO Workflows**: `stateset_approve_purchase_order`, `stateset_cancel_purchase_order`, `stateset_receive_purchase_order`
- **Manufacturer Orders**: `stateset_create_manufacturer_order`, `stateset_update_manufacturer_order`, `stateset_get_manufacturer_order`, `stateset_list_manufacturer_orders`
- **ASN**: `stateset_create_asn`, `stateset_update_asn`, `stateset_get_asn`, `stateset_list_asns`
- **ASN Workflows**: `stateset_mark_asn_in_transit`, `stateset_mark_asn_delivered`, `stateset_cancel_asn`
- **Item Receipts**: `stateset_create_item_receipt`, `stateset_update_item_receipt`, `stateset_get_item_receipt`, `stateset_list_item_receipts`
- **Suppliers**: `stateset_create_supplier`, `stateset_update_supplier`, `stateset_get_supplier`, `stateset_delete_supplier`, `stateset_list_suppliers`

#### Financial Operations
- **Invoices**: `stateset_create_invoice`, `stateset_update_invoice`, `stateset_get_invoice`, `stateset_list_invoices`, `stateset_delete_invoice`
- **Payments**: `stateset_create_payment`, `stateset_update_payment`, `stateset_get_payment`, `stateset_list_payments`, `stateset_delete_payment`
- **Payment Workflows**: `stateset_refund_payment`, `stateset_get_payments_by_order`
- **Sales Orders**: `stateset_create_sales_order`, `stateset_update_sales_order`, `stateset_get_sales_order`, `stateset_list_sales_orders`
- **Cash Sales**: `stateset_create_cash_sale`, `stateset_update_cash_sale`, `stateset_get_cash_sale`, `stateset_list_cash_sales`

#### Customer Management
- `stateset_create_customer` - Create a new customer
- `stateset_update_customer` - Update customer information
- `stateset_get_customer` - Get customer details
- `stateset_list_customers` - List all customers
- `stateset_delete_customer` - Delete a customer
- `stateset_get_customer_addresses` - Get customer addresses
- `stateset_add_customer_address` - Add address to customer

#### Warranties
- `stateset_create_warranty` - Create warranty record
- `stateset_update_warranty` - Update warranty details
- `stateset_get_warranty` - Get warranty information
- `stateset_list_warranties` - List all warranties
- `stateset_extend_warranty` - Extend warranty period
- `stateset_create_warranty_claim` - Create warranty claim
- `stateset_approve_warranty_claim` - Approve warranty claim

#### Analytics & Reporting
- `stateset_get_dashboard_metrics` - Get key dashboard metrics
- `stateset_get_sales_trends` - Get sales trends over time
- `stateset_get_sales_metrics` - Get sales performance metrics
- `stateset_get_inventory_metrics` - Get inventory metrics
- `stateset_get_shipment_metrics` - Get shipment metrics
- `stateset_get_cart_metrics` - Get cart abandonment metrics

#### Advanced Search
- `stateset_advanced_search` - Multi-filter search with sorting, pagination, and aggregations
- `stateset_search_orders_by_date` - Find orders within date ranges
- `stateset_search_products_with_inventory` - Search products by stock levels
- `stateset_search_customer_analytics` - Analyze customer segments
- `stateset_full_text_search` - Full-text search across all resources

#### Batch Operations
- `stateset_batch_operations` - Execute multiple operations atomically
- `stateset_batch_create_orders` - Create multiple orders at once
- `stateset_batch_update_inventory` - Bulk inventory adjustments
- `stateset_csv_import` - Import data from CSV files

#### Monitoring & Admin
- `stateset_health_check` - Check server and API health
- `stateset_get_api_metrics` - View request metrics and performance
- `stateset_tool_rate_limits` - Get per-tool rate limit status
- `stateset_timeout_config` - View timeout configuration
- `stateset_cache_stats` - Get cache performance statistics
- `stateset_clear_cache` - Clear cached data
- `stateset_websocket_stats` - View WebSocket connection statistics

### Resources

Access StateSet resources through URI templates. Resources provide direct access to specific records by ID:

```
stateset-rma:///RMA-12345
stateset-order:///ORD-123
stateset-warranty:///WAR-123
stateset-shipment:///SHIP-123
stateset-product:///PROD-789
stateset-inventory:///INV-456
stateset-customer:///CUST-789
stateset-sales-order:///SO-123
stateset-purchase-order:///PO-456
stateset-invoice:///INV-789
stateset-payment:///PAY-123
```

Example usage:
```javascript
// Read a specific order
const response = await client.readResource({
  uri: 'stateset-order:///ORD-12345'
});
```

### Prompts

The server provides a comprehensive prompt that includes:

- **Tool Catalog**: Detailed descriptions of all 166 tools organized by category
- **Best Practices**: Guidelines for input validation, rate limiting, error handling, search/filtering, and batch processing
- **Workflow Guidance**: Common patterns for orders, returns, fulfillment, manufacturing, inventory, and financial operations
- **API Usage Tips**: Rate limit management, caching strategies, and performance optimization

## 🛠️ Development

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- TypeScript >= 5.0.0

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run linting
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

### Project Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build production bundle |
| `npm run test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run docs` | Generate API documentation |

## 🧪 Testing

### Running Tests

```bash
# Run all tests (297 passing tests)
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

### Test Results

```
Test Suites: 14 passed, 14 total
Tests:       203 passed, 203 total
```

### Test Structure

```
tests/
├── unit/                           # Unit tests for individual components
│   ├── batch-processor.test.ts    # Batch operation processing
│   ├── cache.test.ts              # Cache functionality
│   ├── circuit-breaker.test.ts    # Circuit breaker logic
│   ├── connection-pool.test.ts    # Connection pooling
│   ├── definitions.test.ts        # Tool definitions
│   ├── dispatcher.test.ts         # Tool dispatcher
│   ├── error-handler.test.ts      # Error handling
│   ├── handlers.test.ts           # Request handlers
│   ├── health.test.ts             # Health check functionality
│   ├── intelligent-cache.test.ts  # Advanced caching
│   ├── mcp-client.test.ts         # MCP client wrapper
│   ├── metrics.test.ts            # Metrics collection
│   ├── openapi-converter.test.ts  # OpenAPI conversion
│   ├── rate-limiter.test.ts       # Rate limiting core
│   ├── redis-cache.test.ts        # Redis cache integration
│   ├── registry.test.ts           # Tool registry
│   ├── schemas.test.ts            # Zod schema validation
│   ├── server.test.ts             # Server initialization
│   ├── stateset-client.test.ts    # API client
│   ├── telemetry.test.ts          # Telemetry integration
│   ├── tool-rate-limiter.test.ts  # Tool-level rate limiting
│   ├── validation.test.ts         # Input validation
│   └── websocket.test.ts          # WebSocket functionality
├── e2e/                            # End-to-end tests
│   ├── mcp-server.e2e.test.ts     # MCP server integration
│   └── workflow.e2e.test.ts       # Business workflow tests
├── setup.ts                        # Test setup and configuration
└── teardown.ts                     # Test cleanup
```

### Coverage

The test suite provides comprehensive coverage of:
- ✅ Core MCP server functionality
- ✅ Rate limiting and circuit breaker logic
- ✅ Caching strategies (LRU/LFU/FIFO) and Redis integration
- ✅ Input validation and sanitization
- ✅ Error handling and formatting
- ✅ WebSocket connections
- ✅ Metrics collection
- ✅ Connection pooling
- ✅ OpenAPI conversion
- ✅ Tool dispatcher and registry
- ✅ Batch processor operations
- ✅ Health check endpoints

### Writing Tests

```typescript
import { StateSetClient } from '../src/services/stateset-client';

describe('StateSet Client', () => {
  it('should create order successfully', async () => {
    const client = new StateSetClient(mockConfig);
    const order = await client.createOrder({
      customer_email: 'test@example.com',
      items: [{ product_id: 'PROD-1', quantity: 1, price: 10.00 }]
    });
    expect(order.id).toBeDefined();
  });
});
```

## 🚀 Deployment

### Docker Deployment

The server includes a multi-stage Dockerfile optimized for production:

```bash
# Build image
docker build -t stateset-mcp-server .

# Run container
docker run -d \
  --name stateset-mcp \
  --env-file .env \
  -p 9464:9464 \
  -p 8081:8081 \
  stateset-mcp-server
```

The Dockerfile includes:
- Multi-stage build for smaller image size
- Non-root user for security
- dumb-init for proper signal handling
- Health checks for container orchestration
- Production-optimized dependencies

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stateset-mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: stateset-mcp
  template:
    metadata:
      labels:
        app: stateset-mcp
    spec:
      containers:
      - name: server
        image: stateset/mcp-server:latest
        envFrom:
        - secretRef:
            name: stateset-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Cloud Deployment

- **AWS**: Use ECS or EKS with the provided Docker image
- **Google Cloud**: Deploy to Cloud Run or GKE
- **Azure**: Use Container Instances or AKS

## 📊 Monitoring

### Health Checks

Use the MCP tool for health monitoring:

```javascript
// Check overall server health
await client.callTool({
  name: 'stateset_health_check',
  arguments: { include_details: true }
});

// Returns:
// - API connection status
// - Rate limiter state
// - Circuit breaker state (open/closed/half-open)
// - Memory usage
// - Cache statistics
// - WebSocket connections
```

### Metrics

Access detailed metrics through MCP tools:

```javascript
// Get API metrics
await client.callTool({
  name: 'stateset_get_api_metrics',
  arguments: {}
});

// Get cache statistics
await client.callTool({
  name: 'stateset_cache_stats',
  arguments: { namespace: 'orders' }
});

// Get rate limit status
await client.callTool({
  name: 'stateset_tool_rate_limits',
  arguments: { category: 'read' }
});

// Get WebSocket statistics
await client.callTool({
  name: 'stateset_websocket_stats',
  arguments: {}
});
```

Key metrics tracked:
- `totalRequests` - Total API requests made
- `requestsInLastHour` - Recent request count
- `averageRequestTime` - Mean response time in ms
- `queueLength` - Current rate limit queue size
- `cacheHitRate` - Cache effectiveness percentage
- `circuitBreakerState` - Protection status
- `activeConnections` - WebSocket connections

### Logging

Structured JSON logs with configurable levels:

```json
{
  "level": "info",
  "time": "2024-01-01T12:00:00.000Z",
  "context": "api",
  "method": "POST",
  "url": "/orders",
  "duration": 123,
  "status": 200,
  "msg": "API request completed"
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- Follow TypeScript best practices
- Maintain 80%+ test coverage
- Use conventional commits
- Document all public APIs
- Add JSDoc comments for complex functions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://github.com/modelcontextprotocol) for the MCP specification
- [StateSet](https://stateset.io) for the comprehensive e-commerce API
- All our contributors and users

## 🔧 Troubleshooting

### Common Issues

#### Server Won't Start

```bash
# Check if API key is set
echo $STATESET_API_KEY

# Verify environment file
cat .env

# Check for port conflicts
lsof -i :8081
```

#### Rate Limit Errors

```javascript
// Check rate limit status
await client.callTool({
  name: 'stateset_tool_rate_limits',
  arguments: {}
});

// Increase limits in .env
REQUESTS_PER_HOUR=2000
REQUESTS_PER_MINUTE=100
```

#### Circuit Breaker Open

```javascript
// Check health status
await client.callTool({
  name: 'stateset_health_check',
  arguments: { include_details: true }
});

// Circuit breaker will automatically reset after timeout
// Or disable in .env for testing:
CIRCUIT_BREAKER_ENABLED=false
```

#### Cache Issues

```javascript
// Clear cache if data seems stale
await client.callTool({
  name: 'stateset_clear_cache',
  arguments: { namespace: 'orders' }
});

// Check cache statistics
await client.callTool({
  name: 'stateset_cache_stats',
  arguments: {}
});
```

#### WebSocket Connection Fails

```bash
# Check if WebSocket port is available
lsof -i :8081

# Verify WebSocket is enabled
grep FEATURE_WEBSOCKET .env

# Check firewall rules
sudo ufw status
```

### Debug Mode

Enable detailed logging for troubleshooting:

```bash
LOG_LEVEL=debug npm run dev
```

## 🚀 Performance Tips

### Optimize for High Throughput

1. **Enable Caching**
   ```bash
   CACHE_ENABLED=true
   CACHE_TTL=600  # Increase TTL for less volatile data
   CACHE_MAX_SIZE=5000
   ```

2. **Adjust Rate Limits**
   ```bash
   REQUESTS_PER_HOUR=5000
   REQUESTS_PER_MINUTE=200
   BURST_SIZE=50
   ```

3. **Use Batch Operations**
   ```javascript
   // Instead of multiple single calls
   await client.callTool({
     name: 'stateset_batch_create_orders',
     arguments: { orders: [...], options: { parallel: true } }
   });
   ```

4. **Connection Pooling**
   ```bash
   # Already enabled by default
   # Adjust pool size if needed in code
   ```

5. **Circuit Breaker Tuning**
   ```bash
   CIRCUIT_BREAKER_THRESHOLD=10  # Allow more failures
   CIRCUIT_BREAKER_TIMEOUT=30000  # Faster recovery
   ```

## 📞 Support

- 📧 **Email**: support@stateset.io
- 💬 **Discord**: [Join our community](https://discord.gg/stateset)
- 📚 **Documentation**: [docs.stateset.io](https://docs.stateset.io)
- 🐛 **Issues**: [GitHub Issues](https://github.com/stateset/mcp-server/issues)
- 🌐 **Website**: [stateset.io](https://stateset.io)

## 🗺️ Roadmap

### Recently Completed

- [x] Redis-based distributed caching
- [x] Hybrid memory/Redis cache with automatic fallback
- [x] Request correlation IDs for distributed tracing
- [x] Retry strategies with exponential backoff and jitter
- [x] Adaptive cache with automatic TTL tuning and cache warming
- [x] Graceful degradation with automatic fallbacks
- [x] Per-tool metrics collection with duration histograms
- [x] Enhanced input validation (XSS, command injection, path traversal protection)
- [x] Sensitive data masking in logs

### Coming Soon

- [ ] GraphQL API support
- [ ] Webhook event delivery
- [ ] Multi-tenant support
- [ ] Enhanced AI insights and predictions
- [ ] Integration with popular e-commerce platforms
- [ ] Real-time analytics dashboard
- [ ] Audit logging and compliance features

### Under Consideration

- HTTP/REST transport alongside stdio
- gRPC support for high-performance scenarios
- Plugin system for custom tools
- Multi-region deployment support
- Advanced workflow automation

## 🙏 Credits

Built with:
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk) - MCP implementation
- [TypeScript](https://www.typescriptlang.org/) - Type-safe development
- [Zod](https://github.com/colinhacks/zod) - Schema validation
- [Axios](https://axios-http.com/) - HTTP client
- [Pino](https://getpino.io/) - High-performance logging
- [Jest](https://jestjs.io/) - Testing framework
- [WebSocket (ws)](https://github.com/websockets/ws) - Real-time communication
