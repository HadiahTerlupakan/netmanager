import { NextRequest } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authConfig, getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { inventoryKeluarRouteService } from "@/modules/inventory";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  INVENTORY_UNEXPECTED_ERROR_MESSAGE,
  inventoryFailureResponse,
} from "../../_lib/inventory-failure-response";
import { parseInventoryMutationBody } from "../../_lib/inventory-mutation-request";

const SESSION_EXPIRED_MESSAGE =
  "Sesi login Anda sudah habis. Silakan login lagi, lalu ulangi.";

interface UserSession {
  id: string;
  role?: string;
  isSuperAdmin?: boolean;
}

async function requireAdmin(): Promise<UserSession | null> {
  const session = (await getServerSession(authConfig)) as Session | null;
  return session?.user ? (session.user as UserSession) : null;
}

/** Gangguan tak terduga: catat penyebabnya, beri staf langkah yang aman. */
function unexpectedFailure(error: unknown, method: string) {
  logger.error(
    "Error mutating barang keluar",
    error instanceof Error ? error : new Error(String(error)),
    { path: "/api/inventory/keluar/[id]", method },
  );
  return ApiErrors.internalError(INVENTORY_UNEXPECTED_ERROR_MESSAGE);
}

async function buildAccessInput(id: string, user: UserSession) {
  return {
    id,
    userId: user.id,
    permissions: await getUserPermissions(user.id),
    isSuperAdmin: isSuperAdmin(user),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdmin();
  if (!user) return ApiErrors.unauthorized(SESSION_EXPIRED_MESSAGE);
  if (!(await hasPermission("keluar:read", user))) {
    return ApiErrors.forbidden(
      "Akun Anda tidak punya izin melihat barang keluar. Minta admin menambahkan izin ini ke peran Anda.",
    );
  }

  try {
    const { id } = await params;
    const result = await inventoryKeluarRouteService.getKeluarDetail(
      await buildAccessInput(id, user),
    );
    return result.success === true
      ? apiSuccess(result.data)
      : inventoryFailureResponse(result);
  } catch (error) {
    logger.error(
      "Error fetching barang keluar",
      error instanceof Error ? error : new Error(String(error)),
      { path: "/api/inventory/keluar/[id]", method: "GET" },
    );
    return ApiErrors.internalError(
      "Data barang keluar gagal dimuat karena ada gangguan di server. Muat ulang halaman. Kalau tetap gagal, laporkan ke admin.",
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdmin();
  if (!user) return ApiErrors.unauthorized(SESSION_EXPIRED_MESSAGE);
  if (!(await hasPermission("keluar:update", user))) {
    return ApiErrors.forbidden(
      "Akun Anda tidak punya izin mengubah barang keluar. Minta admin menambahkan izin ini ke peran Anda.",
    );
  }

  const parsed = await parseInventoryMutationBody(req);
  if (parsed.ok === false) return parsed.response;

  try {
    const { id } = await params;
    const result = await inventoryKeluarRouteService.updateKeluar({
      ...(await buildAccessInput(id, user)),
      body: parsed.body,
    });
    return result.success === true
      ? apiSuccess(null, { message: "Barang keluar berhasil diperbarui" })
      : inventoryFailureResponse(result);
  } catch (error) {
    return unexpectedFailure(error, "PUT");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdmin();
  if (!user) return ApiErrors.unauthorized(SESSION_EXPIRED_MESSAGE);
  if (!(await hasPermission("keluar:delete", user))) {
    return ApiErrors.forbidden(
      "Akun Anda tidak punya izin menghapus barang keluar. Minta admin menambahkan izin ini ke peran Anda.",
    );
  }

  try {
    const { id } = await params;
    const result = await inventoryKeluarRouteService.deleteKeluar(
      await buildAccessInput(id, user),
    );
    return result.success === true
      ? apiSuccess(null, {
          message:
            "Catatan barang keluar sudah dihapus, dan stoknya sudah dikembalikan ke gudang.",
        })
      : inventoryFailureResponse(result);
  } catch (error) {
    return unexpectedFailure(error, "DELETE");
  }
}
