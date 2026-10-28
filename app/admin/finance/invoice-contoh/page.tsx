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
    <div className="p-4 md:p-8">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
        Invoice Contoh
      </h1>
      <p className="mb-6 text-gray-500">
        Kumpulan invoice lunas fiktif untuk demo dan contoh format laporan ke
        mitra. Setiap PDF bertanda CONTOH dan tidak tercatat di billing maupun
        pembukuan.
      </p>
      <InvoiceContohClient
        canEditLimits={canEditLimits}
        canDelete={canDelete}
      />
    </div>
  );
}
