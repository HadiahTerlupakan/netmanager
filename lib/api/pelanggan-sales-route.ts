import { NextResponse } from "next/server";

import { ApiErrors } from "@/lib/api";
import { isRouteServiceError } from "@/lib/api/route-service-error";
import { logger } from "@/lib/logger";

const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE = 422;

/** Galat service sales penanggung jawab → respons API tanpa detail internal. */
export function responsGalatSalesPelanggan(error: unknown, label: string): NextResponse {
  if (isRouteServiceError(error) && error.status === HTTP_NOT_FOUND) return ApiErrors.notFound(error.message);
  if (isRouteServiceError(error) && error.status === HTTP_UNPROCESSABLE) return ApiErrors.badRequest(error.message);
  logger.error(`[PelangganSales] ${label} gagal:`, error);
  return ApiErrors.internalError("Terjadi kesalahan pada server");
}
