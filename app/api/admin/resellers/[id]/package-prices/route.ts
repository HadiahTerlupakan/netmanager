import {
  apiError,
  apiSuccess,
  createHandler,
  requireSessionTenantId,
} from "@/lib/api";
import {
  getResellerPricingService,
  RESELLER_PACKAGE_PRICE_DEPRECATED_MESSAGE,
} from "@/modules/reseller";

const GONE_STATUS = 410;
const DEPRECATED_CODE = "RESELLER_PACKAGE_PRICE_DEPRECATED";

/** Data harga khusus lama tetap bisa dibaca (hanya-baca). */
export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const prices = await getResellerPricingService().listPackagePrices(
      requireSessionTenantId(ctx),
      ctx.params.id,
    );
    return apiSuccess(prices);
  },
);

/** Tulis harga khusus reseller dihentikan: model agen memakai harga paket ISP. */
const rejectDeprecatedWrite = createHandler(
  { auth: true, permissions: ["reseller:update"], feature: "reseller" },
  async () =>
    apiError(RESELLER_PACKAGE_PRICE_DEPRECATED_MESSAGE, DEPRECATED_CODE, {
      status: GONE_STATUS,
    }),
);

export const POST = rejectDeprecatedWrite;
export const PATCH = rejectDeprecatedWrite;
export const DELETE = rejectDeprecatedWrite;
