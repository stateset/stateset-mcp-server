import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Input sanitization utilities
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // Remove potentially dangerous characters and HTML
  return DOMPurify.sanitize(input.trim(), {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeString(email).toLowerCase();

  // Basic email validation pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format');
  }

  return sanitized;
}

export function sanitizeId(id: string): string {
  const sanitized = sanitizeString(id);

  // Only allow alphanumeric characters, hyphens, and underscores
  const idRegex = /^[a-zA-Z0-9_-]+$/;

  if (!idRegex.test(sanitized)) {
    throw new Error(
      'Invalid ID format: only alphanumeric characters, hyphens, and underscores allowed',
    );
  }

  if (sanitized.length > 100) {
    throw new Error('ID too long: maximum 100 characters allowed');
  }

  return sanitized;
}

export function sanitizeUrl(url: string): string {
  const sanitized = sanitizeString(url);

  try {
    const urlObj = new URL(sanitized);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Invalid URL protocol: only HTTP and HTTPS allowed');
    }

    return urlObj.toString();
  } catch (error) {
    throw new Error(
      `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

// Enhanced validation schemas with sanitization
export const SanitizedStringSchema = z
  .string()
  .transform(sanitizeString)
  .refine((val) => val.length > 0, { message: 'String cannot be empty after sanitization' });

export const SanitizedEmailSchema = z.string().transform(sanitizeEmail);

export const SanitizedIdSchema = z.string().transform(sanitizeId);

export const SanitizedUrlSchema = z.string().transform(sanitizeUrl);

// Rate limiting validation
export const PaginationSchema = z.object({
  page: z.number().int().min(1).max(1000).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
});

// Common validation patterns
export const CommonValidationSchemas = {
  positiveInteger: z.number().int().positive(),
  nonNegativeInteger: z.number().int().min(0),
  price: z.number().min(0).max(999999.99),
  quantity: z.number().int().min(1).max(10000),
  phoneNumber: z.string().regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number format'),
  postalCode: z
    .string()
    .regex(/^[\w\s-]+$/, 'Invalid postal code format')
    .max(20),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Invalid currency code (must be 3 uppercase letters)'),
};

// Validation helper functions
export function validateAndSanitizeInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  context?: string,
): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const contextMsg = context ? ` for ${context}` : '';
      throw new Error(
        `Validation failed${contextMsg}: ${error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ')}`,
      );
    }
    throw error;
  }
}

export function createOptionalField<T>(schema: z.ZodSchema<T>) {
  return schema
    .optional()
    .nullable()
    .transform((val) => val || undefined);
}

// Security validation
export function validateContentLength(content: string, maxLength: number = 10000): void {
  if (content.length > maxLength) {
    throw new Error(`Content too long: maximum ${maxLength} characters allowed`);
  }
}

export function validateNoSqlInjection(input: string): void {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|\/\*|\*\/|;|'|")/,
    /(\b(OR|AND)\b.*[=<>])/i,
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      throw new Error('Potentially malicious input detected');
    }
  }
}

/**
 * Validates input for potential XSS attacks
 */
export function validateNoXSS(input: string): void {
  const xssPatterns = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<embed/gi,
    /<object/gi,
    /data:/gi,
    /vbscript:/gi,
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(input)) {
      throw new Error('Potentially malicious content detected');
    }
  }
}

/**
 * Validates path traversal attempts
 */
export function validateNoPathTraversal(input: string): void {
  const pathPatterns = [
    /\.\.\//g,
    /\.\.\\/,
    /%2e%2e/gi,
    /%252e/gi,
  ];

  for (const pattern of pathPatterns) {
    if (pattern.test(input)) {
      throw new Error('Invalid path detected');
    }
  }
}

/**
 * Validates command injection attempts
 */
export function validateNoCommandInjection(input: string): void {
  const cmdPatterns = [
    /[;&|`$]/,
    /\$\(/,
    /`[^`]*`/,
    /\|\|/,
    /&&/,
  ];

  for (const pattern of cmdPatterns) {
    if (pattern.test(input)) {
      throw new Error('Invalid characters detected');
    }
  }
}

/**
 * Comprehensive security validation
 */
export function validateSecureInput(input: string, options: {
  maxLength?: number;
  allowHtml?: boolean;
  allowSpecialChars?: boolean;
  fieldName?: string;
} = {}): string {
  const {
    maxLength = 10000,
    allowHtml = false,
    allowSpecialChars = false,
    fieldName = 'input',
  } = options;

  if (typeof input !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }

  // Length validation
  if (input.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength} characters`);
  }

  // XSS validation
  if (!allowHtml) {
    validateNoXSS(input);
  }

  // Path traversal validation
  validateNoPathTraversal(input);

  // Command injection validation (for non-special char fields)
  if (!allowSpecialChars) {
    validateNoCommandInjection(input);
  }

  return input;
}

/**
 * Validates and sanitizes API key format
 */
export function validateApiKey(key: string): boolean {
  // API keys should be alphanumeric with optional dashes/underscores
  // Typical format: sk_live_xxxx or similar
  const apiKeyPattern = /^[a-zA-Z0-9_-]{20,100}$/;
  return apiKeyPattern.test(key);
}

/**
 * Masks sensitive data for logging
 */
export function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password',
    'api_key',
    'apiKey',
    'secret',
    'token',
    'authorization',
    'credit_card',
    'creditCard',
    'ssn',
    'social_security',
  ];

  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      if (typeof value === 'string' && value.length > 4) {
        masked[key] = `***${value.slice(-4)}`;
      } else {
        masked[key] = '***';
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      masked[key] = maskSensitiveData(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Rate limit key generation with sanitization
 */
export function generateRateLimitKey(clientId: string, operation: string): string {
  const sanitizedClient = clientId.replace(/[^a-zA-Z0-9_-]/g, '');
  const sanitizedOp = operation.replace(/[^a-zA-Z0-9_-]/g, '');
  return `ratelimit:${sanitizedClient}:${sanitizedOp}`;
}

/**
 * Sanitize and validate tool arguments for security
 * @param args The raw arguments from the tool call
 * @param toolName The name of the tool being called
 * @returns Sanitized arguments
 */
export function sanitizeToolArguments(
  args: Record<string, unknown>,
  toolName: string,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      // Validate content length
      validateContentLength(value, 50000);

      // Check for SQL injection patterns in text fields
      if (key.includes('note') || key.includes('description') || key.includes('comment')) {
        validateNoSqlInjection(value);
      }

      // Sanitize string values
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      // Recursively sanitize array items
      sanitized[key] = value.map((item: unknown) => {
        if (typeof item === 'object' && item !== null) {
          return sanitizeToolArguments(item as Record<string, unknown>, toolName);
        }
        if (typeof item === 'string') {
          return sanitizeString(item);
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeToolArguments(value as Record<string, unknown>, toolName);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
