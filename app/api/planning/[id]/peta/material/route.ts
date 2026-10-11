import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningMaterialService,
  terbitkanMaterialSchema,
} from "@/modules/planning";

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
 *
 * `spareKabelPersen` opsional: cadangan yang dipilih perencana di panel ikut
 * tersimpan di rencana, supaya angka yang dipesan dan angka yang terlihat
 * berikutnya tidak bisa berbeda.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
    schema: terbitkanMaterialSchema,
  },
  async (req, ctx) => {
    const items = await planningMaterialService.terbitkan(
      ctx.params.id,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
      ctx.validated.spareKabelPersen,
    );

    return apiSuccess(items, {
      message: "Material berhasil diterbitkan dari peta rencana",
    });
  },
);
