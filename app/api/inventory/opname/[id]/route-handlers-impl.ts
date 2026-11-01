import type { NextResponse } from "next/server";

import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  getInventoryOpnameService,
  inventoryOpnameRouteService,
  mapOpnameError,
  OPNAME_PESAN,
  pesanGagalMuatOpname,
} from "@/modules/inventory";

function toUserContext(user: {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string;
  siteId?: string;
  tenantId?: string;
}) {
  return {
    id: user.id,
    // Nama & email ikut: jejak perubahan opname menyimpan nama pelaku.
    name: user.name,
    email: user.email,
    role: user.role,
    siteId: user.siteId,
    tenantId: user.tenantId,
  };
}

/** Ubah error service menjadi respons dengan pesan yang dibaca petugas. */
function respondOpnameError(
  error: unknown,
  serverErrorMessage: string,
): NextResponse {
  const failure = mapOpnameError(error, serverErrorMessage);
  if (failure.status === 404) return ApiErrors.notFound(failure.error);
  if (failure.status === 403) return ApiErrors.forbidden(failure.error);
  if (failure.status === 400) return ApiErrors.badRequest(failure.error);
  return ApiErrors.internalError(failure.error);
}

function readOpnameId(params: Record<string, string> | undefined) {
  const id = params?.id?.trim();
  return id ? id : null;
}

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("opname:read"))) {
    return ApiErrors.forbidden(OPNAME_PESAN.tanpaIzinLihat);
  }

  const id = readOpnameId(ctx.params);
  if (!id) return ApiErrors.badRequest(OPNAME_PESAN.catatanTidakLengkap);

  try {
    const opnameService = getInventoryOpnameService();
    const dbStart = Date.now();
    const record = await opnameService.getOpnameRecord({
      id,
      user: toUserContext(user),
    });

    if (!record) return ApiErrors.notFound(OPNAME_PESAN.catatanTidakDitemukan);

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
    return respondOpnameError(error, pesanGagalMuatOpname("Catatan opname"));
  }
});

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("opname:update"))) {
    return ApiErrors.forbidden(OPNAME_PESAN.tanpaIzinUbah);
  }

  const id = readOpnameId(ctx.params);
  if (!id) return ApiErrors.badRequest(OPNAME_PESAN.catatanTidakLengkap);

  const body = await req.json().catch((): null => null);
  if (!body) return ApiErrors.badRequest(OPNAME_PESAN.dataTidakTerbaca);

  const parsed = inventoryOpnameRouteService.parseOpnameUpdate(body);
  if (parsed.ok === false) {
    return ApiErrors.badRequest(parsed.failure.error, parsed.failure.details);
  }

  try {
    const opnameService = getInventoryOpnameService();
    const dbStart = Date.now();
    const result = await opnameService.updateOpname({
      id,
      ...parsed.data,
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
        stokFisik: parsed.data.stokFisik,
        stokSistem: result.stokSistem,
        selisih: result.selisih,
      },
    );

    return apiSuccess({
      message: "Stock opname berhasil diperbarui",
      record: result.record,
    });
  } catch (error: unknown) {
    return respondOpnameError(error, OPNAME_PESAN.gagalSimpan);
  }
});

export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("opname:delete"))) {
    return ApiErrors.forbidden(OPNAME_PESAN.tanpaIzinHapus);
  }

  const id = readOpnameId(ctx.params);
  if (!id) return ApiErrors.badRequest(OPNAME_PESAN.catatanTidakLengkap);

  try {
    const opnameService = getInventoryOpnameService();
    await opnameService.deleteOpname({ id, user: toUserContext(user) });
    return apiSuccess({ message: "Stock opname berhasil dihapus" });
  } catch (error: unknown) {
    return respondOpnameError(error, OPNAME_PESAN.gagalHapus);
  }
});
