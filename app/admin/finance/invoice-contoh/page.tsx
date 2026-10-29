import { ensurePermission, hasPermission } from "@/lib/rbac";
import InvoiceContohClient from "./InvoiceContohClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InvoiceContohPage() {
  await ensurePermission("invoice_contoh:read");
  const [canEditLimits, canDelete] = await Promise.all([
    hasPermission("invoice_contoh:update"),
    hasPermission("invoice_contoh:delete"),
  ]);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Invoice Contoh
          </h1>
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
            Bertanda CONTOH
          </span>
        </div>
        <p className="mt-1 max-w-3xl text-gray-500 dark:text-gray-400">
          Kumpulan invoice lunas fiktif untuk demo dan contoh format laporan ke
          mitra. Tidak tercatat di billing maupun pembukuan.
        </p>
      </header>
      <InvoiceContohClient
        canEditLimits={canEditLimits}
        canDelete={canDelete}
      />
    </div>
  );
}
