import { NextRequest, NextResponse } from "next/server";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  idempotencyService,
  resolveIdempotencyKey,
} from "@/lib/api/idempotency";
import { buildIdempotencyRejectionResponse } from "@/lib/api/idempotency-route-helpers";
import { logger } from "@/lib/logger";
import type { MobileInventoryError } from "@/modules/inventory";

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_ERROR = 500;

/**
 * Pesan untuk staf lapangan di aplikasi mobile. Pesan 5xx harus ≤160 karakter:
 * aplikasi mengganti pesan 5xx yang lebih panjang dengan kalimat umum.
 */
export const MOBILE_INVENTORY_MESSAGES = {
  noAccess:
    "Akun Anda belum boleh melihat barang gudang. Minta admin menambahkan izin barang di akun Anda.",
  noMasukAccess:
    "Akun Anda belum boleh mencatat barang masuk. Minta admin menambahkan izin barang masuk di akun Anda.",
  noKeluarAccess:
    "Akun Anda belum boleh mencatat barang keluar. Minta admin menambahkan izin barang keluar di akun Anda.",
  brokenBody:
    "Data yang dikirim rusak. Tutup layar ini, buka lagi, lalu isi ulang.",
  saveServerError:
    "Ada gangguan di server. Buka Riwayat dulu: kalau datanya belum ada, coba simpan lagi. Kalau tetap gagal, lapor admin.",
  loadServerError:
    "Data belum bisa dimuat karena ada gangguan di server. Tarik layar ke bawah untuk coba lagi. Kalau tetap gagal, lapor admin.",
} as const;

type MobileInventoryAction = "simpan" | "muat";

function errorCodeForStatus(status: number) {
  if (status === HTTP_FORBIDDEN) return ErrorCodes.FORBIDDEN;
  if (status === HTTP_NOT_FOUND) return ErrorCodes.NOT_FOUND;
  return ErrorCodes.VALIDATION_ERROR;
}

/**
 * Bangun response error terstandar untuk route mobile inventory. Penolakan
 * yang disengaja (`MobileInventoryError`) diteruskan apa adanya; selain itu
 * penyebab aslinya dicatat di log dan pengguna mendapat pesan yang bisa
 * ditindaklanjuti. Penulisan stok tidak menjanjikan "belum tersimpan": efek
 * samping setelah transaksi bisa gagal padahal stok sudah tercatat.
 */
export function createMobileInventoryErrorResponse(
  error: unknown,
  action: MobileInventoryAction = "muat",
) {
  const inventoryError = error as MobileInventoryError & { status?: number };

  if (
    inventoryError &&
    typeof inventoryError.message === "string" &&
    typeof inventoryError.status === "number"
  ) {
    return apiError(
      inventoryError.message,
      errorCodeForStatus(inventoryError.status),
      { status: inventoryError.status },
    );
  }

  logger.error(
    `Mobile inventory gagal (${action})`,
    error instanceof Error ? error : new Error(String(error)),
  );
  const message =
    action === "simpan"
      ? MOBILE_INVENTORY_MESSAGES.saveServerError
      : MOBILE_INVENTORY_MESSAGES.loadServerError;
  return apiError(message, ErrorCodes.INTERNAL_ERROR, {
    status: HTTP_INTERNAL_ERROR,
  });
}

/** Tolak akses dengan pesan izin yang menyebut apa yang perlu diminta ke admin. */
export function rejectMobileInventoryAccess(message: string) {
  return apiError(message, ErrorCodes.FORBIDDEN, { status: HTTP_FORBIDDEN });
}

/**
 * Baca badan permintaan transaksi mobile. JSON rusak atau bukan objek adalah
 * kesalahan kiriman (400), bukan gangguan server.
 */
export async function readMobileInventoryBody(
  req: NextRequest,
): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: NextResponse }
> {
  const body: unknown = await req.json().catch((): null => null);
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return { ok: true, body: body as Record<string, unknown> };
  }
  return {
    ok: false,
    response: apiError(
      MOBILE_INVENTORY_MESSAGES.brokenBody,
      ErrorCodes.VALIDATION_ERROR,
      { status: HTTP_BAD_REQUEST },
    ),
  };
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
