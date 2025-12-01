import { z } from 'zod';
import dotenv from 'dotenv';
import { pino } from 'pino';

// Load environment variables
dotenv.config();

// Configuration schema with comprehensive validation
const ConfigSchema = z.object({
  // API Configuration
  api: z.object({
    key: z.string().min(1, 'STATESET_API_KEY is required'),
    baseUrl: z.string().url().default('http://localhost:8080/api/v1'),
    version: z.string().default('v1'),
    timeout: z.number().positive().default(10000),
  }),

  // Rate Limiting Configuration
  rateLimit: z.object({
    requestsPerHour: z.number().positive().default(1000),
    requestsPerMinute: z.number().positive().default(50),
    burstSize: z.number().positive().default(10),
    retryAttempts: z.number().min(0).max(5).default(3),
    retryDelay: z.number().positive().default(1000),
  }),

  // Server Configuration
  server: z.object({
    name: z.string().default('stateset-mcp-server'),
    version: z.string().default('1.0.0'),
    environment: z.enum(['development', 'staging', 'production', 'test']).default('production'),
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  }),

  // Feature Flags
  features: z.object({
    caching: z.boolean().default(true),
    metrics: z.boolean().default(true),
    healthCheck: z.boolean().default(true),
    requestValidation: z.boolean().default(true),
    responseEnrichment: z.boolean().default(true),
    circuitBreaker: z.boolean().default(true),
    compression: z.boolean().default(true),
    openApiConverter: z.boolean().default(false),
    enableTelemetry: z.boolean().default(false),
    websocket: z.boolean().default(true),
  }),

  // Cache Configuration
  cache: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().positive().default(300), // 5 minutes
    maxSize: z.number().positive().default(1000),
    strategy: z.enum(['lru', 'lfu', 'fifo']).default('lru'),
    backend: z.enum(['memory', 'redis', 'hybrid']).default('memory'),
    redis: z
      .object({
        enabled: z.boolean().default(false),
        host: z.string().default('localhost'),
        port: z.number().positive().default(6379),
        password: z.string().optional(),
        db: z.number().min(0).default(0),
        keyPrefix: z.string().default('stateset:mcp:'),
        hybridL1Size: z.number().positive().default(1000),
        hybridL1TTL: z.number().positive().default(60),
      })
      .optional(),
  }),

  // Circuit Breaker Configuration
  circuitBreaker: z.object({
    enabled: z.boolean().default(true),
    threshold: z.number().positive().default(5),
    timeout: z.number().positive().default(60000), // 1 minute
    resetTimeout: z.number().positive().default(30000), // 30 seconds
  }),

  // Monitoring Configuration
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsInterval: z.number().positive().default(60000), // 1 minute
    healthCheckInterval: z.number().positive().default(30000), // 30 seconds
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

// Parse and validate configuration
function loadConfig(): Config {
  const rawConfig = {
    api: {
      key: process.env.STATESET_API_KEY,
      baseUrl: process.env.STATESET_BASE_URL,
      version: process.env.STATESET_API_VERSION,
      timeout: process.env.API_TIMEOUT_MS ? parseInt(process.env.API_TIMEOUT_MS, 10) : undefined,
    },
    rateLimit: {
      requestsPerHour: process.env.REQUESTS_PER_HOUR
        ? parseInt(process.env.REQUESTS_PER_HOUR, 10)
        : undefined,
      requestsPerMinute: process.env.REQUESTS_PER_MINUTE
        ? parseInt(process.env.REQUESTS_PER_MINUTE, 10)
        : undefined,
      burstSize: process.env.BURST_SIZE ? parseInt(process.env.BURST_SIZE, 10) : undefined,
      retryAttempts: process.env.RETRY_ATTEMPTS
        ? parseInt(process.env.RETRY_ATTEMPTS, 10)
        : undefined,
      retryDelay: process.env.RETRY_DELAY ? parseInt(process.env.RETRY_DELAY, 10) : undefined,
    },
    server: {
      name: process.env.SERVER_NAME,
      version: process.env.SERVER_VERSION,
      environment: process.env.NODE_ENV as any,
      logLevel: process.env.LOG_LEVEL as any,
    },
    features: {
      caching: process.env.FEATURE_CACHING !== 'false',
      metrics: process.env.FEATURE_METRICS !== 'false',
      healthCheck: process.env.FEATURE_HEALTH_CHECK !== 'false',
      requestValidation: process.env.FEATURE_REQUEST_VALIDATION !== 'false',
      responseEnrichment: process.env.FEATURE_RESPONSE_ENRICHMENT !== 'false',
      circuitBreaker: process.env.FEATURE_CIRCUIT_BREAKER !== 'false',
      compression: process.env.FEATURE_COMPRESSION !== 'false',
      openApiConverter: process.env.FEATURE_OPEN_API_CONVERTER !== 'false',
      enableTelemetry: process.env.FEATURE_ENABLE_TELEMETRY !== 'false',
      websocket: process.env.FEATURE_WEBSOCKET !== 'false',
    },
    cache: {
      enabled: process.env.CACHE_ENABLED !== 'false',
      ttl: process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL, 10) : undefined,
      maxSize: process.env.CACHE_MAX_SIZE ? parseInt(process.env.CACHE_MAX_SIZE, 10) : undefined,
      strategy: process.env.CACHE_STRATEGY as any,
      backend: process.env.CACHE_BACKEND as any,
      redis: {
        enabled: process.env.REDIS_ENABLED === 'true',
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined,
        keyPrefix: process.env.REDIS_KEY_PREFIX,
        hybridL1Size: process.env.REDIS_HYBRID_L1_SIZE
          ? parseInt(process.env.REDIS_HYBRID_L1_SIZE, 10)
          : undefined,
        hybridL1TTL: process.env.REDIS_HYBRID_L1_TTL
          ? parseInt(process.env.REDIS_HYBRID_L1_TTL, 10)
          : undefined,
      },
    },
    circuitBreaker: {
      enabled: process.env.CIRCUIT_BREAKER_ENABLED !== 'false',
      threshold: process.env.CIRCUIT_BREAKER_THRESHOLD
        ? parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD, 10)
        : undefined,
      timeout: process.env.CIRCUIT_BREAKER_TIMEOUT
        ? parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT, 10)
        : undefined,
      resetTimeout: process.env.CIRCUIT_BREAKER_RESET_TIMEOUT
        ? parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT, 10)
        : undefined,
    },
    monitoring: {
      enabled: process.env.MONITORING_ENABLED !== 'false',
      metricsInterval: process.env.METRICS_INTERVAL
        ? parseInt(process.env.METRICS_INTERVAL, 10)
        : undefined,
      healthCheckInterval: process.env.HEALTH_CHECK_INTERVAL
        ? parseInt(process.env.HEALTH_CHECK_INTERVAL, 10)
        : undefined,
    },
  };

  try {
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const logger = pino({ level: 'error' });
      logger.error({ errors: error.errors }, 'Configuration validation failed');
      throw new Error(
        `Configuration validation failed: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      );
    }
    throw error;
  }
}

// Export singleton configuration
export const config = loadConfig();

// Configuration helpers
export function isProduction(): boolean {
  return config.server.environment === 'production';
}

export function isDevelopment(): boolean {
  return config.server.environment === 'development';
}

export function isFeatureEnabled(feature: keyof Config['features']): boolean {
  return config.features[feature];
}

// Export for testing
export { ConfigSchema, loadConfig };
