import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { hasPermission } from "@/lib/rbac";
import { getInventoryStockMovementService } from "@/modules/inventory";

const stockMovementService = getInventoryStockMovementService();

/** Handle stock opname detail request. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user) return ApiErrors.unauthorized();
    if (!(await hasPermission("opname:read"))) return ApiErrors.forbidden();

    const { id } = await params;
    const dbStart = Date.now();
    const opnameRecord = await stockMovementService.getOpnameRecord(id);
    if (!opnameRecord)
      return ApiErrors.notFound("Record stock opname tidak ditemukan");

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

/** Handle stock opname update request. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user) return ApiErrors.unauthorized();
    if (!(await hasPermission("opname:update"))) return ApiErrors.forbidden();

    const { id } = await params;
    const body = await req.json();
    if (body.stokFisik === undefined || body.stokFisik < 0) {
      return ApiErrors.badRequest("Stok fisik harus berupa angka non-negatif");
    }

    if (
      body.kondisiBaik !== undefined &&
      body.kondisiRusak !== undefined &&
      body.kondisiExpire !== undefined &&
      body.kondisiBaik + body.kondisiRusak + body.kondisiExpire > body.stokFisik
    ) {
      return ApiErrors.badRequest(
        "Total jumlah kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik",
      );
    }

    const dbStart = Date.now();
    const result = await stockMovementService.updateOpname({ id, ...body });
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
        stokFisik: body.stokFisik,
        stokSistem: result.stokSistem,
        selisih: result.selisih,
      },
    );
    return apiSuccess({
      message: "Stock opname berhasil diperbarui",
      record: result.record,
    });
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

/** Handle stock opname delete request. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user) return ApiErrors.unauthorized();
    if (!(await hasPermission("opname:delete"))) return ApiErrors.forbidden();

    const { id } = await params;
    if (!id || id.trim() === "") return ApiErrors.badRequest("ID tidak valid");
    await stockMovementService.deleteOpname(id);
    return apiSuccess({ message: "Stock opname berhasil dihapus" });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Delete error:", err.message);
    if (err.message.includes("tidak ditemukan"))
      return ApiErrors.notFound(err.message);
    return ApiErrors.internalError(
      err.message || "Gagal menghapus stock opname",
    );
  }
}
