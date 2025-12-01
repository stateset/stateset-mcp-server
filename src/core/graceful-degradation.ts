import { createLogger } from '@utils/logger';
import { metrics } from './metrics';
import { addBreadcrumb } from './request-context';

const logger = createLogger('graceful-degradation');

/**
 * Degradation level for service health
 */
export enum DegradationLevel {
  /** Service is fully operational */
  HEALTHY = 'healthy',
  /** Service is operational but with reduced functionality */
  DEGRADED = 'degraded',
  /** Service is partially unavailable */
  PARTIAL = 'partial',
  /** Service is unavailable, using fallback */
  FALLBACK = 'fallback',
  /** Service is completely unavailable */
  UNAVAILABLE = 'unavailable',
}

/**
 * Service status for tracking
 */
export interface ServiceStatus {
  name: string;
  level: DegradationLevel;
  lastCheck: number;
  consecutiveFailures: number;
  lastError?: string;
  fallbackActive: boolean;
}

/**
 * Fallback configuration
 */
export interface FallbackConfig<T> {
  /** Primary function to execute */
  primary: () => Promise<T>;
  /** Fallback function if primary fails */
  fallback?: () => Promise<T> | T;
  /** Static fallback value */
  staticFallback?: T;
  /** Cache to use for stale data */
  cache?: {
    get: (key: string) => T | undefined;
    key: string;
  };
  /** Maximum time to wait for primary */
  timeoutMs?: number;
  /** Should we use stale cache data on error */
  useStaleOnError?: boolean;
}

/**
 * Fallback result
 */
export interface FallbackResult<T> {
  value: T;
  source: 'primary' | 'fallback' | 'cache' | 'static';
  degraded: boolean;
  error?: Error;
}

/**
 * Graceful degradation manager
 */
class GracefulDegradationManager {
  private serviceStatuses: Map<string, ServiceStatus> = new Map();
  private readonly degradationThreshold = 3; // consecutive failures before degradation

  /**
   * Registers a service for monitoring
   */
  registerService(name: string): void {
    this.serviceStatuses.set(name, {
      name,
      level: DegradationLevel.HEALTHY,
      lastCheck: Date.now(),
      consecutiveFailures: 0,
      fallbackActive: false,
    });
  }

  /**
   * Records a successful service call
   */
  recordSuccess(serviceName: string): void {
    const status = this.getOrCreateStatus(serviceName);
    status.consecutiveFailures = 0;
    status.lastCheck = Date.now();
    status.lastError = undefined;

    if (status.level !== DegradationLevel.HEALTHY) {
      logger.info('Service recovered', { service: serviceName, previousLevel: status.level });
      status.level = DegradationLevel.HEALTHY;
      status.fallbackActive = false;
      metrics.increment('service_recovery_total', 1, { service: serviceName });
    }
  }

  /**
   * Records a failed service call
   */
  recordFailure(serviceName: string, error: Error): void {
    const status = this.getOrCreateStatus(serviceName);
    status.consecutiveFailures++;
    status.lastCheck = Date.now();
    status.lastError = error.message;

    // Update degradation level
    if (status.consecutiveFailures >= this.degradationThreshold * 3) {
      status.level = DegradationLevel.UNAVAILABLE;
    } else if (status.consecutiveFailures >= this.degradationThreshold * 2) {
      status.level = DegradationLevel.FALLBACK;
      status.fallbackActive = true;
    } else if (status.consecutiveFailures >= this.degradationThreshold) {
      status.level = DegradationLevel.DEGRADED;
    }

    logger.warn('Service failure recorded', {
      service: serviceName,
      consecutiveFailures: status.consecutiveFailures,
      level: status.level,
      error: error.message,
    });

    metrics.increment('service_failure_total', 1, {
      service: serviceName,
      level: status.level,
    });

    addBreadcrumb('degradation', `Service ${serviceName} failure`, 'warn', {
      consecutiveFailures: status.consecutiveFailures,
      level: status.level,
    });
  }

