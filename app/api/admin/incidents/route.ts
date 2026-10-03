import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { responsGalatInsiden } from "@/lib/api/incident-route";
import { parseQuery } from "@/lib/api/query-parser";
import { createIncidentSchema, getIncidentService, listIncidentQuerySchema } from "@/modules/incident";

export const dynamic = "force-dynamic";

const HTTP_CREATED = 201;
const BATAS_DAFTAR_ADMIN = 100;

/** GET /api/admin/incidents?status= — daftar insiden tenant (ACTIVE = belum selesai). */
export const GET = createHandler({ auth: true, permissions: ["incidents:read"] }, async (req, ctx) => {
  const { status } = listIncidentQuerySchema.parse(parseQuery(new URL(req.url).searchParams));
  try {
    return apiSuccess(
      await getIncidentService().list({ tenantId: requireSessionTenantId(ctx), status, limit: BATAS_DAFTAR_ADMIN }),
    );
  } catch (error) {
    return responsGalatInsiden(error, "daftar");
  }
});

/** POST /api/admin/incidents — buat insiden baru (update awal INVESTIGATING ikut dibuat). */
export const POST = createHandler(
  { auth: true, permissions: ["incidents:create"], schema: createIncidentSchema },
  async (_req, ctx) => {
    try {
      const incident = await getIncidentService().create(
        requireSessionTenantId(ctx),
        ctx.validated!,
        ctx.session!.user.id,
      );
      return apiSuccess(incident, { status: HTTP_CREATED, message: "Insiden berhasil dibuat" });
    } catch (error) {
      return responsGalatInsiden(error, "buat");
    }
  },
);
