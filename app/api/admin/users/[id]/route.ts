import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { logger } from "@/lib/logger";
import { updateUserSchema } from "@/modules/users";
import { AdminUserRouteService } from "@/modules/users";
import type { Session } from "next-auth";

const adminUserRouteService = new AdminUserRouteService();

function getUserId(params: Record<string, string | string[] | undefined>) {
  const rawId = params.id;
  return typeof rawId === "string" ? rawId : "";
}

function toApiError(code: number, message: string) {
  if (code === 400) return ApiErrors.badRequest(message);
  if (code === 403) return ApiErrors.forbidden(message);
  if (code === 404) return ApiErrors.notFound("User");
  if (code === 409) return ApiErrors.conflict(message);
  return ApiErrors.badRequest(message);
}

/** Get user detail for admin route. */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["users:read"],
  },
  async (_req, ctx) => {
    const startTime = Date.now();
    const { session, params } = ctx;
    const userId = getUserId(params);

    if (!session) return ApiErrors.unauthorized();
    if (!userId) return ApiErrors.badRequest("User ID is required");

    const result = await adminUserRouteService.getAdminUserById(
      session as Session & { user: { id: string } },
      userId,
    );
    if (result.ok === false) {
      return toApiError(result.error.code, result.error.message);
    }

    logger.apiRequest(
      "GET",
      `/api/admin/users/${userId}`,
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        targetUserId: userId,
      },
    );

    return apiSuccess(result.data);
  },
);

/** Update user from admin route. */
export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["users:update"],
    schema: updateUserSchema,
  },
  async (_req, ctx) => {
    const startTime = Date.now();
    const { session, params, validated } = ctx;
    const userId = getUserId(params);

    if (!session) return ApiErrors.unauthorized();
    if (!userId) return ApiErrors.badRequest("User ID is required");

    const result = await adminUserRouteService.updateAdminUser(
      session as Session & { user: { id: string; isSuperAdmin?: boolean } },
      userId,
      validated,
    );
    if (result.ok === false) {
      return toApiError(result.error.code, result.error.message);
    }

    logger.apiRequest(
      "PATCH",
      `/api/admin/users/${userId}`,
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        targetUserId: userId,
        changes: Object.keys(validated),
      },
    );

    await logger.logActivity({
      action: "UPDATE",
      subject: "User",
      userId: session.user.id,
      details: { id: userId, changes: Object.keys(validated) },
    });

    return apiSuccess({ ok: true }, { message: "User berhasil diperbarui" });
  },
);

/** Delete user from admin route. */
export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["users:delete"],
  },
  async (_req, ctx) => {
    const startTime = Date.now();
    const { session, params } = ctx;
    const userId = getUserId(params);

    if (!session) return ApiErrors.unauthorized();
    if (!userId) return ApiErrors.badRequest("User ID is required");

    const result = await adminUserRouteService.deleteAdminUser(
      session as Session & { user: { id: string } },
      userId,
    );
    if (result.ok === false) {
      return toApiError(result.error.code, result.error.message);
    }

    logger.apiRequest(
      "DELETE",
      `/api/admin/users/${userId}`,
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        targetUserId: userId,
      },
    );

    await logger.logActivity({
      action: "DELETE",
      subject: "User",
      userId: session.user.id,
      details: { id: userId, name: result.data.deletedUserName },
    });

    return apiSuccess({ ok: true }, { message: "User berhasil dihapus" });
  },
);
