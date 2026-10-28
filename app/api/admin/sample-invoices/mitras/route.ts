import { apiSuccess, createHandler } from "@/lib/api";
import { listMitraOptions } from "@/modules/sample-invoice";

/** Pilihan mitra pada form invoice contoh. */
export const GET = createHandler(
  { auth: true, permissions: ["invoice_contoh:read"] },
  async () => apiSuccess(await listMitraOptions()),
);
