import { loadConfig } from '@config/config';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear environment variables
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should throw error when API key is missing', () => {
      delete process.env.STATESET_API_KEY;
      delete process.env.API_KEY;
      
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });

    it('should load config with minimal required environment variables', () => {
      process.env.STATESET_API_KEY = 'test_api_key';
      
      const config = loadConfig();
      
      expect(config).toBeDefined();
      expect(config.api.key).toBe('test_api_key');
      expect(config.api.baseUrl).toBe('https://api.stateset.com');
      expect(config.features.enableMetrics).toBe(true);
      expect(config.rateLimit.requestsPerHour).toBe(1000);
    });

    it('should use default values when optional env vars are not set', () => {
      process.env.STATESET_API_KEY = 'test_key';
      
      const config = loadConfig();
      
      expect(config.server.name).toBe('StateSet MCP Server');
      expect(config.server.version).toBe('1.0.0');
      expect(config.server.logLevel).toBe('info');
      expect(config.cache.enabled).toBe(true);
      expect(config.cache.strategy).toBe('lru');
      expect(config.security.enableCors).toBe(true);
    });

    it('should override defaults with environment variables', () => {
      process.env.STATESET_API_KEY = 'test_key';
      process.env.LOG_LEVEL = 'debug';
      process.env.CACHE_STRATEGY = 'lfu';
      process.env.RATE_LIMIT_REQUESTS_PER_HOUR = '2000';
      process.env.ENABLE_METRICS = 'false';
      
      const config = loadConfig();
      
      expect(config.server.logLevel).toBe('debug');
      expect(config.cache.strategy).toBe('lfu');
      expect(config.rateLimit.requestsPerHour).toBe(2000);
      expect(config.features.enableMetrics).toBe(false);
    });

    it('should validate and parse comma-separated values', () => {
      process.env.STATESET_API_KEY = 'test_key';
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://app.example.com';
      process.env.IP_WHITELIST = '127.0.0.1,192.168.1.0/24';
      
      const config = loadConfig();
      
      expect(config.security.allowedOrigins).toEqual([
        'http://localhost:3000',
        'https://app.example.com'
      ]);
      expect(config.security.ipWhitelist).toEqual([
        '127.0.0.1',
        '192.168.1.0/24'
      ]);
    });

    it('should handle boolean environment variables correctly', () => {
      process.env.STATESET_API_KEY = 'test_key';
      process.env.CACHE_ENABLED = 'false';
      process.env.ENABLE_CORS = 'true';
      process.env.FEATURE_CACHING = 'false';
      
      const config = loadConfig();
      
      expect(config.cache.enabled).toBe(false);
      expect(config.security.enableCors).toBe(true);
      expect(config.features.caching).toBe(false);
    });

    it('should validate enum values', () => {
      process.env.STATESET_API_KEY = 'test_key';
      process.env.CACHE_STRATEGY = 'invalid_strategy';
      
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });

    it('should validate numeric ranges', () => {
      process.env.STATESET_API_KEY = 'test_key';
      process.env.API_TIMEOUT = '-1000';
      
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });

    it('should support backward compatibility with old env var names', () => {
      process.env.API_KEY = 'legacy_key'; // Old name
      process.env.API_BASE_URL = 'https://legacy.api.com'; // Old name
      
      const config = loadConfig();
      
      expect(config.api.key).toBe('legacy_key');
      expect(config.api.apiKey).toBe('legacy_key'); // Backward compatibility field
      expect(config.api.baseUrl).toBe('https://legacy.api.com');
    });
  });
});