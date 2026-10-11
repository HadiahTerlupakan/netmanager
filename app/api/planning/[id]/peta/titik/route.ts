import { z } from "zod";

import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningPetaService,
  buatTitikRencanaSchema,
} from "@/modules/planning";

const nodeIdQuerySchema = z.string().min(1, "nodeId wajib diisi");

/**
 * GET /api/planning/[id]/peta/titik
 * Seluruh titik dan jalur rencana pada peta planning.
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning:read"],
  },
  async (req, ctx) => {
    const peta = await planningPetaService.ambilPeta(
      ctx.params.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(peta);
  },
);

/**
 * POST /api/planning/[id]/peta/titik
 * Menambah titik rencana. Aturan ada di `PlanningPetaService`.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
    schema: buatTitikRencanaSchema,
  },
  async (req, ctx) => {
    const titik = await planningPetaService.tambahTitik(
      ctx.params.id,
      ctx.validated,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(titik, {
      status: 201,
      message: "Titik rencana berhasil ditambahkan",
    });
  },
);

/**
 * PUT /api/planning/[id]/peta/titik?nodeId=...
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
      nodeIdQuerySchema.parse(ctx.query.nodeId),
      ctx.validated,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(titik, { message: "Titik rencana berhasil diperbarui" });
  },
);

/**
 * DELETE /api/planning/[id]/peta/titik?nodeId=...
 * Menghapus titik rencana.
 */
export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
  },
  async (req, ctx) => {
    const nodeId = nodeIdQuerySchema.parse(ctx.query.nodeId);

    await planningPetaService.hapusTitik(
      ctx.params.id,
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
