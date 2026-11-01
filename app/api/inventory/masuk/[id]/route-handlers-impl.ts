import { NextRequest } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authConfig, getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { inventoryMasukRouteService } from "@/modules/inventory";
import {
  INVENTORY_UNEXPECTED_ERROR_MESSAGE,
  inventoryFailureResponse,
} from "../../_lib/inventory-failure-response";
import { parseInventoryMutationBody } from "../../_lib/inventory-mutation-request";

const SESSION_EXPIRED_MESSAGE =
  "Sesi login Anda sudah habis. Silakan login lagi, lalu ulangi.";

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

/** Handle get barang masuk detail request. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();
  try {
    const auth = await requireAdmin();
    if (!auth) return ApiErrors.unauthorized(SESSION_EXPIRED_MESSAGE);
    if (!(await import("@/lib/rbac")).hasPermission("masuk:read", auth.user)) {
      return ApiErrors.forbidden(
        "Akun Anda tidak punya izin melihat barang masuk. Minta admin menambahkan izin ini ke peran Anda.",
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
    if (result.success === false) return inventoryFailureResponse(result);

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
    return ApiErrors.internalError(
      "Data barang masuk gagal dimuat karena ada gangguan di server. Muat ulang halaman. Kalau tetap gagal, laporkan ke admin.",
    );
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
    if (!auth) return ApiErrors.unauthorized(SESSION_EXPIRED_MESSAGE);
    if (
      !(await import("@/lib/rbac")).hasPermission("masuk:update", auth.user)
    ) {
      return ApiErrors.forbidden(
        "Akun Anda tidak punya izin mengubah barang masuk. Minta admin menambahkan izin ini ke peran Anda.",
      );
    }

    const { id } = await params;
    const parsed = await parseInventoryMutationBody(req);
    if (parsed.ok === false) return parsed.response;
    const permissions = await getUserPermissions(auth.user.id);
    const dbStart = Date.now();
    const result = await inventoryMasukRouteService.updateMasuk({
      id,
      body: parsed.body,
      userId: auth.user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(auth.user),
    });
    if (result.success === false) return inventoryFailureResponse(result);

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
    return ApiErrors.internalError(INVENTORY_UNEXPECTED_ERROR_MESSAGE);
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
    if (!auth) return ApiErrors.unauthorized(SESSION_EXPIRED_MESSAGE);
    if (
      !(await import("@/lib/rbac")).hasPermission("masuk:delete", auth.user)
    ) {
      return ApiErrors.forbidden(
        "Akun Anda tidak punya izin menghapus barang masuk. Minta admin menambahkan izin ini ke peran Anda.",
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
    if (result.success === false) return inventoryFailureResponse(result);

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
      message:
        "Catatan barang masuk sudah dihapus, dan stoknya sudah dikurangi.",
    });
  } catch (error) {
    const err = error as Error;
    logger.error("Error deleting barang masuk", err, {
      path: "/api/inventory/masuk/[id]",
      method: "DELETE",
    });
    return ApiErrors.internalError(INVENTORY_UNEXPECTED_ERROR_MESSAGE);
  }
}
