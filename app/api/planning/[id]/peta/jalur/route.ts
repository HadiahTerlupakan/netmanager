import { z } from "zod";

import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningPetaService,
  buatJalurRencanaSchema,
} from "@/modules/planning";

const edgeIdQuerySchema = z.string().min(1, "edgeId wajib diisi");

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

/**
 * DELETE /api/planning/[id]/peta/jalur?edgeId=...
 * Menghapus jalur rencana.
 */
export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
  },
  async (req, ctx) => {
    const edgeId = edgeIdQuerySchema.parse(ctx.query.edgeId);

    await planningPetaService.hapusJalur(
      ctx.params.id,
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
