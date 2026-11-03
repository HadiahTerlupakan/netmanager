import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import {
  createResellerOutletSchema,
  getResellerOutletService,
} from "@/modules/reseller";

export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const outlets = await getResellerOutletService().listOutlets(
      requireSessionTenantId(ctx),
      ctx.params.id,
    );
    return apiSuccess([...outlets]);
  },
);

export const POST = createHandler(
  {
    auth: true,
    permissions: ["reseller:update"],
    schema: createResellerOutletSchema,
    feature: "reseller",
  },
  async (_req, ctx) => {
    const outlet = await getResellerOutletService().createOutlet(
      requireSessionTenantId(ctx),
      ctx.params.id,
      ctx.validated,
    );
    return apiSuccess(outlet, { status: 201 });
  },
);
