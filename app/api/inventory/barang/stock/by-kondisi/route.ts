import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/modules/database";
import { logger } from "@/lib/logger";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

/**
 * GET /api/inventory/barang/stock/by-kondisi
 * Get stock breakdown by condition for specific barang and gudang
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  try {
    const session = await requireAdmin(req);
    if (session instanceof NextResponse) {
      return session; // Return error response if authentication fails
    }

    const searchParams = req.nextUrl.searchParams;
    const barangId = searchParams.get("barangId");
    const gudangId = searchParams.get("gudangId");

    if (!barangId || !gudangId) {
      return ApiErrors.badRequest("Barang ID dan Gudang ID harus diisi");
    }

    try {
      const dbStart = Date.now();

      const [stockSnapshot, barangInfo, gudangInfo] = await Promise.all([
        prisma.barangGudang.findUnique({
          where: {
            barangId_gudangId: {
              barangId,
              gudangId,
            },
          },
          select: {
            stok: true,
            stokBaru: true,
            stokBekas: true,
            stokRusak: true,
          },
        }),
        prisma.barang.findUnique({
          where: { id: barangId },
          select: {
            id: true,
            kode: true,
            nama: true,
            satuan: true,
          },
        }),
        prisma.gudang.findUnique({
          where: { id: gudangId },
          select: {
            id: true,
            kode: true,
            nama: true,
          },
        }),
      ]);

      const stockPerKondisi = {
        BARU: Math.max(stockSnapshot?.stokBaru || 0, 0),
        BEKAS: Math.max(stockSnapshot?.stokBekas || 0, 0),
        RUSAK: Math.max(stockSnapshot?.stokRusak || 0, 0),
      };

      const totalStock = Math.max(
        stockSnapshot?.stok ||
          Object.values(stockPerKondisi).reduce((sum, stock) => sum + stock, 0),
        0,
      );

      logger.dbOperation(
        "stock snapshot lookup",
        "BarangGudang",
        Date.now() - dbStart,
      );

      logger.apiRequest(
        "GET",
        "/api/inventory/barang/stock/by-kondisi",
        200,
        Date.now() - startTime,
        {
          userId: session.user.id,
          barangId,
          gudangId,
          totalStock,
          stockPerKondisi,
        },
      );

      return apiSuccess({
        totalStock,
        stockPerKondisi,
        barang: barangInfo,
        gudang: gudangInfo,
      });
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error) {
    const err = error as Error;
    logger.error("Error fetching stock by condition", err, {
      path: "/api/inventory/barang/stock/by-kondisi",
      method: "GET",
    });
    return ApiErrors.internalError(
      "Gagal mengambil informasi stok per kondisi",
    );
  }
}
