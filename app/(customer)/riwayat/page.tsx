"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/components/customer/CustomerAuthProvider";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import { getInvoiceStatusLabel } from "@/lib/constants/invoice-status";
import { formatCurrency } from "@/lib/utils";
import {
  MdArrowBack,
  MdSearch,
  MdReceiptLong,
  MdRouter,
  MdErrorOutline,
} from "react-icons/md";
import { isCoveredBySaldo } from "../tagihan/checkout";
import { InvoiceDetailSheet } from "./InvoiceDetailSheet";
import {
  filterHistory,
  formatDay,
  getPaymentInfo,
  groupByIssueMonth,
  type HistoryFilter,
  type HistoryInvoice,
} from "./invoice-history";

const FILTER_CHIPS: Array<[HistoryFilter, string]> = [
  ["ALL", "Semua"],
  ["SUCCESS", "Berhasil"],
  ["PENDING", "Menunggu"],
  ["FAILED", "Dibatalkan"],
];
const COVERED_BY_SALDO_BADGE = "Ditutup saldo";

const formatIssuedAt = (dateString: string) =>
  new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const getStatusConfig = (status: string) => {
  switch (status) {
    case "PAID":
      return {
        icon: MdReceiptLong,
        iconBg: "bg-[#0d9488]/10",
        iconColor: "text-[#0d9488]",
        badgeBg: "bg-green-100 dark:bg-green-900/30",
        badgeText: "text-green-800 dark:text-green-400",
      };
    case "SENT":
    case "OVERDUE":
    case "PARTIAL_PAID":
      return {
        icon: MdRouter,
        iconBg: "bg-orange-50 dark:bg-orange-500/10",
        iconColor: "text-orange-500",
        badgeBg: "bg-yellow-100 dark:bg-yellow-900/30",
        badgeText: "text-yellow-800 dark:text-yellow-400",
      };
    default:
      return {
        icon: MdErrorOutline,
        iconBg: "bg-red-50 dark:bg-red-500/10",
        iconColor: "text-red-500",
        badgeBg: "bg-red-100 dark:bg-red-900/30",
        badgeText: "text-red-800 dark:text-red-400",
      };
  }
};

