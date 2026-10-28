import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { getIssuerPrefill } from "@/modules/sample-invoice";

/** Isian awal identitas penerbit pada form generate. */
export const GET = createHandler(
  { auth: true, permissions: ["invoice_contoh:read"] },
  async (_req, ctx) =>
    apiSuccess(await getIssuerPrefill(requireSessionTenantId(ctx))),
);
