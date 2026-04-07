import { NextRequest } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authConfig, getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  apiError,
  apiSuccess,
  ApiErrors,
  ErrorCodes,
} from "@/lib/api-response";
import {
  getInventoryStockMovementService,
  type InventoryStockMovementService,
} from "@/modules/inventory";

interface UserSession {
  id: string;
  siteId?: string | null;
  role?: string;
  isSuperAdmin?: boolean;
}

const stockMovementService = getInventoryStockMovementService();

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

/**
 * Validate site access for masuk record
 * Returns the record if user has access, null otherwise
 */
async function validateMasukSiteAccess(
  record: Awaited<ReturnType<InventoryStockMovementService["getMasukRecord"]>>,
  user: UserSession,
  permissions: string[],
): Promise<{ allowed: boolean; error?: string }> {
  if (!record) {
    return { allowed: false, error: "Record tidak ditemukan" };
  }

  if (isSuperAdmin(user)) {
    return { allowed: true };
  }

  const hasSiteRestriction =
    permissions.includes("masuk:site_only") ||
    permissions.includes("k_barang:site_only") ||
    permissions.includes("gudang:site_only");

  if (hasSiteRestriction && user.siteId) {
    const gudangSiteIds =
      record.gudang.sites?.map((s: { id: string }) => s.id) || [];
    if (!gudangSiteIds.includes(user.siteId)) {
      return { allowed: false, error: "Anda tidak memiliki akses ke data ini" };
    }
  }

  return { allowed: true };
}

/**
 * GET /api/inventory/masuk/[id]
 * Get specific stock-in record by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();
  try {
    const auth = await requireAdmin();
    if (!auth) {
      logger.warn(
        "Unauthorized access attempt to GET /api/inventory/masuk/[id]",
      );
      return ApiErrors.unauthorized("Session tidak valid");
    }

    const { user } = auth;

    // Permission check
    if (!(await hasPermission("masuk:read", user))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk melihat data barang masuk",
      );
    }

    const { id } = await params;
    const permissions = await getUserPermissions(user.id);

    // Validate site access
    const masuk = await stockMovementService.getMasukRecord(id);

    if (!masuk) {
      return ApiErrors.notFound("Record barang masuk");
    }

    const accessCheck = await validateMasukSiteAccess(masuk, user, permissions);
    if (!accessCheck.allowed) {
      if (accessCheck.error === "Record tidak ditemukan") {
        return ApiErrors.notFound("Record barang masuk");
      }
      return ApiErrors.forbidden(accessCheck.error || "Akses ditolak");
    }

    logger.apiRequest(
      "GET",
      "/api/inventory/masuk/[id]",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        masukId: id,
      },
    );

    return apiSuccess({ masuk });
  } catch (error) {
    const err = error as Error;
    logger.error("Error fetching barang masuk", err, {
      path: "/api/inventory/masuk/[id]",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat data barang masuk");
  }
}

/**
 * PUT /api/inventory/masuk/[id]
 * Update stock-in record
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
        "Unauthorized access attempt to PUT /api/inventory/masuk/[id]",
      );
      return ApiErrors.unauthorized("Session tidak valid");
    }

    const { user } = auth;

    // Permission check
    if (!(await hasPermission("masuk:update", user))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah data barang masuk",
      );
    }

    const { id } = await params;
    const permissions = await getUserPermissions(user.id);
    const masuk = await stockMovementService.getMasukRecord(id);

    // Validate site access before allowing update
    const accessCheck = await validateMasukSiteAccess(masuk, user, permissions);
    if (!accessCheck.allowed) {
      if (accessCheck.error === "Record tidak ditemukan") {
        return ApiErrors.notFound("Record barang masuk");
      }
      return ApiErrors.forbidden(accessCheck.error || "Akses ditolak");
    }

    const body = await req.json();
    const { jumlah, kondisi, keterangan } = body;

    // Validation
    if (!jumlah || jumlah <= 0) {
      return apiError(
        "Jumlah harus diisi dengan angka positif",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    try {
      const dbStart = Date.now();

      await stockMovementService.updateMasuk({
        id,
        jumlah,
        kondisi,
        keterangan,
      });

      logger.dbOperation(
        "transaction",
        "BarangMasuk+BarangGudang",
        Date.now() - dbStart,
      );

      logger.apiRequest(
        "PUT",
        "/api/inventory/masuk/[id]",
        200,
        Date.now() - startTime,
        {
          userId: user.id,
          masukId: id,
          jumlah,
        },
      );

      return apiSuccess(null, { message: "Barang masuk berhasil diperbarui" });
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error) {
    const err = error as Error;
    logger.error("Error updating barang masuk", err, {
      path: "/api/inventory/masuk/[id]",
      method: "PUT",
    });

    if (err.message === "Record barang masuk tidak ditemukan") {
      return ApiErrors.notFound("Record barang masuk");
    }
    if (err.message === "Stok tidak bisa negatif") {
      return apiError("Stok tidak bisa negatif", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    return ApiErrors.internalError("Gagal memperbarui barang masuk");
  }
}

/**
 * DELETE /api/inventory/masuk/[id]
 * Delete stock-in record and reduce stock
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();
  try {
    const auth = await requireAdmin();
    if (!auth) {
      logger.warn(
        "Unauthorized access attempt to DELETE /api/inventory/masuk/[id]",
      );
      return ApiErrors.unauthorized("Session tidak valid");
    }

    const { user } = auth;

    // Permission check
    if (!(await hasPermission("masuk:delete", user))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menghapus data barang masuk",
      );
    }

    const { id } = await params;
    const permissions = await getUserPermissions(user.id);
    const masuk = await stockMovementService.getMasukRecord(id);

    // Validate site access before allowing delete
    const accessCheck = await validateMasukSiteAccess(masuk, user, permissions);
    if (!accessCheck.allowed) {
      if (accessCheck.error === "Record tidak ditemukan") {
        return ApiErrors.notFound("Record barang masuk");
      }
      return ApiErrors.forbidden(accessCheck.error || "Akses ditolak");
    }

    try {
      const dbStart = Date.now();

      await stockMovementService.deleteMasuk(id);

      logger.dbOperation(
        "transaction",
        "BarangMasuk+BarangGudang",
        Date.now() - dbStart,
      );

      logger.apiRequest(
        "DELETE",
        "/api/inventory/masuk/[id]",
        200,
        Date.now() - startTime,
        {
          userId: user.id,
          masukId: id,
        },
      );

      return apiSuccess(null, {
        message: "Record barang masuk berhasil dihapus dan stok dikurangi",
      });
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error) {
    const err = error as Error;
    logger.error("Error deleting barang masuk", err, {
      path: "/api/inventory/masuk/[id]",
      method: "DELETE",
    });

    if (err.message === "Record barang masuk tidak ditemukan") {
      return ApiErrors.notFound("Record barang masuk");
    }

    return ApiErrors.internalError("Gagal menghapus record barang masuk");
  }
}
