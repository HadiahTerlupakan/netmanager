import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

const REQUEST_ID_HEADER = "x-request-id";
const CORRELATION_ID_HEADER = "x-correlation-id";

/**
 * Ambil atau buat request ID untuk korelasi log mobile ↔ backend.
 *
 * Mobile (axios interceptor) inject `X-Request-Id: <uuid>`. Backend baca
 * header tersebut dan echo back via response header agar developer bisa
 * korelasi log saat user lapor "transaksi gagal jam X".
 *
 * Jika header tidak ada (caller bukan mobile), generate UUID baru di
 * backend agar log tetap punya identifier konsisten.
 */
export function getOrCreateRequestId(request: NextRequest | Request): string {
  const headers = request.headers;
  const fromHeader =
    headers.get(REQUEST_ID_HEADER) ?? headers.get(CORRELATION_ID_HEADER);
  if (fromHeader && fromHeader.trim().length > 0) {
    return fromHeader.trim();
  }
  return randomUUID();
}

/** Header untuk echo request ID kembali ke client. */
export function buildRequestIdHeaders(requestId: string): HeadersInit {
  return {
    "X-Request-Id": requestId,
  };
}
