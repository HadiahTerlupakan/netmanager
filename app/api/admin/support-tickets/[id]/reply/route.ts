import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  buildSessionWithPermissions,
  createHandler,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import { idSchema } from "@/lib/validations/common";
import { supportTicketReplySchema } from "@/lib/validations/support-ticket";
import { getAdminSupportTicketRouteService } from "@/modules/pelanggan";
import { checkSiteRestriction } from "@/modules/roles";

const WAITING_CUSTOMER_STATUS = "WAITING_CUSTOMER";

const supportTicketRouteService = getAdminSupportTicketRouteService();

export const POST = createHandler(
  {
    auth: true,
    permissions: ["support:update"],
    schema: supportTicketReplySchema,
  },
  async (_req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    const idResult = idSchema.safeParse(id);
    if (!idResult.success) {
      return apiError("Format ID tidak valid", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    const body = ctx.validated;

    if (
      (!body.message || body.message.trim().length === 0) &&
      (!body.attachments || body.attachments.length === 0)
    ) {
      return apiError(
        "Pesan atau lampiran tidak boleh kosong",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const sessionWithPermissions = buildSessionWithPermissions(
      ctx.session!,
      ctx.permissions,
    );
    const { isRestricted, siteIds } = checkSiteRestriction(
      sessionWithPermissions,
      "support",
    );
    const allowedSiteIds = isRestricted ? siteIds : undefined;

    const result = await supportTicketRouteService.replyToTicket({
      ticketId: idResult.data,
      senderId: user.id,
      message: body.message,
      updateStatus: body.updateStatus || WAITING_CUSTOMER_STATUS,
      sendWhatsApp: body.sendWhatsApp ?? true,
      attachments: body.attachments,
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
  },
);
