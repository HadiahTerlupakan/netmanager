import { AppError } from "@/lib/errors";
import type { HandlerContext } from "./handler";

/**
 * Mengambil `tenantId` dari sesi, atau melempar bila tidak ada.
 *
 * Sesi tanpa tenant tidak bisa dipetakan ke data mana pun, sehingga melanjutkan
 * request hanya menghasilkan query tanpa batas tenant. Dibuat melempar
 * `AppError` alih-alih mengembalikan response supaya route bisa memakainya
 * sebagai satu baris di awal handler, dan `handleError` yang menerjemahkannya
 * ke 400 — pola pemeriksaan yang sama sebelumnya disalin di setiap route.
 */
export function requireSessionTenantId(
  ctx: Pick<HandlerContext, "session">,
): string {
  const tenantId = ctx.session?.user?.tenantId;

  if (!tenantId) {
    throw new AppError("Tenant ID required", 400, "TENANT_ID_REQUIRED");
  }

  return tenantId;
}
