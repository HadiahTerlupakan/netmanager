import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import { planningMaterialService } from "@/modules/planning";

/**
 * GET /api/planning/[id]/peta/material
 * Pratinjau kebutuhan material dari peta rencana; tidak menulis apa pun.
 */
export const GET = createHandler(
  { auth: true, permissions: ["planning:read"] },
  async (req, ctx) => {
    const rekap = await planningMaterialService.hitung(
      ctx.params.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(rekap);
  },
);

/**
 * POST /api/planning/[id]/peta/material
 * Menerbitkan rekap menjadi item material otomatis. Aturan ada di `PlanningMaterialService`.
 */
export const POST = createHandler(
  { auth: true, permissions: ["planning:update"] },
  async (req, ctx) => {
    const items = await planningMaterialService.terbitkan(
      ctx.params.id,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(items, {
      message: "Material berhasil diterbitkan dari peta rencana",
    });
  },
);
