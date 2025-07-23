# StateSet MCP Server

A **production-ready** Model Context Protocol (MCP) server that provides comprehensive access to StateSet's returns, orders, customers, inventory, and warranty management APIs.

## ✨ Features

### 🚀 **Production-Ready Infrastructure**
- **Modular Architecture**: Clean separation of concerns with dedicated modules
- **Rate Limiting**: Intelligent request throttling with circuit breaker patterns
- **Caching System**: Multi-strategy caching (LRU, LFU, FIFO) with warming capabilities
- **Health Monitoring**: Comprehensive health checks and dependency monitoring
- **Security**: API key validation, CORS, request sanitization, and security headers

### 📊 **Observability & Monitoring**
- **Structured Logging**: High-performance Pino-based logging with JSON output
- **Metrics Collection**: Prometheus-compatible metrics with custom business metrics
- **OpenTelemetry**: Distributed tracing support with span context propagation
- **Performance Monitoring**: Request timing, system metrics, and performance insights

### 🛡️ **Resilience & Error Handling**
- **Circuit Breaker**: Prevent cascade failures with automatic recovery
- **Exponential Backoff**: Intelligent retry logic with jitter
- **Graceful Shutdown**: Clean resource cleanup and connection handling
- **Error Recovery**: Comprehensive error handling with detailed reporting

### ⚙️ **Developer Experience**
- **TypeScript First**: Full type safety with strict TypeScript configuration
- **Configuration Management**: Zod-based validation with environment variable support
- **Path Mapping**: Clean imports with `@core/`, `@services/`, etc.
- **Build Optimization**: Fast builds with source map support

## 🏗️ **Architecture**

```
src/
├── core/           # Core infrastructure
│   ├── server.ts           # Main MCP server
│   ├── handlers.ts         # Request handlers
│   ├── rate-limiter.ts     # Rate limiting & queuing
│   ├── cache.ts            # Multi-strategy caching
│   ├── circuit-breaker.ts  # Circuit breaker pattern
│   ├── health.ts           # Health check system
│   ├── metrics.ts          # Metrics collection
│   └── telemetry.ts        # OpenTelemetry integration
├── services/       # Business logic
│   ├── stateset-client.ts  # StateSet API client
│   └── metrics.ts          # Metrics service
├── middleware/     # Express middleware
│   └── security.ts         # Security, CORS, validation
├── config/         # Configuration
│   └── config.ts           # Zod-based config validation
├── tools/          # MCP tools
│   ├── definitions.ts      # Tool definitions
│   └── schemas.ts          # Validation schemas
├── types/          # TypeScript types
│   ├── api.ts             # API types
│   ├── common.ts          # Common types
│   └── index.ts           # Type exports
└── utils/          # Utilities
    ├── logger.ts          # Structured logging
    └── shutdown.ts        # Graceful shutdown
```

## 🚀 **Quick Start**

### Installation

```bash
# Clone the repository
git clone https://github.com/stateset/stateset-mcp-server.git
cd stateset-mcp-server

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env file with your StateSet API key
# STATESET_API_KEY=your_api_key_here
```

### Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Lint code
npm run lint
```

### Configuration

Set your StateSet API key and configure optional features:

```bash
# Required
export STATESET_API_KEY=your_api_key_here

# Optional - API Configuration
export STATESET_API_URL=https://api.stateset.com
export API_TIMEOUT=30000

# Optional - Performance Tuning
export RATE_LIMIT_REQUESTS_PER_HOUR=1000
export CACHE_ENABLED=true
export CACHE_STRATEGY=lru

# Optional - Monitoring
export ENABLE_METRICS=true
export ENABLE_TELEMETRY=false
```

See [`.env.example`](.env.example) for all available configuration options.

## 🛠️ **Available Tools**

### RMA (Return Merchandise Authorization)
- `stateset_create_rma` - Create new RMA request
- `stateset_update_rma` - Update existing RMA
- `stateset_delete_rma` - Delete RMA record
- `stateset_get_rma` - Retrieve RMA details
- `stateset_list_rmas` - List all RMAs with filtering

### Order Management
- `stateset_create_order` - Create new order
- `stateset_update_order` - Update order details
- `stateset_delete_order` - Delete order
- `stateset_get_order` - Get order information
- `stateset_list_orders` - List orders with pagination

### Customer Management
- `stateset_create_customer` - Add new customer
- `stateset_update_customer` - Update customer information
- `stateset_delete_customer` - Remove customer record
- `stateset_get_customer` - Get customer details
- `stateset_list_customers` - List customers with search

### Inventory Management
- `stateset_create_inventory` - Add inventory item
- `stateset_update_inventory` - Update inventory levels
- `stateset_delete_inventory` - Remove inventory item
- `stateset_get_inventory` - Get inventory details
- `stateset_list_inventory` - List inventory with filters

### Warranty Management
- `stateset_create_warranty` - Create warranty record
- `stateset_update_warranty` - Update warranty details
- `stateset_delete_warranty` - Delete warranty
- `stateset_get_warranty` - Get warranty information
- `stateset_list_warranties` - List warranties

## 📊 **Monitoring & Observability**

### Health Checks
```bash
# Check server health
curl http://localhost:3000/health

# Detailed health check
curl http://localhost:3000/health?detailed=true
```

### Metrics
```bash
# Prometheus metrics
curl http://localhost:9464/metrics

# Application metrics
curl http://localhost:3000/metrics
```

### Logging
All logs are structured JSON with configurable levels:
```bash
# Set log level
export LOG_LEVEL=debug  # trace, debug, info, warn, error, fatal
```

## 🔧 **Advanced Configuration**

### Rate Limiting
```bash
export RATE_LIMIT_REQUESTS_PER_HOUR=1000    # Hourly limit
export RATE_LIMIT_REQUESTS_PER_MINUTE=60    # Per-minute limit
export RATE_LIMIT_RETRY_ATTEMPTS=3          # Retry attempts
export RATE_LIMIT_RETRY_DELAY=1000          # Retry delay (ms)
```

### Caching
```bash
export CACHE_ENABLED=true                   # Enable caching
export CACHE_TTL=300                        # TTL in seconds
export CACHE_MAX_SIZE=1000                  # Max entries
export CACHE_STRATEGY=lru                   # lru, lfu, or fifo
```

### Security
```bash
export ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com
export IP_WHITELIST=127.0.0.1,192.168.1.0/24
export ENABLE_CORS=true
export ENABLE_HELMET=true
```

### Feature Flags
```bash
export FEATURE_METRICS=true
export FEATURE_CACHING=true
export FEATURE_HEALTH_CHECK=true
export FEATURE_CIRCUIT_BREAKER=true
export FEATURE_COMPRESSION=true
```

## 🧪 **Testing**

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Test specific module
npm test -- --testPathPattern=core
```

## 📦 **Docker Support**

```bash
# Build Docker image
docker build -t stateset-mcp-server .

# Run container
docker run -e STATESET_API_KEY=your_key -p 3000:3000 stateset-mcp-server

# Docker Compose
docker-compose up -d
```

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 **Links**

- [StateSet Documentation](https://docs.stateset.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [GitHub Repository](https://github.com/stateset/stateset-mcp-server)
- [Issues & Support](https://github.com/stateset/stateset-mcp-server/issues)

## 📈 **Performance**

- **Startup Time**: < 2s with caching enabled
- **Memory Usage**: ~50MB baseline, scales with cache size
- **Request Latency**: < 100ms average (excluding API calls)
- **Throughput**: 1000+ requests/hour with rate limiting
- **Reliability**: 99.9% uptime with circuit breaker protection

---

**Made with ❤️ by the StateSet Team**
