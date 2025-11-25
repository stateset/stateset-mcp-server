# Architecture

## Overview

StateSet MCP Server is a **production-grade Model Context Protocol server** that provides comprehensive e-commerce operations management through a standardized interface. The architecture is designed for scalability, reliability, and maintainability.

## System Design

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Client Layer                        │
│         (Claude Desktop, IDEs, Custom Clients)              │
└──────────────────────┬──────────────────────────────────────┘
                       │ MCP Protocol (stdio)
┌──────────────────────▼──────────────────────────────────────┐
│                   MCP Server Core                           │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Tool Handler │  │   Resources  │  │     Prompts     │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                  │                    │           │
│  ┌──────▼──────────────────▼────────────────────▼────────┐ │
│  │              Tool Dispatcher                           │ │
│  └────────────────────────┬───────────────────────────────┘ │
└───────────────────────────┼─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    Service Layer                            │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ StateSet Client│  │ Rate Limiter │  │ Circuit Breaker│ │
│  │  (API Client)  │  │              │  │                │ │
│  └───────┬────────┘  └──────┬───────┘  └───────┬────────┘ │
│          │                   │                   │          │
│  ┌───────▼───────────────────▼───────────────────▼────────┐ │
│  │        Connection Pool & Request Management            │ │
│  └────────────────────────┬───────────────────────────────┘ │
└───────────────────────────┼─────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────────┐
│                    StateSet API                             │
│           (https://api.stateset.io/v1)                      │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. MCP Server Core (`src/server.ts`)

The main server implementation handling MCP protocol communication:

- **Transport**: stdio-based communication with MCP clients
- **Request Handling**: Processes tool calls, resource reads, and prompt requests
- **Graceful Shutdown**: Handles SIGINT/SIGTERM signals and cleans up resources

### 2. Tool System

#### Tool Definitions (`src/tools/definitions.ts`)
- 100+ tool definitions covering all StateSet API endpoints
- Comprehensive descriptions for AI understanding
- JSON Schema validation for inputs

#### Tool Schemas (`src/tools/schemas.ts`)
- Zod-based schema definitions
- Input validation and sanitization
- Type-safe tool arguments

#### Tool Dispatcher (`src/tools/dispatcher.ts`)
- Routes tool calls to appropriate handlers
- Validates inputs before execution
- Handles errors and formats responses

#### Tool Registry (`src/tools/registry.ts`)
- Manages tool lifecycle
- Provides tool discovery
- Handles tool metadata

### 3. StateSet API Client (`src/services/stateset-client.ts`)

Production-ready HTTP client with advanced features:

- **Rate Limiting**: Token bucket algorithm with configurable limits
- **Circuit Breaker**: Fault tolerance and graceful degradation
- **Connection Pooling**: Reuses connections for better performance
- **Request Deduplication**: Prevents duplicate concurrent requests
- **Retry Logic**: Exponential backoff for transient failures
- **Request Tracing**: Request IDs for debugging
- **Metrics Collection**: Performance monitoring

### 4. Core Infrastructure

#### Cache Manager (`src/core/cache.ts`)
- Multiple eviction strategies (LRU, LFU, FIFO)
- TTL support
- Namespace isolation
- Memory-efficient storage

#### Rate Limiter (`src/core/rate-limiter.ts`)
- Multiple strategies (Token Bucket, Sliding Window, Adaptive)
- Priority queuing
- Metrics tracking
- Event-driven notifications

#### Circuit Breaker (`src/core/circuit-breaker.ts`)
- Three states: Closed, Open, Half-Open
- Configurable failure thresholds
- Automatic recovery
- Metrics reporting

#### Connection Pool (`src/core/connection-pool.ts`)
- HTTP keep-alive support
- Health checks
- Connection lifecycle management
- Statistics tracking

#### Metrics (`src/core/metrics.ts`)
- Prometheus-compatible metrics
- Counters, gauges, histograms
- Request/response tracking
- Performance profiling

#### Health Checks (`src/core/health.ts`)
- Liveness probes
- Readiness probes
- Dependency health tracking

### 5. WebSocket Manager (`src/core/websocket.ts`)

Real-time updates and bidirectional communication:
- Client connection management
- Broadcast capabilities
- Room-based messaging
- Heartbeat/ping-pong

## Optional Features

The following features are **excluded from the default build** but available for advanced use cases:

### HTTP/REST API Layer (Optional)

Located in `src/middleware/`:

- **security.ts**: Express middleware for HTTP security
  - Helmet security headers
  - CORS configuration
  - Request sanitization
  - API key validation
  - IP whitelisting
  - Rate limiting

- **api-docs.ts**: Swagger/OpenAPI documentation
  - Interactive API explorer
  - Comprehensive endpoint documentation
  - Schema definitions

**Why Excluded**: The main MCP server uses stdio transport and doesn't need HTTP middleware. These files are useful if you want to expose an HTTP REST API alongside the MCP server.

### Advanced/Experimental Features

Located in `src/core/`:

- **openapi-converter.ts**: Convert OpenAPI specs to MCP tools
  - Automatically generate MCP tools from OpenAPI specifications
  - Support for multiple AI platforms (OpenAI, Anthropic, MCP)
  - Schema transformation and validation

- **performance-optimizer.ts**: Advanced performance monitoring
  - Memory profiling and optimization
  - GC optimization
  - Object pooling
  - Event loop monitoring
  - CPU profiling

- **advanced-metrics.ts**: Extended metrics collection
  - Custom metrics
  - Aggregation strategies
  - Time-series data

- **intelligent-cache.ts**: ML-based cache optimization
  - Predictive pre-fetching
  - Adaptive TTL
  - Usage pattern analysis

- **realtime-manager.ts**: Advanced real-time features
  - Event sourcing
  - CQRS patterns
  - Real-time analytics

**Why Excluded**: These features add significant complexity and are not needed for most use cases. They're available for power users who need advanced capabilities.

### Authentication System (Optional)

Located in `src/auth/`:

- OAuth integration
- JWT token management
- Session handling
- Multi-tenant support

**Why Excluded**: Basic API key authentication (via StateSet API key) is sufficient for most use cases.

## Configuration

### Environment-Based Configuration (`src/config/index.ts`)

All configuration is managed through environment variables with sensible defaults:

```typescript
{
  api: {
    key: string,           // StateSet API key
    baseUrl: string,       // API base URL
    timeout: number        // Request timeout
  },
  rateLimit: {
    requestsPerHour: number,
    requestsPerMinute: number,
    burstSize: number,
    retryAttempts: number
  },
  features: {
    caching: boolean,
    metrics: boolean,
    circuitBreaker: boolean,
    websocket: boolean
  },
  cache: {
    ttl: number,
    maxSize: number,
    strategy: 'lru' | 'lfu' | 'fifo'
  }
}
```

### Feature Flags

Enable/disable features via environment variables:
- `FEATURE_CACHING` - Enable response caching
- `FEATURE_METRICS` - Enable metrics collection
- `FEATURE_CIRCUIT_BREAKER` - Enable circuit breaker
- `FEATURE_WEBSOCKET` - Enable WebSocket server

## Data Flow

### Tool Execution Flow

```
1. MCP Client sends tool call request
2. Server validates request against schema
3. Dispatcher routes to appropriate handler
4. Service layer:
   a. Check cache for result
   b. Apply rate limiting
   c. Check circuit breaker state
   d. Execute API request via connection pool
   e. Handle retries if needed
5. Response enrichment (metadata, caching)
6. Return result to MCP client
```

### Error Handling Flow

```
1. Error occurs in service layer
2. Circuit breaker tracks failure
3. Retry logic attempts recovery
4. Error handler:
   a. Classify error type
   b. Format user-friendly message
   c. Add context and suggestions
   d. Log with appropriate level
5. Return structured error to client
```

## Scalability Considerations

### Horizontal Scaling

- **Stateless Design**: Each server instance is independent
- **Shared Cache**: Use external cache (Redis) for distributed caching
- **Load Balancing**: Multiple instances behind load balancer
- **Connection Pooling**: Efficient resource utilization

### Vertical Scaling

- **Connection Pool Tuning**: Adjust pool size based on load
- **Cache Size**: Configure based on available memory
- **Rate Limits**: Set appropriate limits for API quotas

### Performance Optimization

- **Request Deduplication**: Prevents redundant API calls
- **Caching Strategy**: Reduces API load
- **Connection Reuse**: Reduces connection overhead
- **Batch Operations**: Group multiple operations

## Security

### Defense in Depth

1. **Input Validation**: Zod schemas validate all inputs
2. **Sanitization**: Remove dangerous characters and SQL injection
3. **API Key Protection**: Never log full API keys
4. **Rate Limiting**: Prevents abuse
5. **Timeout Protection**: Prevents resource exhaustion
6. **Circuit Breaker**: Protects against cascading failures

### Security Best Practices

- Store API keys in environment variables
- Use HTTPS for all API communication
- Enable request logging for audit trails
- Implement IP whitelisting if needed
- Rotate API keys regularly

## Monitoring & Observability

### Metrics

Prometheus-compatible metrics available at `/metrics`:
- `stateset_api_requests_total` - Total API requests
- `stateset_api_request_duration_seconds` - Request duration
- `stateset_api_errors_total` - API errors
- `stateset_rate_limit_queue_size` - Rate limit queue
- `stateset_circuit_breaker_state` - Circuit breaker state

### Logging

Structured JSON logs with Pino:
- Request/response logging
- Error logging with stack traces
- Performance metrics
- Security audit logs

### Health Checks

- **Liveness**: `/health/live` - Is the server running?
- **Readiness**: `/health/ready` - Can it handle requests?

## Deployment

### Docker

```bash
docker build -t stateset-mcp-server .
docker run --env-file .env stateset-mcp-server
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stateset-mcp-server
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: server
        image: stateset/mcp-server:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
```

### Cloud Platforms

- **AWS**: ECS, EKS, Lambda
- **Google Cloud**: Cloud Run, GKE
- **Azure**: Container Instances, AKS

## Future Enhancements

### Planned Features

1. **GraphQL Support**: GraphQL API alongside REST
2. **Event Streaming**: Kafka/RabbitMQ integration
3. **Multi-Region**: Geo-distributed deployment
4. **Advanced Analytics**: ML-powered insights
5. **Plugin System**: Custom tool extensions

### Performance Goals

- < 100ms p95 latency
- 99.9% uptime
- Handle 10k+ req/second
- < 512MB memory footprint

## Contributing

When modifying the architecture:

1. Maintain backward compatibility
2. Update this document
3. Add tests for new components
4. Document configuration changes
5. Consider security implications

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/docs)
- [StateSet API Documentation](https://docs.stateset.io)
- [TypeScript Best Practices](https://typescript-eslint.io/)
- [Node.js Performance](https://nodejs.org/en/docs/guides/simple-profiling/)
