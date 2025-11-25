import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';
import { logger } from '../utils/logger';
import { AdvancedMetrics } from './advanced-metrics';

interface MemoryProfile {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

interface GCStats {
  type: string;
  duration: number;
  before: MemoryProfile;
  after: MemoryProfile;
  freedMemory: number;
}

interface PerformanceProfile {
  cpu: {
    user: number;
    system: number;
    usage: number;
  };
  memory: MemoryProfile;
  eventLoop: {
    lag: number;
    utilization: number;
  };
  handles: {
    active: number;
    refs: number;
  };
}

interface OptimizationConfig {
  enableGCOptimization: boolean;
  enableMemoryCompaction: boolean;
  enableObjectPooling: boolean;
  gcThresholdMB: number;
  memoryWarningThresholdMB: number;
  eventLoopLagThresholdMs: number;
  optimizationInterval: number;
}

export class PerformanceOptimizer extends EventEmitter {
  private config: OptimizationConfig;
  private metrics: AdvancedMetrics;
  private performanceObserver: PerformanceObserver | null = null;
  private gcObserver: PerformanceObserver | null = null;
  private optimizationInterval: NodeJS.Timeout | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private objectPools = new Map<string, any[]>();
  private lastCpuUsage = process.cpuUsage();
  private lastCpuTime = Date.now();

  constructor(config: Partial<OptimizationConfig> = {}, metrics?: AdvancedMetrics) {
    super();

    this.config = {
      enableGCOptimization: true,
      enableMemoryCompaction: true,
      enableObjectPooling: true,
      gcThresholdMB: 100,
      memoryWarningThresholdMB: 500,
      eventLoopLagThresholdMs: 50,
      optimizationInterval: 60000, // 1 minute
      ...config,
    };

    this.metrics = metrics || new AdvancedMetrics();

    this.setupPerformanceObservers();
    this.startOptimization();
    this.startMonitoring();

    logger.info('Performance optimizer initialized', { config: this.config });
  }

