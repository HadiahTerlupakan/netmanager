import { NextRequest } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authConfig, getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  apiSuccess,
  ApiErrors,
  apiError,
  ErrorCodes,
} from "@/lib/api-response";
import {
  inventoryMasukRouteService,
  type InventoryMasukRouteError,
} from "@/modules/inventory";

interface UserSession {
  id: string;
  siteId?: string | null;
  role?: string;
  isSuperAdmin?: boolean;
}

/** Resolve authenticated admin session for inventory masuk by id route. */
async function requireAdmin(): Promise<{
  session: Session;
  user: UserSession;
} | null> {
  const session = (await getServerSession(authConfig)) as Session | null;
  if (!session?.user) return null;
  return { session, user: session.user as UserSession };
}

/** Map route service result into API response. */
function toMasukRouteResponse(result: InventoryMasukRouteError) {
  if (result.status === 404) return ApiErrors.notFound("Record barang masuk");
  if (result.status === 403) return ApiErrors.forbidden(result.error);
  if (result.status === 400) {
    return apiError(result.error, ErrorCodes.VALIDATION_ERROR, { status: 400 });
  }
  return ApiErrors.internalError(result.error);
}

/** Handle get barang masuk detail request. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();
  try {
    const auth = await requireAdmin();
    if (!auth) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await import("@/lib/rbac")).hasPermission("masuk:read", auth.user)) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk melihat data barang masuk",
      );
    }

    const { id } = await params;
    const permissions = await getUserPermissions(auth.user.id);
    const result = await inventoryMasukRouteService.getMasukDetail({
      id,
      userId: auth.user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(auth.user),
    });
    if (result.success === false) return toMasukRouteResponse(result);

    logger.apiRequest(
      "GET",
      "/api/inventory/masuk/[id]",
      200,
      Date.now() - startTime,
      {
        userId: auth.user.id,
        masukId: id,
      },
    );
    return apiSuccess({ masuk: result.data.masuk });
  } catch (error) {
    const err = error as Error;
    logger.error("Error fetching barang masuk", err, {
      path: "/api/inventory/masuk/[id]",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat data barang masuk");
  }
}

/** Handle update barang masuk request. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();
  try {
    const auth = await requireAdmin();
    if (!auth) return ApiErrors.unauthorized("Session tidak valid");
    if (
      !(await import("@/lib/rbac")).hasPermission("masuk:update", auth.user)
    ) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah data barang masuk",
      );
    }

    const { id } = await params;
    const body = await req.json();
    const permissions = await getUserPermissions(auth.user.id);
    const dbStart = Date.now();
    const result = await inventoryMasukRouteService.updateMasuk({
      id,
      body,
      userId: auth.user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(auth.user),
    });
    if (result.success === false) return toMasukRouteResponse(result);

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
        userId: auth.user.id,
        masukId: id,
        jumlah: result.data.jumlah,
      },
    );
    return apiSuccess(null, { message: "Barang masuk berhasil diperbarui" });
  } catch (error) {
    const err = error as Error;
    logger.error("Error updating barang masuk", err, {
      path: "/api/inventory/masuk/[id]",
      method: "PUT",
    });
    return ApiErrors.internalError("Gagal memperbarui barang masuk");
  }
}

/** Handle delete barang masuk request. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();
  try {
    const auth = await requireAdmin();
    if (!auth) return ApiErrors.unauthorized("Session tidak valid");
    if (
      !(await import("@/lib/rbac")).hasPermission("masuk:delete", auth.user)
    ) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menghapus data barang masuk",
      );
    }

    const { id } = await params;
    const permissions = await getUserPermissions(auth.user.id);
    const dbStart = Date.now();
    const result = await inventoryMasukRouteService.deleteMasuk({
      id,
      userId: auth.user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(auth.user),
    });
    if (result.success === false) return toMasukRouteResponse(result);

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
        userId: auth.user.id,
        masukId: id,
      },
    );
    return apiSuccess(null, {
      message: "Record barang masuk berhasil dihapus dan stok dikurangi",
    });
  } catch (error) {
    const err = error as Error;
    logger.error("Error deleting barang masuk", err, {
      path: "/api/inventory/masuk/[id]",
      method: "DELETE",
    });
    return ApiErrors.internalError("Gagal menghapus record barang masuk");
  }
}
