import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  idempotencyService,
  resolveIdempotencyKey,
} from "@/lib/api/idempotency";
import type { MobileInventoryError } from "@/modules/inventory";

export type MobileInventoryAuthResult = Exclude<
  Awaited<ReturnType<typeof getMobileAuthPayload>>,
  NextResponse
>;

/** Autentikasi request mobile inventory dan kembalikan payload actor. */
export async function requireMobileInventoryAuth(request: NextRequest) {
  const authResult = await getMobileAuthPayload(request);
  if (authResult instanceof NextResponse) {
    return { response: authResult } as const;
  }

  return { auth: authResult } as const;
}

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
    case "in-progress":
      return apiError(
        "Permintaan masih diproses, tunggu sebentar",
        ErrorCodes.BUSINESS_LOGIC_ERROR,
        { status: 409 },
      );
    case "hash-mismatch":
      return apiError(
        "Idempotency-Key sudah dipakai untuk payload berbeda",
        ErrorCodes.BUSINESS_LOGIC_ERROR,
        { status: 409 },
      );
    case "unavailable":
      return apiError(
        "Layanan idempotency tidak tersedia, silakan coba lagi",
        ErrorCodes.EXTERNAL_SERVICE_ERROR,
        { status: 503 },
      );
  }
}