function HistoryRow({
  invoice,
  onOpen,
}: {
  invoice: HistoryInvoice;
  onOpen: (invoice: HistoryInvoice) => void;
}) {
  const config = getStatusConfig(invoice.status);
  const Icon = config.icon;
  const payment = getPaymentInfo(invoice);
  // "Belum Bayar Rp 0" membuat pelanggan mengira masih harus membayar.
  const badge = isCoveredBySaldo(invoice)
    ? COVERED_BY_SALDO_BADGE
    : getInvoiceStatusLabel(invoice.status);

  return (
    <li className="bg-white dark:bg-[#1C2630] border-b border-gray-100 dark:border-gray-800/50 first:border-t">
      <button
        type="button"
        onClick={() => onOpen(invoice)}
        className="flex w-full gap-4 px-4 py-4 justify-between items-center text-left hover:bg-gray-50 dark:hover:bg-[#252e38] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0d9488]"
      >
        <span className="flex items-start gap-4">
          <span
            className={`${config.iconColor} ${config.iconBg} flex items-center justify-center rounded-xl shrink-0 size-12`}
          >
            <Icon className="text-[24px]" aria-hidden="true" />
          </span>
          <span className="flex flex-1 flex-col justify-center gap-0.5">
            <span className="text-[#111418] dark:text-white text-base font-semibold leading-tight">
              {invoice.items[0]?.description || "Tagihan Layanan"}
            </span>
            <span className="text-[#617589] dark:text-gray-400 text-xs leading-normal">
              #{invoice.invoiceNumber}
            </span>
            <span className="text-[#617589] dark:text-gray-400 text-xs leading-normal mt-0.5">
              {formatIssuedAt(invoice.issueDate)}
            </span>
            {payment && (
              <span className="text-[#0d9488] text-xs leading-normal">
                Dibayar {formatDay(payment.date)} · {payment.method}
              </span>
            )}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[#111418] dark:text-white text-base font-bold leading-normal">
            {formatCurrency(invoice.totalAmount)}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.badgeBg} ${config.badgeText}`}
          >
            {badge}
          </span>
        </span>
      </button>
    </li>
  );
}

export default function CustomerHistoryPage() {
  const { isLoading: authLoading, isAuthenticated } = useCustomerAuth();
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [query, setQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<HistoryInvoice | null>(
    null,
  );
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const { data, isLoading } = useApi<{ invoices: HistoryInvoice[] }>(
    isAuthenticated ? "/api/customer/invoices?limit=50" : null,
  );
  const invoices = data?.invoices ?? [];
  const groupedInvoices = Object.entries(
    groupByIssueMonth(filterHistory(invoices, filter, query)),
  );
  const emptyMessage =
    query.trim() && invoices.length > 0
      ? "Tidak ada tagihan yang cocok dengan pencarian"
      : "Belum ada riwayat transaksi";

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
        <div className="w-10 h-10 border-4 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="font-sans bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white overflow-x-hidden w-full min-h-screen">
      <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-white dark:bg-[#1C2630] shadow-xl">
        <header className="sticky top-0 z-50 bg-white dark:bg-[#1C2630] border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center px-4 py-3 justify-between">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label="Kembali"
              onClick={() => router.back()}
            >
              <MdArrowBack className="text-2xl" aria-hidden="true" />
            </Button>
            <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight flex-1 text-center pr-10">
              Riwayat Transaksi
            </h2>
          </div>

          <div className="px-4 py-2">
            <div className="flex h-12 w-full items-stretch rounded-lg bg-[#f0f2f4] dark:bg-[#2A3441] overflow-hidden focus-within:ring-2 focus-within:ring-[#0d9488]/50 transition-all">
              <div className="text-[#617589] dark:text-gray-400 flex items-center justify-center pl-4 pr-2">
                <MdSearch className="text-[24px]" aria-hidden="true" />
              </div>
              <input
                type="search"
                aria-label="Cari tagihan"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="flex w-full min-w-0 flex-1 bg-transparent border-none text-[#111418] dark:text-white placeholder:text-[#617589] dark:placeholder:text-gray-500 focus:outline-0 focus:ring-0 px-2 text-base font-normal leading-normal"
                placeholder="Cari nomor atau keterangan tagihan"
              />
            </div>
          </div>

          <div className="flex gap-3 px-4 py-3 overflow-x-auto hide-scrollbar pb-4">
            {FILTER_CHIPS.map(([value, label]) => (
              <Button
                key={value}
                variant="ghost"
                size="sm"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`shrink-0 rounded-full ${
                  filter === value
                    ? "bg-[#0d9488] text-white shadow-sm shadow-[#0d9488]/30 hover:bg-[#0d9488]"
                    : "bg-[#f0f2f4] dark:bg-[#2A3441] text-[#111418] dark:text-gray-300"
                }`}
              >
                {label}
              </Button>
            ))}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 bg-gray-50 dark:bg-[#101922]/50">
          {groupedInvoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{emptyMessage}</div>
          ) : (
            groupedInvoices.map(([month, items]) => (
              <section key={month} className="pt-4">
                <h3 className="text-[#617589] dark:text-gray-400 text-sm font-semibold uppercase tracking-wider px-4 pb-2">
                  {month}
                </h3>
                <ul>
                  {items.map((invoice) => (
                    <HistoryRow
                      key={invoice.id}
                      invoice={invoice}
                      onOpen={setSelectedInvoice}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}

          <div className="flex justify-center p-6 text-sm text-[#617589] dark:text-gray-500">
            <p>Menampilkan semua transaksi terbaru</p>
          </div>
        </main>
      </div>
      {selectedInvoice && (
        <InvoiceDetailSheet
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
