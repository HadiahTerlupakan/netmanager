import { apiPaginated, apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { createResellerSchema, getResellerService } from "@/modules/reseller";

function getTenantId(ctx: {
  session: { user: { tenantId?: string | null } } | null;
}) {
  return ctx.session?.user.tenantId ?? null;
}

export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const page = Number(ctx.query.page ?? 1);
    const limit = Number(ctx.query.limit ?? 20);
    const result = await getResellerService().listResellers({
      tenantId: getTenantId(ctx),
      page,
      limit,
    });

    return apiPaginated([...result.items], {
      page,
      limit,
      total: result.total,
    });
  },
);

export const POST = createHandler(
  {
    auth: true,
    permissions: ["reseller:create"],
    schema: createResellerSchema,
    feature: "reseller",
  },
  async (_req, ctx) => {
    try {
      const reseller = await getResellerService().createReseller({
        ...ctx.validated,
        tenantId: getTenantId(ctx),
      });
      return apiSuccess(reseller, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message.includes("sudah digunakan")) {
        return ApiErrors.conflict(error.message);
      }
      throw error;
    }
  },
);
