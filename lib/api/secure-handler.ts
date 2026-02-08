import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, isSuperAdmin, getUserPermissions } from '@/lib/auth';
import { ApiErrors } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export type SecureContext = {
  user: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
    siteId?: string;
    departmentId?: string;
    [key: string]: unknown;
  };
  isSuperAdmin: boolean;
};

type HandlerFunction = (
  req: NextRequest,
  ctx: SecureContext & { params?: Record<string, string | string[] | undefined> }
) => Promise<NextResponse>;

type PermissionRequirement = string | string[] | ((user: SecureContext['user']) => boolean | Promise<boolean>);

interface SecureOptions {
  /**
   * Permission required to access this endpoint.
   * Can be a single string ('barang:read'), an array of strings (allow any of),
   * or a custom validation function.
   */
  permission?: PermissionRequirement;

  /**
   * If true, allows Super Admin to bypass permission checks.
   * Default: true
   */
  bypassSuperAdmin?: boolean;
}

/**
 * Wraps an API route handler with authentication and permission checks.
 *
 * @param handler The API route handler function
 * @param options Security options (permissions, etc.)
 */
export function secure(
  handler: HandlerFunction,
  options: SecureOptions = {}
) {
  return async (req: NextRequest, { params }: { params?: Promise<Record<string, string | string[] | undefined>> } = {}) => {
    const path = req.nextUrl.pathname;
    const method = req.method;

    // Resolve params if it's a promise (Next.js 15+)
    const resolvedParams = params ? await params : {};

    try {
      // 1. Verify Authentication
      const user = await verifyAuth(req);
      if (!user) {
        return ApiErrors.unauthorized('Session tidak valid');
      }

      // 2. Prepare Context
      const isSuper = isSuperAdmin(user);
      const userPermissions = await getUserPermissions(user.id);

      const context: SecureContext = {
        user: { ...user, permissions: userPermissions },
        isSuperAdmin: isSuper,
      };

      // 3. Check Permissions
      const { permission, bypassSuperAdmin = true } = options;

      if (permission) {
        // Skip check if user is Super Admin and bypass is enabled
        if (bypassSuperAdmin && isSuper) {
          // Allowed
        } else {
          let hasAccess = false;

          if (typeof permission === 'function') {
            hasAccess = await permission(context.user);
          } else if (Array.isArray(permission)) {
            // Allow if user has ANY of the permissions in the array
            hasAccess = permission.some(p => userPermissions.includes(p));
          } else {
            // Single permission string
            hasAccess = userPermissions.includes(permission);
          }

          if (!hasAccess) {
            const requiredPerm = Array.isArray(permission) ? permission.join(' OR ') : permission;
            logger.warn(`Access denied for ${user.email} on ${method} ${path}. Required: ${requiredPerm}`);
            return ApiErrors.forbidden(`Akses ditolak. Anda memerlukan permission: ${requiredPerm}`);
          }
        }
      }

      // 4. Execute Handler
      return await handler(req, { ...context, params: resolvedParams });

    } catch (error) {
      // 5. Global Error Handling
      console.error(`[SecureHandler] Error in ${method} ${path}:`, error);

      if (error instanceof Error) {
        // If it's already a known API error response structure, return strictly
        // Otherwise wrap it
        return ApiErrors.internalError(error.message || 'Terjadi kesalahan internal server');
      }

      return ApiErrors.internalError('Terjadi kesalahan yang tidak diketahui');
    }
  };
}
