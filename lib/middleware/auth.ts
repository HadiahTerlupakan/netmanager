/**
 * Authentication Middleware
 * Centralized authentication middleware using verifyAuth()
 * Replaces multiple auth patterns (requireAdmin, getServerSession, verifyAuth)
 */

import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin, verifyAuth } from "@/lib/auth";
import type { UserSession } from "@/lib/auth";
import { UnauthorizedError } from "./error-handler";

/**
 * Authentication context passed to handlers
 */
export interface AuthContext {
  user: UserSession;
  request: NextRequest;
}

/**
 * Handler function with authentication context
 */
export type AuthenticatedHandler<T = unknown> = (
  context: AuthContext,
  routeContext?: unknown,
) => Promise<NextResponse<T>>;

/**
 * Middleware to require authentication
 * Supports both web (NextAuth JWT) and mobile (Bearer token) authentication
 *
 * @example
 * ```ts
 * export const GET = withAuth(async ({ user, request }) => {
 *   // user is guaranteed to be authenticated
 *   return apiSuccess({ userId: user.id })
 * })
 * ```
 */
export function withAuth<T = unknown>(handler: AuthenticatedHandler<T>) {
  return async (
    request: NextRequest,
    routeContext?: unknown,
  ): Promise<NextResponse> => {
    const user = await verifyAuth(request);

    if (!user) {
      throw new UnauthorizedError("Autentikasi diperlukan");
    }

    return handler({ user, request }, routeContext);
  };
}

/**
 * Middleware to require admin panel access
 * Checks that user has accessAdminPanel permission
 *
 * @example
 * ```ts
 * export const GET = withAdminAuth(async ({ user, request }) => {
 *   // user has admin access
 *   return apiSuccess(data)
 * })
 * ```
 */
export function withAdminAuth<T = unknown>(handler: AuthenticatedHandler<T>) {
  return async (
    request: NextRequest,
    routeContext?: unknown,
  ): Promise<NextResponse> => {
    const user = await verifyAuth(request);

    if (!user) {
      throw new UnauthorizedError("Autentikasi diperlukan");
    }

    // Check admin panel access
    const hasAdminAccess = await checkAdminAccess(user);
    if (!hasAdminAccess) {
      throw new UnauthorizedError("Akses admin diperlukan");
    }

    return handler({ user, request }, routeContext);
  };
}

/**
 * Middleware to require employee panel access
 * Checks that user has accessEmployeePanel permission
 */
export function withEmployeeAuth<T = unknown>(
  handler: AuthenticatedHandler<T>,
) {
  return async (
    request: NextRequest,
    routeContext?: unknown,
  ): Promise<NextResponse> => {
    const user = await verifyAuth(request);

    if (!user) {
      throw new UnauthorizedError("Autentikasi diperlukan");
    }

    // Check employee panel access
    const hasEmployeeAccess = await checkEmployeeAccess(user);
    if (!hasEmployeeAccess) {
      throw new UnauthorizedError("Akses karyawan diperlukan");
    }

    return handler({ user, request }, routeContext);
  };
}

/**
 * Helper function to check admin panel access
 * SUPER_ADMIN always has access
 */
async function checkAdminAccess(user: UserSession): Promise<boolean> {
  // SUPER_ADMIN bypass
  if (isSuperAdmin(user)) {
    return true;
  }

  // Load user with role to check accessAdminPanel
  const { prisma } = await import("@/lib/prisma");
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      role: {
        select: {
          accessAdminPanel: true,
        },
      },
    },
  });

  return dbUser?.role?.accessAdminPanel ?? false;
}

/**
 * Helper function to check employee panel access
 * SUPER_ADMIN always has access
 */
async function checkEmployeeAccess(user: UserSession): Promise<boolean> {
  // SUPER_ADMIN bypass
  if (isSuperAdmin(user)) {
    return true;
  }

  // Load user with role to check accessEmployeePanel
  const { prisma } = await import("@/lib/prisma");
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      role: {
        select: {
          accessEmployeePanel: true,
        },
      },
    },
  });

  return dbUser?.role?.accessEmployeePanel ?? false;
}

/**
 * Optional auth - user may or may not be authenticated
 * Handler receives user as null if not authenticated
 *
 * @example
 * ```ts
 * export const GET = withOptionalAuth(async ({ user, request }) => {
 *   if (user) {
 *     // Authenticated behavior
 *   } else {
 *     // Anonymous behavior
 *   }
 * })
 * ```
 */
export function withOptionalAuth<T = unknown>(
  handler: (
    context: { user: UserSession | null; request: NextRequest },
    routeContext?: { params: Record<string, string | string[]> },
  ) => Promise<NextResponse<T>>,
) {
  return async (
    request: NextRequest,
    routeContext?: { params: Record<string, string | string[]> },
  ): Promise<NextResponse> => {
    const user = await verifyAuth(request);
    return handler({ user, request }, routeContext);
  };
}
