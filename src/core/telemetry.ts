import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, context, SpanStatusCode, Span, SpanKind } from '@opentelemetry/api';
import { config } from '@config/index';
import { createLogger } from '@utils/logger';

const logger = createLogger('telemetry');

export class TelemetryService {
  private static instance: TelemetryService;
  private sdk: NodeSDK | null = null;
  private tracer = trace.getTracer('stateset-mcp-server', '1.0.0');

  private constructor() {}

  static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  async initialize(): Promise<void> {
    if (!config.features.enableTelemetry) {
      logger.info('Telemetry disabled by configuration');
      return;
    }

    try {
      const resource = Resource.default().merge(
        new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: 'stateset-mcp-server',
          [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.server.environment,
        })
      );

      // Prometheus exporter for metrics
      const prometheusExporter = new PrometheusExporter(
        {
          port: 9464,
          endpoint: '/metrics',
        },
        () => {
          logger.info('Prometheus metrics server started on port 9464');
        }
      );

      // Create SDK
      this.sdk = new NodeSDK({
        resource,
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': {
              enabled: false, // Disable fs instrumentation to reduce noise
            },
          }),
        ],
        metricReader: new PeriodicExportingMetricReader({
          exporter: prometheusExporter,
          exportIntervalMillis: 10000,
        }),
      });

      // Start SDK
      await this.sdk.start();
      logger.info('OpenTelemetry initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize OpenTelemetry');
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        logger.info('OpenTelemetry shut down successfully');
      } catch (error) {
        logger.error({ error }, 'Error shutting down OpenTelemetry');
      }
    }
  }

  // Create a new span for tracing
  startSpan(
    name: string,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, any>;
      parentSpan?: Span;
    }
  ): Span {
    const spanOptions = {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes,
    };

    if (options?.parentSpan) {
      const ctx = trace.setSpan(context.active(), options.parentSpan);
      return this.tracer.startSpan(name, spanOptions, ctx);
    }

    return this.tracer.startSpan(name, spanOptions);
  }

  // Wrap a function with tracing
  async traceAsync<T>(
    name: string,
    fn: () => Promise<T>,
    options?: {
      attributes?: Record<string, any>;
      recordException?: boolean;
    }
  ): Promise<T> {
    const span = this.startSpan(name, { attributes: options?.attributes });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      if (options?.recordException !== false) {
        span.recordException(error as Error);
      }
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  }

  // Trace synchronous operations
  trace<T>(
    name: string,
    fn: () => T,
    options?: {
      attributes?: Record<string, any>;
      recordException?: boolean;
    }
  ): T {
    const span = this.startSpan(name, { attributes: options?.attributes });

    try {
      const result = fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      if (options?.recordException !== false) {
        span.recordException(error as Error);
      }
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  }

  // Add event to current span
  addEvent(name: string, attributes?: Record<string, any>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  // Set attributes on current span
  setAttributes(attributes: Record<string, any>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  // Create a decorator for method tracing
  static trace(name?: string) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      const spanName = name || `${target.constructor.name}.${propertyKey}`;

      descriptor.value = async function (...args: any[]) {
        const telemetry = TelemetryService.getInstance();
        return telemetry.traceAsync(
          spanName,
          async () => originalMethod.apply(this, args),
          {
            attributes: {
              'method.name': propertyKey,
              'method.args.count': args.length,
            },
          }
        );
      };

      return descriptor;
    };
  }
}

// Export singleton instance
export const telemetry = TelemetryService.getInstance();

// Export decorator
export const trace = TelemetryService.trace; 