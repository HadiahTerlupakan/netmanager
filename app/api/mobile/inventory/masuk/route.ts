import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { hasMobilePermission } from "@/lib/mobile-auth";
import { prisma } from "@/modules/database";
import { prismaMitra } from "@/modules/database";
import { socketEmitter } from "@/lib/websocket/emitter";
import { isSuperAdmin } from "@/lib/auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  getAssignedInventorySiteIds,
  hasGudangSiteAccess,
  isInventorySiteRestricted,
} from "@/modules/inventory/utils/validation";

// POST - Create barang masuk (mobile)
export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const payload = authResult;
    const tenantId = payload.tenantId as string;
    const userId = payload.id as string;
    const permissions = payload.permissions as string[] | undefined;

    if (!hasMobilePermission(permissions, "m_barang_masuk:create")) {
      return apiError("Akses inventory masuk ditolak", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }

    const body = await request.json();
    const {
      barangId,
      gudangId,
      jumlah,
      kondisi,
      keterangan,
      supplier,
      fotoBukti,
    } = body;

    if (!barangId || !gudangId || !jumlah || jumlah <= 0) {
      return apiError("Data tidak lengkap", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
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

    if (!user && !mitra) {
      return apiError("User tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    if (mitra) {
      return apiError(
        "Mutasi inventory untuk mitra belum tersedia",
        ErrorCodes.FORBIDDEN,
        { status: 403 },
      );
    }

    const userPermissions =
      user.role?.permission.map((p) => `${p.resource}:${p.action}`) || [];
    const allowedSiteIds = getAssignedInventorySiteIds({
      primarySite: user.sites ? { id: user.sites.id } : null,
      userSites: user.userSites || null,
    });
    const isRestricted = isInventorySiteRestricted({
      actorType: "user",
      isSuperAdmin: isSuperAdmin({ role: user.role?.name }),
      permissions: userPermissions,
    });

    const targetGudang = await prisma.gudang.findFirst({
      where: { id: gudangId, tenantId },
      include: { sites: { select: { id: true } } },
    });

    if (!targetGudang) {
      return apiError("Gudang tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    if (isRestricted) {
      if (allowedSiteIds.length === 0) {
        return apiError(
          "Akses ditolak: Tidak ada site yang ditugaskan",
          ErrorCodes.FORBIDDEN,
          { status: 403 },
        );
      }

      const gudangSiteIds = targetGudang.sites.map((site) => site.id);
      if (!hasGudangSiteAccess(gudangSiteIds, allowedSiteIds)) {
        return apiError(
          "Akses ditolak: Gudang di luar site Anda",
          ErrorCodes.FORBIDDEN,
          { status: 403 },
        );
      }
    }

    const stockField =
      kondisi === "BEKAS"
        ? "stokBekas"
        : kondisi === "RUSAK"
          ? "stokRusak"
          : "stokBaru";

    const result = await prisma.$transaction(async (tx) => {
      const masuk = await tx.barangMasuk.create({
        data: {
          id: crypto.randomUUID(),
          barangId,
          gudangId,
          jumlah,
          kondisi: kondisi || "BARU",
          keterangan,
          supplier,
          fotoBukti: fotoBukti || [],
          userId: user.id,
        },
        include: { barang: true, gudang: true },
      });

      await tx.barangGudang.upsert({
        where: {
          barangId_gudangId: { barangId, gudangId },
        },
        create: {
          id: crypto.randomUUID(),
          barangId,
          gudangId,
          stok: jumlah,
          [stockField]: jumlah,
          updatedAt: new Date(),
        },
        update: {
          stok: { increment: jumlah },
          [stockField]: { increment: jumlah },
          updatedAt: new Date(),
        },
      });

      return masuk;
    });

    socketEmitter.inventoryUpdate({
      type: "masuk",
      userId: user.id,
      barangId,
      gudangId,
      jumlah,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Mobile Barang Masuk Error:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
