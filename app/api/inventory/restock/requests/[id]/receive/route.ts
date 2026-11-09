import { NextResponse } from "next/server";

import { createHandler, ApiErrors } from "@/lib/api";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  createRestockGoodsReceiptService,
  RESTOCK_MESSAGES,
  RestockReceiptFailedError,
  RestockReceiptForbiddenError,
  RestockReceiptInvalidError,
  RestockReceiptNotFoundError,
  type RestockReceiptResult,
  restockForbiddenMessage,
  restockServerErrorMessage,
} from "@/modules/inventory";
import { ensureRestockRequestSiteAccess } from "../../../_lib/restock-site-access";

const goodsReceiptService = createRestockGoodsReceiptService();

/**
 * Catat barang yang datang dari pengajuan restock via GRN service.
 * Mendukung substitusi barang, kelebihan kiriman, sisa yang tidak jadi
 * datang, menyelesaikan pesanan tanpa kiriman (semua jumlah 0), dan menutup
 * sisa yang tidak jadi dibeli (`closeUnpurchased`).
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("restock:verify"))) {
    return ApiErrors.forbidden(restockForbiddenMessage("restock:verify"));
  }

  const siteDenied = await ensureRestockRequestSiteAccess({
    user,
    purchaseRequestId: ctx.params.id,
    tenantId: user.tenantId as string,
  });
  if (siteDenied) return siteDenied;

  const body = await req.json().catch((): null => null);
  if (!body) return ApiErrors.badRequest(RESTOCK_MESSAGES.unreadableBody);

  try {
    const result = await goodsReceiptService.receive({
      purchaseRequestId: ctx.params.id,
      receivedItems: (body.items ?? {}) as Record<string, number>,
      substitutions: (body.substitutions ?? {}) as Record<string, string>,
      cancellations: (body.cancellations ?? {}) as Record<string, string>,
      overReceipts: (body.overReceipts ?? {}) as Record<string, string>,
      canIncreasePurchaseOrder: await hasPermission("purchase_orders:update"),
      fotoBukti: (body.fotoBukti ?? []) as string[],
      closePO: Boolean(body.closePO),
      closeUnpurchased: body.closeUnpurchased === true,
      closeReason:
        typeof body.closeReason === "string" ? body.closeReason : undefined,
      actorId: user.id as string,
      tenantId: user.tenantId as string,
    });

    return NextResponse.json({
      data: result.goodsReceipt,
      purchaseOrderStatus: result.purchaseOrderStatus,
      purchaseRequestStatus: result.purchaseRequestStatus,
      message: describeReceiptOutcome(result),
    });
  } catch (error) {
    const mappedResponse = mapReceiptError(error);
    if (!mappedResponse) {
      logger.error(
        "Error receiving restock request",
        error instanceof Error ? error : new Error(String(error)),
        { purchaseRequestId: ctx.params.id },
      );
    }
    const response =
      mappedResponse ??
      ApiErrors.internalError(
        restockServerErrorMessage("Menerima barang", false),
      );
    // Pesan penolakan hanya tampil di layar operator; tanpa log ini penyebab
    // 400/404/500 tidak bisa ditelusuri dari server. `cause` menyimpan pesan
    // teknis asli di balik pesan yang sudah diterjemahkan untuk petugas.
    logger.warn("[RESTOCK_RECEIVE] Penerimaan ditolak", {
      purchaseRequestId: ctx.params.id,
      status: response.status,
      reason: describeErrorForLog(error),
      cause: describeErrorForLog((error as { cause?: unknown })?.cause),
    });
    return response;
  }
});

/** Ringkasan hasil penyimpanan untuk petugas gudang. */
function describeReceiptOutcome(result: RestockReceiptResult): string {
  if (result.purchaseRequestStatus === "CANCELLED") {
    return "Pesanan dibatalkan. Tidak ada barang yang masuk gudang.";
  }
  const isFinished = result.purchaseRequestStatus === "RECEIVED";
  if (result.goodsReceipt) {
    return isFinished
      ? "Tersimpan. Barang sudah masuk gudang. Pesanan selesai."
      : "Tersimpan. Barang sudah masuk gudang. Sisanya masih ditunggu.";
  }
  return isFinished
    ? "Tersimpan. Pesanan selesai. Sisa barangnya tidak jadi datang."
    : "Tersimpan. Barang yang tidak jadi datang sudah dicatat. Sisanya masih ditunggu.";
}

function describeErrorForLog(error: unknown): string | undefined {
  if (error === undefined) return undefined;
  return error instanceof Error ? error.message : String(error);
}

function mapReceiptError(error: unknown) {
  if (error instanceof RestockReceiptNotFoundError) {
    return ApiErrors.notFound(error.message);
  }
  if (error instanceof RestockReceiptInvalidError) {
    return ApiErrors.badRequest(error.message);
  }
  if (error instanceof RestockReceiptForbiddenError) {
    return ApiErrors.forbidden(error.message);
  }
  if (error instanceof RestockReceiptFailedError) {
    return ApiErrors.internalError(error.message);
  }
  return null;
}
