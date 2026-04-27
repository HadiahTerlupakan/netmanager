import { TicketStatus } from "@prisma/client";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { getAdminSupportTicketRouteService } from "@/modules/pelanggan";

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

  const result = await supportTicketRouteService.replyToTicket({
    ticketId: id,
    senderId: user.id,
    message,
    updateStatus: updateStatus || TicketStatus.WAITING_CUSTOMER,
    sendWhatsApp,
    attachments,
  });

  if (!result.success) {
    if (result.code === "NOT_FOUND") return ApiErrors.notFound("Tiket");
    if (result.code === "VALIDATION_ERROR") {
      return apiError(
        result.error || "Data tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }
    throw new Error(result.error || "Gagal mengirim balasan");
  }

  return apiSuccess(result.data, { message: "Balasan berhasil dikirim" });
});
