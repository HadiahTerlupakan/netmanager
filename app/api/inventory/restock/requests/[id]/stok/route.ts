import { NextResponse } from "next/server";

import { ApiErrors, createHandler } from "@/lib/api";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  getInventoryRouteService,
  RESTOCK_MESSAGES,
  restockForbiddenMessage,
  restockServerErrorMessage,
} from "@/modules/inventory";
import { ensureRestockRequestSiteAccess } from "../../../_lib/restock-site-access";

const inventoryRouteService = getInventoryRouteService();
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/**
 * Stok terkini di gudang tujuan pengajuan (total, Baru, Bekas, Rusak, dan
 * minimum) per barang, sebagai bahan pertimbangan di modal persetujuan.
 * Tidak di-cache: angkanya dipakai untuk memutuskan.
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("restock:read"))) {
    return ApiErrors.forbidden(restockForbiddenMessage("restock:read"));
  }
  const tenantId = ctx.session!.user.tenantId as string;
  const siteDenied = await ensureRestockRequestSiteAccess({
    user: ctx.session!.user,
    purchaseRequestId: ctx.params.id,
    tenantId,
  });
  if (siteDenied) return siteDenied;

  try {
    const stock = await inventoryRouteService.getApprovalStock({
      id: ctx.params.id,
      tenantId,
    });
    if (!stock) return ApiErrors.notFound(RESTOCK_MESSAGES.requestNotFound);
    return NextResponse.json(
      { data: { ...stock, fetchedAt: new Date().toISOString() } },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    logger.error(
      "Error reading restock approval stock",
      error instanceof Error ? error : new Error(String(error)),
      { purchaseRequestId: ctx.params.id },
    );
    return ApiErrors.internalError(
      restockServerErrorMessage("Memuat stok gudang", true),
    );
  }
});
