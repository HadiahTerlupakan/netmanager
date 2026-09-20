import { NextRequest, NextResponse } from "next/server";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import {
  authConfig,
  getUserPermissions,
  isSuperAdmin as isSuperAdminHelper,
} from "@/lib/auth";
import { logger } from "@/lib/logger";
import { logAuthAttempt } from "./audit";

/**
 * Core Authorization Evaluator
 */

export interface AuthorizationConfig {
  permissions?: string[];
  requireAll?: boolean;
  allowSelf?: boolean;
  selfIdParam?: string;
  auditLog?: boolean;
  errorMessages?: {
    unauthorized?: string;
    forbidden?: string;
  };
}

export interface AuthorizedSession {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    siteId?: string | null;
    siteIds?: string[];
    primarySiteId?: string | null;
    departmentId?: string | null;
    isSales?: boolean;
    isSuperAdmin?: boolean;
    tenantId?: string | null;
  };
  permissions: string[];
}

interface SessionUser {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  isSuperAdmin?: boolean;
  permissions?: string[];
  siteId?: string | null;
  siteIds?: string[];
  primarySiteId?: string | null;
  departmentId?: string | null;
  isSales?: boolean;
  tenantId?: string | null;
}

export type AuthorizationResult =
  | { error: NextResponse; session?: never }
  | { session: AuthorizedSession; error?: never };

export async function authorize(
  request: NextRequest,
  config: AuthorizationConfig = {},
  params?: { id?: string },
): Promise<AuthorizationResult> {
  const {
    permissions = [],
    requireAll = false,
    allowSelf = false,
    selfIdParam = "id",
    auditLog = false,
    errorMessages = {},
  } = config;

  let session: Record<string, unknown> | null;
  try {
    session = (await getServerSession(authConfig as NextAuthOptions)) as Record<
      string,
      unknown
    > | null;
  } catch (error) {
    logger.error("[AUTH] Error getting session:", error);
    return {
      error: NextResponse.json(
        { error: errorMessages.unauthorized || "Kesalahan autentikasi" },
        { status: 500 },
      ),
    };
  }

  if (!(session?.user as SessionUser)?.id) {
    if (auditLog) {
      await logAuthAttempt({
        userId: null,
        url: request.url,
        action: "AUTHENTICATION_FAILED",
        granted: false,
        details: { reason: "No session found" },
      });
    }

    return {
      error: NextResponse.json(
        { error: errorMessages.unauthorized || "Autentikasi diperlukan" },
        { status: 401 },
      ),
    };
  }

  const user = session.user as SessionUser;
  const userId = user.id;
  const userRole = user.role || "";
  const userSiteId = user.siteId;
  const userSiteIds = user.siteIds || (userSiteId ? [userSiteId] : []);
  const primarySiteId = user.primarySiteId || userSiteId;
  const isSuperAdmin = isSuperAdminHelper(user);

  let userPermissions: string[] = [];

  if (isSuperAdmin) {
    return {
      session: {
        user: {
          id: userId,
          email: user.email || "",
          name: user.name || null,
          role: userRole,
          siteId: primarySiteId,
          siteIds: userSiteIds,
          primarySiteId,
          departmentId: user.departmentId,
          isSales: user.isSales,
          isSuperAdmin: true,
          tenantId: user.tenantId,
        },
        permissions: ["*"],
      },
    };
  }

  try {
    userPermissions = await getUserPermissions(userId);
  } catch (error) {
    logger.error("[AUTH] Error loading permissions:", error);
    return {
      error: NextResponse.json(
        { error: "Kesalahan otorisasi" },
        { status: 500 },
      ),
    };
  }

  const resourceId = params?.[selfIdParam as keyof typeof params] || params?.id;
  const isSelfAccess = allowSelf && resourceId === userId;

  if (isSelfAccess) {
    return {
      session: {
        user: {
          id: userId,
          email: user.email || "",
          name: user.name || null,
          role: userRole,
          siteId: primarySiteId,
          siteIds: userSiteIds,
          primarySiteId,
          departmentId: user.departmentId,
          isSales: user.isSales,
        },
        permissions: userPermissions,
      },
    };
  }

  if (permissions.length > 0) {
    const hasAccess = requireAll
      ? permissions.every((p) => userPermissions.includes(p))
      : permissions.some((p) => userPermissions.includes(p));

    if (!hasAccess) {
      if (auditLog) {
        await logAuthAttempt({
          userId,
          url: request.url,
          action: "PERMISSION_DENIED",
          granted: false,
          details: {
            required: permissions,
            requireAll,
            userPermissions: userPermissions.length,
          },
        });
      }

      logger.warn("[AUTH] Permission denied", {
        userId,
        required: permissions,
        requireAll,
        userHas: userPermissions.length,
      });

      return {
        error: NextResponse.json(
          { error: errorMessages.forbidden || "Izin tidak mencukupi" },
          { status: 403 },
        ),
      };
    }
  }

  if (auditLog) {
    await logAuthAttempt({
      userId,
      url: request.url,
      action: "ACCESS_GRANTED",
      granted: true,
      details: { permissions: permissions.length > 0 ? permissions : "*" },
    });
  }

  return {
    session: {
      user: {
        id: userId,
        email: user.email || "",
        name: user.name || null,
        role: userRole,
        siteId: primarySiteId,
        siteIds: userSiteIds,
        primarySiteId,
        departmentId: user.departmentId,
        isSales: user.isSales,
        isSuperAdmin: false,
        tenantId: user.tenantId,
      },
      permissions: userPermissions,
    },
  };
}
