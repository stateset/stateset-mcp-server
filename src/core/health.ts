import { config } from '@config/index';
import { createLogger } from '@utils/logger';
import { metrics } from '@core/metrics';
import { EventEmitter } from 'events';
import axios from 'axios';

const logger = createLogger('health');

// Health status
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

// Health check result
export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

// Overall health report
export interface HealthReport {
  status: HealthStatus;
  timestamp: number;
  version: string;
  uptime: number;
  checks: HealthCheckResult[];
  metrics?: {
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    eventLoop?: {
      delay: number;
      utilization: number;
    };
  };
}

// Health check function type
type HealthCheckFunction = () => Promise<HealthCheckResult>;

// Health check options
interface HealthCheckOptions {
  timeout?: number;
  critical?: boolean;
  interval?: number;
}

// Dependency check options
interface DependencyCheckOptions extends HealthCheckOptions {
  url?: string;
  expectedStatus?: number;
}

export class HealthChecker extends EventEmitter {
  private checks: Map<string, { fn: HealthCheckFunction; options: HealthCheckOptions }> = new Map();
  private lastResults: Map<string, HealthCheckResult> = new Map();
  private startTime: number = Date.now();
  private checkInterval?: NodeJS.Timeout;
  private eventLoopMonitor?: NodeJS.Timeout;
  private eventLoopDelay: number = 0;

  constructor() {
    super();

    // Register default checks
    this.registerDefaultChecks();

    // Start monitoring
    if (config.monitoring.enabled) {
      this.startMonitoring();
    }
  }

  // Register a health check
  register(name: string, check: HealthCheckFunction, options: HealthCheckOptions = {}): void {
    this.checks.set(name, { fn: check, options });
    logger.info('Health check registered', { name, options });
  }

  // Register an HTTP dependency check
  registerHttpDependency(name: string, url: string, options: DependencyCheckOptions = {}): void {
    const check: HealthCheckFunction = async () => {
      const start = Date.now();

      try {
        const response = await axios.get(url, {
          timeout: options.timeout || 5000,
          validateStatus: () => true,
        });

        const duration = Date.now() - start;
        const expectedStatus = options.expectedStatus || 200;

        if (response.status === expectedStatus) {
          return {
            name,
            status: HealthStatus.HEALTHY,
            message: `HTTP ${response.status}`,
            duration,
            timestamp: Date.now(),
            metadata: { url, status: response.status },
          };
        } else {
          return {
            name,
            status: HealthStatus.UNHEALTHY,
            message: `Expected HTTP ${expectedStatus}, got ${response.status}`,
            duration,
            timestamp: Date.now(),
            metadata: { url, status: response.status },
          };
        }
      } catch (error) {
        const duration = Date.now() - start;
        return {
          name,
          status: HealthStatus.UNHEALTHY,
          message: error instanceof Error ? error.message : 'Unknown error',
          duration,
          timestamp: Date.now(),
          metadata: { url, error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    };

    this.register(name, check, options);
  }

  // Perform all health checks
  async check(): Promise<HealthReport> {
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, { fn, options }]) => {
      try {
        const timeoutPromise = new Promise<HealthCheckResult>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), options.timeout || 10000);
        });

        const result = await Promise.race([fn(), timeoutPromise]);
        this.lastResults.set(name, result);

        // Record metrics
        metrics.observe('health_check_duration_ms', result.duration, { check: name });
        metrics.set('health_check_status', result.status === HealthStatus.HEALTHY ? 1 : 0, {
          check: name,
        });

