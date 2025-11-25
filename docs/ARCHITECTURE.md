# StateSet MCP Server Architecture

This document describes the architecture of the StateSet MCP (Model Context Protocol) server.

## Overview

The StateSet MCP server provides a bridge between AI assistants (like Claude) and the StateSet e-commerce API. It implements the Model Context Protocol to expose e-commerce operations as tools that AI models can invoke.

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI Assistant                             │
│                    (Claude, GPT, etc.)                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ MCP Protocol (stdio)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Server (server.ts)                       │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────────┐  │
│  │   Tools     │ │  Resources   │ │      Prompts            │  │
│  │  (90+)      │ │  Templates   │ │  (Server Instructions)  │  │
│  └──────┬──────┘ └──────┬───────┘ └─────────────────────────┘  │
│         │               │                                       │
│         ▼               ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Request Processing Pipeline                 │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │   │
│  │  │Sanitize  │→│Validate  │→│Rate Limit│→│Circuit    │  │   │
│  │  │Input     │ │Schema    │ │          │ │Breaker    │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │   │
│  └─────────────────────────┬───────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    StateSet API Client                          │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────────┐  │
│  │   Cache     │ │   Retry      │ │   Request               │  │
│  │   Manager   │ │   Logic      │ │   Deduplication         │  │
│  └─────────────┘ └──────────────┘ └─────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    StateSet API                                  │
│              (https://api.stateset.io/v1)                       │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── server.ts              # Main MCP server entry point
├── index.ts               # Module exports
├── config/
│   └── index.ts           # Configuration management (Zod validated)
├── core/
│   ├── cache.ts           # LRU/LFU/FIFO caching system
│   ├── circuit-breaker.ts # Circuit breaker pattern implementation
│   ├── metrics.ts         # Prometheus-compatible metrics
│   ├── rate-limiter.ts    # Token bucket rate limiting
│   ├── websocket.ts       # WebSocket real-time updates
│   └── telemetry.ts       # OpenTelemetry integration
├── services/
│   └── stateset-client.ts # StateSet API client with retry logic
├── tools/
│   ├── definitions.ts     # MCP tool definitions (90+ tools)
│   ├── schemas.ts         # Zod validation schemas
│   ├── handlers.ts        # Tool handler dispatch
│   ├── batch-operations.ts# Batch operation tools
│   └── search-tools.ts    # Advanced search tools
├── types/
│   ├── api.ts             # API response types
│   ├── common.ts          # Shared types
│   └── tools.ts           # Tool-related types
├── middleware/
│   └── error-handler.ts   # Centralized error handling
└── utils/
    ├── logger.ts          # Pino structured logging
    └── validation.ts      # Input sanitization
```

## Core Components

### 1. MCP Server (`server.ts`)

The main server implements the Model Context Protocol using `@modelcontextprotocol/sdk`. It:

- Registers 90+ tools for e-commerce operations
- Handles tool invocation requests from AI clients
- Manages resource templates for direct data access
- Provides server prompts with usage instructions

**Key handlers:**
- `CallToolRequestSchema` - Processes tool invocations
- `ReadResourceRequestSchema` - Handles resource URI requests
- `ListToolsRequestSchema` - Returns available tools
- `ListResourceTemplatesRequestSchema` - Returns resource templates

### 2. StateSet API Client (`services/stateset-client.ts`)

A robust HTTP client for the StateSet API with:

- **Request Deduplication**: Prevents duplicate concurrent GET requests
- **Retry Logic**: Automatic retry with exponential backoff for transient errors
- **Caching**: LRU cache for GET responses (5 minute TTL)
- **Circuit Breaker**: Prevents cascade failures
- **Rate Limiting**: Token bucket algorithm

```typescript
// Request flow
Request → Cache Check → Deduplication → Rate Limit → Circuit Breaker → API Call
```

### 3. Tool System (`tools/`)

Tools are organized by operation type:

| Category | Examples | Count |
|----------|----------|-------|
| Create | `stateset_create_order`, `stateset_create_rma` | 18 |
| Update | `stateset_update_order`, `stateset_update_shipment` | 18 |
| Delete | `stateset_delete_order`, `stateset_delete_product` | 18 |
| Get | `stateset_get_order`, `stateset_get_customer` | 19 |
| List | `stateset_list_orders`, `stateset_list_products` | 19 |
| Workflow | `stateset_approve_return`, `stateset_mark_shipment_shipped` | 4 |
| Admin | `stateset_health_check`, `stateset_cache_stats` | 7 |
| Search | `stateset_full_text_search`, `stateset_advanced_search` | 5 |
| Batch | `stateset_batch_operations` | 2 |

### 4. Resilience Patterns (`core/`)

#### Cache Manager (`cache.ts`)
- Supports LRU, LFU, and FIFO eviction strategies
- Namespace isolation for different data types
- Statistics tracking (hit rate, evictions)

#### Circuit Breaker (`circuit-breaker.ts`)
- States: CLOSED → OPEN → HALF_OPEN
- Configurable failure threshold (default: 5)
- Automatic recovery testing

#### Rate Limiter (`rate-limiter.ts`)
- Token bucket algorithm
- Per-tool category limits
- Priority queue support

### 5. Configuration (`config/index.ts`)

All configuration is validated using Zod schemas:

```typescript
const ConfigSchema = z.object({
  api: z.object({
    key: z.string().min(1),
    baseUrl: z.string().url(),
    timeout: z.number().positive(),
  }),
  rateLimit: z.object({...}),
  cache: z.object({...}),
  circuitBreaker: z.object({...}),
  features: z.object({...}),
});
```

## Data Flow

### Tool Invocation Flow

```
1. AI Client sends CallToolRequest
   ↓
2. Server extracts tool name and arguments
   ↓
3. Arguments sanitized (XSS, SQL injection prevention)
   ↓
4. Arguments validated against Zod schema
   ↓
5. Per-tool rate limit checked
   ↓
6. Tool handler invoked
   ↓
7. StateSet client makes API request
   ↓
8. Response formatted and returned to AI
```

### Error Handling Flow

```
API Error → Error Handler → Categorize → Generate Suggestions → Format Response
```

Error categories:
- `ValidationError` (400) - Invalid input
- `AuthenticationError` (401) - Auth failed
- `NotFoundError` (404) - Resource not found
- `RateLimitError` (429) - Too many requests
- `CircuitBreakerError` (503) - Service protection

## Security

### Input Sanitization
All tool inputs are sanitized before processing:
- HTML/XSS pattern detection
- SQL injection pattern detection
- Content length validation (50KB max)

### Authentication
- Bearer token authentication to StateSet API
- API key stored in environment variable
- Never logged or exposed in errors

## Monitoring

### Metrics (Prometheus-compatible)
- `stateset_api_requests_total` - Request counter
- `stateset_api_request_duration_seconds` - Latency histogram
- `stateset_api_errors_total` - Error counter
- `stateset_cache_hits_total` - Cache hit counter

### Health Checks
- API connectivity check
- Rate limiter status
- Circuit breaker state
- Memory usage

### Logging (Pino)
- Structured JSON logs
- Request ID tracking
- Log levels: trace, debug, info, warn, error, fatal

## WebSocket Real-time Updates

The server supports WebSocket connections for real-time updates:

```
Client → Subscribe to channel (e.g., "orders") → Receive updates
```

Channels available:
- Resource type channels: `orders`, `products`, `customers`
- Specific resource channels: `orders:ORD-123`

## Development

### Running Tests
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
```

### Building
```bash
npm run build               # Compile TypeScript
npm run typecheck           # Type check only
```

### Running Locally
```bash
STATESET_API_KEY=your_key npm run dev
```

## Performance Considerations

1. **Caching**: GET requests are cached for 5 minutes
2. **Request Deduplication**: Prevents duplicate API calls
3. **Parallel Search**: Full-text search runs in parallel across resource types
4. **Connection Pooling**: Axios connection reuse

## Future Improvements

See `IMPROVEMENTS.md` for planned enhancements:
- GraphQL support
- Event sourcing
- Multi-tenant support
- Advanced analytics
