import { ZodError } from 'zod';
import { AxiosError } from 'axios';
import { logger } from '../utils/logger';
import {
  getCorrelationId,
  getContextForError,
  addBreadcrumb,
  getElapsedTime,
} from '../core/request-context';
import { classifyError, ErrorType } from '../core/retry-strategy';
import { metrics } from '../core/metrics';

export interface ErrorContext {
  operation?: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface ActionableSuggestion {
  action: string;
  description: string;
  example?: string;
}

export class APIError extends Error {
  public suggestions: ActionableSuggestion[];

  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public context?: ErrorContext,
    suggestions?: ActionableSuggestion[],
  ) {
    super(message);
    this.name = 'APIError';
    this.suggestions = suggestions || [];
  }
}

export class ValidationError extends APIError {
  constructor(
    message: string,
    public validationErrors: ZodError,
  ) {
    super(message, 400, 'VALIDATION_ERROR', undefined, [
      {
        action: 'Check input parameters',
        description: 'Verify all required fields are provided and have the correct data types',
      },
      {
        action: 'Review field constraints',
        description: 'Ensure values meet minimum/maximum length requirements and valid formats',
      },
    ]);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends APIError {
  constructor(message: string = 'Rate limit exceeded', retryAfterMs?: number) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', undefined, [
      {
        action: 'Wait and retry',
        description: retryAfterMs
          ? `Wait ${Math.ceil(retryAfterMs / 1000)} seconds before retrying`
          : 'Wait a few seconds before making another request',
      },
      {
        action: 'Reduce request frequency',
        description: 'Consider batching operations or implementing request queuing',
      },
      {
        action: 'Check rate limit status',
        description: 'Use stateset_tool_rate_limits to monitor your current rate limit consumption',
      },
    ]);
    this.name = 'RateLimitError';
  }
}

export class CircuitBreakerError extends APIError {
  constructor(message: string = 'Service temporarily unavailable', resetTimeMs?: number) {
    super(message, 503, 'CIRCUIT_BREAKER_OPEN', undefined, [
      {
        action: 'Wait for recovery',
        description: resetTimeMs
          ? `The circuit breaker will attempt recovery in ${Math.ceil(resetTimeMs / 1000)} seconds`
          : 'The system is protecting itself from cascading failures. It will recover automatically.',
      },
      {
        action: 'Check service health',
        description: 'Use stateset_health_check to get detailed component status',
      },
      {
        action: 'Review recent failures',
        description: 'Check server logs for patterns that may indicate the root cause',
      },
    ]);
    this.name = 'CircuitBreakerError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR', undefined, [
      {
        action: 'Verify API key',
        description: 'Ensure STATESET_API_KEY environment variable is set correctly',
      },
      {
        action: 'Check key expiration',
        description:
          'API keys may expire. Generate a new key from the StateSet dashboard if needed.',
      },
      {
        action: 'Verify permissions',
        description: 'Ensure your API key has the required permissions for this operation',
      },
    ]);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends APIError {
  constructor(resourceType: string, resourceId: string) {
    super(`${resourceType} with ID '${resourceId}' not found`, 404, 'NOT_FOUND', undefined, [
      {
        action: 'Verify resource ID',
        description: `Double-check the ${resourceType.toLowerCase()} ID is correct`,
        example: `Use stateset_list_${resourceType.toLowerCase()}s to see available resources`,
      },
      {
        action: 'Check resource existence',
        description: 'The resource may have been deleted or never existed',
      },
    ]);
    this.name = 'NotFoundError';
  }
}

export class TimeoutError extends APIError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`, 504, 'TIMEOUT', undefined, [
      {
        action: 'Retry the operation',
        description: 'The server may be temporarily slow. Try again in a few seconds.',
      },
      {
        action: 'Simplify the request',
        description: 'For batch operations, try smaller batch sizes',
      },
      {
        action: 'Check server status',
        description: 'Use stateset_health_check to verify the API is responsive',
      },
    ]);
    this.name = 'TimeoutError';
  }
}

// Helper to get suggestions based on error type and status code
function getSuggestionsForHttpError(
  statusCode: number,
  _operation?: string,
): ActionableSuggestion[] {
  switch (statusCode) {
    case 400:
      return [
        {
          action: 'Check request parameters',
          description: 'Verify all required fields are provided with correct data types',
        },
        {
          action: 'Review API documentation',
          description: 'Check the expected format for this operation',
        },
      ];
    case 401:
      return [
        {
          action: 'Verify API key',
          description: 'Ensure STATESET_API_KEY is set correctly',
        },
      ];
    case 403:
      return [
        {
          action: 'Check permissions',
          description: 'Your API key may not have permission for this operation',
        },
        {
          action: 'Contact support',
          description: 'Request additional permissions if needed',
        },
      ];
    case 404:
      return [
        {
          action: 'Verify resource ID',
          description: 'Check that the resource exists and the ID is correct',
        },
      ];
    case 409:
      return [
        {
          action: 'Check for conflicts',
          description: 'The resource may already exist or be in a conflicting state',
        },
        {
          action: 'Refresh and retry',
          description: 'Fetch the latest state before making changes',
        },
      ];
    case 422:
      return [
        {
          action: 'Fix validation errors',
          description: 'Review the specific field errors in the response',
        },
      ];
    case 429:
      return [
        {
          action: 'Wait and retry',
          description: 'You have exceeded the rate limit. Wait before retrying.',
        },
      ];
    case 500:
    case 502:
    case 503:
    case 504:
      return [
        {
          action: 'Retry later',
          description: 'Server is experiencing issues. Wait and retry.',
        },
        {
          action: 'Check service status',
          description: 'Use stateset_health_check for status information',
        },
      ];
    default:
      return [
        {
          action: 'Review the error',
          description: 'Check the error message for specific guidance',
        },
      ];
  }
}

export function handleError(error: unknown, context?: ErrorContext): APIError {
  const correlationId = context?.correlationId || getCorrelationId();
  const requestId = context?.requestId || correlationId;
  const elapsedTime = getElapsedTime();
  const requestContext = getContextForError();

  // Add breadcrumb for error
  addBreadcrumb(
    'error',
    error instanceof Error ? error.message : String(error),
    'error',
    { operation: context?.operation },
  );

  // Classify the error for metrics
  const errorType = error instanceof Error ? classifyError(error) : ErrorType.UNKNOWN;

  // Record error metrics
  metrics.increment('errors_total', 1, {
    operation: context?.operation || 'unknown',
    error_type: errorType,
    error_class: error?.constructor?.name || 'Unknown',
  });

  // Log the error with full context
  logger.error('Error occurred', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    correlationId,
    requestId,
    elapsedTimeMs: elapsedTime,
    errorType,
    requestContext,
  });

  // Handle different error types
  if (error instanceof APIError) {
    error.context = {
      ...error.context,
      correlationId,
      requestId,
    };
    return error;
  }

  if (error instanceof ZodError) {
    const validationError = new ValidationError(
      `Validation failed: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      error,
    );
    validationError.context = { ...context, correlationId, requestId };
    return validationError;
  }

  if (error instanceof AxiosError) {
    const statusCode = error.response?.status || 500;
    const message = error.response?.data?.message || error.message || 'API request failed';

    // Check for specific error codes
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      const timeoutError = new TimeoutError(context?.operation || 'unknown', 10000);
      timeoutError.context = { ...context, correlationId, requestId };
      return timeoutError;
    }

    // Check for authentication errors
    if (statusCode === 401) {
      const authError = new AuthenticationError(message);
      authError.context = { ...context, correlationId, requestId };
      return authError;
    }

    // Check for rate limit errors
    if (statusCode === 429) {
      const retryAfter = error.response?.headers?.['retry-after'];
      const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
      const rateLimitError = new RateLimitError(message, retryAfterMs);
      rateLimitError.context = { ...context, correlationId, requestId };
      return rateLimitError;
    }

    // Get suggestions based on status code
    const suggestions = getSuggestionsForHttpError(statusCode, context?.operation);

    return new APIError(
      `External API error: ${message}`,
      statusCode,
      'EXTERNAL_API_ERROR',
      { ...context, correlationId, requestId },
      suggestions,
    );
  }

  // Unknown error
  return new APIError('An unexpected error occurred', 500, 'INTERNAL_ERROR',
    { ...context, correlationId, requestId },
    [
      {
        action: 'Contact support',
        description: `If this error persists, please report it with correlation ID: ${correlationId}`,
      },
      {
        action: 'Retry the operation',
        description: 'This may be a transient error. Try again in a few seconds.',
      },
    ],
  );
}