        return result;
      } catch (error) {
        const result: HealthCheckResult = {
          name,
          status: HealthStatus.UNHEALTHY,
          message: error instanceof Error ? error.message : 'Unknown error',
          duration: 0,
          timestamp: Date.now(),
        };

        this.lastResults.set(name, result);
        return result;
      }
    });

    const results = await Promise.all(checkPromises);
    const overallStatus = this.calculateOverallStatus(results);

    const report: HealthReport = {
      status: overallStatus,
      timestamp: Date.now(),
      version: config.server.version,
      uptime: Date.now() - this.startTime,
      checks: results,
      metrics: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        eventLoop: {
          delay: this.eventLoopDelay,
          utilization: 0, // Would need perf_hooks for accurate measurement
        },
      },
    };

    // Emit health status
    this.emit('health', report);

    // Log if unhealthy
    if (overallStatus !== HealthStatus.HEALTHY) {
      logger.logHealthCheck('unhealthy', {
        status: overallStatus,
        failedChecks: results.filter((r) => r.status !== HealthStatus.HEALTHY).map((r) => r.name),
      });
    }

    return report;
  }

  // Liveness probe (is the service alive?)
  async liveness(): Promise<{ status: HealthStatus; message: string }> {
    try {
      // Basic liveness check - can we allocate memory and respond?
      const test = Buffer.alloc(1024);
      test.fill(0);

      return {
        status: HealthStatus.HEALTHY,
        message: 'Service is alive',
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Readiness probe (is the service ready to accept traffic?)
  async readiness(): Promise<{ status: HealthStatus; message: string; checks?: string[] }> {
    const report = await this.check();

    if (report.status === HealthStatus.HEALTHY) {
      return {
        status: HealthStatus.HEALTHY,
        message: 'Service is ready',
      };
    } else {
      const failedChecks = report.checks
        .filter((c) => c.status !== HealthStatus.HEALTHY)
        .map((c) => c.name);

      return {
        status: report.status,
        message: 'Service is not ready',
        checks: failedChecks,
      };
    }
  }

  // Get last check results
  getLastResults(): Map<string, HealthCheckResult> {
    return new Map(this.lastResults);
  }

  // Calculate overall status
  private calculateOverallStatus(results: HealthCheckResult[]): HealthStatus {
    const criticalChecks = Array.from(this.checks.entries())
      .filter(([_, { options }]) => options.critical !== false)
      .map(([name]) => name);

    // If any critical check fails, overall status is unhealthy
    const criticalFailure = results.some(
      (r) => criticalChecks.includes(r.name) && r.status === HealthStatus.UNHEALTHY,
    );

    if (criticalFailure) {
      return HealthStatus.UNHEALTHY;
    }

    // If any check is unhealthy, overall status is degraded
    const anyUnhealthy = results.some((r) => r.status === HealthStatus.UNHEALTHY);
    if (anyUnhealthy) {
      return HealthStatus.DEGRADED;
    }

    // If any check is degraded, overall status is degraded
    const anyDegraded = results.some((r) => r.status === HealthStatus.DEGRADED);
    if (anyDegraded) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  // Register default health checks
  private registerDefaultChecks(): void {
    // Memory check
    this.register('memory', async () => {
      const start = Date.now();
      const usage = process.memoryUsage();
      const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;

      let status = HealthStatus.HEALTHY;
      let message = `Heap used: ${heapUsedPercent.toFixed(2)}%`;

      if (heapUsedPercent > 90) {
        status = HealthStatus.UNHEALTHY;
        message = `Heap usage critical: ${heapUsedPercent.toFixed(2)}%`;
      } else if (heapUsedPercent > 80) {
        status = HealthStatus.DEGRADED;
        message = `Heap usage high: ${heapUsedPercent.toFixed(2)}%`;
      }

      return {
        name: 'memory',
        status,
        message,
        duration: Date.now() - start,
        timestamp: Date.now(),
        metadata: {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          rss: usage.rss,
          external: usage.external,
        },
      };
    });

    // Event loop check
    this.register('eventLoop', async () => {
      const start = Date.now();

      let status = HealthStatus.HEALTHY;
      let message = `Event loop delay: ${this.eventLoopDelay.toFixed(2)}ms`;

      if (this.eventLoopDelay > 100) {
        status = HealthStatus.UNHEALTHY;
        message = `Event loop blocked: ${this.eventLoopDelay.toFixed(2)}ms`;
      } else if (this.eventLoopDelay > 50) {
        status = HealthStatus.DEGRADED;
        message = `Event loop slow: ${this.eventLoopDelay.toFixed(2)}ms`;
      }

      return {
        name: 'eventLoop',
        status,
        message,
        duration: Date.now() - start,
        timestamp: Date.now(),
        metadata: {
          delay: this.eventLoopDelay,
        },
      };
    });

    // API connectivity check (if configured)
    if (config.api.baseUrl) {
      this.registerHttpDependency('api', `${config.api.baseUrl}/health`, {
        critical: true,
        timeout: 5000,
      });
    }
  }

  // Start monitoring
  private startMonitoring(): void {
    // Periodic health checks
    this.checkInterval = setInterval(async () => {
      try {
        await this.check();
      } catch (error) {
        logger.error('Health check failed', error);
      }
    }, config.monitoring.healthCheckInterval);

    // Event loop monitoring
    this.startEventLoopMonitoring();
  }

  // Monitor event loop delay
  private startEventLoopMonitoring(): void {
    let lastCheck = Date.now();

    this.eventLoopMonitor = setInterval(() => {
      const now = Date.now();
      const delay = now - lastCheck - 100; // Expected 100ms interval

      // Use exponential moving average
      this.eventLoopDelay = this.eventLoopDelay * 0.9 + Math.max(0, delay) * 0.1;

      lastCheck = now;
    }, 100);
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    if (this.eventLoopMonitor) {
      clearInterval(this.eventLoopMonitor);
      this.eventLoopMonitor = undefined;
    }
  }

  // Express middleware for health endpoints
  expressMiddleware() {
    return {
      health: async (_req: any, res: any) => {
        try {
          const report = await this.check();
          const statusCode = report.status === HealthStatus.HEALTHY ? 200 : 503;
          res.status(statusCode).json(report);
        } catch (error) {
          res.status(503).json({
            status: HealthStatus.UNHEALTHY,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },

      liveness: async (_req: any, res: any) => {
        try {
          const result = await this.liveness();
          const statusCode = result.status === HealthStatus.HEALTHY ? 200 : 503;
          res.status(statusCode).json(result);
        } catch (error) {
          res.status(503).json({
            status: HealthStatus.UNHEALTHY,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },

      readiness: async (_req: any, res: any) => {
        try {
          const result = await this.readiness();
          const statusCode = result.status === HealthStatus.HEALTHY ? 200 : 503;
          res.status(statusCode).json(result);
        } catch (error) {
          res.status(503).json({
            status: HealthStatus.UNHEALTHY,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
    };
  }
}

// Create singleton instance
export const healthChecker = new HealthChecker();

// Convenience function for registering checks
export function registerHealthCheck(
  name: string,
  check: HealthCheckFunction,
  options?: HealthCheckOptions,
): void {
  healthChecker.register(name, check, options);
}

// Export types
export type { HealthCheckFunction };
