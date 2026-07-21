import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { socketEmitter } from "@/lib/websocket/emitter";
import { AdminUserRouteService } from "@/modules/users";
import { forceLogoutSchema } from "@/lib/validations/user";
import { logger } from "@/lib/logger";
import type { Session } from "next-auth";

/**
 * @swagger
 * /api/admin/users/{id}/force-logout:
 *   post:
 *     summary: Force logout user
 *     description: Mengeluarkan paksa user dengan meng-increment tokenVersion.
 *     tags: [Users]
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["users:force_logout"],
    schema: forceLogoutSchema,
  },
  async (_req, ctx) => {
    const startTime = Date.now();
    const { session, params, permissions } = ctx;
    const rawId = params.id;
    const targetUserId = typeof rawId === "string" ? rawId : rawId?.[0];

    if (!targetUserId) return ApiErrors.badRequest("ID User tidak valid");
    if (!session) return ApiErrors.unauthorized();

    const scopedSession = {
      ...session,
      user: {
        ...session.user,
        permissions: Array.isArray(permissions) ? permissions : [],
      },
    } as Session & {
      user: Session["user"] & {
        id: string;
        tenantId?: string | null;
        permissions?: string[];
      };
    };

    const adminUserRouteService = new AdminUserRouteService();
    const result = await adminUserRouteService.forceLogoutUser(
      scopedSession,
      targetUserId,
    );

    if (result.ok === false) {
      if (result.error.code === 400) {
        return ApiErrors.badRequest(result.error.message);
      }
      if (result.error.code === 403) {
        return ApiErrors.forbidden(result.error.message);
      }
      if (result.error.code === 404) {
        return ApiErrors.notFound("User");
      }
      return ApiErrors.badRequest(result.error.message);
    }

    socketEmitter.forceLogout(targetUserId);

    logger.apiRequest(
      "POST",
      `/api/admin/users/${targetUserId}/force-logout`,
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        targetUserId,
        newTokenVersion: result.data.tokenVersion,
      },
    );

    await logger.logActivity({
      action: "FORCE_LOGOUT",
      subject: "User",
      userId: session.user.id,
      details: { id: targetUserId, name: result.data.name },
    });

    return apiSuccess(
      { tokenVersion: result.data.tokenVersion },
      { message: `User ${result.data.name} berhasil di-logout paksa` },
    );
  },
);
