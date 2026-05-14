import { NextRequest } from "next/server";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/modules/database";

/** GET /api/admin/pelanggan/[id]/prorate-log — riwayat prorate per pelanggan. */
export const GET = createHandler(
  { auth: true, permissions: ["finance:read"] },
  async (_req: NextRequest, ctx) => {
    const pelangganId = ctx.params.id as string;
    const isSuperAdmin = ctx.session!.user.isSuperAdmin === true;
    const tenantId = ctx.session!.user.tenantId;

    if (!isSuperAdmin && !tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const tenantFilter = !isSuperAdmin ? { tenantId } : {};

    const pelanggan = await prisma.pelanggan.findFirst({
      where: { id: pelangganId, ...tenantFilter },
      select: { id: true, nama: true },
    });

    if (!pelanggan) {
      return ApiErrors.notFound("Pelanggan tidak ditemukan");
    }

    const logs = await prisma.proratePaymentLog.findMany({
      where: { pelangganId, ...tenantFilter },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return apiSuccess({
      pelanggan: { id: pelanggan.id, nama: pelanggan.nama },
      logs,
    });
  },
);
