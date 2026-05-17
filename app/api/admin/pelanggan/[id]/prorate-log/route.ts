import { NextRequest } from "next/server";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  getPelangganProrateLog,
  ProrateLogPelangganNotFoundError,
} from "@/modules/finance";

/** GET /api/admin/pelanggan/[id]/prorate-log — riwayat prorate per pelanggan. */
export const GET = createHandler(
  { auth: true, permissions: ["finance:read"] },
  async (_req: NextRequest, ctx) => {
    const pelangganId = ctx.params.id as string;
    const isSuperAdmin = ctx.session!.user.isSuperAdmin === true;
    const tenantId = ctx.session!.user.tenantId ?? null;

    if (!isSuperAdmin && !tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    try {
      const result = await getPelangganProrateLog({
        pelangganId,
        isSuperAdmin,
        tenantId,
      });
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof ProrateLogPelangganNotFoundError) {
        return ApiErrors.notFound(error.message);
      }
      throw error;
    }
  },
);
