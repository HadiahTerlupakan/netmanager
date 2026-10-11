import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningPetaService,
  buatTitikRencanaSchema,
} from "@/modules/planning";

/**
 * PUT /api/planning/[id]/peta/titik/[nodeId]
 * Mengubah titik rencana.
 */
export const PUT = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
    schema: buatTitikRencanaSchema,
  },
  async (req, ctx) => {
    const titik = await planningPetaService.ubahTitik(
      ctx.params.id,
      ctx.params.nodeId,
      ctx.validated,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(titik, { message: "Titik rencana berhasil diperbarui" });
  },
);

/**
 * DELETE /api/planning/[id]/peta/titik/[nodeId]
 * Menghapus titik rencana.
 */
export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
  },
  async (req, ctx) => {
    const { id, nodeId } = ctx.params;

    await planningPetaService.hapusTitik(
      id,
      nodeId,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(
      { nodeId },
      { message: "Titik rencana berhasil dihapus" },
    );
  },
);
