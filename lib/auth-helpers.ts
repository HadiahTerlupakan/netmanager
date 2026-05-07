/**
 * @deprecated This file is deprecated for NEW routes.
 *
 * MIGRATION PATH:
 * - For NEW API routes: Use `createHandler({ auth: true })` pattern from @/lib/api
 * - For existing routes: Keep using this file for backward compatibility
 *
 * REASON:
 * This file uses manual auth guard pattern which has been replaced by
 * the more robust `createHandler` pattern that integrates with authorization
 * middleware and provides better error handling.
 *
 * KEPT FOR:
 * - Backward compatibility with existing routes
 * - Routes that haven't been migrated yet
 *
 * NEW ROUTES SHOULD USE:
 * ```typescript
 * import { createHandler, apiSuccess } from "@/lib/api";
 *
 * export const GET = createHandler(
 *   { auth: true, permissions: ["resource:read"] },
 *   async (req, ctx) => {
 *     const user = ctx.session.user;
 *     // Your logic here
 *     return apiSuccess(data);
 *   }
 * );
 * ```
 */

import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authConfig } from "@/lib/auth";

// Re-export isSuperAdminRole from new location
export { isSuperAdminRole } from "@/lib/auth";

function logSecurityEvent(
  request: NextRequest,
  event: string,
  details: unknown = null,
) {
  const timestamp = new Date().toISOString();
  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "Unknown";
  const userAgent = request.headers.get("user-agent") || "Unknown";

  logger.warn(`[SECURITY] ${event}`, {
    timestamp,
    ip,
    userAgent,
    url: request.url,
    method: request.method,
    details,
  });
}

export async function getCurrentSession(_request: NextRequest) {
  try {
    const session = (await getServerSession(authConfig)) as
      | (Session & { user: { role?: string; id: string; employee?: unknown } })
      | null;

    if (!session) {
      return null;
    }

    if (session?.user) {
      if (!session.user.role) {
        session.user.role = "ADMIN";
      }
    }

    return session;
  } catch (error) {
    logger.error("[AUTH] Error getting session:", error);
    return null;
  }
}

export async function requireAuth(request: NextRequest) {
  const session = await getCurrentSession(request);

  if (!session?.user) {
    logSecurityEvent(request, "UNAUTHORIZED_ACCESS", {
      reason: "No session found",
    });

    return NextResponse.json(
      { error: "Autentikasi diperlukan" },
      { status: 401 },
    );
  }

  return session;
}

export async function requireAdmin(request: NextRequest) {
  const session = await getCurrentSession(request);

  if (!session) {
    logSecurityEvent(request, "UNAUTHORIZED_ACCESS", {
      reason: "No session found",
    });

    return NextResponse.json(
      { error: "Tidak terautentikasi" },
      { status: 401 },
    );
  }

  return session;
}

export async function requireSelfAccess(
  request: NextRequest,
  resourceId: string,
) {
  const session = await getCurrentSession(request);

  if (!session) {
    logSecurityEvent(request, "UNAUTHORIZED_ACCESS", {
      reason: "No session found",
    });

    return NextResponse.json(
      { error: "Autentikasi diperlukan" },
      { status: 401 },
    );
  }

  const userId = session.user.id;

  if (resourceId !== userId) {
    logSecurityEvent(request, "UNAUTHORIZED_SELF_ACCESS", {
      userId,
      attemptedAccess: resourceId,
    });

    return NextResponse.json(
      { error: "Tidak dapat mengakses data user lain" },
      { status: 403 },
    );
  }

  return session;
}

export async function getCurrentUserId(
  request: NextRequest,
): Promise<string | null> {
  const session = await getCurrentSession(request);
  return session?.user?.id || null;
}

export async function getCurrentEmployee(request: NextRequest) {
  const session = await getCurrentSession(request);
  return session?.user?.employee || null;
}

export async function isAdmin(request: NextRequest): Promise<boolean> {
  const session = await getCurrentSession(request);
  return session?.user?.role === "ADMIN";
}
