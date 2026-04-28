import { NextRequest } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authConfig, getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { inventoryKeluarRouteService } from "@/modules/inventory";
import {
  apiError,
  apiSuccess,
  ApiErrors,
  ErrorCodes,
} from "@/lib/api-response";
import { hasPermission } from "@/lib/rbac";

interface UserSession {
  id: string;
  role?: string;
  isSuperAdmin?: boolean;
}

async function requireAdmin(): Promise<UserSession | null> {
  const session = (await getServerSession(authConfig)) as Session | null;
  return session?.user ? (session.user as UserSession) : null;
}

function routeFailure(result: { status: number; error: string }) {
  if (result.status === 404) return ApiErrors.notFound(result.error);
  if (result.status === 403) return ApiErrors.forbidden(result.error);
  return apiError(result.error, ErrorCodes.VALIDATION_ERROR, {
    status: result.status,
  });
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
  if (!user) return ApiErrors.unauthorized("Session tidak valid");
  if (!(await hasPermission("keluar:read", user))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data barang keluar",
    );
  }

  const { id } = await params;
  const result = await inventoryKeluarRouteService.getKeluarDetail(
    await buildAccessInput(id, user),
  );
  return result.success === true
    ? apiSuccess(result.data)
    : routeFailure(result);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdmin();
  if (!user) return ApiErrors.unauthorized("Session tidak valid");
  if (!(await hasPermission("keluar:update", user))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah data barang keluar",
    );
  }

  try {
    const { id } = await params;
    const result = await inventoryKeluarRouteService.updateKeluar({
      ...(await buildAccessInput(id, user)),
      body: await req.json(),
    });
    return result.success === true
      ? apiSuccess(null, { message: "Barang keluar berhasil diperbarui" })
      : routeFailure(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Record barang keluar tidak ditemukan") {
      return ApiErrors.notFound("Record barang keluar");
    }
    if (message === "Stok tidak mencukupi untuk perubahan ini") {
      return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }
    return ApiErrors.internalError("Gagal memperbarui barang keluar");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdmin();
  if (!user) return ApiErrors.unauthorized("Session tidak valid");
  if (!(await hasPermission("keluar:delete", user))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus data barang keluar",
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
            "Record barang keluar berhasil dihapus dan stok dikembalikan",
        })
      : routeFailure(result);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Record barang keluar tidak ditemukan"
    ) {
      return ApiErrors.notFound("Record barang keluar");
    }
    return ApiErrors.internalError("Gagal menghapus record barang keluar");
  }
}
