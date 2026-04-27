import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { logActivitySafe } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import { lemburActionSchema, OvertimeRouteService } from "@/modules/overtime";
import * as z from "zod";

const overtimeRouteService = new OvertimeRouteService();

/**
 * GET /api/admin/lembur/[id]
 * Retrieve single overtime record
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("lembur:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  try {
    const overtime = await overtimeRouteService.getAdminDetail({
      id: ctx.params.id,
      session: ctx.session as never,
    });

    return apiSuccess(overtime);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Data lembur tidak ditemukan"
    ) {
      return ApiErrors.notFound(error.message);
    }
    return ApiErrors.internalError("Gagal mengambil data lembur");
  }
});

/**
 * PATCH /api/admin/lembur/[id]
 * Update or verify overtime record
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const body = await req.json();
  const parseResult = lemburActionSchema.safeParse(body);

  if (!parseResult.success) {
    return ApiErrors.badRequest("Data tidak valid", {
      errors: z.flattenError(parseResult.error).fieldErrors,
    });
  }

  const { action, reason, startTime, endTime } = parseResult.data;

  try {
    if (action === "approve" || action === "reject") {
      if (!(await hasPermission("lembur:verify"))) {
        return ApiErrors.forbidden("Anda membutuhkan permission lembur:verify");
      }

      if (action === "approve") {
        const result = await overtimeRouteService.approve({
          id: ctx.params.id,
          session: ctx.session as never,
        });

        logActivitySafe({
          action: "UPDATE",
          subject: "Overtime",
          userId: user.id,
          details: { id: ctx.params.id, action: "APPROVE" },
        });
        return apiSuccess(result, { message: "Lembur berhasil disetujui" });
      }

      if (!reason) {
        return ApiErrors.badRequest("Alasan penolakan wajib diisi");
      }

      const result = await overtimeRouteService.reject({
        id: ctx.params.id,
        reason,
        session: ctx.session as never,
      });

      logActivitySafe({
        action: "UPDATE",
        subject: "Overtime",
        userId: user.id,
        details: { id: ctx.params.id, action: "REJECT", reason },
      });
      return apiSuccess(result, { message: "Lembur berhasil ditolak" });
    }

    if (!(await hasPermission("lembur:update"))) {
      return ApiErrors.forbidden("Anda membutuhkan permission lembur:update");
    }

    const result = await overtimeRouteService.updateAdminOvertime({
      id: ctx.params.id,
      reason,
      startTime,
      endTime,
      session: ctx.session as never,
    });

    logActivitySafe({
      action: "UPDATE",
      subject: "Overtime",
      userId: user.id,
      details: { id: ctx.params.id, updates: { reason, startTime, endTime } },
    });

    return apiSuccess(result, { message: "Data lembur berhasil diperbarui" });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Data lembur tidak ditemukan"
    ) {
      return ApiErrors.notFound(error.message);
    }
    return ApiErrors.internalError(
      error instanceof Error ? error.message : "Gagal memproses data lembur",
    );
  }
});

/**
 * DELETE /api/admin/lembur/[id]
 * Remove overtime record
 */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("lembur:delete"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  try {
    await overtimeRouteService.delete({
      id: ctx.params.id,
      session: ctx.session as never,
    });

    logActivitySafe({
      action: "DELETE",
      subject: "Overtime",
      userId: user.id,
      details: { id: ctx.params.id },
    });

    return apiSuccess(
      { id: ctx.params.id },
      { message: "Lembur berhasil dihapus" },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Data lembur tidak ditemukan"
    ) {
      return ApiErrors.notFound(error.message);
    }
    return ApiErrors.internalError("Gagal menghapus data lembur");
  }
});
