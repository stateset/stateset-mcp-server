import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

/**
 * Request context for correlation, tracing, and per-request state
 */
export interface RequestContext {
  /** Unique correlation ID for request tracing */
  correlationId: string;
  /** Parent correlation ID for distributed tracing */
  parentCorrelationId?: string;
  /** Request start timestamp */
  startTime: number;
  /** Tool being executed */
  toolName?: string;
  /** Tool category for rate limiting */
  toolCategory?: string;
  /** User/client identifier */
  clientId?: string;
  /** Session identifier */
  sessionId?: string;
  /** Custom metadata */
  metadata: Record<string, unknown>;
  /** Breadcrumbs for debugging */
  breadcrumbs: Breadcrumb[];
  /** Performance marks */
  marks: Map<string, number>;
}

export interface Breadcrumb {
  timestamp: number;
  category: string;
  message: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  data?: Record<string, unknown>;
}

// AsyncLocalStorage for request-scoped context
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Creates a new request context
 */
export function createRequestContext(options: Partial<RequestContext> = {}): RequestContext {
  return {
    correlationId: options.correlationId || randomUUID(),
    parentCorrelationId: options.parentCorrelationId,
    startTime: options.startTime || Date.now(),
    toolName: options.toolName,
    toolCategory: options.toolCategory,
    clientId: options.clientId,
    sessionId: options.sessionId,
    metadata: options.metadata || {},
    breadcrumbs: options.breadcrumbs || [],
    marks: options.marks || new Map(),
  };
}

/**
 * Runs a function within a request context
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Runs an async function within a request context
 */
export async function runWithContextAsync<T>(
  context: RequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Gets the current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Gets the current correlation ID (or generates a new one if no context)
 */
export function getCorrelationId(): string {
  const context = getRequestContext();
  return context?.correlationId || randomUUID();
}

/**
 * Adds a breadcrumb to the current context
 */
export function addBreadcrumb(
  category: string,
  message: string,
  level: Breadcrumb['level'] = 'info',
  data?: Record<string, unknown>,
): void {
  const context = getRequestContext();
  if (context) {
    context.breadcrumbs.push({
      timestamp: Date.now(),
      category,
      message,
      level,
      data,
    });

    // Keep only the last 50 breadcrumbs
    if (context.breadcrumbs.length > 50) {
      context.breadcrumbs = context.breadcrumbs.slice(-50);
    }
  }
}

/**
 * Adds a performance mark
 */
export function mark(name: string): void {
  const context = getRequestContext();
  if (context) {
    context.marks.set(name, Date.now());
  }
}

/**
 * Measures time between two marks or from start
 */
export function measure(_name: string, startMark?: string): number {
  const context = getRequestContext();
  if (!context) return 0;

  const endTime = Date.now();
  const startTime = startMark ? context.marks.get(startMark) : context.startTime;

  if (!startTime) return 0;
  return endTime - startTime;
}

/**
 * Sets metadata on the current context
 */
export function setContextMetadata(key: string, value: unknown): void {
  const context = getRequestContext();
  if (context) {
    context.metadata[key] = value;
  }
}

/**
 * Gets metadata from the current context
 */
export function getContextMetadata<T = unknown>(key: string): T | undefined {
  const context = getRequestContext();
  return context?.metadata[key] as T | undefined;
}

/**
 * Gets the elapsed time since request start
 */
export function getElapsedTime(): number {
  const context = getRequestContext();
  if (!context) return 0;
  return Date.now() - context.startTime;
}

/**
 * Creates a child context for sub-operations
 */
export function createChildContext(options: Partial<RequestContext> = {}): RequestContext {
  const parent = getRequestContext();

  return createRequestContext({
    parentCorrelationId: parent?.correlationId,
    clientId: parent?.clientId,
    sessionId: parent?.sessionId,
    ...options,
  });
}

/**
 * Decorator to wrap functions with request context
 */
export function withContext<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  contextOptions?: Partial<RequestContext>,
): T {
  return (async (...args: Parameters<T>) => {
    const context = createRequestContext(contextOptions);
    return runWithContextAsync(context, () => fn(...args));
  }) as T;
}

/**
 * Gets a summary of the current context for logging
 */
export function getContextSummary(): Record<string, unknown> {
  const context = getRequestContext();
  if (!context) {
    return { correlationId: 'no-context' };
  }

  return {
    correlationId: context.correlationId,
    parentCorrelationId: context.parentCorrelationId,
    toolName: context.toolName,
    toolCategory: context.toolCategory,
    clientId: context.clientId,
    elapsedMs: Date.now() - context.startTime,
    breadcrumbCount: context.breadcrumbs.length,
    markCount: context.marks.size,
  };
}

/**
 * Formats context for error reporting
 */
export function getContextForError(): Record<string, unknown> {
  const context = getRequestContext();
  if (!context) {
    return {};
  }

  return {
    correlationId: context.correlationId,
    parentCorrelationId: context.parentCorrelationId,
    toolName: context.toolName,
    toolCategory: context.toolCategory,
    elapsedMs: Date.now() - context.startTime,
    breadcrumbs: context.breadcrumbs.slice(-10), // Last 10 breadcrumbs
    metadata: context.metadata,
  };
}

export { asyncLocalStorage };
