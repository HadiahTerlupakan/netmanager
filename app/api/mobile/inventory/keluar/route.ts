import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { prisma } from "@/modules/database";
import { prismaMitra } from "@/modules/database";
import { InventoryRepository } from "@/modules/inventory";
import { socketEmitter } from "@/lib/websocket/emitter";
import { logger } from "@/lib/logger";
import { apiError, ErrorCodes } from "@/lib/api-response";

// POST - Create barang keluar (mobile)
export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const payload = authResult;
    const tenantId = payload.tenantId as string;
    const userId = payload.id as string;
    const body = await request.json();
    const {
      barangId,
      gudangId,
      jumlah,
      kondisi,
      keterangan,
      tujuanPenggunaan,
      fotoBukti,
    } = body;

    if (!barangId || !gudangId || !jumlah || jumlah <= 0) {
      return apiError("Data tidak lengkap", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    // Fetch user to check permissions
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        role: { include: { permission: true } },
        sites: true,
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

    // Check stock
    const barangGudang = await prisma.barangGudang.findFirst({
      where: {
        barangId,
        gudangId,
        tenantId,
      },
      include: {
        barang: { select: { nama: true } },
      },
    });

    // Check available stock based on kondisi
    const stockField =
      kondisi === "BEKAS"
        ? "stokBekas"
        : kondisi === "RUSAK"
          ? "stokRusak"
          : "stokBaru";
    const availableStock = barangGudang
      ? (barangGudang as unknown as Record<string, number>)[stockField] || 0
      : 0;

    if (!barangGudang || availableStock < jumlah) {
      return NextResponse.json(
        {
          error: `Stok ${kondisi || "BARU"} tidak mencukupi. Tersedia: ${availableStock}`,
        },
        { status: 400 },
      );
    }

    // Check for Site-Based Restriction Policy (only for User, Mitra skips)
    const userPermissions =
      user?.role?.permission.map((p) => `${p.resource}:${p.action}`) || [];
    const isSuper = user
      ? user.role?.name === "SUPER_ADMIN" || user.role?.name === "Super Admin"
      : false;
    const isSiteRestricted = user
      ? !isSuper && userPermissions.includes("k_barang:site_only")
      : false;

    if (isSiteRestricted && user) {
      if (!user.sites?.id) {
        return apiError(
          "Akses ditolak: Tidak ada site yang ditugaskan",
          ErrorCodes.FORBIDDEN,
          { status: 403 },
        );
      }

      // Verify the target gudang belongs to user's site
      const targetGudang = await prisma.gudang.findFirst({
        where: { id: gudangId, tenantId },
        include: { sites: { select: { id: true } } },
      });

      if (!targetGudang) {
        return apiError("Gudang not found", ErrorCodes.NOT_FOUND, {
          status: 404,
        });
      }

      const gudangSiteIds = targetGudang.sites.map((s) => s.id);
      if (!gudangSiteIds.includes(user.sites?.id || "")) {
        return apiError(
          "Akses ditolak: Gudang di luar site Anda",
          ErrorCodes.FORBIDDEN,
          { status: 403 },
        );
      }
    }

    // Use Repository for consistency
    const inventoryRepository = new InventoryRepository();

    const result = await inventoryRepository.removeStock({
      barangId,
      gudangId,
      jumlah,
      kondisi: kondisi || "BARU",
      keterangan,
      tujuanPenggunaan,
      fotoBukti: fotoBukti || [],
      userId,
      tenantId,
      tanggal: new Date(),
    });

    // Emit real-time update via WebSocket
    socketEmitter.inventoryUpdate({
      type: "keluar",
      userId,
      barangId,
      gudangId,
      jumlah,
    });

    // Log activity
    await logger.logActivity({
      action: "CREATE",
      subject: "Inventory Out (Mobile)",
      details: {
        barangId,
        namaBarang: barangGudang?.barang?.nama,
        jumlah,
        kondisi,
        gudangId,
        keterangan,
        tujuanPenggunaan,
      },
      userId,
      tenantId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Mobile Barang Keluar Error:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
