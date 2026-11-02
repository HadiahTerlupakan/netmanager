import { ApiErrors } from "@/lib/api";

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

/**
 * Terjemahkan kegagalan `UserRouteResult` dari `AdminUserRouteService` ke
 * respons `ApiErrors` — satu pemetaan untuk seluruh route admin user.
 * Kode tak dikenal dijawab 400.
 */
export function toUserRouteApiError(error: { code: number; message: string }) {
  if (error.code === HTTP_BAD_REQUEST)
    return ApiErrors.badRequest(error.message);
  if (error.code === HTTP_FORBIDDEN) return ApiErrors.forbidden(error.message);
  if (error.code === HTTP_NOT_FOUND) return ApiErrors.notFound("User");
  if (error.code === HTTP_CONFLICT) return ApiErrors.conflict(error.message);
  return ApiErrors.badRequest(error.message);
}
