import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { idSchema } from "@/lib/validations/common";
import {
  getAdminSupportTicketRouteService,
  supportTicketUpdateSchema,
} from "@/modules/pelanggan";
import * as z from "zod";

const supportTicketRouteService = getAdminSupportTicketRouteService();

/**
 * GET /api/admin/support-tickets/[id]
 * Get single support ticket with all replies
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("support:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const parseResult = idSchema.safeParse(id);
  if (!parseResult.success) {
    return ApiErrors.badRequest("ID tidak valid", {
      errors: z.flattenError(parseResult.error).fieldErrors,
    });
  }

  const result = await supportTicketRouteService.getTicketById(
    parseResult.data,
    {
      user,
    },
  );

  if (!result.success) {
    if (result.code === "NOT_FOUND") return ApiErrors.notFound("Tiket");
    if (result.code === "FORBIDDEN") {
      return ApiErrors.forbidden(result.error || "Akses ditolak");
    }
    throw new Error(result.error || "Gagal mengambil detail tiket");
  }

  return apiSuccess(result.data);
});

/**
 * PATCH /api/admin/support-tickets/[id]
 * Update ticket (status, priority, assignee)
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("support:update"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const idParseResult = idSchema.safeParse(id);
  if (!idParseResult.success) {
    return ApiErrors.badRequest("ID tidak valid", {
      errors: z.flattenError(idParseResult.error).fieldErrors,
    });
  }

  const body = await req.json();
  const parseResult = supportTicketUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return ApiErrors.badRequest("Data tidak valid", {
      errors: z.flattenError(parseResult.error).fieldErrors,
    });
  }

  const updateData = {
    ...(parseResult.data.status !== undefined && {
      status: parseResult.data.status,
    }),
    ...(parseResult.data.priority !== undefined && {
      priority: parseResult.data.priority,
    }),
    ...(parseResult.data.assignedToId !== undefined && {
      assignedToId: parseResult.data.assignedToId,
    }),
    ...(parseResult.data.resolution && {
      closingNote: parseResult.data.resolution,
    }),
  };

  const result = await supportTicketRouteService.updateTicket(
    idParseResult.data,
    updateData,
    { user },
  );

  if (!result.success) {
    if (result.code === "NOT_FOUND") return ApiErrors.notFound("Tiket");
    if (result.code === "FORBIDDEN") {
      return ApiErrors.forbidden(result.error || "Akses ditolak");
    }
    throw new Error(result.error || "Gagal mengupdate tiket");
  }

  return apiSuccess(result.data, { message: "Tiket berhasil diupdate" });
});

/**
 * DELETE /api/admin/support-tickets/[id]
 * Delete support ticket
 */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("support:delete"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const parseResult = idSchema.safeParse(id);
  if (!parseResult.success) {
    return ApiErrors.badRequest("ID tidak valid", {
      errors: z.flattenError(parseResult.error).fieldErrors,
    });
  }

  const result = await supportTicketRouteService.deleteTicket(
    parseResult.data,
    {
      user,
    },
  );

  if (!result.success) {
    if (result.code === "NOT_FOUND") return ApiErrors.notFound("Tiket");
    if (result.code === "FORBIDDEN") {
      return ApiErrors.forbidden(result.error || "Akses ditolak");
    }
    throw new Error(result.error || "Gagal menghapus tiket");
  }

  return apiSuccess(result.data, { message: "Tiket berhasil dihapus" });
});
