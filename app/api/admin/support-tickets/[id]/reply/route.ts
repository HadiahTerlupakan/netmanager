const WAITING_CUSTOMER_STATUS = "WAITING_CUSTOMER";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import { getAdminSupportTicketRouteService } from "@/modules/pelanggan";
import { checkSiteRestriction } from "@/modules/roles";

/**
 * POST /api/admin/support-tickets/[id]/reply
 * Admin replies to a ticket
 */
const supportTicketRouteService = getAdminSupportTicketRouteService();

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  const body = await req.json();
  const { message, updateStatus, sendWhatsApp = true, attachments } = body;

  if (
    (!message || message.trim().length === 0) &&
    (!attachments || attachments.length === 0)
  ) {
    return apiError(
      "Pesan atau lampiran tidak boleh kosong",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const { isRestricted, siteIds } = checkSiteRestriction(
    ctx.session as never,
    "support",
  );
  const allowedSiteIds = isRestricted ? siteIds : undefined;

  const result = await supportTicketRouteService.replyToTicket({
    ticketId: id,
    senderId: user.id,
    message,
    updateStatus: updateStatus || WAITING_CUSTOMER_STATUS,
    sendWhatsApp,
    attachments,
    allowedSiteIds,
  });

  if (!result.success) {
    if (result.code === "NOT_FOUND") return ApiErrors.notFound("Tiket");
    if (result.code === "FORBIDDEN") {
      return apiError(result.error || "Akses ditolak", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }
    if (result.code === "VALIDATION_ERROR") {
      return apiError(
        result.error || "Data tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }
    logger.error("[support-tickets/[id]/reply] Reply failed", {
      error: result.error,
    });
    return ApiErrors.internalError("Gagal mengirim balasan");
  }

  return apiSuccess(result.data, { message: "Balasan berhasil dikirim" });
});
