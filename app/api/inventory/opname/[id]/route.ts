import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { hasPermission } from "@/lib/rbac";
import { getInventoryStockMovementService } from "@/modules/inventory";

// Auth helpers unified in route handlers

const stockMovementService = getInventoryStockMovementService();

/**
 * GET /api/inventory/opname/[id]
 * Get single stock opname record by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();
  try {
    const session = await getServerSession(authConfig);
    if (!session || !session.user) {
      logger.warn(
        "Unauthorized access attempt to GET /api/inventory/opname/[id]",
      );
      return ApiErrors.unauthorized();
    }

    if (!(await hasPermission("opname:read"))) {
      return ApiErrors.forbidden();
    }

    const { id } = await params;
    try {
      const dbStart = Date.now();

      const opnameRecord = await stockMovementService.getOpnameRecord(id);

      if (!opnameRecord) {
        return ApiErrors.notFound("Record stock opname tidak ditemukan");
      }

      logger.dbOperation(
        "findUnique",
        "StockOpname+Relations",
        Date.now() - dbStart,
      );

      logger.apiRequest(
        "GET",
        "/api/inventory/opname/[id]",
        200,
        Date.now() - startTime,
        {
          userId: session.user.id,
          opnameId: id,
        },
      );

      return apiSuccess(opnameRecord);
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching stock opname record", err, {
      path: "/api/inventory/opname/[id]",
      method: "GET",
      id: "unknown",
    });
    return ApiErrors.internalError("Gagal memuat data stock opname");
  }
}

/**
 * PUT /api/inventory/opname/[id]
 * Update stock opname record
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();
  try {
    const session = await getServerSession(authConfig);
    if (!session || !session.user) {
      logger.warn(
        "Unauthorized access attempt to PUT /api/inventory/opname/[id]",
      );
      return ApiErrors.unauthorized();
    }

    if (!(await hasPermission("opname:update"))) {
      return ApiErrors.forbidden();
    }

    const { id } = await params;
    const body = await req.json();
    const {
      stokFisik,
      keterangan,
      kondisiBaik,
      kondisiRusak,
      kondisiExpire,
      lokasiPenyimpanan,
      nomorRak,
      nomorBox,
      pic,
      suhuPenyimpanan,
      kelembaban,
      tanggalExpire,
      nomorBatch,
      catatanDetail,
    } = body;

    // Validation
    if (stokFisik === undefined || stokFisik < 0) {
      return ApiErrors.badRequest("Stok fisik harus berupa angka non-negatif");
    }

    // Validate condition breakdown
    if (
      kondisiBaik !== undefined &&
      kondisiRusak !== undefined &&
      kondisiExpire !== undefined
    ) {
      const totalKondisi = kondisiBaik + kondisiRusak + kondisiExpire;
      if (totalKondisi > stokFisik) {
        return ApiErrors.badRequest(
          "Total jumlah kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik",
        );
      }
    }

    try {
      const dbStart = Date.now();
      const result = await stockMovementService.updateOpname({
        id,
        stokFisik,
        keterangan,
        kondisiBaik,
        kondisiRusak,
        kondisiExpire,
        lokasiPenyimpanan,
        nomorRak,
        nomorBox,
        pic,
        suhuPenyimpanan,
        kelembaban,
        tanggalExpire,
        nomorBatch,
        catatanDetail,
      });

      logger.dbOperation(
        "transaction",
        "StockOpname+BarangGudang",
        Date.now() - dbStart,
      );

      logger.apiRequest(
        "PUT",
        "/api/inventory/opname/[id]",
        200,
        Date.now() - startTime,
        {
          userId: session.user.id,
          opnameId: id,
          stokFisik,
          stokSistem: result.stokSistem,
          selisih: result.selisih,
        },
      );

      return apiSuccess({
        message: "Stock opname berhasil diperbarui",
        record: result.record,
      });
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error updating stock opname", err, {
      path: "/api/inventory/opname/[id]",
      method: "PUT",
      id: "unknown",
    });

    if (err.message === "Record stock opname tidak ditemukan") {
      return ApiErrors.notFound(err.message);
    }

    return ApiErrors.internalError("Gagal memperbarui stock opname");
  }
}

/**
 * DELETE /api/inventory/opname/[id]
 * Delete stock opname record
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session || !session.user) {
      return ApiErrors.unauthorized();
    }

    if (!(await hasPermission("opname:delete"))) {
      return ApiErrors.forbidden();
    }

    const { id } = await params;
    // Validate ID
    if (!id || id.trim() === "") {
      return ApiErrors.badRequest("ID tidak valid");
    }

    await stockMovementService.deleteOpname(id);

    return apiSuccess({
      message: "Stock opname berhasil dihapus",
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Delete error:", err.message);

    if (err.message.includes("tidak ditemukan")) {
      return ApiErrors.notFound(err.message);
    }

    return ApiErrors.internalError(
      err.message || "Gagal menghapus stock opname",
    );
  }
}
