import { NextRequest, NextResponse } from "next/server";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  idempotencyService,
  resolveIdempotencyKey,
} from "@/lib/api/idempotency";
import { buildIdempotencyRejectionResponse } from "@/lib/api/idempotency-route-helpers";
import type { MobileInventoryError } from "@/modules/inventory";

/** Bangun response error terstandar untuk route mobile inventory. */
export function createMobileInventoryErrorResponse(error: unknown) {
  const inventoryError = error as MobileInventoryError & { status?: number };

  if (
    inventoryError &&
    typeof inventoryError.message === "string" &&
    typeof inventoryError.status === "number"
  ) {
    return apiError(inventoryError.message, ErrorCodes.VALIDATION_ERROR, {
      status: inventoryError.status,
    });
  }

  return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
    status: 500,
  });
}

/**
 * Eksekusi handler inventory dengan generic idempotency. Caller pass scope
 * (mis. "inventory:masuk") + service handler. Replay yang sudah pernah
 * dieksekusi (via SyncService) return cached response, bukan create
 * duplicate stock movement.
 */
export async function executeMobileInventoryWithIdempotency<T>(input: {
  request: NextRequest;
  scope: string;
  userId: string;
  body: unknown;
  handler: () => Promise<T>;
}): Promise<NextResponse> {
  const requestId = resolveIdempotencyKey(
    input.request.headers.get("Idempotency-Key"),
    (input.body as { requestId?: unknown } | null)?.requestId,
  );

  const outcome = await idempotencyService.execute({
    scope: input.scope,
    userId: input.userId,
    requestId,
    payload: input.body,
    handler: input.handler,
  });

  switch (outcome.kind) {
    case "fresh":
    case "no-key":
      return NextResponse.json({ success: true, data: outcome.response });
    case "replay":
      return NextResponse.json(
        { success: true, data: outcome.response },
        { headers: { "X-Idempotent-Replay": "true" } },
      );
    default:
      return buildIdempotencyRejectionResponse(outcome);
  }
}
