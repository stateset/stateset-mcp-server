import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace as otelTrace, context, SpanStatusCode, Span, SpanKind } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { createLogger } from '@utils/logger';
import type { Config } from '@config/config';

const logger = createLogger('telemetry');

export class TelemetryService {
  private static instance: TelemetryService;
  private sdk?: NodeSDK;
  private tracer = otelTrace.getTracer('stateset-mcp-server', '1.0.0');
  private enabled: boolean = false;

  private constructor() {}

  static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  /**
   * Initialize telemetry based on configuration
   */
  async initialize(config: Config): Promise<void> {
    if (!config.features.enableTelemetry) {
      logger.info('Telemetry disabled by configuration');
      return;
    }

    try {
      this.enabled = true;

      // Create resource
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'stateset-mcp-server',
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'stateset',
      });

      // Configure metrics (simpler configuration)
      if (config.features.metrics) {
        const prometheusExporter = new PrometheusExporter(
          {
            port: 9464,
          },
          () => {
            logger.debug('Prometheus metrics server started on port 9464');
          }
        );

        // Use a simple metric provider configuration
        const meterProvider = new MeterProvider({
          resource,
        });
      }

      // Initialize SDK with auto-instrumentations
      this.sdk = new NodeSDK({
        resource,
        instrumentations: [getNodeAutoInstrumentations()],
      });

      this.sdk.start();
      logger.info('Telemetry initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize telemetry', error instanceof Error ? error.message : 'Unknown error');
      this.enabled = false;
    }
  }

  /**
   * Create a span and execute function within it
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
      parentSpan?: Span;
    }
  ): Promise<T> {
    if (!this.enabled) {
      // If telemetry is disabled, create a no-op span
      const noopSpan = {
        setAttributes: () => {},
        setStatus: () => {},
        end: () => {},
      } as unknown as Span;
      return fn(noopSpan);
    }

    const span = this.tracer.startSpan(name, {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes,
    });

    if (options?.parentSpan) {
      const ctx = otelTrace.setSpan(context.active(), options.parentSpan);
      return context.with(ctx, async () => {
        try {
          const result = await fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        } finally {
          span.end();
        }
      });
    }

    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Add attributes to the current span
   */
  addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
    if (!this.enabled) return;

    const span = otelTrace.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  /**
   * Record an exception in the current span
   */
  recordException(error: Error): void {
    if (!this.enabled) return;

    const span = otelTrace.getActiveSpan();
    if (span) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    }
  }

  /**
   * Shutdown telemetry
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      logger.info('Telemetry shutdown completed');
    }
  }

  /**
   * Decorator for tracing methods
   */
  static traceMethod(spanName?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      const name = spanName || `${target.constructor.name}.${propertyKey}`;

      descriptor.value = async function (...args: any[]) {
        const telemetry = TelemetryService.getInstance();
        return telemetry.withSpan(name, async () => {
          return originalMethod.apply(this, args);
        });
      };

      return descriptor;
    };
  }
}

// Export a decorator for easier usage
export function traceMethod(spanName?: string) {
  return TelemetryService.traceMethod(spanName);
}

// Export the main trace function for external usage
export const trace = (name?: string) => TelemetryService.traceMethod(name); 