  private setupPerformanceObservers(): void {
    // General performance observer
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        this.handlePerformanceEntry(entry);
      }
    });

    this.performanceObserver.observe({
      entryTypes: ['measure', 'resource', 'function'],
    });

    // GC observer
    this.gcObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        this.handleGCEntry(entry);
      }
    });

    this.gcObserver.observe({ entryTypes: ['gc'] });
  }

  private handlePerformanceEntry(entry: globalThis.PerformanceEntry): void {
    this.metrics.recordHistogram('performance_entry_duration', entry.duration, {
      entryType: entry.entryType,
      name: entry.name,
    });

    // Detect slow operations
    if (entry.duration > 100) {
      // > 100ms
      logger.warn('Slow performance entry detected', {
        name: entry.name,
        type: entry.entryType,
        duration: entry.duration,
      });

      this.metrics.incrementCounter('performance_slow_operations', 1, {
        entryType: entry.entryType,
      });
    }
  }

  private handleGCEntry(entry: globalThis.PerformanceEntry): void {
    const gcEntry = entry as any; // GC entries have additional properties

    const gcStats: GCStats = {
      type: gcEntry.kind || 'unknown',
      duration: entry.duration,
      before: this.getMemoryProfile(),
      after: this.getMemoryProfile(),
      freedMemory: 0,
    };

    gcStats.freedMemory = gcStats.before.heapUsed - gcStats.after.heapUsed;

    this.metrics.recordHistogram('gc_duration_ms', entry.duration, {
      type: gcStats.type,
    });

    this.metrics.setGauge('gc_freed_memory_bytes', gcStats.freedMemory);

    logger.debug('GC event', gcStats);

    // Trigger optimization if GC is frequent or slow
    if (entry.duration > 50) {
      // > 50ms
      this.triggerOptimization('slow_gc');
    }

    this.emit('gc', gcStats);
  }

  private startOptimization(): void {
    this.optimizationInterval = setInterval(() => {
      this.performOptimization();
    }, this.config.optimizationInterval);
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkPerformanceThresholds();
    }, 10000); // Every 10 seconds
  }

  private async performOptimization(): Promise<void> {
    logger.debug('Starting performance optimization cycle');

    const beforeProfile = this.getPerformanceProfile();

    try {
      // Memory optimization
      if (this.config.enableMemoryCompaction) {
        await this.optimizeMemory();
      }

      // GC optimization
      if (this.config.enableGCOptimization) {
        this.optimizeGarbageCollection();
      }

      // Object pool cleanup
      if (this.config.enableObjectPooling) {
        this.cleanupObjectPools();
      }

      const afterProfile = this.getPerformanceProfile();

      this.logOptimizationResults(beforeProfile, afterProfile);
    } catch (error) {
      logger.error('Performance optimization failed', { error });
      this.metrics.incrementCounter('performance_optimization_errors');
    }
  }

  private async optimizeMemory(): Promise<void> {
    const memoryUsage = process.memoryUsage();

    // Force GC if memory usage is high
    if (global.gc && memoryUsage.heapUsed > this.config.gcThresholdMB * 1024 * 1024) {
      logger.info('Triggering manual garbage collection', {
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      });

      const beforeGC = process.memoryUsage();
      global.gc();
      const afterGC = process.memoryUsage();

      const freedMemory = beforeGC.heapUsed - afterGC.heapUsed;

      this.metrics.incrementCounter('manual_gc_triggers');
      this.metrics.setGauge('manual_gc_freed_bytes', freedMemory);

      logger.info('Manual GC completed', {
        freedMemoryMB: Math.round(freedMemory / 1024 / 1024),
      });
    }

    // Clear internal caches if memory pressure is high
    if (memoryUsage.heapUsed > this.config.memoryWarningThresholdMB * 1024 * 1024) {
      this.emit('memoryPressure', { memoryUsage });
      logger.warn('High memory usage detected', {
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        thresholdMB: this.config.memoryWarningThresholdMB,
      });
    }
  }

  private optimizeGarbageCollection(): void {
    // Tune GC settings if available
    if (process.env.NODE_ENV === 'production') {
      // These would be set via Node.js flags in production:
      // --max-old-space-size=4096
      // --gc-interval=100
      // --optimize-for-size
    }
  }

  private cleanupObjectPools(): void {
    let totalCleaned = 0;

    for (const [, pool] of this.objectPools) {
      const initialSize = pool.length;

      // Keep only a reasonable number of objects in each pool
      const maxPoolSize = 100;
      if (pool.length > maxPoolSize) {
        pool.splice(maxPoolSize);
        totalCleaned += initialSize - maxPoolSize;
      }
    }

    if (totalCleaned > 0) {
      logger.debug('Object pools cleaned up', { objectsRemoved: totalCleaned });
      this.metrics.incrementCounter('object_pool_cleanups', totalCleaned);
    }
  }

  private collectMetrics(): void {
    const profile = this.getPerformanceProfile();

    // Memory metrics
    this.metrics.setGauge('process_memory_heap_used_bytes', profile.memory.heapUsed);
    this.metrics.setGauge('process_memory_heap_total_bytes', profile.memory.heapTotal);
    this.metrics.setGauge('process_memory_external_bytes', profile.memory.external);
    this.metrics.setGauge('process_memory_rss_bytes', profile.memory.rss);

    // CPU metrics
    this.metrics.setGauge('process_cpu_usage_percent', profile.cpu.usage * 100);
    this.metrics.setGauge('process_cpu_user_seconds', profile.cpu.user / 1000000);
    this.metrics.setGauge('process_cpu_system_seconds', profile.cpu.system / 1000000);

    // Event loop metrics
    this.metrics.recordHistogram('event_loop_lag_seconds', profile.eventLoop.lag / 1000);
    this.metrics.setGauge('event_loop_utilization_percent', profile.eventLoop.utilization * 100);

    // Handle metrics
    this.metrics.setGauge('process_active_handles', profile.handles.active);
  }

  private checkPerformanceThresholds(): void {
    const profile = this.getPerformanceProfile();

    // Check event loop lag
    if (profile.eventLoop.lag > this.config.eventLoopLagThresholdMs) {
      logger.warn('High event loop lag detected', {
        lagMs: profile.eventLoop.lag,
        thresholdMs: this.config.eventLoopLagThresholdMs,
      });

      this.metrics.incrementCounter('performance_threshold_violations', 1, {
        type: 'event_loop_lag',
      });

      this.emit('performanceIssue', {
        type: 'event_loop_lag',
        value: profile.eventLoop.lag,
        threshold: this.config.eventLoopLagThresholdMs,
      });
    }

    // Check memory usage
    const memoryUsageMB = profile.memory.heapUsed / 1024 / 1024;
    if (memoryUsageMB > this.config.memoryWarningThresholdMB) {
      this.metrics.incrementCounter('performance_threshold_violations', 1, {
        type: 'memory_usage',
      });

      this.emit('performanceIssue', {
        type: 'memory_usage',
        value: memoryUsageMB,
        threshold: this.config.memoryWarningThresholdMB,
      });
    }
  }

  private async measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = performance.now();
      setImmediate(() => {
        const lag = performance.now() - start;
        resolve(lag);
      });
    });
  }

  // Public method to get event loop lag measurement
  public async getEventLoopLag(): Promise<number> {
    return this.measureEventLoopLag();
  }

  private getEventLoopUtilization(): number {
    // This is a simplified calculation
    // In practice, you'd use perf_hooks.eventLoopUtilization()
    return process.uptime() > 0 ? Math.random() * 0.1 : 0; // Placeholder
  }

  private getActiveHandles(): number {
    return (process as any)._getActiveHandles?.()?.length || 0;
  }

  private getMemoryProfile(): MemoryProfile {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers,
    };
  }

  private getPerformanceProfile(): PerformanceProfile {
    const currentCpuUsage = process.cpuUsage();
    const currentTime = Date.now();

    const cpuDelta = process.cpuUsage(this.lastCpuUsage);
    const timeDelta = currentTime - this.lastCpuTime;

    const cpuUsage = timeDelta > 0 ? (cpuDelta.user + cpuDelta.system) / (timeDelta * 1000) : 0;

    this.lastCpuUsage = currentCpuUsage;
    this.lastCpuTime = currentTime;

    return {
      cpu: {
        user: currentCpuUsage.user,
        system: currentCpuUsage.system,
        usage: cpuUsage,
      },
      memory: this.getMemoryProfile(),
      eventLoop: {
        lag: 0, // Would be measured asynchronously
        utilization: this.getEventLoopUtilization(),
      },
      handles: {
        active: this.getActiveHandles(),
        refs: 0, // Placeholder
      },
    };
  }

  private logOptimizationResults(before: PerformanceProfile, after: PerformanceProfile): void {
    const memoryDiff = before.memory.heapUsed - after.memory.heapUsed;
    const cpuDiff = after.cpu.usage - before.cpu.usage;

    logger.info('Performance optimization completed', {
      memoryFreedMB: Math.round(memoryDiff / 1024 / 1024),
      cpuUsageChange: Math.round(cpuDiff * 100 * 100) / 100, // Percentage
      eventLoopLagMs: after.eventLoop.lag,
    });

    this.metrics.recordHistogram('optimization_memory_freed_bytes', memoryDiff);
    this.metrics.recordHistogram('optimization_cpu_change_percent', cpuDiff * 100);
  }

  // Object pooling utilities
  getFromPool<T>(poolName: string, factory: () => T): T {
    if (!this.config.enableObjectPooling) {
      return factory();
    }

    if (!this.objectPools.has(poolName)) {
      this.objectPools.set(poolName, []);
    }

    const pool = this.objectPools.get(poolName)!;

    if (pool.length > 0) {
      this.metrics.incrementCounter('object_pool_hits', 1, { pool: poolName });
      return pool.pop();
    }

    this.metrics.incrementCounter('object_pool_misses', 1, { pool: poolName });
    return factory();
  }

  returnToPool<T>(poolName: string, object: T): void {
    if (!this.config.enableObjectPooling) {
      return;
    }

    if (!this.objectPools.has(poolName)) {
      this.objectPools.set(poolName, []);
    }

    const pool = this.objectPools.get(poolName)!;

    // Limit pool size to prevent memory leaks
    if (pool.length < 50) {
      pool.push(object);
      this.metrics.incrementCounter('object_pool_returns', 1, { pool: poolName });
    }
  }

  // Manual optimization triggers
  triggerOptimization(reason: string): void {
    logger.info('Manual optimization triggered', { reason });
    this.metrics.incrementCounter('manual_optimization_triggers', 1, { reason });

    // Run optimization in next tick to avoid blocking
    setImmediate(() => {
      this.performOptimization();
    });
  }

  // Profiling utilities
  async profileFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const markStart = `${name}-start`;
    const markEnd = `${name}-end`;
    const measureName = `${name}-duration`;

    performance.mark(markStart);

    try {
      const result = await fn();
      performance.mark(markEnd);
      performance.measure(measureName, markStart, markEnd);

      const duration = performance.now() - start;
      this.metrics.recordHistogram('profiled_function_duration_ms', duration, {
        function: name,
      });

      return result;
    } catch (error) {
      performance.mark(markEnd);
      performance.measure(measureName, markStart, markEnd);

      this.metrics.incrementCounter('profiled_function_errors', 1, {
        function: name,
      });

      throw error;
    } finally {
      // Clean up marks to prevent memory leaks
      performance.clearMarks(markStart);
      performance.clearMarks(markEnd);
      performance.clearMeasures(measureName);
    }
  }

  // Statistics
  getOptimizationStats(): {
    memoryUsage: MemoryProfile;
    performanceProfile: PerformanceProfile;
    objectPools: Array<{ name: string; size: number }>;
    optimizationCount: number;
  } {
    return {
      memoryUsage: this.getMemoryProfile(),
      performanceProfile: this.getPerformanceProfile(),
      objectPools: Array.from(this.objectPools.entries()).map(([name, pool]) => ({
        name,
        size: pool.length,
      })),
      optimizationCount: this.metrics.getCounter('manual_optimization_triggers') || 0,
    };
  }

  destroy(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    if (this.gcObserver) {
      this.gcObserver.disconnect();
    }

    this.objectPools.clear();
    this.removeAllListeners();

    logger.info('Performance optimizer destroyed');
  }
}
