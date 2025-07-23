import { createLogger } from '@utils/logger';
import type { Config } from '@config/config';

const logger = createLogger('metrics');

// Metric types
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TIMER = 'timer',
}

// Metric interface
export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
  help?: string;
}

// Histogram bucket
export interface HistogramBucket {
  le: number;
  count: number;
}

// Timer interface
export interface Timer {
  start: number;
  end?: number;
  duration?: number;
}

export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();
  private timers: Map<string, Timer> = new Map();
  private enabled: boolean = true;
  private interval?: NodeJS.Timeout;

  constructor(config?: Config) {
    this.enabled = config?.features?.enableMetrics ?? true;
    
    if (this.enabled) {
      logger.info('Metrics collection enabled');
      this.initializeDefaultMetrics();
    }
  }

  start(): void {
    if (!this.enabled) return;

    // Collect system metrics every 30 seconds
    this.interval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    logger.info('Metrics collector started');
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }

    logger.info('Metrics collector stopped');
  }

  // Counter metrics
  incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    if (!this.enabled) return;

    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key);

    if (existing && existing.type === MetricType.COUNTER) {
      existing.value += value;
      existing.timestamp = Date.now();
    } else {
      this.metrics.set(key, {
        name,
        type: MetricType.COUNTER,
        value,
        labels,
        timestamp: Date.now(),
        help: `Counter for ${name}`,
      });
    }
  }

  // Gauge metrics
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.enabled) return;

    const key = this.getMetricKey(name, labels);
    this.metrics.set(key, {
      name,
      type: MetricType.GAUGE,
      value,
      labels,
      timestamp: Date.now(),
      help: `Gauge for ${name}`,
    });
  }

  // Histogram metrics
  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.enabled) return;

    // For simplicity, we'll just track the average
    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key);

    if (existing && existing.type === MetricType.HISTOGRAM) {
      // Simple moving average
      existing.value = (existing.value + value) / 2;
      existing.timestamp = Date.now();
    } else {
      this.metrics.set(key, {
        name,
        type: MetricType.HISTOGRAM,
        value,
        labels,
        timestamp: Date.now(),
        help: `Histogram for ${name}`,
      });
    }
  }

  // Timer metrics
  startTimer(name: string, labels: Record<string, string> = {}): string {
    if (!this.enabled) return '';

    const timerId = `${name}:${JSON.stringify(labels)}:${Date.now()}`;
    this.timers.set(timerId, {
      start: Date.now(),
    });

    return timerId;
  }

  endTimer(timerId: string): number {
    if (!this.enabled) return 0;

    const timer = this.timers.get(timerId);
    if (!timer) return 0;

    const end = Date.now();
    const duration = end - timer.start;

    timer.end = end;
    timer.duration = duration;

    this.timers.delete(timerId);

    // Extract name and labels from timerId
    const [name] = timerId.split(':');
    if (name) {
      this.observeHistogram(`${name}_duration_ms`, duration);
    }

    return duration;
  }

  // Record API call metrics
  recordApiCall(method: string, endpoint: string, statusCode: number, duration: number): void {
    if (!this.enabled) return;

    const labels = {
      method: method.toUpperCase(),
      endpoint: endpoint.replace(/\/[0-9]+/g, '/:id'), // Normalize IDs
      status_code: statusCode.toString(),
      status_class: `${Math.floor(statusCode / 100)}xx`,
    };

    this.incrementCounter('api_requests_total', labels);
    this.observeHistogram('api_request_duration_ms', duration, labels);

    if (statusCode >= 400) {
      this.incrementCounter('api_errors_total', labels);
    }
  }

  // Record business metrics
  recordBusinessMetric(operation: string, resource: string, result: 'success' | 'error'): void {
    if (!this.enabled) return;

    const labels = {
      operation,
      resource,
      result,
    };

    this.incrementCounter('business_operations_total', labels);
  }

  // Get all metrics
  getMetrics(): Metric[] {
    if (!this.enabled) return [];

    return Array.from(this.metrics.values());
  }

  // Get metrics in Prometheus format
  getPrometheusMetrics(): string {
    if (!this.enabled) return '';

    const lines: string[] = [];
    const metricGroups = this.groupMetricsByName();

    for (const [metricName, metrics] of metricGroups) {
      const firstMetric = metrics[0];
      if (!firstMetric) continue;

      // Add help comment
      if (firstMetric.help) {
        lines.push(`# HELP ${metricName} ${firstMetric.help}`);
      }

      // Add type comment
      lines.push(`# TYPE ${metricName} ${firstMetric.type}`);

      // Add metric lines
      for (const metric of metrics) {
        const labelStr = this.formatLabels(metric.labels);
        lines.push(`${metricName}${labelStr} ${metric.value} ${metric.timestamp}`);
      }

      lines.push(''); // Empty line between metrics
    }

    return lines.join('\n');
  }

  // Get health metrics
  getHealthMetrics(): Record<string, any> {
    const now = Date.now();
    const uptime = process.uptime();

    return {
      uptime_seconds: uptime,
      memory_usage_bytes: process.memoryUsage(),
      cpu_usage_percent: process.cpuUsage(),
      timestamp: now,
      metrics_count: this.metrics.size,
      active_timers: this.timers.size,
    };
  }

  // Clear metrics (useful for testing)
  clear(): void {
    this.metrics.clear();
    this.timers.clear();
    logger.debug('Metrics cleared');
  }

  private initializeDefaultMetrics(): void {
    // Initialize system metrics
    this.setGauge('process_start_time_seconds', Date.now() / 1000);
    this.collectSystemMetrics();
  }

  private collectSystemMetrics(): void {
    if (!this.enabled) return;

    try {
      // Memory metrics
      const memUsage = process.memoryUsage();
      this.setGauge('process_memory_rss_bytes', memUsage.rss);
      this.setGauge('process_memory_heap_total_bytes', memUsage.heapTotal);
      this.setGauge('process_memory_heap_used_bytes', memUsage.heapUsed);
      this.setGauge('process_memory_external_bytes', memUsage.external);

      // CPU metrics
      const cpuUsage = process.cpuUsage();
      this.setGauge('process_cpu_user_seconds_total', cpuUsage.user / 1000000);
      this.setGauge('process_cpu_system_seconds_total', cpuUsage.system / 1000000);

      // Uptime
      this.setGauge('process_uptime_seconds', process.uptime());

      // Event loop lag (simplified)
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        this.setGauge('nodejs_eventloop_lag_seconds', lag / 1000);
      });
    } catch (error) {
      logger.error('Error collecting system metrics', error instanceof Error ? error.message : String(error));
    }
  }

  private getMetricKey(name: string, labels: Record<string, string>): string {
    const sortedLabels = Object.keys(labels)
      .sort()
      .map(key => `${key}="${labels[key]}"`)
      .join(',');
    return `${name}{${sortedLabels}}`;
  }

  private groupMetricsByName(): Map<string, Metric[]> {
    const groups = new Map<string, Metric[]>();

    for (const metric of this.metrics.values()) {
      const existing = groups.get(metric.name) || [];
      existing.push(metric);
      groups.set(metric.name, existing);
    }

    return groups;
  }

  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';

    const formatted = entries
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');

    return `{${formatted}}`;
  }
}