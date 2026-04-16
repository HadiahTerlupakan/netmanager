import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { hasAnyMobilePermission } from "@/lib/mobile-auth";
import { prisma } from "@/modules/database";
import { prismaMitra } from "@/modules/database";
import { isSuperAdmin } from "@/lib/auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  buildGudangSiteFilter,
  buildInventoryActorFilter,
  resolveInventoryActorScope,
} from "@/modules/inventory";

// GET - Get transaction history for mobile
export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const payload = authResult;
    const tenantId = payload.tenantId as string;
    const actorId = payload.userId as string;
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
    const cursorValue = searchParams.get("cursor");
    const limit = 20;

    const user = await prisma.user.findFirst({
      where: { id: actorId, tenantId },
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
          where: { id: actorId },
          select: { id: true, siteId: true },
        })
      : null;

    if (!user && !mitra) {
      return apiError("User tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

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

    if (actorScope.isRestricted && actorScope.allowedSiteIds.length === 0) {
      return apiError(
        "Akses ditolak: Tidak ada site yang ditugaskan",
        ErrorCodes.FORBIDDEN,
        { status: 403 },
      );
    }

    const whereClauseMasuk: Record<string, unknown> = {
      tenantId,
      ...buildInventoryActorFilter(actorScope.actor),
    };
    const whereClauseKeluar: Record<string, unknown> = {
      tenantId,
      ...buildInventoryActorFilter(actorScope.actor),
    };

    if (actorScope.isRestricted) {
      whereClauseMasuk.gudang = buildGudangSiteFilter(
        actorScope.allowedSiteIds,
      );
      whereClauseKeluar.gudang = buildGudangSiteFilter(
        actorScope.allowedSiteIds,
      );
    }

    if (cursorValue) {
      const cursorDate = new Date(cursorValue);
      whereClauseMasuk.tanggal = { lt: cursorDate };
      whereClauseKeluar.tanggal = { lt: cursorDate };
    }

    let transactions: Array<Record<string, unknown> & { rawDate?: Date }> = [];

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

      transactions = barangMasuk.map((masuk) => ({
        id: masuk.id,
        type: "masuk" as const,
        barang: masuk.barang,
        gudang: masuk.gudang,
        jumlah: masuk.jumlah,
        kondisi: masuk.kondisi,
        keterangan: masuk.keterangan,
        tanggal: masuk.tanggal.toISOString(),
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

      transactions = barangKeluar.map((keluar) => ({
        id: keluar.id,
        type: "keluar" as const,
        barang: keluar.barang,
        gudang: keluar.gudang,
        jumlah: keluar.jumlah,
        kondisi: keluar.kondisi,
        keterangan: keluar.keterangan,
        tanggal: keluar.tanggal.toISOString(),
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

      transactions = [
        ...barangMasuk.map((masuk) => ({
          id: masuk.id,
          type: "masuk" as const,
          barang: masuk.barang,
          gudang: masuk.gudang,
          jumlah: masuk.jumlah,
          kondisi: masuk.kondisi,
          keterangan: masuk.keterangan,
          tanggal: masuk.tanggal.toISOString(),
          rawDate: masuk.tanggal,
        })),
        ...barangKeluar.map((keluar) => ({
          id: keluar.id,
          type: "keluar" as const,
          barang: keluar.barang,
          gudang: keluar.gudang,
          jumlah: keluar.jumlah,
          kondisi: keluar.kondisi,
          keterangan: keluar.keterangan,
          tanggal: keluar.tanggal.toISOString(),
          rawDate: keluar.tanggal,
        })),
      ].sort(
        (left, right) =>
          (right.rawDate?.getTime() || 0) - (left.rawDate?.getTime() || 0),
      );
    }

    let nextCursor: string | null = null;

    if (transactions.length > limit) {
      nextCursor = String(transactions[limit - 1].tanggal);
      transactions = transactions.slice(0, limit);
    } else if (transactions.length === limit) {
      nextCursor = String(transactions[transactions.length - 1].tanggal);
    }

    return NextResponse.json({
      success: true,
      data: transactions.map(({ rawDate: _, ...transaction }) => transaction),
      nextCursor,
    });
  } catch (error) {
    console.error("Mobile Inventory History Error:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
