import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  createResellerOutletSchema,
  getResellerOutletService,
} from "@/modules/reseller";

function getTenantId(ctx: {
  session: { user: { tenantId?: string | null } } | null;
}) {
  return ctx.session?.user.tenantId ?? null;
}

function mapOutletError(error: Error) {
  if (error.message.includes("tidak ditemukan")) {
    return ApiErrors.notFound("Outlet reseller");
  }
  if (
    error.message.includes("tidak aktif") ||
    error.message.includes("tidak sesuai")
  ) {
    return ApiErrors.badRequest(error.message);
  }
  if (error.message.includes("sudah digunakan")) {
    return ApiErrors.conflict(error.message);
  }
  return null;
}

export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    try {
      const outlets = await getResellerOutletService().listOutlets(
        getTenantId(ctx),
        ctx.params.id,
      );
      return apiSuccess([...outlets]);
    } catch (error) {
      if (error instanceof Error) {
        const response = mapOutletError(error);
        if (response) return response;
      }
      throw error;
    }
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
    try {
      const outlet = await getResellerOutletService().createOutlet(
        getTenantId(ctx),
        ctx.params.id,
        ctx.validated,
      );
      return apiSuccess(outlet, { status: 201 });
    } catch (error) {
      if (error instanceof Error) {
        const response = mapOutletError(error);
        if (response) return response;
      }
      throw error;
    }
  },
);
