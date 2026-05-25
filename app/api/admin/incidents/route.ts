import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getIncidentService } from "@/modules/incident";
import { logger } from "@/lib/logger";
import * as z from "zod";

export const dynamic = "force-dynamic";

const SEVERITY_VALUES = ["CRITICAL", "MAJOR", "MINOR"] as const;
const STATUS_FILTER_VALUES = [
  "ACTIVE",
  "INVESTIGATING",
  "IDENTIFIED",
  "MONITORING",
  "RESOLVED",
] as const;

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1),
  severity: z.enum(SEVERITY_VALUES),
  affectedAreas: z.array(z.string().trim().min(1)).default([]),
  isPublic: z.boolean().optional(),
});

/** GET /api/admin/incidents — list dengan filter status */
export const GET = createHandler({ auth: true }, async (req) => {
  if (!(await hasPermission("incidents:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat incident",
    );
  }

  try {
    const filterRaw = req.nextUrl.searchParams.get("status");
    const status = STATUS_FILTER_VALUES.includes(
      filterRaw as (typeof STATUS_FILTER_VALUES)[number],
    )
      ? (filterRaw as (typeof STATUS_FILTER_VALUES)[number])
      : undefined;

    const incidents = await getIncidentService().list({ status, limit: 100 });
    return apiSuccess(incidents);
  } catch (error: unknown) {
    logger.error("[Admin Incidents] List error:", error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : "Gagal mengambil incident",
    );
  }
});

/** POST /api/admin/incidents — create incident baru */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("incidents:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat incident",
    );
  }

  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);
    const incident = await getIncidentService().create(
      parsed,
      ctx.session!.user.id,
    );
    return apiSuccess(incident, {
      status: 201,
      message: "Incident berhasil dibuat",
    });
  } catch (error: unknown) {
    logger.error("[Admin Incidents] Create error:", error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : "Gagal membuat incident",
    );
  }
});
