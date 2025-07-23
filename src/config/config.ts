import { z } from 'zod';
import dotenv from 'dotenv';
import { createLogger } from '@utils/logger';

// Load environment variables
dotenv.config();

const logger = createLogger('config');

// Configuration schema
const ConfigSchema = z.object({
  server: z.object({
    name: z.string().default('StateSet MCP Server'),
    version: z.string().default('1.0.0'),
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  }),
  api: z.object({
    key: z.string(),
    apiKey: z.string().optional(), // Legacy field for backward compatibility
    baseUrl: z.string().url().default('https://api.stateset.com'),
    timeout: z.number().default(30000),
    version: z.string().default('v1'),
  }),
  rateLimit: z.object({
    requestsPerHour: z.number().default(1000),
    requestsPerMinute: z.number().default(60),
    retryAttempts: z.number().default(3),
    retryDelay: z.number().default(1000),
    burstSize: z.number().default(10),
  }),
  cache: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().default(300),
    maxSize: z.number().default(1000),
    strategy: z.enum(['lru', 'lfu', 'fifo']).default('lru'),
  }),
  security: z.object({
    allowedOrigins: z.array(z.string()).default(['http://localhost:3000']),
    ipWhitelist: z.array(z.string()).default([]),
    enableCors: z.boolean().default(true),
    enableHelmet: z.boolean().default(true),
  }),
  features: z.object({
    enableMetrics: z.boolean().default(true),
    enableTelemetry: z.boolean().default(false),
    metrics: z.boolean().default(true),
    caching: z.boolean().default(true),
    healthCheck: z.boolean().default(true),
    requestValidation: z.boolean().default(true),
    responseEnrichment: z.boolean().default(true),
    circuitBreaker: z.boolean().default(true),
    compression: z.boolean().default(true),
  }),
  monitoring: z.object({
    healthCheck: z.object({
      endpoint: z.string().default('/health'),
      interval: z.number().default(30000),
    }),
    metrics: z.object({
      endpoint: z.string().default('/metrics'),
      enabled: z.boolean().default(true),
    }),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load and validate configuration
 */
export function loadConfig(): Config {
  const rawConfig = {
    server: {
      name: process.env.SERVER_NAME,
      version: process.env.SERVER_VERSION,
      logLevel: process.env.LOG_LEVEL,
    },
    api: {
      key: process.env.STATESET_API_KEY || process.env.API_KEY,
      apiKey: process.env.STATESET_API_KEY || process.env.API_KEY, // Backward compatibility
      baseUrl: process.env.STATESET_API_URL || process.env.API_BASE_URL,
      timeout: process.env.API_TIMEOUT ? parseInt(process.env.API_TIMEOUT, 10) : undefined,
      version: process.env.API_VERSION,
    },
    rateLimit: {
      requestsPerHour: process.env.RATE_LIMIT_REQUESTS_PER_HOUR ? parseInt(process.env.RATE_LIMIT_REQUESTS_PER_HOUR, 10) : undefined,
      requestsPerMinute: process.env.RATE_LIMIT_REQUESTS_PER_MINUTE ? parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE, 10) : undefined,
      retryAttempts: process.env.RATE_LIMIT_RETRY_ATTEMPTS ? parseInt(process.env.RATE_LIMIT_RETRY_ATTEMPTS, 10) : undefined,
      retryDelay: process.env.RATE_LIMIT_RETRY_DELAY ? parseInt(process.env.RATE_LIMIT_RETRY_DELAY, 10) : undefined,
      burstSize: process.env.RATE_LIMIT_BURST_SIZE ? parseInt(process.env.RATE_LIMIT_BURST_SIZE, 10) : undefined,
    },
    cache: {
      enabled: process.env.CACHE_ENABLED ? process.env.CACHE_ENABLED === 'true' : undefined,
      ttl: process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL, 10) : undefined,
      maxSize: process.env.CACHE_MAX_SIZE ? parseInt(process.env.CACHE_MAX_SIZE, 10) : undefined,
      strategy: process.env.CACHE_STRATEGY,
    },
    security: {
      allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : undefined,
      ipWhitelist: process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(',') : undefined,
      enableCors: process.env.ENABLE_CORS ? process.env.ENABLE_CORS === 'true' : undefined,
      enableHelmet: process.env.ENABLE_HELMET ? process.env.ENABLE_HELMET === 'true' : undefined,
    },
    features: {
      enableMetrics: process.env.ENABLE_METRICS ? process.env.ENABLE_METRICS === 'true' : undefined,
      enableTelemetry: process.env.ENABLE_TELEMETRY ? process.env.ENABLE_TELEMETRY === 'true' : undefined,
      metrics: process.env.FEATURE_METRICS ? process.env.FEATURE_METRICS === 'true' : undefined,
      caching: process.env.FEATURE_CACHING ? process.env.FEATURE_CACHING === 'true' : undefined,
      healthCheck: process.env.FEATURE_HEALTH_CHECK ? process.env.FEATURE_HEALTH_CHECK === 'true' : undefined,
      requestValidation: process.env.FEATURE_REQUEST_VALIDATION ? process.env.FEATURE_REQUEST_VALIDATION === 'true' : undefined,
      responseEnrichment: process.env.FEATURE_RESPONSE_ENRICHMENT ? process.env.FEATURE_RESPONSE_ENRICHMENT === 'true' : undefined,
      circuitBreaker: process.env.FEATURE_CIRCUIT_BREAKER ? process.env.FEATURE_CIRCUIT_BREAKER === 'true' : undefined,
      compression: process.env.FEATURE_COMPRESSION ? process.env.FEATURE_COMPRESSION === 'true' : undefined,
    },
    monitoring: {
      healthCheck: {
        endpoint: process.env.HEALTH_CHECK_ENDPOINT,
        interval: process.env.HEALTH_CHECK_INTERVAL ? parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) : undefined,
      },
      metrics: {
        endpoint: process.env.METRICS_ENDPOINT,
        enabled: process.env.METRICS_ENABLED ? process.env.METRICS_ENABLED === 'true' : undefined,
      },
    },
  };

  try {
    const config = ConfigSchema.parse(rawConfig);
    logger.info('Configuration loaded successfully');
    return config;
  } catch (error) {
    logger.fatal('Failed to load configuration', error instanceof Error ? error.message : String(error));
    throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a specific configuration value
 */
export function getConfig<T extends keyof Config>(key: T): Config[T] {
  const config = loadConfig();
  return config[key];
} 