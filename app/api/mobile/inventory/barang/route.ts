import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/modules/database";
import { prismaMitra } from "@/modules/database";
import { Prisma } from "@prisma/client";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { hasAnyMobilePermission } from "@/lib/mobile-auth";
import { isSuperAdmin } from "@/lib/auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  buildGudangSiteFilter,
  getAssignedInventorySiteIds,
  isInventorySiteRestricted,
} from "@/modules/inventory/utils/validation";

// GET - Get barang list for mobile
// Query params:
//   - gudangId: required - Target warehouse
//   - mode: 'masuk' | 'keluar' (default: 'keluar')
//     - masuk: return ALL barang (master data) for receiving new stock
//     - keluar: return only barang with existing stock in the gudang
export async function GET(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const decoded = authResult;
    const userId = decoded.id as string;
    const tenantId = decoded.tenantId as string;

    const { searchParams } = new URL(req.url);
    const gudangId = searchParams.get("gudangId");
    const mode = searchParams.get("mode") || "keluar"; // Default to 'keluar' for backward compatibility
    const permissions = decoded.permissions as string[] | undefined;
    const allowedPermissions =
      mode === "masuk"
        ? ["m_barang:read", "m_barang_masuk:create"]
        : ["m_barang:read", "m_barang_keluar:create"];

    if (!hasAnyMobilePermission(permissions, allowedPermissions)) {
      return apiError("Akses inventory ditolak", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }

    if (!gudangId && mode !== "masuk") {
      return apiError("gudangId required", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    // Fetch user to check permissions
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

    // Fallback: check Mitra table
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

    const userPermissions =
      user?.role?.permission.map((p) => `${p.resource}:${p.action}`) || [];
    const allowedSiteIds = getAssignedInventorySiteIds({
      primarySite: user?.sites ? { id: user.sites.id } : null,
      userSites: user?.userSites || null,
      mitraSiteId: mitra?.siteId,
    });
    const isRestricted = isInventorySiteRestricted({
      actorType: mitra ? "mitra" : "user",
      isSuperAdmin: user ? isSuperAdmin({ role: user.role?.name }) : false,
      permissions: userPermissions,
    });

    if (isRestricted && allowedSiteIds.length === 0) {
      return apiError(
        "Akses ditolak: Tidak ada site yang ditugaskan",
        ErrorCodes.FORBIDDEN,
        { status: 403 },
      );
    }

    // MODE: MASUK - Return ALL master barang (for receiving new stock)
    if (mode === "masuk") {
      const barangWhere: Prisma.BarangWhereInput = { tenantId };

      if (isRestricted) {
        barangWhere.barangGudang = {
          some: {
            gudang: buildGudangSiteFilter(allowedSiteIds),
          },
        };
      }

      // Get all barang from master data
      const allBarang = await prisma.barang.findMany({
        where: barangWhere,
        select: {
          id: true,
          kode: true,
          nama: true,
          satuan: true,
          isWorkOrderMaterial: true,
        },
        orderBy: { nama: "asc" },
      });

      const barangList = allBarang.map((b) => ({
        id: b.id,
        kode: b.kode,
        nama: b.nama,
        satuan: b.satuan,
        isWorkOrderMaterial: b.isWorkOrderMaterial,
        stok: 0,
        stokBaru: 0,
        stokBekas: 0,
        stokRusak: 0,
      }));

      return NextResponse.json({ barangList });
    }

    // MODE: KELUAR (default) - Return only barang with existing stock in gudang
    const whereClause: Record<string, unknown> = {
      gudangId,
      tenantId,
    };

    if (isRestricted) {
      whereClause.gudang = buildGudangSiteFilter(allowedSiteIds);
    }

    // Get barang with stock in the specified gudang using BarangGudang
    const barangGudangs = await prisma.barangGudang.findMany({
      where: whereClause,
      include: {
        barang: {
          select: {
            id: true,
            kode: true,
            nama: true,
            satuan: true,
            isWorkOrderMaterial: true,
          },
        },
      },
      orderBy: {
        barang: { nama: "asc" },
      },
    });

    const barangList = barangGudangs.map((bg) => ({
      id: bg.barang.id,
      kode: bg.barang.kode,
      nama: bg.barang.nama,
      satuan: bg.barang.satuan,
      isWorkOrderMaterial: bg.barang.isWorkOrderMaterial,
      stok: bg.stok,
      stokBaru: bg.stokBaru,
      stokBekas: bg.stokBekas,
      stokRusak: bg.stokRusak,
    }));

    return NextResponse.json({ barangList });
  } catch (error) {
    console.error("Error fetching barangs (mobile):", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
