import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import { planningPetaService } from "@/modules/planning";

/**
 * DELETE /api/planning/[id]/peta/jalur/[edgeId]
 * Menghapus jalur rencana.
 */
export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
  },
  async (req, ctx) => {
    const { id, edgeId } = ctx.params;

    await planningPetaService.hapusJalur(
      id,
      edgeId,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(
      { edgeId },
      { message: "Jalur rencana berhasil dihapus" },
    );
  },
);
