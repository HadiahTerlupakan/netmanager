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

/**
 * Tenant sesi untuk penulisan yang boleh dilakukan super admin lintas tenant.
 *
 * Mengembalikan null HANYA bila pemanggil super admin tanpa tenant sesi;
 * pemanggilnya lalu wajib menurunkan tenant baris dari data lain dan
 * menulisnya eksplisit, karena ekstensi tenant tidak mengisi apa pun untuk
 * konteks itu (`lib/prisma-extension.ts`). Pemanggil lain diperlakukan persis
 * seperti `requireSessionTenantId`.
 */
export function requireSessionTenantIdUnlessSuperAdmin(
  ctx: Pick<HandlerContext, "session">,
): string | null {
  const user = ctx.session?.user;
  if (user?.isSuperAdmin && !user.tenantId) return null;
  return requireSessionTenantId(ctx);
}
