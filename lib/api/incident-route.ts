import { NextResponse } from "next/server";

import { ApiErrors } from "@/lib/api";
import { isRouteServiceError } from "@/lib/api/route-service-error";
import { logger } from "@/lib/logger";

const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

/** Galat service insiden → respons API (404/409 apa adanya, sisanya 500 tanpa detail internal). */
export function responsGalatInsiden(error: unknown, label: string): NextResponse {
  if (isRouteServiceError(error) && error.status === HTTP_NOT_FOUND) return ApiErrors.notFound(error.message);
  if (isRouteServiceError(error) && error.status === HTTP_CONFLICT) return ApiErrors.conflict(error.message);
  logger.error(`[Admin Incidents] ${label} gagal:`, error);
  return ApiErrors.internalError("Terjadi kesalahan pada server");
}
