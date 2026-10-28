import { ensurePermission } from "@/lib/rbac";
import PaymentGatewayTransactionsClient from "./PaymentGatewayTransactionsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PaymentGatewayTransactionsPage() {
  await ensurePermission("payment_gateway:read");

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Transaksi Payment Gateway
      </h1>
      <p className="text-gray-500 mb-6">
        Semua pembayaran pelanggan lewat payment gateway: siapa yang membayar,
        metode yang dipakai, dan statusnya, termasuk yang mengganti metode.
      </p>
      <PaymentGatewayTransactionsClient />
    </div>
  );
}
