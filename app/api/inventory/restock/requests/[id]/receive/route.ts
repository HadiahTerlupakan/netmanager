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
  restockForbiddenMessage,
  restockServerErrorMessage,
} from "@/modules/inventory";

const goodsReceiptService = createRestockGoodsReceiptService();

/**
 * Terima barang dari pre-request restock via GRN service.
 * Mendukung substitusi barang bila yang datang berbeda dari yang dipesan.
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("restock:verify"))) {
    return ApiErrors.forbidden(restockForbiddenMessage("restock:verify"));
  }

  const body = await req.json().catch((): null => null);
  if (!body) return ApiErrors.badRequest(RESTOCK_MESSAGES.unreadableBody);

  try {
    const goodsReceipt = await goodsReceiptService.receive({
      purchaseRequestId: ctx.params.id,
      receivedItems: (body.items ?? {}) as Record<string, number>,
      substitutions: (body.substitutions ?? {}) as Record<string, string>,
      cancellations: (body.cancellations ?? {}) as Record<string, string>,
      overReceipts: (body.overReceipts ?? {}) as Record<string, string>,
      canIncreasePurchaseOrder: await hasPermission("purchase_orders:update"),
      fotoBukti: (body.fotoBukti ?? []) as string[],
      closePO: Boolean(body.closePO),
      actorId: user.id as string,
      tenantId: user.tenantId as string,
    });

    return NextResponse.json({
      data: goodsReceipt,
      message: "Barang berhasil diterima dan GRN tercatat",
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
