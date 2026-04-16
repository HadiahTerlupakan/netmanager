import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { hasMobilePermission } from "@/lib/mobile-auth";
import { prisma } from "@/modules/database";
import { prismaMitra } from "@/modules/database";
import { InventoryRepository } from "@/modules/inventory";
import { socketEmitter } from "@/lib/websocket/emitter";
import { isSuperAdmin } from "@/lib/auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  getAssignedInventorySiteIds,
  hasGudangSiteAccess,
  isInventorySiteRestricted,
} from "@/modules/inventory/utils/validation";

export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const payload = authResult;
    const tenantId = payload.tenantId as string;
    const actorId = payload.userId as string;
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
      fotoMetadata,
    } = body;
    const parsedJumlah = Number(jumlah);

    if (
      !barangId ||
      !gudangId ||
      !Number.isFinite(parsedJumlah) ||
      parsedJumlah <= 0
    ) {
      return apiError("Data tidak lengkap", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

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

    const actor = user
      ? { type: "user" as const, id: user.id, userId: user.id }
      : { type: "mitra" as const, id: mitra!.id };

    const userPermissions =
      user?.role?.permission.map(
        (permission) => `${permission.resource}:${permission.action}`,
      ) || [];
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

    const inventoryRepository = new InventoryRepository();
    const result = await inventoryRepository.addStock({
      barangId,
      gudangId,
      jumlah: parsedJumlah,
      kondisi: kondisi || "BARU",
      keterangan,
      supplier,
      fotoBukti: fotoBukti || [],
      fotoMetadata: fotoMetadata || null,
      actor,
      tenantId,
      tanggal: new Date(),
    });

    socketEmitter.inventoryUpdate({
      type: "masuk",
      userId: actor.id,
      barangId,
      gudangId,
      jumlah: parsedJumlah,
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
