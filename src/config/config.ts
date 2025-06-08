import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration schema
const ConfigSchema = z.object({
  // API Configuration
  api: z.object({
    key: z.string().min(1, 'STATESET_API_KEY is required'),
    baseUrl: z.string().url().default('https://api.stateset.io/v1'),
    timeout: z.number().positive().default(10000),
  }),
  
  // Rate limiting configuration
  rateLimit: z.object({
    requestsPerHour: z.number().positive().default(1000),
    retryAttempts: z.number().positive().default(3),
    retryDelay: z.number().positive().default(1000),
  }),
  
  // Server configuration
  server: z.object({
    name: z.string().default('stateset-mcp-server'),
    version: z.string().default('1.0.0'),
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  }),
  
  // Feature flags
  features: z.object({
    enableMetrics: z.boolean().default(true),
    enableHealthCheck: z.boolean().default(true),
    enableRequestLogging: z.boolean().default(true),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  const rawConfig = {
    api: {
      key: process.env.STATESET_API_KEY,
      baseUrl: process.env.STATESET_BASE_URL,
      timeout: process.env.API_TIMEOUT_MS ? parseInt(process.env.API_TIMEOUT_MS, 10) : undefined,
    },
    rateLimit: {
      requestsPerHour: process.env.REQUESTS_PER_HOUR ? parseInt(process.env.REQUESTS_PER_HOUR, 10) : undefined,
      retryAttempts: process.env.RETRY_ATTEMPTS ? parseInt(process.env.RETRY_ATTEMPTS, 10) : undefined,
      retryDelay: process.env.RETRY_DELAY_MS ? parseInt(process.env.RETRY_DELAY_MS, 10) : undefined,
    },
    server: {
      name: process.env.SERVER_NAME,
      version: process.env.SERVER_VERSION,
      logLevel: process.env.LOG_LEVEL,
    },
    features: {
      enableMetrics: process.env.ENABLE_METRICS === 'true',
      enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== 'false',
      enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
    },
  };

  try {
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('\n');
      throw new Error(`Configuration validation failed:\n${issues}`);
    }
    throw error;
  }
}

/**
 * Get a specific configuration value
 */
export function getConfig<T extends keyof Config>(key: T): Config[T] {
  const config = loadConfig();
  return config[key];
} 