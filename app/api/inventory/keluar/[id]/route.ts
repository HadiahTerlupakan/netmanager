import { NextRequest } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authConfig, getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { getInventoryRouteService } from "@/modules/inventory";
import { logger } from "@/lib/logger";
import {
  apiError,
  apiSuccess,
  ApiErrors,
  ErrorCodes,
} from "@/lib/api-response";
import { hasPermission } from "@/lib/rbac";

interface UserSession {
  id: string;
  siteId?: string | null;
  role?: string;
  isSuperAdmin?: boolean;
}

const inventoryRouteService = getInventoryRouteService();

async function requireAdmin(): Promise<{
  session: Session;
  user: UserSession;
} | null> {
  const session = (await getServerSession(authConfig)) as Session | null;
  if (!session?.user) {
    return null;
  }
  return { session, user: session.user as UserSession };
}

/** Validasi akses site untuk record barang keluar. */
async function validateKeluarSiteAccess(
  keluarId: string,
  user: UserSession,
  permissions: string[],
) {
  const record = await inventoryRouteService.getKeluarRecordWithSite(keluarId);
  if (!record) {
    return { allowed: false, error: "Record tidak ditemukan" };
  }

  if (isSuperAdmin(user)) {
    return { allowed: true, record };
  }

  const hasSiteRestriction =
    permissions.includes("keluar:site_only") ||
    permissions.includes("k_barang:site_only") ||
    permissions.includes("gudang:site_only");
  const gudangSiteIds =
    record.gudang.sites?.map((site: { id: string }) => site.id) || [];

  if (
    hasSiteRestriction &&
    user.siteId &&
    !gudangSiteIds.includes(user.siteId)
  ) {
    return { allowed: false, error: "Anda tidak memiliki akses ke data ini" };
  }

  return { allowed: true, record };
}

/**
 * GET /api/inventory/keluar/[id]
 * Get specific stock-out record by ID
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    if (!auth) {
      logger.warn(
        "Unauthorized access attempt to GET /api/inventory/keluar/[id]",
      );
      return ApiErrors.unauthorized("Session tidak valid");
    }

    const { user } = auth;
    if (!(await hasPermission("keluar:read", user))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk melihat data barang keluar",
      );
    }

    const { id } = await params;
    const permissions = await getUserPermissions(user.id);
    const accessCheck = await validateKeluarSiteAccess(id, user, permissions);

    if (!accessCheck.allowed) {
      if (accessCheck.error === "Record tidak ditemukan") {
        return ApiErrors.notFound("Record barang keluar");
      }
      return ApiErrors.forbidden(accessCheck.error || "Akses ditolak");
    }

    logger.apiRequest(
      "GET",
      "/api/inventory/keluar/[id]",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        keluarId: id,
      },
    );

    return apiSuccess({ keluar: accessCheck.record });
  } catch (error) {
    const err = error as Error;
    logger.error("Error fetching barang keluar", err, {
      path: "/api/inventory/keluar/[id]",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat data barang keluar");
  }
}

/**
 * PUT /api/inventory/keluar/[id]
 * Update stock-out record
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    if (!auth) {
      logger.warn(
        "Unauthorized access attempt to PUT /api/inventory/keluar/[id]",
      );
      return ApiErrors.unauthorized("Session tidak valid");
    }

    const { user } = auth;
    if (!(await hasPermission("keluar:update", user))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah data barang keluar",
      );
    }

    const { id } = await params;
    const permissions = await getUserPermissions(user.id);
    const accessCheck = await validateKeluarSiteAccess(id, user, permissions);

    if (!accessCheck.allowed) {
      if (accessCheck.error === "Record tidak ditemukan") {
        return ApiErrors.notFound("Record barang keluar");
      }
      return ApiErrors.forbidden(accessCheck.error || "Akses ditolak");
    }

    const body = await req.json();
    const { jumlah, keterangan } = body;
    if (!jumlah || jumlah <= 0) {
      return apiError(
        "Jumlah harus diisi dengan angka positif",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const dbStart = Date.now();
    const transactionResult = await inventoryRouteService.updateKeluarRecord({
      id,
      jumlah,
      keterangan,
    });

    logger.dbOperation(
      "transaction",
      "BarangKeluar+BarangGudang",
      Date.now() - dbStart,
    );
    logger.apiRequest(
      "PUT",
      "/api/inventory/keluar/[id]",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        keluarId: id,
        jumlah,
      },
    );

    await logger.logActivity({
      action: "UPDATE",
      subject: "Inventory Out (Admin)",
      details: {
        id,
        namaBarang: transactionResult.barangNama,
        jumlahLama: transactionResult.jumlahLama,
        jumlahBaru: jumlah,
        keterangan,
      },
      userId: user.id,
    });

    return apiSuccess(null, { message: "Barang keluar berhasil diperbarui" });
  } catch (error) {
    const err = error as Error;
    logger.error("Error updating barang keluar", err, {
      path: "/api/inventory/keluar/[id]",
      method: "PUT",
    });

    if (err.message === "Record barang keluar tidak ditemukan") {
      return ApiErrors.notFound("Record barang keluar");
    }
    if (err.message === "Stok tidak mencukupi untuk perubahan ini") {
      return apiError(
        "Stok tidak mencukupi untuk perubahan ini",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    return ApiErrors.internalError("Gagal memperbarui barang keluar");
  }
}

/**
 * DELETE /api/inventory/keluar/[id]
 * Delete stock-out record and restore stock
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    if (!auth) {
      logger.warn(
        "Unauthorized access attempt to DELETE /api/inventory/keluar/[id]",
      );
      return ApiErrors.unauthorized("Session tidak valid");
    }

    const { user } = auth;
    if (!(await hasPermission("keluar:delete", user))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menghapus data barang keluar",
      );
    }

    const { id } = await params;
    const permissions = await getUserPermissions(user.id);
    const accessCheck = await validateKeluarSiteAccess(id, user, permissions);

    if (!accessCheck.allowed) {
      if (accessCheck.error === "Record tidak ditemukan") {
        return ApiErrors.notFound("Record barang keluar");
      }
      return ApiErrors.forbidden(accessCheck.error || "Akses ditolak");
    }

    const dbStart = Date.now();
    const transactionResult =
      await inventoryRouteService.deleteKeluarRecord(id);

    logger.dbOperation(
      "transaction",
      "BarangKeluar+BarangGudang",
      Date.now() - dbStart,
    );
    logger.apiRequest(
      "DELETE",
      "/api/inventory/keluar/[id]",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        keluarId: id,
      },
    );

    await logger.logActivity({
      action: "DELETE",
      subject: "Inventory Out (Admin)",
      details: {
        id,
        namaBarang: transactionResult.barangNama,
        jumlahRestored: transactionResult.jumlah,
      },
      userId: user.id,
    });

    return apiSuccess(null, {
      message: "Record barang keluar berhasil dihapus dan stok dikembalikan",
    });
  } catch (error) {
    const err = error as Error;
    logger.error("Error deleting barang keluar", err, {
      path: "/api/inventory/keluar/[id]",
      method: "DELETE",
    });

    if (err.message === "Record barang keluar tidak ditemukan") {
      return ApiErrors.notFound("Record barang keluar");
    }

    return ApiErrors.internalError("Gagal menghapus record barang keluar");
  }
}
