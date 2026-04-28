import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getRoleService, RolePolicyError } from "@/modules/roles";
import * as z from "zod";
import { logActivitySafe } from "@/lib/logger";
import {
  ForbiddenError,
  UnauthorizedError,
  withAuth,
  withPermission,
  type AuthenticatedHandler,
} from "@/lib/middleware";

const roleUpdateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissions: z.array(z.string()), // Array of permission IDs
  accessAdminPanel: z.boolean().optional(),
  accessEmployeePanel: z.boolean().optional(),
  isRestricted: z.boolean().optional(),
  isTechnical: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
  canApproveRab: z.boolean().optional(),
});
type RoleRouteContext = {
  params: Promise<{ id: string }>;
};

const resolveId = async (routeContext?: unknown): Promise<string | null> => {
  const ctx = routeContext as RoleRouteContext | undefined;
  if (!ctx?.params) {
    return null;
  }

  try {
    const { id } = await ctx.params;
    return id;
  } catch {
    return null;
  }
};

const handleGet: AuthenticatedHandler = async (_authCtx, routeContext) => {
  const id = await resolveId(routeContext);
  if (!id) {
    return NextResponse.json(
      { error: "Role tidak ditemukan" },
      { status: 404 },
    );
  }

  try {
    const roleService = getRoleService();
    const role = await roleService.getRoleWithPermissions(id);

    if (!role) {
      return NextResponse.json(
        { error: "Role tidak ditemukan" },
        { status: 404 },
      );
    }

    return NextResponse.json(role);
  } catch (error) {
    logger.error("Error fetching role:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
};

const handlePut: AuthenticatedHandler = async (
  { request, user },
  routeContext,
) => {
  const id = await resolveId(routeContext);
  if (!id) {
    return NextResponse.json(
      { error: "Role tidak ditemukan" },
      { status: 404 },
    );
  }

  try {
    const body = await request.json();
    const validated = roleUpdateSchema.parse(body);
    const roleService = getRoleService();
    const updatedRole = await roleService.updateRoleWithPolicy(id, validated, {
      tenantId: user.tenantId ?? null,
    });

    logActivitySafe({
      action: "UPDATE",
      subject: "Role",
      userId: user.id,
      details: { id, updates: validated },
    });

    return NextResponse.json(updatedRole);
  } catch (error: unknown) {
    logger.error("Error updating role:", error);
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
      if (error.message === "Role tidak ditemukan") {
        return NextResponse.json(
          { error: "Role tidak ditemukan" },
          { status: 404 },
        );
      }
      if (error.message === "Tidak dapat mengubah nama role SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Tidak dapat mengubah nama role SUPER_ADMIN" },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
};

const handleDelete: AuthenticatedHandler = async ({ user }, routeContext) => {
  const id = await resolveId(routeContext);
  if (!id) {
    return NextResponse.json(
      { error: "Role tidak ditemukan" },
      { status: 404 },
    );
  }

  try {
    const roleService = getRoleService();
    await roleService.deleteRole(id);

    logActivitySafe({
      action: "DELETE",
      subject: "Role",
      userId: user.id,
      details: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("Error deleting role:", error);
    if (error instanceof Error) {
      if (error.message === "Role tidak ditemukan") {
        return NextResponse.json(
          { error: "Role tidak ditemukan" },
          { status: 404 },
        );
      }
      if (
        error.message === "Tidak dapat menghapus role SUPER_ADMIN" ||
        error.message ===
          "Tidak dapat menghapus role yang masih memiliki pengguna"
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
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

const guardedGet = withAuth(withPermission("roles:read", handleGet));

const guardedPut = withAuth(withPermission("roles:update", handlePut));

const guardedDelete = withAuth(withPermission("roles:delete", handleDelete));

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

export const PUT = async (request: NextRequest, routeContext?: unknown) => {
  try {
    return await guardedPut(request, routeContext);
  } catch (error) {
    const response = handleAuthError(error);
    if (response) {
      return response;
    }
    throw error;
  }
};

export const DELETE = async (request: NextRequest, routeContext?: unknown) => {
  try {
    return await guardedDelete(request, routeContext);
  } catch (error) {
    const response = handleAuthError(error);
    if (response) {
      return response;
    }
    throw error;
  }
};
