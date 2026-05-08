import * as z from "zod";

import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { AdminLeaveRouteService } from "@/modules/attendance";

const service = new AdminLeaveRouteService();

const updateLeaveStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().max(500).optional(),
});

export const PATCH = createHandler(
  {
    auth: true,
    schema: updateLeaveStatusSchema,
  },
  async (_req, ctx) => {
    if (!(await hasPermission("leave:verify"))) {
      return ApiErrors.forbidden("Anda membutuhkan permission verify");
    }

    const result = await service.updateStatus({
      id: ctx.params.id,
      status: ctx.validated.status,
      rejectionReason: ctx.validated.rejectionReason,
      session: ctx.session as never,
    });

    if (!result.success) {
      if (result.code === "NOT_FOUND") {
        return ApiErrors.notFound("Pengajuan izin");
      }
      if (result.code === "FORBIDDEN") {
        return ApiErrors.forbidden(result.error);
      }
      return ApiErrors.internalError(result.error);
    }

    return apiSuccess(result.data, {
      message:
        ctx.validated.status === "APPROVED"
          ? "Izin berhasil disetujui"
          : "Izin berhasil ditolak",
    });
  },
);

export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("leave:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus izin",
    );
  }

  const result = await service.deleteLeave({
    id: ctx.params.id,
    session: ctx.session as never,
  });

  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      return ApiErrors.notFound("Pengajuan izin");
    }
    if (result.code === "FORBIDDEN") {
      return ApiErrors.forbidden(result.error);
    }
    return ApiErrors.internalError(result.error);
  }

  return apiSuccess(null, { message: "Izin berhasil dihapus" });
});
