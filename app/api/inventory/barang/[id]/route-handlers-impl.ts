import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  getInventoryRouteService,
  inventoryBarangRouteService,
  PESAN_DATA_TIDAK_TERBACA,
  pesanGagalHapus,
  pesanGagalMuat,
  pesanGagalSimpan,
  pesanTanpaIzin,
  pesanTidakDitemukan,
} from "@/modules/inventory";
import { masterDataFailureResponse } from "../../master-data-response";
import type { InventoryBarangRouteResult } from "@/modules/inventory";

type InventoryBarangRouteFailure = Extract<
  InventoryBarangRouteResult<unknown>,
  { success: false }
>;

const inventoryRouteService = getInventoryRouteService();
const SITE_RESTRICTION_PERMISSIONS = ["barang:site_only", "gudang:site_only"];

/** Check whether inventory barang route service returned a failure. */
function isInventoryBarangRouteFailure(
  result: InventoryBarangRouteResult<unknown>,
): result is InventoryBarangRouteFailure {
  return !result.success;
}

/** Resolve restricted site id for current user. */
async function resolveRestrictedSiteId(user: {
  id: string;
  role?: string;
  isSuperAdmin?: boolean;
}) {
  const permissions = await getUserPermissions(user.id);
  return inventoryRouteService.resolveRestrictedSiteId({
    userId: user.id,
    permissions,
    isSuperAdmin: isSuperAdmin(user),
    restrictedPermissions: SITE_RESTRICTION_PERMISSIONS,
  });
}

/** Log successful barang request. */
function logBarangRequest(
  method: string,
  path: string,
  startTime: number,
  meta: Record<string, unknown>,
) {
  logger.apiRequest(method, path, 200, Date.now() - startTime, meta);
}

/** Handle get barang detail request. */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("barang:read"))) {
    return ApiErrors.forbidden(pesanTanpaIzin("melihat detail barang"));
  }

  try {
    const siteId = await resolveRestrictedSiteId(user);
    const dbStart = Date.now();
    const result = await inventoryBarangRouteService.getBarangDetail({
      id,
      siteId,
    });

    if (!result.found) {
      return ApiErrors.notFound(pesanTidakDitemukan("Barang"));
    }

    logger.dbOperation("findUnique", "Barang+Relations", Date.now() - dbStart);
    logBarangRequest("GET", `/api/inventory/barang/${id}`, startTime, {
      userId: user.id,
      barangId: result.barang.id,
    });

    return apiSuccess({ barang: result.barang });
  } catch (error) {
    const err = error as Error;
    logger.error("Error fetching barang", err, {
      path: "/api/inventory/barang/[id]",
      method: "GET",
      id: "unknown",
    });
    return ApiErrors.internalError(pesanGagalMuat("barang"));
  }
});

/** Handle update barang request. */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("barang:update"))) {
    return ApiErrors.forbidden(pesanTanpaIzin("mengubah barang"));
  }

  const body = await req.json().catch((): null => null);
  if (!body || typeof body !== "object") {
    return ApiErrors.badRequest(PESAN_DATA_TIDAK_TERBACA);
  }

  try {
    const siteId = await resolveRestrictedSiteId(user);
    const dbStart = Date.now();
    const result = await inventoryBarangRouteService.updateBarang({
      id,
      siteId,
      body,
    });

    if (isInventoryBarangRouteFailure(result)) {
      return masterDataFailureResponse(result);
    }

    const updatedBarang = result.data as { id: string };
    logger.dbOperation("update", "Barang", Date.now() - dbStart);
    logBarangRequest("PUT", `/api/inventory/barang/${id}`, startTime, {
      userId: user.id,
      barangId: updatedBarang.id,
    });

    await logger.logActivity({
      action: "UPDATE",
      subject: "Barang",
      userId: user.id,
      details: {
        id: updatedBarang.id,
        changes: {
          kode: body.kode,
          nama: body.nama,
          satuan: body.satuan,
        },
      },
    });

    return apiSuccess({ barang: updatedBarang }, { message: result.message });
  } catch (error) {
    const err = error as Error;
    logger.error("Error updating barang", err, {
      path: "/api/inventory/barang/[id]",
      method: "PUT",
      id: "unknown",
    });
    return ApiErrors.internalError(pesanGagalSimpan("Perubahan barang"));
  }
});

/** Handle delete barang request. */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("barang:delete"))) {
    return ApiErrors.forbidden(pesanTanpaIzin("menghapus barang"));
  }

  try {
    const siteId = await resolveRestrictedSiteId(user);
    const dbStart = Date.now();
    const result = await inventoryBarangRouteService.deleteBarang({
      id,
      siteId,
    });

    if (isInventoryBarangRouteFailure(result)) {
      return masterDataFailureResponse(result);
    }

    logger.dbOperation("delete", "Barang", Date.now() - dbStart);
    logBarangRequest("DELETE", `/api/inventory/barang/${id}`, startTime, {
      userId: user.id,
      barangId: id,
    });

    await logger.logActivity({
      action: "DELETE",
      subject: "Barang",
      userId: user.id,
      details: { id },
    });

    return apiSuccess(null, { message: result.message });
  } catch (error) {
    const err = error as Error;
    logger.error("Error deleting barang", err, {
      path: "/api/inventory/barang/[id]",
      method: "DELETE",
      id: "unknown",
    });
    return ApiErrors.internalError(pesanGagalHapus("Barang"));
  }
});
