import { NextResponse } from "next/server";

import { createHandler, ApiErrors } from "@/lib/api";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  describeRestockValidationError,
  restockReceiveSchema,
} from "@/lib/validations/restock";
import {
  createRestockGoodsReceiptService,
  restockForbiddenMessage,
  restockServerErrorMessage,
  type RestockReceiptErrorCode,
  type RestockReceiptFailure,
  type RestockReceiptResult,
} from "@/modules/inventory";
import { ensureRestockRequestSiteAccess } from "../../../_lib/restock-site-access";

const goodsReceiptService = createRestockGoodsReceiptService();

const RECEIPT_ERROR_RESPONSES: Record<
  RestockReceiptErrorCode,
  (message: string) => NextResponse
> = {
  INVALID: ApiErrors.badRequest,
  FORBIDDEN: ApiErrors.forbidden,
  NOT_FOUND: ApiErrors.notFound,
  CONFLICT: ApiErrors.conflict,
  FAILED: ApiErrors.internalError,
};

/**
 * Masukkan Barang pada pengajuan restock yang sudah disetujui: jumlah masuk
 * per barang, barang pengganti, kelebihan beserta alasannya, dan foto bukti.
 * Sekali simpan langsung menyelesaikan pengajuan.
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const purchaseRequestId = ctx.params.id;

  if (!(await hasPermission("restock:verify"))) {
    return ApiErrors.forbidden(restockForbiddenMessage("restock:verify"));
  }

  const siteDenied = await ensureRestockRequestSiteAccess({
    user,
    purchaseRequestId,
    tenantId: user.tenantId as string,
  });
  if (siteDenied) return siteDenied;

  const body: unknown = await req.json().catch((): null => null);
  const parsed = restockReceiveSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.badRequest(describeRestockValidationError(parsed.error));
  }

  try {
    const outcome = await goodsReceiptService.receive({
      purchaseRequestId,
      receivedItems: parsed.data.items,
      substitutions: parsed.data.substitutions,
      overReceipts: parsed.data.overReceipts,
      fotoBukti: parsed.data.fotoBukti,
      canIncreasePurchaseOrder: await hasPermission("purchase_orders:update"),
      actorId: user.id,
      tenantId: user.tenantId as string,
    });
    if (outcome.success === false) {
      return rejectReceipt(purchaseRequestId, outcome);
    }

    return NextResponse.json({
      data: outcome.data.goodsReceipt,
      purchaseRequestStatus: outcome.data.purchaseRequestStatus,
      message: describeReceiptOutcome(outcome.data),
    });
  } catch (error: unknown) {
    logger.error(
      "Error receiving restock request",
      error instanceof Error ? error : new Error(String(error)),
      { purchaseRequestId },
    );
    // Barang pengganti bisa sudah tertulis sebelum gangguan ini, jadi jangan
    // menjanjikan bahwa tidak ada yang berubah.
    return ApiErrors.internalError(
      restockServerErrorMessage("Memasukkan barang", false),
    );
  }
});

/** Ringkasan hasil penyimpanan untuk admin gudang. */
function describeReceiptOutcome(result: RestockReceiptResult): string {
  return result.goodsReceipt
    ? "Tersimpan. Barang sudah masuk gudang. Pengajuan selesai."
    : "Tersimpan. Pengajuan selesai.";
}

/**
 * Pesan penolakan hanya tampil di layar admin; log ini menyimpan penyebabnya,
 * termasuk pesan teknis asli di `cause`, supaya bisa ditelusuri dari server.
 */
function rejectReceipt(
  purchaseRequestId: string,
  failure: RestockReceiptFailure,
): NextResponse {
  const response = RECEIPT_ERROR_RESPONSES[failure.code](failure.error);
  logger.warn("[RESTOCK_RECEIVE] Penerimaan ditolak", {
    purchaseRequestId,
    status: response.status,
    reason: failure.error,
    cause: describeErrorForLog(failure.cause),
  });
  return response;
}

function describeErrorForLog(error: unknown): string | undefined {
  if (error === undefined) return undefined;
  return error instanceof Error ? error.message : String(error);
}
