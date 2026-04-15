import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { hasAnyMobilePermission } from "@/lib/mobile-auth";
import { prisma } from "@/modules/database";
import { prismaMitra } from "@/modules/database";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { isSuperAdmin } from "@/lib/auth";
import {
  buildGudangSiteFilter,
  getAssignedInventorySiteIds,
  isInventorySiteRestricted,
} from "@/modules/inventory/utils/validation";

// GET - Get transaction history for mobile (Optimized)
export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const payload = authResult;
    const tenantId = payload.tenantId as string;
    const userId = payload.id as string;
    const permissions = payload.permissions as string[] | undefined;
    const searchParams = request.nextUrl.searchParams;

    if (
      !hasAnyMobilePermission(permissions, [
        "m_barang:read",
        "m_barang_masuk:read",
        "m_barang_keluar:read",
      ])
    ) {
      return apiError("Akses inventory ditolak", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }
    const filterType = searchParams.get("type");
    const cursorValues = searchParams.get("cursor");
    const limit = 20;

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
        "Riwayat inventory untuk mitra belum tersedia",
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

    const whereClauseMasuk: Record<string, unknown> = { userId: user.id };
    const whereClauseKeluar: Record<string, unknown> = { userId: user.id };

    if (isRestricted) {
      if (allowedSiteIds.length === 0) {
        return apiError(
          "Akses ditolak: Tidak ada site yang ditugaskan",
          ErrorCodes.FORBIDDEN,
          { status: 403 },
        );
      }

      whereClauseMasuk.gudang = buildGudangSiteFilter(allowedSiteIds);
      whereClauseKeluar.gudang = buildGudangSiteFilter(allowedSiteIds);
    }

    if (cursorValues) {
      const cursorDate = new Date(cursorValues);
      whereClauseMasuk.tanggal = { lt: cursorDate };
      whereClauseKeluar.tanggal = { lt: cursorDate };
    }

    let transactions: Record<string, unknown>[] = [];

    if (filterType === "masuk") {
      const barangMasuk = await prisma.barangMasuk.findMany({
        where: whereClauseMasuk,
        include: {
          barang: { select: { kode: true, nama: true, satuan: true } },
          gudang: { select: { nama: true } },
        },
        orderBy: { tanggal: "desc" },
        take: limit + 1,
      });

      transactions = barangMasuk.map((m) => ({
        id: m.id,
        type: "masuk" as const,
        barang: m.barang,
        gudang: m.gudang,
        jumlah: m.jumlah,
        kondisi: m.kondisi,
        keterangan: m.keterangan,
        tanggal: m.tanggal.toISOString(),
      }));
    } else if (filterType === "keluar") {
      const barangKeluar = await prisma.barangKeluar.findMany({
        where: whereClauseKeluar,
        include: {
          barang: { select: { kode: true, nama: true, satuan: true } },
          gudang: { select: { nama: true } },
        },
        orderBy: { tanggal: "desc" },
        take: limit + 1,
      });

      transactions = barangKeluar.map((k) => ({
        id: k.id,
        type: "keluar" as const,
        barang: k.barang,
        gudang: k.gudang,
        jumlah: k.jumlah,
        kondisi: k.kondisi,
        keterangan: k.keterangan,
        tanggal: k.tanggal.toISOString(),
      }));
    } else {
      const [barangMasuk, barangKeluar] = await Promise.all([
        prisma.barangMasuk.findMany({
          where: whereClauseMasuk,
          include: {
            barang: { select: { kode: true, nama: true, satuan: true } },
            gudang: { select: { nama: true } },
          },
          orderBy: { tanggal: "desc" },
          take: limit,
        }),
        prisma.barangKeluar.findMany({
          where: whereClauseKeluar,
          include: {
            barang: { select: { kode: true, nama: true, satuan: true } },
            gudang: { select: { nama: true } },
          },
          orderBy: { tanggal: "desc" },
          take: limit,
        }),
      ]);

      const merged = [
        ...barangMasuk.map((m) => ({
          id: m.id,
          type: "masuk" as const,
          barang: m.barang,
          gudang: m.gudang,
          jumlah: m.jumlah,
          kondisi: m.kondisi,
          keterangan: m.keterangan,
          tanggal: m.tanggal.toISOString(),
          rawDate: m.tanggal,
        })),
        ...barangKeluar.map((k) => ({
          id: k.id,
          type: "keluar" as const,
          barang: k.barang,
          gudang: k.gudang,
          jumlah: k.jumlah,
          kondisi: k.kondisi,
          keterangan: k.keterangan,
          tanggal: k.tanggal.toISOString(),
          rawDate: k.tanggal,
        })),
      ];

      transactions = merged.sort(
        (a, b) => b.rawDate.getTime() - a.rawDate.getTime(),
      );
    }

    let nextCursor = null;

    if (transactions.length > limit) {
      const nextItem = transactions[limit - 1];
      nextCursor = nextItem.tanggal;
      transactions = transactions.slice(0, limit);
    }

    if (transactions.length > 0 && transactions.length === limit) {
      nextCursor = transactions[transactions.length - 1].tanggal;
    }

    return NextResponse.json({
      success: true,
      data: transactions.map(({ rawDate: _, ...rest }) => rest),
      nextCursor,
    });
  } catch (error) {
    console.error("Mobile Inventory History Error:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
