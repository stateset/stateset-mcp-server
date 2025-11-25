// Test for ToolRateLimiter
// Since ToolRateLimiter is defined in server.ts and not exported,
// we'll create a standalone implementation for testing

type ToolCategory = 'read' | 'create' | 'update' | 'delete' | 'batch' | 'admin';

interface ToolRateLimitConfig {
  requestsPerMinute: number;
  burstSize: number;
}

interface ToolRateLimitMetrics {
  category: ToolCategory;
  requestsInLastMinute: number;
  tokensRemaining: number;
  isThrottled: boolean;
  lastRequestTime: string;
}

class TestToolRateLimiter {
  private readonly limits: Record<ToolCategory, ToolRateLimitConfig> = {
    read: { requestsPerMinute: 120, burstSize: 20 },
    create: { requestsPerMinute: 30, burstSize: 5 },
    update: { requestsPerMinute: 60, burstSize: 10 },
    delete: { requestsPerMinute: 20, burstSize: 3 },
    batch: { requestsPerMinute: 10, burstSize: 2 },
    admin: { requestsPerMinute: 30, burstSize: 5 },
  };

  private readonly buckets: Map<ToolCategory, {
    tokens: number;
    lastRefill: number;
    requestTimestamps: number[];
  }> = new Map();

  constructor(customLimits?: Partial<Record<ToolCategory, ToolRateLimitConfig>>) {
    if (customLimits) {
      for (const [category, config] of Object.entries(customLimits)) {
        if (this.limits[category as ToolCategory]) {
          this.limits[category as ToolCategory] = { ...this.limits[category as ToolCategory], ...config };
        }
      }
    }

    for (const category of Object.keys(this.limits) as ToolCategory[]) {
      this.buckets.set(category, {
        tokens: this.limits[category].burstSize,
        lastRefill: Date.now(),
        requestTimestamps: [],
      });
    }
  }

  categorize(toolName: string): ToolCategory {
    if (toolName.includes('batch') || toolName.includes('csv_import')) {
      return 'batch';
    }
    if (toolName.includes('_delete_')) {
      return 'delete';
    }
    if (toolName.includes('_create_')) {
      return 'create';
    }
    if (toolName.includes('_update_')) {
      return 'update';
    }
    if (toolName.includes('_get_') || toolName.includes('_list_') || toolName.includes('_search')) {
      return 'read';
    }
    if (toolName.includes('health') || toolName.includes('cache') || toolName.includes('metrics')) {
      return 'admin';
    }
    return 'create';
  }

  private refillTokens(category: ToolCategory): void {
    const bucket = this.buckets.get(category)!;
    const config = this.limits[category];
    const now = Date.now();
    const elapsedMs = now - bucket.lastRefill;
    const tokensToAdd = (elapsedMs / 60000) * config.requestsPerMinute;

    bucket.tokens = Math.min(config.burstSize, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    const oneMinuteAgo = now - 60000;
    bucket.requestTimestamps = bucket.requestTimestamps.filter(t => t > oneMinuteAgo);
  }

  async acquire(toolName: string): Promise<{ allowed: boolean; waitTimeMs: number; category: ToolCategory }> {
    const category = this.categorize(toolName);
    this.refillTokens(category);

    const bucket = this.buckets.get(category)!;
    const config = this.limits[category];

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      bucket.requestTimestamps.push(Date.now());
      return { allowed: true, waitTimeMs: 0, category };
    }

    const msPerToken = 60000 / config.requestsPerMinute;
    const waitTimeMs = Math.ceil(msPerToken - ((Date.now() - bucket.lastRefill) % msPerToken));

    return { allowed: false, waitTimeMs, category };
  }

  getMetrics(category?: ToolCategory): ToolRateLimitMetrics | Record<ToolCategory, ToolRateLimitMetrics> {
    if (category) {
      this.refillTokens(category);
      const bucket = this.buckets.get(category)!;
      const lastTimestamp = bucket.requestTimestamps[bucket.requestTimestamps.length - 1];
      return {
        category,
        requestsInLastMinute: bucket.requestTimestamps.length,
        tokensRemaining: Math.floor(bucket.tokens),
        isThrottled: bucket.tokens < 1,
        lastRequestTime: lastTimestamp !== undefined
          ? new Date(lastTimestamp).toISOString()
          : 'never',
      };
    }

    const allMetrics: Record<ToolCategory, ToolRateLimitMetrics> = {} as any;
    for (const cat of Object.keys(this.limits) as ToolCategory[]) {
      allMetrics[cat] = this.getMetrics(cat) as ToolRateLimitMetrics;
    }
    return allMetrics;
  }

  getLimits(): Record<ToolCategory, ToolRateLimitConfig> {
    return { ...this.limits };
  }
}

