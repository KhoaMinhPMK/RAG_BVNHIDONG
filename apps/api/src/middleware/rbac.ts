import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import type { Role } from '../types/api.js';

/**
 * RBAC Middleware - Role-Based Access Control
 * Based on yeu_cau_he_thong_rag.md Section 6
 */

interface RBACPermissions {
  [key: string]: {
    allowedRoles: Role[];
    description: string;
  };
}

// Permission matrix
const permissions: RBACPermissions = {
  'query:knowledge': {
    allowedRoles: ['clinician', 'radiologist', 'researcher', 'admin'],
    description: 'Query knowledge base',
  },
  'explain:detection': {
    allowedRoles: ['clinician', 'radiologist', 'researcher', 'admin'],
    description: 'Get explanation for detection results',
  },
  'draft:create': {
    allowedRoles: ['clinician', 'radiologist', 'researcher'],
    description: 'Create draft report',
  },
  'draft:edit': {
    allowedRoles: ['clinician', 'radiologist', 'researcher'],
    description: 'Edit draft report',
  },
  'draft:approve': {
    allowedRoles: ['clinician', 'radiologist'],
    description: 'Approve draft report',
  },
  'compare:models': {
    allowedRoles: ['researcher', 'admin'],
    description: 'Compare champion/challenger models',
  },
  'knowledge:manage': {
    allowedRoles: ['admin'],
    description: 'Manage knowledge base documents',
  },
  'audit:view': {
    allowedRoles: ['researcher', 'admin'],
    description: 'View audit logs',
  },
  'audit:full': {
    allowedRoles: ['admin'],
    description: 'View full audit logs with sensitive data',
  },
  'template:manage': {
    allowedRoles: ['admin'],
    description: 'Manage report templates',
  },
  'episodes:read': {
    allowedRoles: ['clinician', 'radiologist', 'researcher', 'admin'],
    description: 'View episodes list and details',
  },
  'episodes:create': {
    allowedRoles: ['clinician', 'radiologist', 'admin'],
    description: 'Create new episodes',
  },
  'episodes:update': {
    allowedRoles: ['clinician', 'radiologist', 'admin'],
    description: 'Update episode status and data',
  },
};

/**
 * Check if user has permission
 */
export function hasPermission(userRole: Role, permission: string): boolean {
  const perm = permissions[permission];
  if (!perm) {
    logger.warn('Unknown permission requested', { permission });
    return false;
  }

  return perm.allowedRoles.includes(userRole);
}

/**
 * RBAC middleware factory
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Extract user role from JWT (set by authenticateJWT middleware)
    const userRole = (req as any).userRole as Role;

    if (!userRole) {
      logger.warn('User role not found in request', {
        permission,
        path: req.path,
        ip: req.ip,
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please login.',
        },
      });
    }

    if (!hasPermission(userRole, permission)) {
      logger.warn('Permission denied', {
        userRole,
        permission,
        path: req.path,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: `Permission denied: ${permission}`,
          details: {
            requiredRoles: permissions[permission]?.allowedRoles,
            userRole,
          },
        },
      });
    }

    next();
  };
}

/**
 * Require any of multiple permissions (OR logic)
 */
export function requireAnyPermission(...permissionList: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req.headers['x-user-role'] as Role) || 'clinician';

    const hasAnyPermission = permissionList.some((perm) => hasPermission(userRole, perm));

    if (!hasAnyPermission) {
      logger.warn('Permission denied (any)', {
        userRole,
        permissions: permissionList,
        path: req.path,
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Permission denied',
          details: {
            requiredPermissions: permissionList,
            userRole,
          },
        },
      });
    }

    (req as any).userRole = userRole;
    next();
  };
}

/**
 * Require all permissions (AND logic)
 */
export function requireAllPermissions(...permissionList: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req.headers['x-user-role'] as Role) || 'clinician';

    const hasAllPermissions = permissionList.every((perm) => hasPermission(userRole, perm));

    if (!hasAllPermissions) {
      logger.warn('Permission denied (all)', {
        userRole,
        permissions: permissionList,
        path: req.path,
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Insufficient permissions',
          details: {
            requiredPermissions: permissionList,
            userRole,
          },
        },
      });
    }

    (req as any).userRole = userRole;
    next();
  };
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): string[] {
  return Object.keys(permissions).filter((perm) => hasPermission(role, perm));
}
