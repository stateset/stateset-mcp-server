import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import type { Config } from '@config/config';
import { createLogger } from '@utils/logger';

const logger = createLogger('security');

/**
 * CORS middleware configuration
 */
export function createCorsMiddleware(config: Config) {
  const allowedOrigins = config.security.allowedOrigins || ['http://localhost:3000'];
  
  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      logger.warn('CORS request blocked', { origin, allowedOrigins });
      const error = new Error('Not allowed by CORS');
      callback(error, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });
}

/**
 * Helmet security middleware configuration
 */
export function createHelmetMiddleware(config: Config) {
  if (!config.security.enableHelmet) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
}

/**
 * Rate limiting middleware
 */
export function createRateLimitMiddleware(config: Config) {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: config.rateLimit.requestsPerMinute,
    message: {
      error: 'Too many requests',
      retryAfter: 60,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      
      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: 60,
      });
    },
  });
}

/**
 * API key authentication middleware
 */
export function createApiKeyMiddleware(config: Config) {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      logger.warn('Missing API key', { ip: req.ip, path: req.path });
      return res.status(401).json({
        error: 'Authentication required',
        message: 'API key is required',
      });
    }

    const expectedKey = config.api.key || config.api.apiKey;
    if (Array.isArray(apiKey) ? apiKey[0] !== expectedKey : apiKey !== expectedKey) {
      logger.warn('Invalid API key', { 
        ip: req.ip, 
        path: req.path,
        apiKey: Array.isArray(apiKey) ? 
          apiKey[0].substring(0, 8) + '...' : 
          apiKey.substring(0, 8) + '...',
      });
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid API key',
      });
    }

    next();
  };
}

/**
 * IP whitelist middleware
 */
export function createIpWhitelistMiddleware(config: Config) {
  const whitelist = config.security.ipWhitelist || [];
  
  if (whitelist.length === 0) {
    // No whitelist configured, allow all IPs
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    
    if (!clientIp || !whitelist.includes(clientIp)) {
      logger.warn('IP not whitelisted', { 
        ip: clientIp, 
        whitelist,
        path: req.path,
      });
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not authorized',
      });
    }

    next();
  };
}

/**
 * Request validation middleware
 */
export function createRequestValidationMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Validate request size
    const contentLength = req.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) { // 10MB limit
      logger.warn('Request too large', { 
        contentLength, 
        ip: req.ip,
        path: req.path,
      });
      return res.status(413).json({
        error: 'Payload too large',
        message: 'Request body exceeds maximum size limit',
      });
    }

    // Validate content type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return res.status(415).json({
          error: 'Unsupported media type',
          message: 'Content-Type must be application/json',
        });
      }
    }

    next();
  };
} 