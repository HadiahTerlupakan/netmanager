import { NextRequest, NextResponse } from "next/server";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { idempotencyService, resolveIdempotencyKey } from "./idempotency";

interface ExecuteMobileWithIdempotencyInput<T> {
  request: NextRequest;
  scope: string;
  userId: string;
  body: unknown;
  handler: () => Promise<T>;
  /** HTTP status untuk fresh/replay response. Default 200. */
  status?: number;
  /** Wrap response dalam `{ success: true, data }` (default) atau raw. */
  wrapData?: boolean;
}

/**
 * Generic helper untuk execute handler dengan idempotency + return
 * NextResponse standar. Mengurangi duplikasi switch outcome 60+ lines
 * di setiap mobile mutation route.
 *
 * Pakai di route mobile yang dipanggil via SyncService replay
 * (work-order, inventory, leave, overtime) — replay ditolak sebagai
 * duplicate stock movement / cuti / lembur tanpa middleware ini.
 */
export async function executeMobileWithIdempotency<T>(
  input: ExecuteMobileWithIdempotencyInput<T>,
): Promise<NextResponse> {
  const status = input.status ?? 200;
  const wrap = input.wrapData ?? true;

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
    case "no-key": {
      const body = wrap
        ? { success: true, data: outcome.response }
        : (outcome.response as object);
      return NextResponse.json(body, { status });
    }
    case "replay": {
      const body = wrap
        ? { success: true, data: outcome.response }
        : (outcome.response as object);
      return NextResponse.json(body, {
        status,
        headers: { "X-Idempotent-Replay": "true" },
      });
    }
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
