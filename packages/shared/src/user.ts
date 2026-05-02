import { z } from 'zod';

/**
 * User and RBAC schemas
 */

export const UserRoleSchema = z.enum(['clinician', 'radiologist', 'researcher', 'admin']);

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: UserRoleSchema,
  department: z.string().optional(),
  active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const PermissionSchema = z.enum([
  'query',
  'explain',
  'draft',
  'knowledge.read',
  'knowledge.write',
  'knowledge.approve',
  'admin.users',
  'admin.audit',
  'admin.config',
]);

export const RolePermissionsSchema = z.object({
  clinician: z.array(PermissionSchema).default(['query', 'explain', 'draft']),
  radiologist: z.array(PermissionSchema).default(['query', 'explain', 'draft', 'knowledge.read']),
  researcher: z.array(PermissionSchema).default(['query', 'knowledge.read']),
  admin: z.array(PermissionSchema).default(['*' as any]), // All permissions
});

export type UserRole = z.infer<typeof UserRoleSchema>;
export type User = z.infer<typeof UserSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type RolePermissions = z.infer<typeof RolePermissionsSchema>;
