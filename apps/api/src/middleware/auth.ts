import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase/client.js';
import { logger } from '../utils/logger.js';
import type { Role } from '../types/api.js';

/**
 * JWT Authentication Middleware
 *
 * Validates Supabase JWT tokens and attaches user context to request
 *
 * Usage:
 * router.post('/endpoint', authenticateJWT, requirePermission('...'), handler)
 */

interface JWTPayload {
  id: string;
  sub: string; // user_id
  email: string;
  role: Role;
  aud: string;
  exp: number;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      userId?: string;
      userRole?: Role;
    }
  }
}

/**
 * Main JWT authentication middleware
 * Requires valid token, returns 401 if missing/invalid
 */
export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // DEV BYPASS: Skip auth in development mode when SKIP_AUTH=true
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
      req.userId = '70f081ff-734b-46f7-ba5c-94ffc9fb6e28'; // radiologist@bvnhidong.vn
      req.userRole = 'clinician' as Role;
      req.user = {
        id: 'dev-user-id',
        sub: 'dev-user-id',
        email: 'dev@localhost',
        role: 'clinician' as Role,
        aud: 'authenticated',
        exp: 0,
      };
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing authorization header', {
        path: req.path,
        ip: req.ip,
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authorization header. Please provide a valid Bearer token.',
        },
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('JWT validation failed', {
        error: error?.message,
        path: req.path,
        ip: req.ip,
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token. Please login again.',
        },
      });
      return;
    }

    // Fetch user profile to get role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, role, department')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to fetch user profile', {
        userId: user.id,
        error: profileError?.message,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User profile not found. Please contact administrator.',
        },
      });
      return;
    }

    // Attach user context to request
    req.userId = user.id;
    req.userRole = profile.role as Role;
    req.user = {
      id: user.id,
      sub: user.id,
      email: user.email!,
      role: profile.role as Role,
      aud: 'authenticated',
      exp: 0, // Not needed for our use case
    };

    logger.debug('JWT validated successfully', {
      userId: user.id,
      role: profile.role,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.error('JWT middleware error', {
      error: (error as Error).message,
      path: req.path,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication error',
      },
    });
  }
}

/**
 * Optional authentication middleware
 * Allows both authenticated and unauthenticated requests
 * Useful for endpoints that have different behavior based on auth state
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  // No auth provided - continue without user context
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  // Has auth header - validate it
  return authenticateJWT(req, res, next);
}

/**
 * Check if request has authenticated user
 */
export function isAuthenticated(req: Request): boolean {
  return !!req.userId && !!req.userRole;
}

/**
 * Get user ID from request (throws if not authenticated)
 */
export function requireUserId(req: Request): string {
  if (!req.userId) {
    throw new Error('User ID not found in request. Ensure authenticateJWT middleware is applied.');
  }
  return req.userId;
}

/**
 * Get user role from request (throws if not authenticated)
 */
export function requireUserRole(req: Request): Role {
  if (!req.userRole) {
    throw new Error('User role not found in request. Ensure authenticateJWT middleware is applied.');
  }
  return req.userRole;
}
