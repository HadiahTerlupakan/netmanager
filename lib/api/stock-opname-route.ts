import { NextResponse } from "next/server";

import { isRouteServiceError } from "@/lib/api/route-service-error";
import { ApiErrors } from "@/lib/api";
import { logger } from "@/lib/logger";

/**
 * Ubah galat service jadwal SO menjadi respons API: validasi (400) diteruskan
 * pesannya, site tak ditemukan (404), selain itu 500 tanpa detail internal.
 */
export function responsGalatJadwalSo(error: unknown, label: string): NextResponse {
  if (isRouteServiceError(error) && error.status === 400) {
    return ApiErrors.badRequest(error.message);
  }
  if (isRouteServiceError(error) && error.status === 404) {
    return ApiErrors.notFound(error.message);
  }
  logger.error(`[StockOpnameJadwal] ${label} gagal:`, error);
  return ApiErrors.internalError("Terjadi kesalahan pada server");
}
