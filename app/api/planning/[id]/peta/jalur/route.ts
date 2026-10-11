import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningPetaService,
  buatJalurRencanaSchema,
} from "@/modules/planning";

/**
 * POST /api/planning/[id]/peta/jalur
 * Menambah jalur kabel rencana. Aturan ada di `PlanningPetaService`.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
    schema: buatJalurRencanaSchema,
  },
  async (req, ctx) => {
    const jalur = await planningPetaService.tambahJalur(
      ctx.params.id,
      ctx.validated,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(jalur, {
      status: 201,
      message: "Jalur rencana berhasil ditambahkan",
    });
  },
);
