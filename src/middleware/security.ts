import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createLogger } from '@utils/logger';
import { config } from '@config/index';

const logger = createLogger('security');

// Security headers configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'no-referrer' },
  xssFilter: true,
});

// CORS configuration
export const corsOptions = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = config.security?.allowedOrigins || ['http://localhost:3000'];
    
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400, // 24 hours
});

// Compression middleware
export const compressionMiddleware = compression({
  filter: (req: Request, res: Response) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Fallback to standard filter function
    return compression.filter(req, res);
  },
  level: 6, // Balanced compression level
  threshold: 1024, // Only compress responses larger than 1KB
});

// Request sanitization middleware
export const sanitizeRequest: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Remove any null bytes from request
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      return value.replace(/\0/g, '');
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);

  next();
};

// API key validation middleware
export const validateApiKey: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');

  if (!apiKey) {
    logger.warn({ ip: req.ip, path: req.path }, 'Missing API key');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required',
    });
  }

  // In a real implementation, validate against a database or service
  if (apiKey !== config.api.apiKey) {
    logger.warn({ ip: req.ip, path: req.path }, 'Invalid API key');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  }

  // Add user context to request
  (req as any).user = {
    apiKey: apiKey.substring(0, 8) + '...',
    authenticated: true,
  };

  next();
};

// IP whitelist middleware
export const ipWhitelist: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const whitelist = config.security?.ipWhitelist || [];
  
  if (whitelist.length === 0) {
    return next(); // No whitelist configured
  }

  const clientIp = req.ip || req.connection.remoteAddress;
  
  if (!clientIp || !whitelist.includes(clientIp)) {
    logger.warn({ ip: clientIp, path: req.path }, 'IP not in whitelist');
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied',
    });
  }

  next();
};

// Request size limit middleware
export const requestSizeLimit = (limit: string = '10mb'): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxSize = parseSize(limit);

    if (contentLength > maxSize) {
      logger.warn(
        { ip: req.ip, path: req.path, contentLength, maxSize },
        'Request size exceeds limit'
      );
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request size exceeds limit of ${limit}`,
      });
    }

    next();
  };
};

// Helper function to parse size strings
function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }

  const [, value, unit] = match;
  const multiplier = units[unit];

  if (!multiplier) {
    throw new Error(`Unknown size unit: ${unit}`);
  }

  return parseFloat(value) * multiplier;
}

// Security audit logging
export const auditLog: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  // Log request
  logger.info({
    type: 'audit',
    event: 'request',
    ip: req.ip,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    user: (req as any).user,
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      type: 'audit',
      event: 'response',
      ip: req.ip,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      user: (req as any).user,
    });
  });

  next();
};

// Combined security middleware
export const security = [
  securityHeaders,
  corsOptions,
  compressionMiddleware,
  sanitizeRequest,
  requestSizeLimit('10mb'),
]; 