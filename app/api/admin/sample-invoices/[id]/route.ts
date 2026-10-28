import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";
import {
  deleteSampleBatch,
  getSampleBatchParts,
} from "@/modules/sample-invoice";

/** Bagian ZIP yang bisa diunduh untuk satu riwayat. */
export const GET = createHandler(
  { auth: true, permissions: ["invoice_contoh:read"] },
  async (_req, ctx) => {
    const parts = await getSampleBatchParts(ctx.params.id);
    return parts ? apiSuccess({ parts }) : ApiErrors.notFound("Riwayat");
  },
);

export const DELETE = createHandler(
  { auth: true, permissions: ["invoice_contoh:delete"] },
  async (_req, ctx) => {
    await deleteSampleBatch(ctx.params.id);
    return apiSuccess({ deleted: true });
  },
);
