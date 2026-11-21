import type { Session } from "next-auth";
import { NextResponse } from "next/server";

import { ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  describeRestockValidationError,
  restockCancelSchema,
} from "@/lib/validations/restock";
import {
  cancelRestockRequest,
  restockForbiddenMessage,
  restockServerErrorMessage,
  type RestockCancelErrorCode,
} from "@/modules/inventory";
import { ensureRestockRequestSiteAccess } from "../../_lib/restock-site-access";

const CANCEL_ERROR_RESPONSES: Record<
  RestockCancelErrorCode,
  (message: string) => NextResponse
> = {
  NOT_FOUND: ApiErrors.notFound,
  CONFLICT: ApiErrors.conflict,
};

const CANCELLED_MESSAGE = "Pengajuan dibatalkan.";

/** Body PATCH yang meminta pembatalan; isinya diperiksa `restockCancelSchema`. */
export function isRestockCancelBody(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { action?: unknown }).action === "CANCEL"
  );
}

/**
 * Batalkan pengajuan restock yang sudah disetujui tetapi belum ada barang
 * atau jasa yang masuk, dengan alasan admin. Butuh izin `restock:verify` dan
 * akses ke site gudang pengajuan.
 */
export async function handleRestockCancelRequest(input: {
  user: Session["user"];
  id: string;
  body: unknown;
}): Promise<NextResponse> {
  if (!(await hasPermission("restock:verify"))) {
    return ApiErrors.forbidden(restockForbiddenMessage("restock:verify"));
  }

  const tenantId = input.user.tenantId as string;
  const siteDenied = await ensureRestockRequestSiteAccess({
    user: input.user,
    purchaseRequestId: input.id,
    tenantId,
  });
  if (siteDenied) return siteDenied;

  const parsed = restockCancelSchema.safeParse(input.body);
  if (!parsed.success) {
    return ApiErrors.badRequest(describeRestockValidationError(parsed.error));
  }

  try {
    const result = await cancelRestockRequest({
      id: input.id,
      tenantId,
      actorId: input.user.id as string,
      alasan: parsed.data.alasan,
    });
    if (result.success === false) {
      return CANCEL_ERROR_RESPONSES[result.code](result.error);
    }
    return NextResponse.json({ data: result.data, message: CANCELLED_MESSAGE });
  } catch (error: unknown) {
    logger.error(
      "Error cancelling purchase request",
      error instanceof Error ? error : new Error(String(error)),
      { purchaseRequestId: input.id },
    );
    // Pencoretan sisa dan status pengajuan ditulis dalam satu transaksi.
    return ApiErrors.internalError(
      restockServerErrorMessage("Membatalkan pengajuan", true),
    );
  }
}
