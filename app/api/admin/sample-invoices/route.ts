import {
  ApiErrors,
  apiSuccess,
  createHandler,
  requireSessionTenantId,
} from "@/lib/api";
import {
  SampleInvoiceInputError,
  generateSampleBatch,
  listSampleBatches,
} from "@/modules/sample-invoice";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/** Riwayat generate invoice contoh, per mitra. */
export const GET = createHandler(
  { auth: true, permissions: ["invoice_contoh:read"] },
  async (_req, ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(ctx.query.limit) || DEFAULT_LIMIT),
    );
    return apiSuccess(
      await listSampleBatches({
        mitraId: text(ctx.query.mitraId),
        page,
        limit,
      }),
    );
  },
);

/** Generate set invoice contoh baru; ZIP-nya diunduh lewat route download. */
export const POST = createHandler(
  { auth: true, permissions: ["invoice_contoh:create"] },
  async (req, ctx) => {
    const tenantId = requireSessionTenantId(ctx);
    const user = ctx.session!.user;
    try {
      const result = await generateSampleBatch(
        tenantId,
        { id: user.id, name: user.name ?? user.email },
        await req.json(),
      );
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof SampleInvoiceInputError) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
