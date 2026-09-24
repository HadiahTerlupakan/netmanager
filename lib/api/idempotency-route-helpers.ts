import { NextRequest, NextResponse } from "next/server";

import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  idempotencyService,
  resolveIdempotencyKey,
  type IdempotencyOutcome,
} from "./idempotency";

const HTTP_CONFLICT = 409;
const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * Nilai header `Retry-After` (detik) untuk 409 in-progress. Handler tipikal
 * selesai dalam timeout standar klien 30 detik (`HTTP_TIMEOUTS.standard`,
 * mobile-netmanager `src/constants/httpTimeouts.ts`); kunci yatim sendiri
 * kedaluwarsa setelah `IN_PROGRESS_TTL_SECONDS` (`./idempotency.ts`).
 */
export const IDEMPOTENCY_RETRY_AFTER_SECONDS = 30;

/** Outcome idempotensi yang berujung penolakan (bukan respons handler). */
export type IdempotencyRejectedOutcome = Extract<
  IdempotencyOutcome<unknown>,
  { kind: "in-progress" | "hash-mismatch" | "unavailable" }
>;

/**
 * Bangun respons galat untuk outcome penolakan. Dipakai bersama oleh semua
 * route idempoten supaya kode galat & header seragam: 409 in-progress
 * (`IDEMPOTENCY_IN_PROGRESS` + `Retry-After`, klien boleh mengulang dengan
 * kunci sama), 409 hash-mismatch (`IDEMPOTENCY_KEY_REUSED`, permanen), dan
 * 503 bila Redis tidak tersedia.
 */
export function buildIdempotencyRejectionResponse(
  outcome: IdempotencyRejectedOutcome,
): NextResponse {
  switch (outcome.kind) {
    case "in-progress":
      return apiError(
        "Permintaan masih diproses, tunggu sebentar",
        ErrorCodes.IDEMPOTENCY_IN_PROGRESS,
        {
          status: HTTP_CONFLICT,
          headers: { "Retry-After": String(IDEMPOTENCY_RETRY_AFTER_SECONDS) },
        },
      );
    case "hash-mismatch":
      return apiError(
        "Idempotency-Key sudah dipakai untuk payload berbeda",
        ErrorCodes.IDEMPOTENCY_KEY_REUSED,
        { status: HTTP_CONFLICT },
      );
    case "unavailable":
      return apiError(
        "Layanan idempotency tidak tersedia, silakan coba lagi",
        ErrorCodes.EXTERNAL_SERVICE_ERROR,
        { status: HTTP_SERVICE_UNAVAILABLE },
      );
  }
}

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
    default:
      return buildIdempotencyRejectionResponse(outcome);
  }
}
