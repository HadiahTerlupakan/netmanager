import Link from "next/link";
import { MdChevronRight, MdHistory, MdPendingActions } from "react-icons/md";
import { getInvoiceStatusLabel } from "@/lib/constants/invoice-status";
import { formatCurrency } from "@/lib/utils";

type UnpaidInvoice = {
  id: string;
  invoiceNumber: string;
  remainingAmount: number;
  status: string;
  dueDate: string;
  items: Array<{ description: string }>;
};

const PARTIAL_BADGE_CLASS =
  "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 ring-amber-600/20 dark:ring-amber-400/20";
const UNPAID_BADGE_CLASS =
  "text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 ring-orange-600/10 dark:ring-orange-400/20";

function formatDueDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function HistoryLink() {
  return (
    <Link
      href="/riwayat"
      className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-[#0d9488] dark:border-gray-700 dark:bg-[#1a2632]"
    >
      <span className="flex items-center gap-2">
        <MdHistory className="text-xl" />
        Riwayat Tagihan & Pembayaran
      </span>
      <MdChevronRight className="text-xl" />
    </Link>
  );
}

/**
 * Tagihan yang akan dibayar lewat tombol "Bayar Sekarang". Riwayat lengkap
 * sengaja dipindah ke /riwayat agar halaman bayar tidak memanjang mengikuti
 * jumlah tagihan yang pernah terbit.
 */
export function UnpaidInvoiceList({ invoices }: { invoices: UnpaidInvoice[] }) {
  return (
    <section className="pt-4">
      <h3 className="px-4 pb-2 text-xl font-bold leading-tight tracking-tight text-[#111418] dark:text-white">
        Tagihan Belum Dibayar
      </h3>
      {invoices.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-500">
          Tidak ada tagihan yang perlu dibayar
        </p>
      ) : (
        invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="flex items-center justify-between gap-4 border-b border-gray-100 bg-white px-4 py-4 dark:border-gray-800 dark:bg-[#1a2632]"
          >
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                <MdPendingActions className="text-2xl" />
              </div>
              <div className="flex flex-col">
                <p className="text-base font-semibold leading-tight text-[#111418] dark:text-white">
                  {invoice.items[0]?.description || "Layanan Internet"}
                </p>
                <p className="line-clamp-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {invoice.invoiceNumber} • Jatuh tempo{" "}
                  {formatDueDate(invoice.dueDate)}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {/* Sisa tagihan, bukan total: itulah yang ditagihkan saat bayar. */}
              <p className="text-base font-bold text-[#111418] dark:text-white">
                {formatCurrency(invoice.remainingAmount)}
              </p>
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  invoice.status === "PARTIAL_PAID"
                    ? PARTIAL_BADGE_CLASS
                    : UNPAID_BADGE_CLASS
                }`}
              >
                {getInvoiceStatusLabel(invoice.status)}
              </span>
            </div>
          </div>
        ))
      )}
      <HistoryLink />
    </section>
  );
}
