import { apiSuccess, createHandler, ApiErrors } from "@/lib/api";
import { logger } from "@/lib/logger";
import { getAdminSupportTicketRouteService } from "@/modules/pelanggan";

const supportTicketRouteService = getAdminSupportTicketRouteService();

export const GET = createHandler(
  { auth: true, permissions: ["support:read"] },
  async (_req, ctx) => {
    const result = await supportTicketRouteService.getUnreadCount(ctx.session!);
    if (!result.ok) return ApiErrors.forbidden(result.error);
    if (!result.success) {
      logger.error("[support-tickets/unread-count] Get unread count failed", {
        error: result.error,
      });
      return ApiErrors.internalError("Gagal mengambil jumlah tiket");
    }
    const response = apiSuccess(result.data);
    response.headers.set("Cache-Control", "private, max-age=30");
    return response;
  },
);
