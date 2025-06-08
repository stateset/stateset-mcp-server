import { config } from '@config/index';
import { createLogger } from '@utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('metrics');

// Metric types
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

// Metric labels
export type Labels = Record<string, string | number>;

// Base metric interface
interface BaseMetric {
  name: string;
  type: MetricType;
  help: string;
  labels: Labels;
  timestamp: number;
}

// Counter metric
export interface CounterMetric extends BaseMetric {
  type: MetricType.COUNTER;
  value: number;
}

// Gauge metric
export interface GaugeMetric extends BaseMetric {
  type: MetricType.GAUGE;
  value: number;
}

// Histogram metric
export interface HistogramMetric extends BaseMetric {
  type: MetricType.HISTOGRAM;
  buckets: Map<number, number>;
  sum: number;
  count: number;
}

// Summary metric
export interface SummaryMetric extends BaseMetric {
  type: MetricType.SUMMARY;
  quantiles: Map<number, number>;
  sum: number;
  count: number;
}

export type Metric = CounterMetric | GaugeMetric | HistogramMetric | SummaryMetric;

// Metric aggregation
interface MetricAggregation {
  min: number;
  max: number;
  avg: number;
  sum: number;
  count: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

// Histogram implementation
class Histogram {
  private values: number[] = [];
  private buckets: number[];
  private bucketCounts: Map<number, number> = new Map();
  private sum: number = 0;
  private count: number = 0;

  constructor(buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]) {
    this.buckets = buckets.sort((a, b) => a - b);
    this.buckets.forEach(bucket => this.bucketCounts.set(bucket, 0));
  }

  observe(value: number): void {
    this.values.push(value);
    this.sum += value;
    this.count++;

    // Update buckets
    for (const bucket of this.buckets) {
      if (value <= bucket) {
        this.bucketCounts.set(bucket, (this.bucketCounts.get(bucket) || 0) + 1);
      }
    }

    // Keep only recent values for quantile calculation
    if (this.values.length > 10000) {
      this.values = this.values.slice(-10000);
    }
  }

  getBuckets(): Map<number, number> {
    return new Map(this.bucketCounts);
  }

