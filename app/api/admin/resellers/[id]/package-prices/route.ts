import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getResellerPricingService,
  upsertResellerPackagePriceSchema,
} from "@/modules/reseller";

function getTenantId(ctx: {
  session: { user: { tenantId?: string | null } } | null;
}) {
  return ctx.session?.user.tenantId ?? null;
}

export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const prices = await getResellerPricingService().listPackagePrices(
      getTenantId(ctx),
      ctx.params.id,
    );
    return apiSuccess(prices);
  },
);

export const POST = createHandler(
  {
    auth: true,
    permissions: ["reseller:update"],
    schema: upsertResellerPackagePriceSchema,
    feature: "reseller",
  },
  async (_req, ctx) => {
    try {
      const price = await getResellerPricingService().upsertPackagePrice({
        ...ctx.validated,
        tenantId: getTenantId(ctx),
        resellerId: ctx.params.id,
      });
      return apiSuccess(price, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message.includes("tidak ditemukan")) {
        return ApiErrors.notFound("Reseller");
      }
      throw error;
    }
  },
);
