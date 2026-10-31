"use client";

import { useId } from "react";
import { MdClose } from "react-icons/md";
import { CustomerDialog } from "@/components/customer/CustomerDialog";
import { Button } from "@/components/ui/Button";
import { getInvoiceStatusLabel } from "@/lib/constants/invoice-status";
import { formatCurrency } from "@/lib/utils";
import { isCoveredBySaldo } from "../tagihan/checkout";
import {
  formatDay,
  getPaymentInfo,
  type HistoryInvoice,
} from "./invoice-history";

const COVERED_BY_SALDO_LABEL = "Ditutup saldo, sedang diproses";

type DetailRow = [label: string, value: string];

function buildRows(invoice: HistoryInvoice): DetailRow[] {
  const discount = invoice.discountAmount ?? 0;
  const payment = getPaymentInfo(invoice);
  const descriptions = invoice.items.map((item) => item.description);
  const rows: Array<DetailRow | null> = [
    ["Nomor tagihan", invoice.invoiceNumber],
    ["Keterangan", descriptions.join(", ") || "Tagihan Layanan"],
    ["Tanggal terbit", formatDay(invoice.issueDate)],
    ["Jatuh tempo", formatDay(invoice.dueDate)],
    discount > 0 ? ["Diskon", `-${formatCurrency(discount)}`] : null,
    ["Total tagihan", formatCurrency(invoice.totalAmount)],
    ["Sudah dibayar", formatCurrency(invoice.paidAmount ?? 0)],
    [
      "Status",
      isCoveredBySaldo(invoice)
        ? COVERED_BY_SALDO_LABEL
        : getInvoiceStatusLabel(invoice.status),
    ],
    payment ? ["Tanggal bayar", formatDay(payment.date)] : null,
    payment ? ["Metode bayar", payment.method] : null,
  ];
  return rows.filter((row): row is DetailRow => row !== null);
}

/** Rincian satu tagihan riwayat, dari data yang sudah ada di daftar. */
export function InvoiceDetailSheet({
  invoice,
  onClose,
}: {
  invoice: HistoryInvoice;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <CustomerDialog labelledBy={titleId} onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h2
          id={titleId}
          className="text-lg font-bold text-[#111418] dark:text-white"
        >
          Rincian Tagihan
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Tutup"
          onClick={onClose}
        >
          <MdClose className="text-2xl text-gray-500" aria-hidden="true" />
        </Button>
      </div>
      <dl className="space-y-3 text-sm">
        {buildRows(invoice).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="text-right font-medium text-[#111418] dark:text-white break-words">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </CustomerDialog>
  );
}