  /**
   * Executes with fallback support
   */
  async executeWithFallback<T>(
    serviceName: string,
    config: FallbackConfig<T>,
  ): Promise<FallbackResult<T>> {
    const status = this.getOrCreateStatus(serviceName);

    // If service is unavailable and we have a fallback, skip primary
    if (status.level === DegradationLevel.UNAVAILABLE) {
      const fallbackResult = await this.tryFallback(config);
      if (fallbackResult) {
        return fallbackResult;
      }
      throw new Error(`Service ${serviceName} is unavailable and no fallback available`);
    }

    // Try primary with timeout
    try {
      const primaryPromise = config.primary();
      let result: T;

      if (config.timeoutMs) {
        result = await this.withTimeout(primaryPromise, config.timeoutMs);
      } else {
        result = await primaryPromise;
      }

      this.recordSuccess(serviceName);

      return {
        value: result,
        source: 'primary',
        degraded: false,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.recordFailure(serviceName, err);

      // Try fallback strategies
      const fallbackResult = await this.tryFallback(config, err);
      if (fallbackResult) {
        return fallbackResult;
      }

      // No fallback available
      throw err;
    }
  }

  /**
   * Gets service status
   */
  getServiceStatus(serviceName: string): ServiceStatus | undefined {
    return this.serviceStatuses.get(serviceName);
  }

  /**
   * Gets all service statuses
   */
  getAllServiceStatuses(): ServiceStatus[] {
    return Array.from(this.serviceStatuses.values());
  }

  /**
   * Gets degraded services
   */
  getDegradedServices(): ServiceStatus[] {
    return this.getAllServiceStatuses().filter(
      (s) => s.level !== DegradationLevel.HEALTHY,
    );
  }

  /**
   * Checks if service is healthy
   */
  isHealthy(serviceName: string): boolean {
    const status = this.serviceStatuses.get(serviceName);
    return !status || status.level === DegradationLevel.HEALTHY;
  }

  /**
   * Resets service status (for testing or manual recovery)
   */
  resetService(serviceName: string): void {
    const status = this.serviceStatuses.get(serviceName);
    if (status) {
      status.level = DegradationLevel.HEALTHY;
      status.consecutiveFailures = 0;
      status.fallbackActive = false;
      status.lastError = undefined;
    }
  }

  /**
   * Gets overall system health
   */
  getSystemHealth(): {
    level: DegradationLevel;
    healthyServices: number;
    degradedServices: number;
    unavailableServices: number;
  } {
    const statuses = this.getAllServiceStatuses();
    const healthy = statuses.filter((s) => s.level === DegradationLevel.HEALTHY);
    const degraded = statuses.filter(
      (s) => s.level === DegradationLevel.DEGRADED || s.level === DegradationLevel.PARTIAL,
    );
    const unavailable = statuses.filter(
      (s) => s.level === DegradationLevel.UNAVAILABLE || s.level === DegradationLevel.FALLBACK,
    );

    let level = DegradationLevel.HEALTHY;
    if (unavailable.length > 0) {
      level = DegradationLevel.PARTIAL;
    } else if (degraded.length > 0) {
      level = DegradationLevel.DEGRADED;
    }

    if (unavailable.length === statuses.length && statuses.length > 0) {
      level = DegradationLevel.UNAVAILABLE;
    }

    return {
      level,
      healthyServices: healthy.length,
      degradedServices: degraded.length,
      unavailableServices: unavailable.length,
    };
  }

  /**
   * Tries fallback strategies in order
   */
  private async tryFallback<T>(
    config: FallbackConfig<T>,
    error?: Error,
  ): Promise<FallbackResult<T> | null> {
    // Try cache first if configured
    if (config.cache && config.useStaleOnError !== false) {
      const cachedValue = config.cache.get(config.cache.key);
      if (cachedValue !== undefined) {
        logger.debug('Using stale cache data', { key: config.cache.key });
        metrics.increment('fallback_cache_used_total', 1);

        return {
          value: cachedValue,
          source: 'cache',
          degraded: true,
          error,
        };
      }
    }

    // Try dynamic fallback function
    if (config.fallback) {
      try {
        const fallbackValue = await config.fallback();
        logger.debug('Using dynamic fallback');
        metrics.increment('fallback_function_used_total', 1);

        return {
          value: fallbackValue,
          source: 'fallback',
          degraded: true,
          error,
        };
      } catch (fallbackError) {
        logger.warn('Fallback function failed', {
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
      }
    }

    // Try static fallback
    if (config.staticFallback !== undefined) {
      logger.debug('Using static fallback');
      metrics.increment('fallback_static_used_total', 1);

      return {
        value: config.staticFallback,
        source: 'static',
        degraded: true,
        error,
      };
    }

    return null;
  }

  /**
   * Wraps a promise with a timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Gets or creates service status
   */
  private getOrCreateStatus(serviceName: string): ServiceStatus {
    let status = this.serviceStatuses.get(serviceName);
    if (!status) {
      status = {
        name: serviceName,
        level: DegradationLevel.HEALTHY,
        lastCheck: Date.now(),
        consecutiveFailures: 0,
        fallbackActive: false,
      };
      this.serviceStatuses.set(serviceName, status);
    }
    return status;
  }
}

// Singleton instance
export const degradationManager = new GracefulDegradationManager();

/**
 * Decorator for graceful degradation
 */
export function WithFallback<T>(options: {
  serviceName: string;
  fallback?: () => Promise<T> | T;
  staticFallback?: T;
  timeoutMs?: number;
}) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await degradationManager.executeWithFallback(options.serviceName, {
        primary: () => originalMethod.apply(this, args),
        fallback: options.fallback,
        staticFallback: options.staticFallback,
        timeoutMs: options.timeoutMs,
      });

      return result.value;
    };

    return descriptor;
  };
}

/**
 * Creates a degradation-aware wrapper for a function
 */
export function createDegradationWrapper<T, Args extends any[]>(
  serviceName: string,
  fn: (...args: Args) => Promise<T>,
  options: {
    fallback?: (...args: Args) => Promise<T> | T;
    staticFallback?: T;
    timeoutMs?: number;
  } = {},
): (...args: Args) => Promise<FallbackResult<T>> {
  return async (...args: Args) => {
    return degradationManager.executeWithFallback(serviceName, {
      primary: () => fn(...args),
      fallback: options.fallback ? () => options.fallback!(...args) : undefined,
      staticFallback: options.staticFallback,
      timeoutMs: options.timeoutMs,
    });
  };
}
