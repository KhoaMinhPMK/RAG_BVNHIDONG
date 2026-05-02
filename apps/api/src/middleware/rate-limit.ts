import { Request, Response, NextFunction } from 'express';
import { incrementCounter } from '../lib/cache/redis.js';
import { logger } from '../lib/utils/logger.js';

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string; // Custom error message
  keyGenerator?: (req: Request) => string; // Custom key generator
}

/**
 * Default rate limit configs
 */
export const RateLimitPresets = {
  // Strict - for expensive operations
  strict: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many requests. Please try again in 1 minute.',
  },
  // Standard - for normal API endpoints
  standard: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    message: 'Too many requests. Please try again later.',
  },
  // Generous - for read-only endpoints
  generous: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120,
    message: 'Too many requests. Please try again later.',
  },
  // Auth - for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
};

/**
 * Rate limiting middleware using Redis
 * Falls back to allowing requests if Redis is unavailable
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests',
    keyGenerator = defaultKeyGenerator,
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      const ttl = Math.ceil(windowMs / 1000);

      // Increment counter
      const count = await incrementCounter(key, ttl);

      // If Redis unavailable (count = 0), allow request
      if (count === 0) {
        logger.warn('Rate limiting disabled - Redis unavailable');
        return next();
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
      res.setHeader('X-RateLimit-Reset', Date.now() + windowMs);

      // Check if limit exceeded
      if (count > maxRequests) {
        logger.warn(`Rate limit exceeded for ${key}: ${count}/${maxRequests}`);

        return res.status(429).json({
          error: 'Too Many Requests',
          message,
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limit middleware error:', error);
      // On error, allow request (fail open)
      next();
    }
  };
}

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const path = req.path;
  return `ratelimit:${ip}:${path}`;
}

/**
 * Key generator by user ID (for authenticated routes)
 */
export function userKeyGenerator(req: Request): string {
  const userId = (req as any).user?.id || 'anonymous';
  const path = req.path;
  return `ratelimit:user:${userId}:${path}`;
}

/**
 * Key generator by API key
 */
export function apiKeyGenerator(req: Request): string {
  const apiKey = req.headers['x-api-key'] || 'anonymous';
  const path = req.path;
  return `ratelimit:apikey:${apiKey}:${path}`;
}
