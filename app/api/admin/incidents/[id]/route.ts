import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { responsGalatInsiden } from "@/lib/api/incident-route";
import { addIncidentUpdateSchema, getIncidentService } from "@/modules/incident";

export const dynamic = "force-dynamic";

/** GET /api/admin/incidents/[id] — detail beserta riwayat update. */
export const GET = createHandler({ auth: true, permissions: ["incidents:read"] }, async (_req, ctx) => {
  try {
    return apiSuccess(await getIncidentService().getById(requireSessionTenantId(ctx), ctx.params.id));
  } catch (error) {
    return responsGalatInsiden(error, "detail");
  }
});

/** POST /api/admin/incidents/[id] — tambah update status (409 bila insiden sudah selesai). */
export const POST = createHandler(
  { auth: true, permissions: ["incidents:update"], schema: addIncidentUpdateSchema },
  async (_req, ctx) => {
    try {
      const update = await getIncidentService().addUpdate(
        requireSessionTenantId(ctx),
        ctx.params.id,
        ctx.validated!,
        ctx.session!.user.id,
      );
      return apiSuccess(update, { message: "Update berhasil ditambahkan" });
    } catch (error) {
      return responsGalatInsiden(error, "update");
    }
  },
);

/** DELETE /api/admin/incidents/[id] */
export const DELETE = createHandler({ auth: true, permissions: ["incidents:delete"] }, async (_req, ctx) => {
  try {
    await getIncidentService().delete(requireSessionTenantId(ctx), ctx.params.id);
    return apiSuccess(null, { message: "Insiden berhasil dihapus" });
  } catch (error) {
    return responsGalatInsiden(error, "hapus");
  }
});
