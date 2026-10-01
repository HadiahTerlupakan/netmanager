import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import {
  createRoleSchema,
  getRoleService,
  RolePolicyError,
} from "@/modules/roles";
import * as z from "zod";
import { isSuperAdmin } from "@/lib/auth/super-admin";
import { logActivitySafe } from "@/lib/logger";
import { apiSuccess } from "@/lib/api";
import {
  ForbiddenError,
  UnauthorizedError,
  withAnyPermission,
  withAuth,
  withPermission,
  type AuthenticatedHandler,
} from "@/lib/middleware";

const handleGet: AuthenticatedHandler = async ({ request, user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const filterRestricted = searchParams.get("filterRestricted") === "true";

    const roleService = getRoleService();
    const currentUserId = filterRestricted ? user.id : null;

    const roles = await roleService.getRolesForHakAkses(
      filterRestricted,
      currentUserId,
    );
    return apiSuccess(roles);
  } catch (error) {
    logger.error("Error fetching roles:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
};

const handlePost: AuthenticatedHandler = async ({ request, user }) => {
  try {
    const body = await request.json();
    const validated = createRoleSchema.parse(body);
    const roleService = getRoleService();
    const newRole = await roleService.createRoleWithPolicy(validated, {
      tenantId: user.tenantId ?? null,
      actorIsSuperAdmin: isSuperAdmin(user),
    });

    if (user.id) {
      logActivitySafe({
        action: "CREATE",
        subject: "Role",
        userId: user.id,
        details: { id: newRole.id, name: newRole.name },
      });
    }

    return apiSuccess(newRole, { status: 201 });
  } catch (error) {
    logger.error("Error creating role:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validasi gagal" },
        { status: 400 },
      );
    }
    if (error instanceof RolePolicyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
};

const handleAuthError = (error: unknown): NextResponse | null => {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: "Tidak terautentikasi" },
      { status: 401 },
    );
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: "Tidak terautentikasi" },
      { status: 403 },
    );
  }
  return null;
};

const guardedGet = withAuth(
  withAnyPermission(["roles:read", "users:create", "users:update"], handleGet),
);

const guardedPost = withAuth(withPermission("roles:create", handlePost));

export const GET = async (request: NextRequest, routeContext?: unknown) => {
  try {
    return await guardedGet(request, routeContext);
  } catch (error) {
    const response = handleAuthError(error);
    if (response) {
      return response;
    }
    throw error;
  }
};

export const POST = async (request: NextRequest, routeContext?: unknown) => {
  try {
    return await guardedPost(request, routeContext);
  } catch (error) {
    const response = handleAuthError(error);
    if (response) {
      return response;
    }
    throw error;
  }
};
