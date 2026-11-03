import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import {
  getResellerPricingService,
  upsertResellerPackagePriceSchema,
} from "@/modules/reseller";

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

export const POST = createHandler(
  {
    auth: true,
    permissions: ["reseller:update"],
    schema: upsertResellerPackagePriceSchema,
    feature: "reseller",
  },
  async (_req, ctx) => {
    const price = await getResellerPricingService().upsertPackagePrice({
      ...ctx.validated,
      tenantId: requireSessionTenantId(ctx),
      resellerId: ctx.params.id,
    });
    return apiSuccess(price, { status: 201 });
  },
);
