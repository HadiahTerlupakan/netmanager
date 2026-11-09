import { NextResponse } from "next/server";

import { createHandler, ApiErrors } from "@/lib/api";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  describeRestockValidationError,
  restockPurchaseVoidSchema,
} from "@/lib/validations/restock";
import {
  createRestockPurchaseRecordService,
  RESTOCK_MESSAGES,
  restockForbiddenMessage,
  restockServerErrorMessage,
  type VoidRestockPurchaseErrorCode,
} from "@/modules/inventory";
import { ensureRestockRequestSiteAccess } from "../../../../../_lib/restock-site-access";

const purchaseRecordService = createRestockPurchaseRecordService();

const VOID_ERROR_RESPONSE: Record<
  VoidRestockPurchaseErrorCode,
  (message: string) => NextResponse
> = {
  NOT_FOUND: ApiErrors.notFound,
  CONFLICT: ApiErrors.conflict,
};

/**
 * POST — batalkan satu catatan belanja (alasan wajib). Catatan tetap
 * disimpan untuk jejak audit; jumlah dibelinya dikembalikan.
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
  const parsed = restockPurchaseVoidSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.badRequest(describeRestockValidationError(parsed.error));
  }

  try {
    const result = await purchaseRecordService.voidPurchase({
      purchaseRequestId: ctx.params.id,
      recordId: ctx.params.recordId,
      tenantId,
      actorId: user.id as string,
      reason: parsed.data.reason,
    });
    if (result.success === false) {
      return VOID_ERROR_RESPONSE[result.code](result.error);
    }
    return NextResponse.json({
      data: result.data.record,
      message: result.data.message,
    });
  } catch (error) {
    logger.error(
      "Error voiding restock purchase record",
      error instanceof Error ? error : new Error(String(error)),
      { purchaseRequestId: ctx.params.id, recordId: ctx.params.recordId },
    );
    return ApiErrors.internalError(
      restockServerErrorMessage("Membatalkan catatan belanja", true),
    );
  }
});
