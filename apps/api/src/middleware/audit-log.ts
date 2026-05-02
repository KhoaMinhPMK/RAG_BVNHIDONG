import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/utils/logger.js';

/**
 * Audit log entry
 */
interface AuditLogEntry {
  timestamp: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  statusCode?: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Sensitive operations that require audit logging
 */
const SENSITIVE_OPERATIONS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/documents',
  '/api/episodes',
  '/api/reports',
  '/api/admin',
];

/**
 * Check if request path is sensitive
 */
function isSensitiveOperation(path: string): boolean {
  return SENSITIVE_OPERATIONS.some((op) => path.startsWith(op));
}

/**
 * Audit logging middleware
 * Logs all sensitive operations for compliance and security
 */
export function auditLog() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Only log sensitive operations
    if (!isSensitiveOperation(req.path)) {
      return next();
    }

    // Capture response
    const originalSend = res.send;
    let responseBody: any;

    res.send = function (body: any) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    // Continue request
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      const auditEntry: AuditLogEntry = {
        timestamp: new Date().toISOString(),
        userId: (req as any).user?.id,
        action: getActionFromMethod(req.method),
        resource: getResourceFromPath(req.path),
        resourceId: req.params.id,
        method: req.method,
        path: req.path,
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        statusCode: res.statusCode,
        metadata: {
          duration,
          query: req.query,
          // Don't log sensitive data like passwords
          body: sanitizeBody(req.body),
        },
      };

      // Log based on status code
      if (res.statusCode >= 500) {
        logger.error('Audit log - Server error', auditEntry);
      } else if (res.statusCode >= 400) {
        logger.warn('Audit log - Client error', auditEntry);
      } else {
        logger.info('Audit log', auditEntry);
      }

      // For critical operations, also log to separate audit file
      if (isCriticalOperation(req.path)) {
        logToAuditFile(auditEntry);
      }
    });

    next();
  };
}

/**
 * Get action from HTTP method
 */
function getActionFromMethod(method: string): string {
  const actions: Record<string, string> = {
    GET: 'read',
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  };
  return actions[method] || method.toLowerCase();
}

/**
 * Get resource from path
 */
function getResourceFromPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[1] || 'unknown'; // e.g., /api/documents -> documents
}

/**
 * Sanitize request body to remove sensitive data
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key'];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Check if operation is critical (requires separate audit log)
 */
function isCriticalOperation(path: string): boolean {
  const criticalOps = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/admin',
    '/api/documents', // Medical documents
    '/api/episodes', // Patient data
  ];

  return criticalOps.some((op) => path.startsWith(op));
}

/**
 * Log to separate audit file (for compliance)
 */
function logToAuditFile(entry: AuditLogEntry): void {
  // Create separate audit logger
  const auditLogger = logger.child({ type: 'audit' });
  auditLogger.info('AUDIT', entry);

  // TODO: Also send to external audit service (e.g., AWS CloudTrail, Splunk)
  // await sendToAuditService(entry);
}

/**
 * Middleware to log failed authentication attempts
 */
export function logFailedAuth() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function (body: any) {
      if (res.statusCode === 401 || res.statusCode === 403) {
        logger.warn('Failed authentication attempt', {
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          statusCode: res.statusCode,
        });
      }
      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Middleware to detect suspicious activity
 */
export function detectSuspiciousActivity() {
  const suspiciousPatterns = [
    /(\.\.|\/etc\/|\/proc\/|\/sys\/)/i, // Path traversal
    /(union|select|insert|update|delete|drop|create|alter)/i, // SQL injection
    /(<script|javascript:|onerror=|onload=)/i, // XSS
    /(eval\(|exec\(|system\()/i, // Code injection
  ];

  return (req: Request, res: Response, next: NextFunction) => {
    const checkString = JSON.stringify({
      path: req.path,
      query: req.query,
      body: req.body,
    });

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(checkString)) {
        logger.error('Suspicious activity detected', {
          timestamp: new Date().toISOString(),
          pattern: pattern.toString(),
          path: req.path,
          method: req.method,
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          query: req.query,
          body: sanitizeBody(req.body),
        });

        // Block request
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Suspicious activity detected',
        });
      }
    }

    next();
  };
}
