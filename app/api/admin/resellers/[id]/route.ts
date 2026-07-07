import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getResellerService, updateResellerSchema } from "@/modules/reseller";

function getTenantId(ctx: {
  session: { user: { tenantId?: string | null } } | null;
}) {
  return ctx.session?.user.tenantId ?? null;
}

function mapResellerError(error: Error) {
  if (error.message.includes("tidak ditemukan")) {
    return ApiErrors.notFound("Reseller");
  }
  if (error.message.includes("sudah digunakan")) {
    return ApiErrors.conflict(error.message);
  }
  return null;
}

export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const reseller = await getResellerService().getResellerById(
      getTenantId(ctx),
      ctx.params.id,
    );
    if (!reseller) return ApiErrors.notFound("Reseller");
    return apiSuccess(reseller);
  },
);

export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["reseller:update"],
    schema: updateResellerSchema,
    feature: "reseller",
  },
  async (_req, ctx) => {
    try {
      const reseller = await getResellerService().updateReseller(
        getTenantId(ctx),
        ctx.params.id,
        ctx.validated,
      );
      return apiSuccess(reseller);
    } catch (error) {
      if (error instanceof Error) {
        const response = mapResellerError(error);
        if (response) return response;
      }
      throw error;
    }
  },
);

export const DELETE = createHandler(
  { auth: true, permissions: ["reseller:delete"], feature: "reseller" },
  async (_req, ctx) => {
    try {
      await getResellerService().deleteReseller(
        getTenantId(ctx),
        ctx.params.id,
      );
      return apiSuccess({ message: "Reseller berhasil dihapus" });
    } catch (error) {
      if (error instanceof Error) {
        const response = mapResellerError(error);
        if (response) return response;
      }
      throw error;
    }
  },
);