  getQuantile(quantile: number): number {
    if (this.values.length === 0) return 0;
    
    const sorted = [...this.values].sort((a, b) => a - b);
    const index = Math.ceil(quantile * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  getSum(): number {
    return this.sum;
  }

  getCount(): number {
    return this.count;
  }

  reset(): void {
    this.values = [];
    this.sum = 0;
    this.count = 0;
    this.bucketCounts.clear();
    this.buckets.forEach(bucket => this.bucketCounts.set(bucket, 0));
  }
}

// Summary implementation
class Summary {
  private values: number[] = [];
  private sum: number = 0;
  private count: number = 0;
  private maxAge: number;
  private ageBuckets: number;

  constructor(maxAge: number = 600000, ageBuckets: number = 5) {
    this.maxAge = maxAge;
    this.ageBuckets = ageBuckets;
  }

  observe(value: number): void {
    const now = Date.now();
    this.values.push(value);
    this.sum += value;
    this.count++;

    // Remove old values
    const cutoff = now - this.maxAge;
    this.values = this.values.filter((_, index) => {
      const age = now - (now - index * 1000);
      return age < cutoff;
    });
  }

  getQuantiles(quantiles: number[]): Map<number, number> {
    const result = new Map<number, number>();
    
    if (this.values.length === 0) {
      quantiles.forEach(q => result.set(q, 0));
      return result;
    }

    const sorted = [...this.values].sort((a, b) => a - b);
    
    for (const quantile of quantiles) {
      const index = Math.ceil(quantile * sorted.length) - 1;
      result.set(quantile, sorted[Math.max(0, index)] ?? 0);
    }

    return result;
  }

  getSum(): number {
    return this.sum;
  }

  getCount(): number {
    return this.count;
  }

  reset(): void {
    this.values = [];
    this.sum = 0;
    this.count = 0;
  }
}

// Metrics collector
export class MetricsCollector extends EventEmitter {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private summaries: Map<string, Summary> = new Map();
  private metricMetadata: Map<string, { type: MetricType; help: string; labels: Labels }> = new Map();
  private collectionInterval?: NodeJS.Timeout;

  constructor() {
    super();
    
    if (config.monitoring.enabled) {
      this.startCollection();
    }
  }

  // Counter operations
  increment(name: string, value: number = 1, labels: Labels = {}): void {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    
    this.metricMetadata.set(key, {
      type: MetricType.COUNTER,
      help: `Counter for ${name}`,
      labels,
    });
  }

  // Gauge operations
  set(name: string, value: number, labels: Labels = {}): void {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
    
    this.metricMetadata.set(key, {
      type: MetricType.GAUGE,
      help: `Gauge for ${name}`,
      labels,
    });
  }

  increment_gauge(name: string, value: number = 1, labels: Labels = {}): void {
    const key = this.getKey(name, labels);
    const current = this.gauges.get(key) || 0;
    this.gauges.set(key, current + value);
  }

  decrement_gauge(name: string, value: number = 1, labels: Labels = {}): void {
    this.increment_gauge(name, -value, labels);
  }

  // Histogram operations
  observe(name: string, value: number, labels: Labels = {}): void {
    const key = this.getKey(name, labels);
    
    if (!this.histograms.has(key)) {
      this.histograms.set(key, new Histogram());
      this.metricMetadata.set(key, {
        type: MetricType.HISTOGRAM,
        help: `Histogram for ${name}`,
        labels,
      });
    }
    
    this.histograms.get(key)!.observe(value);
  }

  // Summary operations
  observe_summary(name: string, value: number, labels: Labels = {}): void {
    const key = this.getKey(name, labels);
    
    if (!this.summaries.has(key)) {
      this.summaries.set(key, new Summary());
      this.metricMetadata.set(key, {
        type: MetricType.SUMMARY,
        help: `Summary for ${name}`,
        labels,
      });
    }
    
    this.summaries.get(key)!.observe(value);
  }

  // Timer helper
  startTimer(name: string, labels: Labels = {}): () => void {
    const start = process.hrtime.bigint();
    
    return () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
      this.observe(name, duration, labels);
    };
  }

  // Get all metrics
  getMetrics(): Metric[] {
    const metrics: Metric[] = [];
    const now = Date.now();

    // Collect counters
    for (const [key, value] of this.counters.entries()) {
      const metadata = this.metricMetadata.get(key)!;
      const [name] = this.parseKey(key);
      
      metrics.push({
        name,
        type: MetricType.COUNTER,
        help: metadata.help,
        labels: metadata.labels,
        value,
        timestamp: now,
      });
    }

    // Collect gauges
    for (const [key, value] of this.gauges.entries()) {
      const metadata = this.metricMetadata.get(key)!;
      const [name] = this.parseKey(key);
      
      metrics.push({
        name,
        type: MetricType.GAUGE,
        help: metadata.help,
        labels: metadata.labels,
        value,
        timestamp: now,
      });
    }

    // Collect histograms
    for (const [key, histogram] of this.histograms.entries()) {
      const metadata = this.metricMetadata.get(key)!;
      const [name] = this.parseKey(key);
      
      metrics.push({
        name,
        type: MetricType.HISTOGRAM,
        help: metadata.help,
        labels: metadata.labels,
        buckets: histogram.getBuckets(),
        sum: histogram.getSum(),
        count: histogram.getCount(),
        timestamp: now,
      });
    }

    // Collect summaries
    for (const [key, summary] of this.summaries.entries()) {
      const metadata = this.metricMetadata.get(key)!;
      const [name] = this.parseKey(key);
      
      metrics.push({
        name,
        type: MetricType.SUMMARY,
        help: metadata.help,
        labels: metadata.labels,
        quantiles: summary.getQuantiles([0.5, 0.9, 0.95, 0.99]),
        sum: summary.getSum(),
        count: summary.getCount(),
        timestamp: now,
      });
    }

    return metrics;
  }

  // Get aggregated metrics
  getAggregatedMetrics(name: string): MetricAggregation | null {
    const histogram = Array.from(this.histograms.entries())
      .find(([key]) => this.parseKey(key)[0] === name)?.[1];

    if (!histogram) return null;

    return {
      min: histogram.getQuantile(0),
      max: histogram.getQuantile(1),
      avg: histogram.getCount() > 0 ? histogram.getSum() / histogram.getCount() : 0,
      sum: histogram.getSum(),
      count: histogram.getCount(),
      p50: histogram.getQuantile(0.5),
      p90: histogram.getQuantile(0.9),
      p95: histogram.getQuantile(0.95),
      p99: histogram.getQuantile(0.99),
    };
  }

  // Export metrics in Prometheus format
  exportPrometheus(): string {
    const lines: string[] = [];
    const metrics = this.getMetrics();

    for (const metric of metrics) {
      const labelStr = Object.entries(metric.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      const fullName = labelStr ? `${metric.name}{${labelStr}}` : metric.name;

      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      switch (metric.type) {
        case MetricType.COUNTER:
        case MetricType.GAUGE:
          lines.push(`${fullName} ${metric.value}`);
          break;

        case MetricType.HISTOGRAM:
          for (const [bucket, count] of metric.buckets.entries()) {
            lines.push(`${metric.name}_bucket{le="${bucket}"${labelStr ? ',' + labelStr : ''}} ${count}`);
          }
          lines.push(`${metric.name}_bucket{le="+Inf"${labelStr ? ',' + labelStr : ''}} ${metric.count}`);
          lines.push(`${metric.name}_sum${labelStr ? '{' + labelStr + '}' : ''} ${metric.sum}`);
          lines.push(`${metric.name}_count${labelStr ? '{' + labelStr + '}' : ''} ${metric.count}`);
          break;

        case MetricType.SUMMARY:
          for (const [quantile, value] of metric.quantiles.entries()) {
            lines.push(`${metric.name}{quantile="${quantile}"${labelStr ? ',' + labelStr : ''}} ${value}`);
          }
          lines.push(`${metric.name}_sum${labelStr ? '{' + labelStr + '}' : ''} ${metric.sum}`);
          lines.push(`${metric.name}_count${labelStr ? '{' + labelStr + '}' : ''} ${metric.count}`);
          break;
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  // Reset all metrics
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
    this.metricMetadata.clear();
  }

  // Start periodic collection
  private startCollection(): void {
    this.collectionInterval = setInterval(() => {
      const metrics = this.getMetrics();
      this.emit('collect', metrics);
      
      // Log sample metrics
      logger.debug('Metrics collected', {
        counters: this.counters.size,
        gauges: this.gauges.size,
        histograms: this.histograms.size,
        summaries: this.summaries.size,
      });
    }, config.monitoring.metricsInterval);
  }

  // Stop collection
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
    }
  }

  // Helper methods
  private getKey(name: string, labels: Labels): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return labelStr ? `${name}:${labelStr}` : name;
  }

  private parseKey(key: string): [string, Labels] {
    const parts = key.split(':');
    const name = parts[0] ?? '';
    const labels: Labels = {};

    for (let i = 1; i < parts.length; i += 2) {
      const labelKey = parts[i];
      const labelValue = parts[i + 1];
      if (labelKey && labelValue) {
        labels[labelKey] = labelValue;
      }
    }

    return [name, labels];
  }
}

// Create singleton instance
export const metrics = new MetricsCollector();

// Convenience functions
export function recordApiCall(method: string, endpoint: string, status: number, duration: number): void {
  metrics.increment('api_calls_total', 1, { method, endpoint, status });
  metrics.observe('api_call_duration_ms', duration, { method, endpoint });
  
  if (status >= 400) {
    metrics.increment('api_errors_total', 1, { method, endpoint, status });
  }
}

export function recordCacheMetrics(operation: 'hit' | 'miss', namespace: string): void {
  metrics.increment(`cache_${operation}_total`, 1, { namespace });
}

export function recordRateLimitMetrics(accepted: boolean, operation: string): void {
  metrics.increment('rate_limit_requests_total', 1, { operation, accepted: accepted.toString() });
}

// Export types
export type { MetricAggregation }; 