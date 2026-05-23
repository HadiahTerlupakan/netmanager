import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  getInventoryOpnameService,
  opnameUpdateSchema,
} from "@/modules/inventory";

const NOT_FOUND_MESSAGE = "Record stock opname tidak ditemukan";
const FORBIDDEN_MESSAGE_PREFIX = "Akses ditolak";

function toUserContext(user: {
  id: string;
  role?: string;
  siteId?: string;
  tenantId?: string;
}) {
  return {
    id: user.id,
    role: user.role,
    siteId: user.siteId,
    tenantId: user.tenantId,
  };
}

function isNotFoundError(message: string) {
  return message.includes("tidak ditemukan");
}

function isForbiddenError(message: string) {
  return message.startsWith(FORBIDDEN_MESSAGE_PREFIX);
}

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("opname:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const { id } = ctx.params;
  if (!id || id.trim() === "") return ApiErrors.badRequest("ID tidak valid");

  try {
    const opnameService = getInventoryOpnameService();
    const dbStart = Date.now();
    const record = await opnameService.getOpnameRecord({
      id: id.trim(),
      user: toUserContext(user),
    });

    if (!record) return ApiErrors.notFound(NOT_FOUND_MESSAGE);

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
      { userId: user.id, opnameId: id },
    );

    return apiSuccess(record);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching stock opname record", err, {
      path: "/api/inventory/opname/[id]",
      method: "GET",
      id,
    });
    if (isNotFoundError(err.message)) return ApiErrors.notFound(err.message);
    if (isForbiddenError(err.message)) return ApiErrors.forbidden(err.message);
    return ApiErrors.internalError("Gagal memuat data stock opname");
  }
});

export const PUT = createHandler(
  { auth: true, schema: opnameUpdateSchema },
  async (_req, ctx) => {
    const startTime = Date.now();
    const user = ctx.session!.user;

    if (!(await hasPermission("opname:update"))) {
      return ApiErrors.forbidden("Akses ditolak");
    }

    const { id } = ctx.params;
    if (!id || id.trim() === "") return ApiErrors.badRequest("ID tidak valid");

    try {
      const opnameService = getInventoryOpnameService();
      const dbStart = Date.now();
      const result = await opnameService.updateOpname({
        id: id.trim(),
        ...ctx.validated,
        user: toUserContext(user),
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
          userId: user.id,
          opnameId: id,
          stokFisik: ctx.validated.stokFisik,
          stokSistem: result.stokSistem,
          selisih: result.selisih,
        },
      );

      return apiSuccess({
        message: "Stock opname berhasil diperbarui",
        record: result.record,
      });
    } catch (error: unknown) {
      const err =
        error instanceof Error ? error : new Error("Terjadi kesalahan");
      logger.error("Error updating stock opname", err, {
        path: "/api/inventory/opname/[id]",
        method: "PUT",
        id,
      });
      if (isNotFoundError(err.message)) return ApiErrors.notFound(err.message);
      if (isForbiddenError(err.message))
        return ApiErrors.forbidden(err.message);
      return ApiErrors.internalError("Gagal memperbarui stock opname");
    }
  },
);

export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("opname:delete"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const { id } = ctx.params;
  if (!id || id.trim() === "") return ApiErrors.badRequest("ID tidak valid");

  try {
    const opnameService = getInventoryOpnameService();
    await opnameService.deleteOpname({
      id: id.trim(),
      user: toUserContext(user),
    });
    return apiSuccess({ message: "Stock opname berhasil dihapus" });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error deleting stock opname", err, {
      path: "/api/inventory/opname/[id]",
      method: "DELETE",
      id,
    });
    if (isNotFoundError(err.message)) return ApiErrors.notFound(err.message);
    if (isForbiddenError(err.message)) return ApiErrors.forbidden(err.message);
    return ApiErrors.internalError(
      err.message || "Gagal menghapus stock opname",
    );
  }
});
