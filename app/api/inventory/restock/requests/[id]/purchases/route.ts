import { NextResponse } from "next/server";

import { createHandler, ApiErrors } from "@/lib/api";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  describeRestockValidationError,
  RESTOCK_PURCHASE_RECORD_LIST_LABELS,
  restockPurchaseRecordSchema,
} from "@/lib/validations/restock";
import {
  createRestockPurchaseRecordService,
  RESTOCK_MESSAGES,
  restockForbiddenMessage,
  restockServerErrorMessage,
  type RestockPurchaseRecordErrorCode,
} from "@/modules/inventory";
import { ensureRestockRequestSiteAccess } from "../../../_lib/restock-site-access";

const purchaseRecordService = createRestockPurchaseRecordService();

const PURCHASE_RECORD_ERROR_RESPONSE: Record<
  RestockPurchaseRecordErrorCode,
  (message: string) => NextResponse
> = {
  INVALID: ApiErrors.badRequest,
  NOT_FOUND: ApiErrors.notFound,
  CONFLICT: ApiErrors.conflict,
  // Hanya terjadi untuk catatan lewat link; di sini tidak pernah muncul.
  LINK_INACTIVE: ApiErrors.conflict,
  LIMIT_REACHED: ApiErrors.conflict,
};

/**
 * Catat satu kali belanja di satu toko untuk pengajuan restock. Pesanan dan
 * tagihannya tetap satu; catatan ini merekam barang mana dibeli di mana.
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const tenantId = user.tenantId as string;

  if (!(await hasPermission("restock:verify"))) {
    return ApiErrors.forbidden(restockForbiddenMessage("restock:verify"));
  }

  const siteDenied = await ensureRestockRequestSiteAccess({
    user,
    purchaseRequestId: ctx.params.id,
    tenantId,
  });
  if (siteDenied) return siteDenied;

  const body = await req.json().catch((): null => null);
  if (!body) return ApiErrors.badRequest(RESTOCK_MESSAGES.unreadableBody);

  const parsed = restockPurchaseRecordSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.badRequest(
      describeRestockValidationError(
        parsed.error,
        RESTOCK_PURCHASE_RECORD_LIST_LABELS,
      ),
    );
  }

  try {
    const result = await purchaseRecordService.recordPurchase({
      purchaseRequestId: ctx.params.id,
      tenantId,
      origin: {
        kind: "ADMIN",
        actorId: user.id as string,
        buyerName: parsed.data.buyerName ?? null,
        actorName: user.name ?? null,
      },
      storeName: parsed.data.storeName,
      supplierId: parsed.data.supplierId ?? null,
      purchasedAt: parsed.data.purchasedAt,
      notes: parsed.data.notes,
      fotoNota: parsed.data.fotoNota,
      items: parsed.data.items.map((item) => ({
        purchaseOrderItemId: item.purchaseOrderItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? null,
      })),
    });
    if (result.success === false) {
      return PURCHASE_RECORD_ERROR_RESPONSE[result.code](result.error);
    }
    return NextResponse.json(
      {
        data: result.data.record,
        purchaseOrderStatus: result.data.purchaseOrderStatus,
        isFullyPurchased: result.data.isFullyPurchased,
        message: result.data.message,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error(
      "Error recording restock purchase",
      error instanceof Error ? error : new Error(String(error)),
      { purchaseRequestId: ctx.params.id },
    );
    return ApiErrors.internalError(
      restockServerErrorMessage("Mencatat belanja", false),
    );
  }
});
