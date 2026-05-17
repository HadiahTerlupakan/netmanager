import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getPelangganNotificationHistory,
  PelangganNotFoundError,
} from "@/modules/notification";

/** Ambil riwayat notifikasi dari semua channel untuk satu pelanggan */
export const GET = createHandler(
  { auth: true, permissions: ["notifications:read"] },
  async (_req: NextRequest, ctx) => {
    const pelangganId = ctx.params.id as string;
    const isSuperAdmin = ctx.session!.user.isSuperAdmin === true;
    const tenantId = ctx.session!.user.tenantId ?? null;

    if (!isSuperAdmin && !tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    try {
      const result = await getPelangganNotificationHistory({
        pelangganId,
        isSuperAdmin,
        tenantId,
      });
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof PelangganNotFoundError) {
        return ApiErrors.notFound(error.message);
      }
      throw error;
    }
  },
);
