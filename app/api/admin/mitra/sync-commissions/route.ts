import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getMitraCommissionSyncService } from "@/modules/mitra";
import { syncCommissionSchema } from "@/lib/validations/mitra";

export const POST = createHandler(
  {
    auth: true,
    permissions: ["mitra:update"],
    schema: syncCommissionSchema,
  },
  async (_req, ctx) => {
    const result = await getMitraCommissionSyncService().syncCommission({
      ...ctx.validated,
      tenantId: ctx.session!.user.tenantId ?? undefined,
    });

    if (!result.success) {
      if (result.code === "VALIDATION_ERROR" || result.code === "DUPLICATE") {
        return ApiErrors.badRequest(result.error);
      }
      if (result.code === "NOT_FOUND") {
        return ApiErrors.notFound(result.error);
      }
      return ApiErrors.internalError(result.error);
    }

    return apiSuccess(undefined, {
      message: "Berhasil mensinkronisasi komisi ke wallet",
    });
  },
);
