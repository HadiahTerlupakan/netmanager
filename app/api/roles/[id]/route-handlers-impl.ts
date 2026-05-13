import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getRoleService, RolePolicyError } from "@/modules/roles";
import * as z from "zod";
import { logActivitySafe } from "@/lib/logger";
import { apiSuccess } from "@/lib/api";
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
  permissions: z.array(z.string()),
  accessAdminPanel: z.boolean().optional(),
  accessEmployeePanel: z.boolean().optional(),
  isRestricted: z.boolean().optional(),
  isTechnical: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
  canApproveRab: z.boolean().optional(),
  canReceiveWhatsappApproval: z.boolean().optional(),
});

type RoleRouteContext = {
  params: Promise<{ id: string }>;
};

/** Resolve role id from route context safely. */
const resolveId = async (routeContext?: unknown): Promise<string | null> => {
  const ctx = routeContext as RoleRouteContext | undefined;
  if (!ctx?.params) return null;

  try {
    const { id } = await ctx.params;
    return id;
  } catch {
    return null;
  }
};

/** Return not-found response when role id is missing. */
function roleNotFoundResponse() {
  return NextResponse.json({ error: "Role tidak ditemukan" }, { status: 404 });
}

/** Map role update errors into API response. */
function mapRoleUpdateError(error: unknown) {
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
  if (error instanceof Error && error.message === "Role tidak ditemukan") {
    return roleNotFoundResponse();
  }
  if (
    error instanceof Error &&
    error.message === "Tidak dapat mengubah nama role SUPER_ADMIN"
  ) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(
    { error: "Terjadi kesalahan server" },
    { status: 500 },
  );
}

/** Map role delete errors into API response. */
function mapRoleDeleteError(error: unknown) {
  if (error instanceof Error && error.message === "Role tidak ditemukan") {
    return roleNotFoundResponse();
  }
  if (
    error instanceof Error &&
    (error.message === "Tidak dapat menghapus role SUPER_ADMIN" ||
      error.message ===
        "Tidak dapat menghapus role yang masih memiliki pengguna")
  ) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(
    { error: "Terjadi kesalahan server" },
    { status: 500 },
  );
}

/** Map auth middleware errors into API response. */
function handleAuthError(error: unknown): NextResponse | null {
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
}

/** Handle role detail request. */
const handleGet: AuthenticatedHandler = async (_authCtx, routeContext) => {
  const id = await resolveId(routeContext);
  if (!id) return roleNotFoundResponse();

  try {
    const role = await getRoleService().getRoleWithPermissions(id);
    if (!role) return roleNotFoundResponse();
    return apiSuccess(role);
  } catch (error) {
    logger.error("Error fetching role:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
};

/** Handle role update request. */
const handlePut: AuthenticatedHandler = async (
  { request, user },
  routeContext,
) => {
  const id = await resolveId(routeContext);
  if (!id) return roleNotFoundResponse();

  try {
    const validated = roleUpdateSchema.parse(await request.json());
    const updatedRole = await getRoleService().updateRoleWithPolicy(
      id,
      validated,
      {
        tenantId: user.tenantId ?? null,
      },
    );

    logActivitySafe({
      action: "UPDATE",
      subject: "Role",
      userId: user.id,
      details: { id, updates: validated },
    });

    return apiSuccess(updatedRole);
  } catch (error: unknown) {
    logger.error("Error updating role:", error);
    return mapRoleUpdateError(error);
  }
};

/** Handle role delete request. */
const handleDelete: AuthenticatedHandler = async ({ user }, routeContext) => {
  const id = await resolveId(routeContext);
  if (!id) return roleNotFoundResponse();

  try {
    await getRoleService().deleteRole(id);
    logActivitySafe({
      action: "DELETE",
      subject: "Role",
      userId: user.id,
      details: { id },
    });

    return apiSuccess({ ok: true });
  } catch (error: unknown) {
    logger.error("Error deleting role:", error);
    return mapRoleDeleteError(error);
  }
};

const guardedGet = withAuth(withPermission("roles:read", handleGet));
const guardedPut = withAuth(withPermission("roles:update", handlePut));
const guardedDelete = withAuth(withPermission("roles:delete", handleDelete));

/** Execute guarded role detail controller. */
export const GET = async (request: NextRequest, routeContext?: unknown) => {
  try {
    return await guardedGet(request, routeContext);
  } catch (error) {
    const response = handleAuthError(error);
    if (response) return response;
    throw error;
  }
};

/** Execute guarded role update controller. */
export const PUT = async (request: NextRequest, routeContext?: unknown) => {
  try {
    return await guardedPut(request, routeContext);
  } catch (error) {
    const response = handleAuthError(error);
    if (response) return response;
    throw error;
  }
};

/** Execute guarded role delete controller. */
export const DELETE = async (request: NextRequest, routeContext?: unknown) => {
  try {
    return await guardedDelete(request, routeContext);
  } catch (error) {
    const response = handleAuthError(error);
    if (response) return response;
    throw error;
  }
};
