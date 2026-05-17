import { apiSuccess, createHandler, ApiErrors } from "@/lib/api";
import { logger } from "@/lib/logger";
import { getAdminSupportTicketRouteService } from "@/modules/pelanggan";

/**
 * GET /api/admin/support-tickets/unread-count
 * Get count of tickets that need attention
 */
const supportTicketRouteService = getAdminSupportTicketRouteService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const result = await supportTicketRouteService.getUnreadCount(ctx.session!);
  if (!result.ok) {
    return ApiErrors.forbidden(result.error);
  }

  if (!result.success) {
    logger.error("[support-tickets/unread-count] Get unread count failed", {
      error: result.error,
    });
    return ApiErrors.internalError("Gagal mengambil jumlah tiket");
  }

  return apiSuccess(result.data);
});
