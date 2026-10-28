import {
  ApiErrors,
  apiSuccess,
  createHandler,
  requireSessionTenantId,
} from "@/lib/api";
import {
  getSampleInvoiceLimits,
  saveSampleInvoiceLimits,
  type SampleInvoiceLimits,
} from "@/modules/sample-invoice";

export const GET = createHandler(
  { auth: true, permissions: ["invoice_contoh:read"] },
  async (_req, ctx) =>
    apiSuccess(await getSampleInvoiceLimits(requireSessionTenantId(ctx))),
);

export const PUT = createHandler(
  { auth: true, permissions: ["invoice_contoh:update"] },
  async (req, ctx) => {
    const body = (await req.json()) as SampleInvoiceLimits;
    try {
      return apiSuccess(
        await saveSampleInvoiceLimits(requireSessionTenantId(ctx), {
          maxCustomers: body.maxCustomers,
          maxMonths: body.maxMonths,
          maxPdfs: body.maxPdfs,
        }),
      );
    } catch (error) {
      return ApiErrors.badRequest(
        error instanceof Error ? error.message : "Batas tidak valid",
      );
    }
  },
);