export function sanitizeError(error: APIError): Record<string, unknown> {
  return {
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    suggestions: error.suggestions,
    ...(error instanceof ValidationError && {
      validationErrors: error.validationErrors.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      })),
    }),
  };
}

/**
 * Format error for MCP response
 */
export function formatErrorForResponse(error: APIError): {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
} {
  let formattedText = `Error: ${error.message}\n`;
  formattedText += `Code: ${error.code}\n`;

  if (error.context?.correlationId) {
    formattedText += `Correlation ID: ${error.context.correlationId}\n`;
  }

  if (error.suggestions.length > 0) {
    formattedText += '\nSuggested Actions:\n';
    error.suggestions.forEach((suggestion, index) => {
      formattedText += `${index + 1}. ${suggestion.action}: ${suggestion.description}`;
      if (suggestion.example) {
        formattedText += `\n   Example: ${suggestion.example}`;
      }
      formattedText += '\n';
    });
  }

  if (error instanceof ValidationError) {
    formattedText += '\nValidation Errors:\n';
    error.validationErrors.errors.forEach((e) => {
      formattedText += `- ${e.path.join('.')}: ${e.message}\n`;
    });
  }

  return {
    content: [{ type: 'text', text: formattedText }],
    isError: true,
  };
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  if (error instanceof TimeoutError) return true;
  if (error instanceof CircuitBreakerError) return true;

  if (error instanceof APIError) {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(error.statusCode);
  }

  if (error instanceof Error) {
    const errorType = classifyError(error);
    return [
      ErrorType.TRANSIENT,
      ErrorType.RATE_LIMITED,
      ErrorType.NETWORK,
      ErrorType.TIMEOUT,
      ErrorType.SERVER_ERROR,
    ].includes(errorType);
  }

  return false;
}

/**
 * Get retry delay suggestion from error
 */
export function getRetryDelay(error: unknown): number {
  if (error instanceof RateLimitError) {
    // Extract from message if available
    const match = error.message.match(/(\d+)\s*seconds?/i);
    if (match) {
      return parseInt(match[1]!, 10) * 1000;
    }
    return 60000; // Default 60 seconds for rate limit
  }

  if (error instanceof CircuitBreakerError) {
    const match = error.message.match(/(\d+)\s*seconds?/i);
    if (match) {
      return parseInt(match[1]!, 10) * 1000;
    }
    return 30000; // Default 30 seconds for circuit breaker
  }

  if (error instanceof TimeoutError) {
    return 5000; // 5 seconds for timeout
  }

  // Default retry delay
  return 1000;
}
