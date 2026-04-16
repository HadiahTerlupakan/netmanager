import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/modules/database";
import { prismaMitra } from "@/modules/database";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { hasAnyMobilePermission } from "@/lib/mobile-auth";
import { isSuperAdmin } from "@/lib/auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  buildGudangSiteFilter,
  resolveInventoryActorScope,
} from "@/modules/inventory";

// GET - Get gudang list for mobile
export async function GET(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const decoded = authResult;
    const userId = decoded.id as string;
    const tenantId = decoded.tenantId as string;
    const permissions = decoded.permissions as string[] | undefined;

    if (
      !hasAnyMobilePermission(permissions, [
        "m_barang:read",
        "m_barang_masuk:create",
        "m_barang_keluar:create",
      ])
    ) {
      return apiError("Akses inventory ditolak", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        role: { include: { permission: true } },
        sites: true,
        userSites: {
          select: { siteId: true },
        },
      },
    });

    const mitra = !user
      ? await prismaMitra.mitra.findUnique({
          where: { id: userId },
          select: { id: true, siteId: true },
        })
      : null;

    const actorScope = resolveInventoryActorScope({
      user: user
        ? {
            id: user.id,
            role: user.role,
            sites: user.sites,
            userSites: user.userSites,
          }
        : null,
      mitra,
      isSuperAdmin: user ? isSuperAdmin({ role: user.role?.name }) : false,
    });

    if (!actorScope) {
      return apiError("User tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    const { searchParams } = new URL(req.url);
    const workOrderId = searchParams.get("workOrderId");
    if (workOrderId) {
      const workOrder = await prisma.workOrders.findFirst({
        where: { id: workOrderId, tenantId },
        select: { siteId: true },
      });

      if (
        workOrder?.siteId &&
        !actorScope.allowedSiteIds.includes(workOrder.siteId)
      ) {
        actorScope.allowedSiteIds.push(workOrder.siteId);
      }
    }

    const whereClause: Record<string, unknown> = { isActive: true, tenantId };

    if (actorScope.isRestricted) {
      if (actorScope.allowedSiteIds.length === 0) {
        return apiError(
          "Akses ditolak: Tidak ada site yang ditugaskan",
          ErrorCodes.FORBIDDEN,
          {
            status: 403,
          },
        );
      }

      Object.assign(
        whereClause,
        buildGudangSiteFilter(actorScope.allowedSiteIds),
      );
    }

    const gudangs = await prisma.gudang.findMany({
      where: whereClause,
      select: {
        id: true,
        kode: true,
        nama: true,
        lokasi: true,
      },
      orderBy: { nama: "asc" },
    });

    return NextResponse.json({ gudangList: gudangs });
  } catch (error) {
    console.error("Error fetching gudangs (mobile):", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
