import {
  createRouteServiceError,
  isRouteServiceError,
} from "@/lib/api/route-service-error";

const HTTP_CONFLICT = 409;
const ADMIN_CHECKOUT_BUSY_MESSAGE =
  "Pelanggan sedang memproses pembayaran untuk tagihan ini. Coba lagi beberapa saat lagi.";

/**
 * Menjalankan `task` di bawah kunci checkout pelanggan, kunci yang sama
 * dengan pembuatan checkout portal: tanpa itu pelanggan bisa membuat VA untuk
 * tagihan tepat saat tagihan itu dibatalkan atau diganti. Kunci yang tidak
 * didapat melempar galat 409 dari `withCustomerCheckoutLock`.
 *
 * Konteks sistem karena tagihan dari billing harian (cron, konteks sistem)
 * dulu tersimpan tanpa tenantId dan tidak terlihat oleh query ber-tenant.
 * Pemanggil sudah memastikan pelanggannya milik tenant yang meminta.
 */
export async function runUnderCustomerCheckoutLockAsSystem<T>(
  pelangganId: string,
  reason: string,
  task: () => Promise<T>,
): Promise<T> {
  const [{ withCustomerCheckoutLock }, { runAsSystemContext }] =
    await Promise.all([
      import("@/modules/payment-gateway"),
      import("@/lib/tenant-context"),
    ]);
  return withCustomerCheckoutLock(pelangganId, () =>
    runAsSystemContext(reason, task),
  );
}

/**
 * `runUnderCustomerCheckoutLockAsSystem` untuk aksi admin (ubah atau hapus
 * tagihan, void, "Batalkan & Buat Tagihan Baru"). Pesan bawaan kunci yang
 * sedang dipegang ditujukan ke pelanggan ("Pembayaran Anda sedang diproses di
 * perangkat lain"); admin menerima pesannya sendiri. Galat dari `task`,
 * termasuk penolakan 409 miliknya, diteruskan apa adanya.
 */
export async function runAdminActionUnderCustomerCheckoutLock<T>(
  pelangganId: string,
  reason: string,
  task: () => Promise<T>,
): Promise<T> {
  let hasLock = false;
  try {
    return await runUnderCustomerCheckoutLockAsSystem(
      pelangganId,
      reason,
      () => {
        hasLock = true;
        return task();
      },
    );
  } catch (error) {
    if (
      !hasLock &&
      isRouteServiceError(error) &&
      error.status === HTTP_CONFLICT
    ) {
      throw createRouteServiceError(ADMIN_CHECKOUT_BUSY_MESSAGE, HTTP_CONFLICT);
    }
    throw error;
  }
}
