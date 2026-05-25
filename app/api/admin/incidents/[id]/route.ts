import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getIncidentService } from "@/modules/incident";
import { logger } from "@/lib/logger";
import * as z from "zod";

export const dynamic = "force-dynamic";

const STATUS_VALUES = [
  "INVESTIGATING",
  "IDENTIFIED",
  "MONITORING",
  "RESOLVED",
] as const;

const updateSchema = z.object({
  status: z.enum(STATUS_VALUES),
  message: z.string().trim().min(1),
});

/** GET /api/admin/incidents/[id] — detail dengan history updates */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("incidents:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat incident",
    );
  }

  try {
    const incident = await getIncidentService().getById(ctx.params.id);
    if (!incident) return ApiErrors.notFound("Incident");
    return apiSuccess(incident);
  } catch (error: unknown) {
    logger.error("[Admin Incidents] Detail error:", error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : "Gagal mengambil incident",
    );
  }
});

/** POST /api/admin/incidents/[id] — tambah update status */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("incidents:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk update incident",
    );
  }

  try {
    const body = await req.json();
    const parsed = updateSchema.parse(body);
    const update = await getIncidentService().addUpdate(
      ctx.params.id,
      parsed,
      ctx.session!.user.id,
    );
    return apiSuccess(update, { message: "Update berhasil ditambahkan" });
  } catch (error: unknown) {
    logger.error("[Admin Incidents] Update error:", error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : "Gagal update incident",
    );
  }
});

/** DELETE /api/admin/incidents/[id] */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("incidents:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus incident",
    );
  }

  try {
    await getIncidentService().delete(ctx.params.id);
    return apiSuccess(null, { message: "Incident berhasil dihapus" });
  } catch (error: unknown) {
    logger.error("[Admin Incidents] Delete error:", error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : "Gagal menghapus incident",
    );
  }
});
