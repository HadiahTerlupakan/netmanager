import { logger } from "@/lib/logger";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  inventoryGudangRouteService,
  PESAN_DATA_TIDAK_TERBACA,
  pesanGagalMuat,
  pesanGagalSimpan,
  pesanTanpaIzin,
  type InventoryGudangRouteResult,
} from "@/modules/inventory";
import { masterDataFailureResponse } from "../master-data-response";
import { logActivitySafe } from "@/lib/logger";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

type InventoryGudangRouteFailure = Extract<
  InventoryGudangRouteResult<unknown>,
  { success: false }
>;

function isInventoryGudangRouteFailure(
  result: InventoryGudangRouteResult<unknown>,
): result is InventoryGudangRouteFailure {
  return !result.success;
}

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("gudang:read"))) {
    return ApiErrors.forbidden(pesanTanpaIzin("melihat daftar gudang"));
  }

  const { searchParams } = req.nextUrl;
  const viewAll = searchParams.get("view") === "all";
  // Khusus layar manajemen gudang: tampilkan juga yang nonaktif, supaya
  // menonaktifkan gudang mengubah statusnya dan bukan menghilangkannya.
  const includeInactive = searchParams.get("includeInactive") === "true";
  const permissions = await getUserPermissions(user.id);

  try {
    const dbStart = Date.now();
    const gudangs = await inventoryGudangRouteService.listGudang({
      userId: user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(user),
      viewAll,
      includeInactive,
    });

    logger.dbOperation("findMany", "Gudang", Date.now() - dbStart);

    logger.apiRequest(
      "GET",
      "/api/inventory/gudang",
      200,
      Date.now() - startTime,
      {
        gudangCount: gudangs.length,
        userId: user.id,
      },
    );

    return apiSuccess({ gudangs });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching gudangs", err, {
      path: "/api/inventory/gudang",
      method: "GET",
    });
    return ApiErrors.internalError(pesanGagalMuat("gudang"));
  }
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("gudang:create"))) {
    return ApiErrors.forbidden(pesanTanpaIzin("menambah gudang"));
  }

  const body = await req.json().catch((): null => null);
  if (!body || typeof body !== "object") {
    return ApiErrors.badRequest(PESAN_DATA_TIDAK_TERBACA);
  }
  const permissions = await getUserPermissions(user.id);

  try {
    const dbStart = Date.now();
    const result = await inventoryGudangRouteService.createGudang({
      userId: user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(user),
      body,
    });

    if (isInventoryGudangRouteFailure(result)) {
      return masterDataFailureResponse(result);
    }

    const gudang = result.data as { id: string; kode: string; nama: string };

    logger.dbOperation("create", "Gudang", Date.now() - dbStart);

    logger.apiRequest(
      "POST",
      "/api/inventory/gudang",
      201,
      Date.now() - startTime,
      {
        gudangId: gudang.id,
        kode: gudang.kode,
        userId: user.id,
      },
    );

    // System Log
    logActivitySafe({
      action: "CREATE",
      subject: "Gudang",
      details: { id: gudang.id, name: gudang.nama, code: gudang.kode },
      userId: user.id,
    });

    return apiSuccess({ gudang }, { status: 201 });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error creating gudang", err, {
      path: "/api/inventory/gudang",
      method: "POST",
    });
    return ApiErrors.internalError(pesanGagalSimpan("Gudang"));
  }
});
