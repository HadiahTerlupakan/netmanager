import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { idSchema } from "@/lib/validations/common";
import {
  supportTicketUpdateSchema,
  type SupportTicketUpdate,
} from "@/lib/validations/support-ticket";
import { logger } from "@/lib/logger";
import { getAdminSupportTicketRouteService } from "@/modules/pelanggan";
import * as z from "zod";

const supportTicketRouteService = getAdminSupportTicketRouteService();

export const GET = createHandler(
  { auth: true, permissions: ["support:read"] },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const parseResult = idSchema.safeParse(id);
    if (!parseResult.success) {
      return ApiErrors.badRequest("ID tidak valid", {
        errors: z.flattenError(parseResult.error).fieldErrors,
      });
    }
    const result = await supportTicketRouteService.getTicketById(
      parseResult.data,
      { user: ctx.session!.user },
    );
    if (!result.success) {
      if (result.code === "NOT_FOUND") return ApiErrors.notFound("Tiket");
      if (result.code === "FORBIDDEN")
        return ApiErrors.forbidden(result.error || "Akses ditolak");
      logger.error("[support-tickets/[id]] Get detail failed", {
        error: result.error,
      });
      return ApiErrors.internalError("Gagal mengambil detail tiket");
    }
    return apiSuccess(result.data);
  },
);

export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["support:update"],
    schema: supportTicketUpdateSchema,
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const idParseResult = idSchema.safeParse(id);
    if (!idParseResult.success) {
      return ApiErrors.badRequest("ID tidak valid", {
        errors: z.flattenError(idParseResult.error).fieldErrors,
      });
    }
    const validated = ctx.validated as SupportTicketUpdate;
    const updateData = {
      ...(validated.status !== undefined && { status: validated.status }),
      ...(validated.priority !== undefined && { priority: validated.priority }),
      ...(validated.assignedToId !== undefined && {
        assignedToId: validated.assignedToId,
      }),
      ...(validated.resolution && { closingNote: validated.resolution }),
    };
    const result = await supportTicketRouteService.updateTicket(
      idParseResult.data,
      updateData,
      { user: ctx.session!.user },
    );
    if (!result.success) {
      if (result.code === "NOT_FOUND") return ApiErrors.notFound("Tiket");
      if (result.code === "FORBIDDEN")
        return ApiErrors.forbidden(result.error || "Akses ditolak");
      logger.error("[support-tickets/[id]] Update failed", {
        error: result.error,
      });
      return ApiErrors.internalError("Gagal mengupdate tiket");
    }
    return apiSuccess(result.data, { message: "Tiket berhasil diupdate" });
  },
);

export const DELETE = createHandler(
  { auth: true, permissions: ["support:delete"] },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const parseResult = idSchema.safeParse(id);
    if (!parseResult.success) {
      return ApiErrors.badRequest("ID tidak valid", {
        errors: z.flattenError(parseResult.error).fieldErrors,
      });
    }
    const result = await supportTicketRouteService.deleteTicket(
      parseResult.data,
      { user: ctx.session!.user },
    );
    if (!result.success) {
      if (result.code === "NOT_FOUND") return ApiErrors.notFound("Tiket");
      if (result.code === "FORBIDDEN")
        return ApiErrors.forbidden(result.error || "Akses ditolak");
      logger.error("[support-tickets/[id]] Delete failed", {
        error: result.error,
      });
      return ApiErrors.internalError("Gagal menghapus tiket");
    }
    return apiSuccess(result.data, { message: "Tiket berhasil dihapus" });
  },
);
