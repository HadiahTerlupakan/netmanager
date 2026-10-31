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
