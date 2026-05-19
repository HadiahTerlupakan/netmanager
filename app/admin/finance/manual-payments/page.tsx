import { ensureAnyPermission } from "@/lib/rbac";
import ManualPaymentClient from "./ManualPaymentClient";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ManualPaymentsPage() {
  await ensureAnyPermission(["manual_payments:read", "finance:read"]);

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Verifikasi Pembayaran Manual
      </h1>
      <p className="text-gray-500 mb-6">
        Daftar pembayaran manual yang menunggu verifikasi admin setelah
        pelanggan mengunggah bukti transfer.
      </p>
      <ManualPaymentClient />
    </div>
  );
}
