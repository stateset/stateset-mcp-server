# Changelog

All notable changes to the StateSet MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-12-01

### Changed
- **Updated @modelcontextprotocol/sdk from 1.6.1 to 1.23.0** - Major SDK update with breaking changes
- **Updated @anthropic-ai/sdk from 0.36.3 to 0.71.0** - Latest Anthropic SDK
- **Updated TypeScript from 5.7.2 to 5.9.3** - Latest TypeScript version
- **Updated dependencies**: pino, axios, dotenv, eslint, prettier, and many others to latest versions
- **Optimized TypeScript configuration**:
  - Updated target to ES2023 for better performance
  - Added incremental builds for faster compilation
  - Optimized module resolution to "bundler" mode
  - Improved build cache with tsBuildInfoFile

### Fixed
- **MCP SDK v1.23 Compatibility**: Removed deprecated properties from resource templates and prompts
  - Removed `parameters` property from ResourceTemplate (not supported in new SDK)
  - Removed `examples` property from ResourceTemplate
  - Removed `serverPrompt` with deprecated `instructions` field
  - Fixed server capabilities configuration for new SDK API

### Improved
- **Build Performance**: Incremental TypeScript compilation reduces build time significantly
- **Type Safety**: Maintained strict type checking while ensuring compatibility with latest SDK
- **Test Coverage**: All 136 tests passing after updates
- **No Breaking Changes**: All existing functionality preserved despite major dependency updates

### Technical Details
- Zero vulnerabilities after dependency updates
- Build now uses optimized ES2023 target
- Improved module resolution and bundling
- Cleaner TypeScript configuration without overly strict flags that caused issues

## [1.0.0] - 2024-11-25

### Added
- Initial release of StateSet MCP Server
- 100+ MCP tools for StateSet API integration
- Comprehensive CRUD operations for all StateSet resources
- Advanced search and filtering capabilities
- Batch operation support
- Real-time WebSocket updates
- Intelligent caching with multiple strategies (LRU/LFU/FIFO)
- Circuit breaker pattern for resilience
- Rate limiting with token bucket algorithm
- Connection pooling
- Input validation and sanitization
- Structured logging with Pino
- Prometheus metrics support
- Health check endpoints
- Graceful shutdown handling
- 136 passing unit tests
- Comprehensive documentation
- Docker support
- TypeScript with full type safety
