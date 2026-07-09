import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { socketEmitter } from "@/lib/websocket/emitter";
import { AdminUserRouteService } from "@/modules/users";
import { forceLogoutSchema } from "@/lib/validations/user";
import { logger } from "@/lib/logger";

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
  async (req, ctx) => {
    const startTime = Date.now();
    const { session, params } = ctx;
    const { id: targetUserId } = params;

    if (!targetUserId) return ApiErrors.badRequest("ID User tidak valid");

    if (!session) return ApiErrors.unauthorized();

    // Prevent self force-logout
    if (session.user.id === targetUserId) {
      return ApiErrors.badRequest("Tidak dapat force logout diri sendiri");
    }

    const adminUserRouteService = new AdminUserRouteService();
    const updatedUser =
      await adminUserRouteService.forceLogoutUser(targetUserId);
    if (!updatedUser) return ApiErrors.notFound("User");
    const targetUser = updatedUser;

    // Emit WebSocket event to force logout the user in real-time
    socketEmitter.forceLogout(targetUserId);

    logger.apiRequest(
      "POST",
      `/api/admin/users/${targetUserId}/force-logout`,
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        targetUserId,
        newTokenVersion: updatedUser.tokenVersion,
      },
    );

    await logger.logActivity({
      action: "FORCE_LOGOUT",
      subject: "User",
      userId: session.user.id,
      details: { id: targetUserId, name: targetUser.name },
    });

    return apiSuccess(
      {
        tokenVersion: updatedUser.tokenVersion,
      },
      { message: `User ${targetUser.name} berhasil di-logout paksa` },
    );
  },
);