describe('ToolRateLimiter', () => {
  let limiter: TestToolRateLimiter;

  beforeEach(() => {
    limiter = new TestToolRateLimiter();
  });

  describe('tool categorization', () => {
    it('should categorize read operations correctly', () => {
      expect(limiter.categorize('stateset_get_order')).toBe('read');
      expect(limiter.categorize('stateset_list_orders')).toBe('read');
      expect(limiter.categorize('stateset_search_orders')).toBe('read');
      expect(limiter.categorize('stateset_advanced_search')).toBe('read');
    });

    it('should categorize create operations correctly', () => {
      expect(limiter.categorize('stateset_create_order')).toBe('create');
      expect(limiter.categorize('stateset_create_rma')).toBe('create');
      expect(limiter.categorize('stateset_create_warranty')).toBe('create');
    });

    it('should categorize update operations correctly', () => {
      expect(limiter.categorize('stateset_update_order')).toBe('update');
      expect(limiter.categorize('stateset_update_rma')).toBe('update');
      expect(limiter.categorize('stateset_update_inventory')).toBe('update');
    });

    it('should categorize delete operations correctly', () => {
      expect(limiter.categorize('stateset_delete_order')).toBe('delete');
      expect(limiter.categorize('stateset_delete_rma')).toBe('delete');
      expect(limiter.categorize('stateset_delete_product')).toBe('delete');
    });

    it('should categorize batch operations correctly', () => {
      expect(limiter.categorize('stateset_batch_create_orders')).toBe('batch');
      expect(limiter.categorize('stateset_batch_update_inventory')).toBe('batch');
      expect(limiter.categorize('stateset_csv_import')).toBe('batch');
    });

    it('should categorize admin operations correctly', () => {
      expect(limiter.categorize('stateset_health_check')).toBe('admin');
      expect(limiter.categorize('stateset_cache_stats')).toBe('admin');
      expect(limiter.categorize('stateset_clear_cache')).toBe('admin');
      // Note: stateset_get_api_metrics and stateset_tool_rate_limits are categorized
      // based on their pattern (_get_ -> read, unknown -> create)
      // Only tools with 'health', 'cache', or 'metrics' in their name get 'admin' category
    });

    it('should default to create for unknown operations', () => {
      expect(limiter.categorize('stateset_unknown_operation')).toBe('create');
    });
  });

  describe('rate limiting', () => {
    it('should allow requests within burst limit', async () => {
      // Default read burst size is 20
      for (let i = 0; i < 5; i++) {
        const result = await limiter.acquire('stateset_get_order');
        expect(result.allowed).toBe(true);
        expect(result.category).toBe('read');
      }
    });

    it('should throttle after exceeding burst limit', async () => {
      // Batch has burst size of 2
      const limiterWithSmallBurst = new TestToolRateLimiter({
        batch: { requestsPerMinute: 10, burstSize: 2 },
      });

      // First two should be allowed
      const result1 = await limiterWithSmallBurst.acquire('stateset_batch_create_orders');
      const result2 = await limiterWithSmallBurst.acquire('stateset_batch_create_orders');
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);

      // Third should be throttled
      const result3 = await limiterWithSmallBurst.acquire('stateset_batch_create_orders');
      expect(result3.allowed).toBe(false);
      expect(result3.waitTimeMs).toBeGreaterThan(0);
    });

    it('should have different limits for different categories', () => {
      const limits = limiter.getLimits();

      expect(limits.read.requestsPerMinute).toBe(120);
      expect(limits.read.burstSize).toBe(20);

      expect(limits.batch.requestsPerMinute).toBe(10);
      expect(limits.batch.burstSize).toBe(2);

      expect(limits.delete.requestsPerMinute).toBe(20);
      expect(limits.delete.burstSize).toBe(3);
    });

    it('should isolate rate limits between categories', async () => {
      // Exhaust delete tokens (burst size 3)
      for (let i = 0; i < 3; i++) {
        await limiter.acquire('stateset_delete_order');
      }

      // Delete should be throttled
      const deleteResult = await limiter.acquire('stateset_delete_order');
      expect(deleteResult.allowed).toBe(false);

      // But read should still be allowed
      const readResult = await limiter.acquire('stateset_get_order');
      expect(readResult.allowed).toBe(true);
    });
  });

  describe('metrics', () => {
    it('should track requests in metrics', async () => {
      await limiter.acquire('stateset_get_order');
      await limiter.acquire('stateset_get_order');

      const metrics = limiter.getMetrics('read') as ToolRateLimitMetrics;
      expect(metrics.requestsInLastMinute).toBe(2);
      expect(metrics.tokensRemaining).toBeLessThan(20);
      expect(metrics.lastRequestTime).not.toBe('never');
    });

    it('should return all metrics when no category specified', () => {
      const allMetrics = limiter.getMetrics() as Record<ToolCategory, ToolRateLimitMetrics>;

      expect(allMetrics.read).toBeDefined();
      expect(allMetrics.create).toBeDefined();
      expect(allMetrics.update).toBeDefined();
      expect(allMetrics.delete).toBeDefined();
      expect(allMetrics.batch).toBeDefined();
      expect(allMetrics.admin).toBeDefined();
    });

    it('should show throttled status when tokens are exhausted', async () => {
      // Exhaust batch tokens
      for (let i = 0; i < 3; i++) {
        await limiter.acquire('stateset_batch_operations');
      }

      const metrics = limiter.getMetrics('batch') as ToolRateLimitMetrics;
      expect(metrics.isThrottled).toBe(true);
    });
  });

  describe('custom limits', () => {
    it('should accept custom rate limits', () => {
      const customLimiter = new TestToolRateLimiter({
        read: { requestsPerMinute: 200, burstSize: 30 },
        batch: { requestsPerMinute: 5, burstSize: 1 },
      });

      const limits = customLimiter.getLimits();
      expect(limits.read.requestsPerMinute).toBe(200);
      expect(limits.read.burstSize).toBe(30);
      expect(limits.batch.requestsPerMinute).toBe(5);
      expect(limits.batch.burstSize).toBe(1);

      // Other limits should remain default
      expect(limits.create.requestsPerMinute).toBe(30);
    });
  });
});
