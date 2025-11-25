import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { logger } from '../utils/logger';

interface MetricPoint {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

interface Histogram {
  buckets: Map<number, number>;
  count: number;
  sum: number;
}

interface MetricSnapshot {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number | Histogram;
  timestamp: number;
  labels?: Record<string, string>;
}

interface AlertRule {
  id: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  duration: number; // milliseconds
  enabled: boolean;
  callback?: (metric: MetricSnapshot) => void;
}

interface PerformanceProfile {
  function: string;
  calls: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  lastCalled: number;
}

export class AdvancedMetrics extends EventEmitter {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, Histogram>();
  private timeSeries = new Map<string, MetricPoint[]>();
  private alerts = new Map<string, AlertRule>();
  private alertStates = new Map<string, { triggered: boolean; since: number }>();
  private performanceProfiles = new Map<string, PerformanceProfile>();
  
  private collectionInterval: NodeJS.Timeout | null = null;
  private alertCheckInterval: NodeJS.Timeout | null = null;
  private systemMetricsInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    this.startCollection();
    this.startAlertChecking();
    this.startSystemMetrics();
    
    logger.info('Advanced metrics system initialized');
  }

  // Counter operations
  incrementCounter(name: string, value = 1, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
    this.addToTimeSeries(name, value, labels);
    this.emit('counterUpdate', { name, value, labels });
  }

  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.getMetricKey(name, labels);
    return this.counters.get(key) || 0;
  }

  // Gauge operations
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, value);
    this.addToTimeSeries(name, value, labels);
    this.emit('gaugeUpdate', { name, value, labels });
  }

  incrementGauge(name: string, value = 1, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const current = this.gauges.get(key) || 0;
    this.setGauge(name, current + value, labels);
  }

  decrementGauge(name: string, value = 1, labels?: Record<string, string>): void {
    this.incrementGauge(name, -value, labels);
  }

  getGauge(name: string, labels?: Record<string, string>): number {
    const key = this.getMetricKey(name, labels);
    return this.gauges.get(key) || 0;
  }

  // Histogram operations
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    let histogram = this.histograms.get(key);
    
    if (!histogram) {
      histogram = {
        buckets: new Map(),
        count: 0,
        sum: 0,
      };
      this.histograms.set(key, histogram);
    }

    // Define standard buckets
    const buckets = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, Infinity];
    
    histogram.count++;
    histogram.sum += value;

    for (const bucket of buckets) {
      if (value <= bucket) {
        histogram.buckets.set(bucket, (histogram.buckets.get(bucket) || 0) + 1);
      }
    }

    this.addToTimeSeries(name, value, labels);
    this.emit('histogramUpdate', { name, value, labels });
  }

  getHistogram(name: string, labels?: Record<string, string>): Histogram | undefined {
    const key = this.getMetricKey(name, labels);
    return this.histograms.get(key);
  }

  // Performance profiling
  profile<T>(functionName: string, fn: () => T): T;
  profile<T>(functionName: string, fn: () => Promise<T>): Promise<T>;
  profile<T>(functionName: string, fn: () => T | Promise<T>): T | Promise<T> {
    const start = performance.now();
    
    const updateProfile = (duration: number) => {
      let profile = this.performanceProfiles.get(functionName);
      
      if (!profile) {
        profile = {
          function: functionName,
          calls: 0,
          totalTime: 0,
          averageTime: 0,
          minTime: Infinity,
          maxTime: 0,
          lastCalled: Date.now(),
        };
        this.performanceProfiles.set(functionName, profile);
      }

      profile.calls++;
      profile.totalTime += duration;
      profile.averageTime = profile.totalTime / profile.calls;
      profile.minTime = Math.min(profile.minTime, duration);
      profile.maxTime = Math.max(profile.maxTime, duration);
      profile.lastCalled = Date.now();

      this.recordHistogram('function_duration_ms', duration, { function: functionName });
      this.incrementCounter('function_calls_total', 1, { function: functionName });
    };

    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result
          .then((value) => {
            const duration = performance.now() - start;
            updateProfile(duration);
            return value;
          })
          .catch((error) => {
            const duration = performance.now() - start;
            updateProfile(duration);
            this.incrementCounter('function_errors_total', 1, { function: functionName });
            throw error;
          }) as T | Promise<T>;
      } else {
        const duration = performance.now() - start;
        updateProfile(duration);
        return result;
      }
    } catch (error) {
      const duration = performance.now() - start;
      updateProfile(duration);
      this.incrementCounter('function_errors_total', 1, { function: functionName });
      throw error;
    }
  }

  // Timing utilities
  startTimer(name: string, labels?: Record<string, string>): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.recordHistogram(name, duration / 1000, labels); // Convert to seconds
    };
  }

  // Time series queries
  getTimeSeries(name: string, since?: number): MetricPoint[] {
    const series = this.timeSeries.get(name) || [];
    
    if (since) {
      return series.filter(point => point.timestamp >= since);
    }
    
    return [...series];
  }

  // Aggregation functions
  getAverageOverTime(name: string, windowMs: number): number {
    const now = Date.now();
    const since = now - windowMs;
    const points = this.getTimeSeries(name, since);
    
    if (points.length === 0) return 0;
    
    const sum = points.reduce((acc, point) => acc + point.value, 0);
    return sum / points.length;
  }

  getMaxOverTime(name: string, windowMs: number): number {
    const now = Date.now();
    const since = now - windowMs;
    const points = this.getTimeSeries(name, since);
    
    if (points.length === 0) return 0;
    
    return Math.max(...points.map(p => p.value));
  }

  getPercentile(name: string, percentile: number, windowMs?: number): number {
    let points = this.getTimeSeries(name);
    
    if (windowMs) {
      const since = Date.now() - windowMs;
      points = points.filter(p => p.timestamp >= since);
    }
    
    if (points.length === 0) return 0;
    
    const values = points.map(p => p.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    
    return values[Math.max(0, index)] ?? 0;
  }

  // Alert management
  addAlert(rule: AlertRule): void {
    this.alerts.set(rule.id, rule);
    this.alertStates.set(rule.id, { triggered: false, since: 0 });
    logger.info('Alert rule added', { id: rule.id, metric: rule.metric });
  }

  removeAlert(id: string): void {
    this.alerts.delete(id);
    this.alertStates.delete(id);
    logger.info('Alert rule removed', { id });
  }

  // System metrics collection
  private startSystemMetrics(): void {
    this.systemMetricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 10000); // Every 10 seconds
  }

  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Memory metrics
    this.setGauge('process_memory_rss_bytes', memUsage.rss);
    this.setGauge('process_memory_heap_used_bytes', memUsage.heapUsed);
    this.setGauge('process_memory_heap_total_bytes', memUsage.heapTotal);
    this.setGauge('process_memory_external_bytes', memUsage.external);
    
    // CPU metrics
    this.setGauge('process_cpu_user_seconds_total', cpuUsage.user / 1000000);
    this.setGauge('process_cpu_system_seconds_total', cpuUsage.system / 1000000);
    
    // Event loop lag
    const start = performance.now();
    setImmediate(() => {
      const lag = performance.now() - start;
      this.recordHistogram('event_loop_lag_seconds', lag / 1000);
    });
    
    // GC metrics if available
    if (global.gc) {
      const beforeGC = process.memoryUsage();
      global.gc();
      const afterGC = process.memoryUsage();
      
      this.incrementCounter('gc_runs_total');
      this.setGauge('gc_memory_freed_bytes', beforeGC.heapUsed - afterGC.heapUsed);
    }
  }

  private startCollection(): void {
    this.collectionInterval = setInterval(() => {
      this.cleanupOldData();
    }, 300000); // Every 5 minutes
  }

  private startAlertChecking(): void {
    this.alertCheckInterval = setInterval(() => {
      this.checkAlerts();
    }, 5000); // Every 5 seconds
  }

  private checkAlerts(): void {
    for (const [id, rule] of this.alerts) {
      if (!rule.enabled) continue;
      
      const snapshot = this.getMetricSnapshot(rule.metric);
      if (!snapshot) continue;
      
      const value = typeof snapshot.value === 'number' ? snapshot.value : 0;
      const shouldTrigger = this.evaluateCondition(value, rule.condition, rule.threshold);
      
      const state = this.alertStates.get(id)!;
      const now = Date.now();
      
      if (shouldTrigger && !state.triggered) {
        state.triggered = true;
        state.since = now;
      } else if (!shouldTrigger && state.triggered) {
        state.triggered = false;
        state.since = 0;
      }
      
      // Check if alert should fire
      if (state.triggered && (now - state.since) >= rule.duration) {
        this.fireAlert(rule, snapshot);
      }
    }
  }

  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  private fireAlert(rule: AlertRule, snapshot: MetricSnapshot): void {
    logger.warn('Alert triggered', { 
      id: rule.id, 
      metric: rule.metric, 
      value: snapshot.value,
      threshold: rule.threshold 
    });
    
    this.emit('alert', { rule, snapshot });
    
    if (rule.callback) {
      try {
        rule.callback(snapshot);
      } catch (error) {
        logger.error('Alert callback failed', { id: rule.id, error });
      }
    }
  }

  private getMetricSnapshot(name: string): MetricSnapshot | undefined {
    // Try different metric types
    if (this.counters.has(name)) {
      return {
        name,
        type: 'counter',
        value: this.counters.get(name)!,
        timestamp: Date.now(),
      };
    }
    
    if (this.gauges.has(name)) {
      return {
        name,
        type: 'gauge',
        value: this.gauges.get(name)!,
        timestamp: Date.now(),
      };
    }
    
    if (this.histograms.has(name)) {
      return {
        name,
        type: 'histogram',
        value: this.histograms.get(name)!,
        timestamp: Date.now(),
      };
    }
    
    return undefined;
  }

  private cleanupOldData(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = Date.now() - maxAge;
    
    for (const [name, points] of this.timeSeries) {
      const filtered = points.filter(point => point.timestamp > cutoff);
      this.timeSeries.set(name, filtered);
    }
  }

  private addToTimeSeries(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.timeSeries.has(name)) {
      this.timeSeries.set(name, []);
    }
    
    const series = this.timeSeries.get(name)!;
    series.push({
      value,
      timestamp: Date.now(),
      labels,
    });
    
    // Keep only recent data (last 1000 points)
    if (series.length > 1000) {
      series.splice(0, series.length - 1000);
    }
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return `${name}{${labelString}}`;
  }

  // Export methods
  getAllMetrics(): MetricSnapshot[] {
    const snapshots: MetricSnapshot[] = [];
    
    // Counters
    for (const [key, value] of this.counters) {
      snapshots.push({
        name: key,
        type: 'counter',
        value,
        timestamp: Date.now(),
      });
    }
    
    // Gauges
    for (const [key, value] of this.gauges) {
      snapshots.push({
        name: key,
        type: 'gauge',
        value,
        timestamp: Date.now(),
      });
    }
    
    // Histograms
    for (const [key, value] of this.histograms) {
      snapshots.push({
        name: key,
        type: 'histogram',
        value,
        timestamp: Date.now(),
      });
    }
    
    return snapshots;
  }

  getPerformanceProfiles(): PerformanceProfile[] {
    return Array.from(this.performanceProfiles.values());
  }

  exportPrometheus(): string {
    const lines: string[] = [];
    
    // Export counters
    for (const [key, value] of this.counters) {
      lines.push(`# TYPE ${key} counter`);
      lines.push(`${key} ${value}`);
    }
    
    // Export gauges
    for (const [key, value] of this.gauges) {
      lines.push(`# TYPE ${key} gauge`);
      lines.push(`${key} ${value}`);
    }
    
    // Export histograms
    for (const [key, histogram] of this.histograms) {
      lines.push(`# TYPE ${key} histogram`);
      
      for (const [bucket, count] of histogram.buckets) {
        const bucketLabel = bucket === Infinity ? '+Inf' : bucket.toString();
        lines.push(`${key}_bucket{le="${bucketLabel}"} ${count}`);
      }
      
      lines.push(`${key}_count ${histogram.count}`);
      lines.push(`${key}_sum ${histogram.sum}`);
    }
    
    return lines.join('\n');
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timeSeries.clear();
    this.performanceProfiles.clear();
    
    logger.info('Metrics reset');
  }

  destroy(): void {
    if (this.collectionInterval) clearInterval(this.collectionInterval);
    if (this.alertCheckInterval) clearInterval(this.alertCheckInterval);
    if (this.systemMetricsInterval) clearInterval(this.systemMetricsInterval);
    
    this.removeAllListeners();
    logger.info('Advanced metrics system destroyed');
  }
}
