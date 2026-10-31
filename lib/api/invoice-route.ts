import { ApiErrors } from "@/lib/api";
import { isRouteServiceError } from "@/lib/api/route-service-error";

const HTTP_CONFLICT = 409;

/**
 * Penolakan layanan tagihan untuk admin (tagihan sedang dibayar atau sudah
 * menerima uang, pelanggan sedang memproses pembayaran) dijawab 409 dengan
 * pesannya; galat lain dilempar ulang ke createHandler.
 */
export function responsPenolakanTagihan(error: unknown) {
  if (isRouteServiceError(error) && error.status === HTTP_CONFLICT) {
    return ApiErrors.conflict(error.message);
  }
  throw error;
}
