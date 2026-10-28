"use client";

import { Button } from "@/components/ui/Button";
import { TransactionStatusBadge } from "./TransactionStatusBadge";
import {
  formatDateTime,
  formatRupiah,
  type GatewayTransaction,
} from "./transaction-types";

// Urutan kolom mengikuti catatan pembayaran dashboard Duitku agar admin bisa
// mencocokkan baris dengan mudah, ditambah pelanggan dan tagihannya.
const COLUMNS = [
  "Tanggal",
  "Pelanggan & Tagihan",
  "No. Referensi",
  "No. Pembayaran",
  "No. Order Merchant",
  "PG Transaction ID",
  "Payment Gateway",
  "Jumlah Dibayarkan",
  "Jumlah Diterima",
  "Biaya",
  "Status",
  "Dibayar / Batas",
  "",
];

const cell = "px-3 py-3 whitespace-nowrap";
const mono = `${cell} font-mono text-xs text-gray-700 dark:text-gray-300`;

export function TransactionsTable({
  items,
  onHistory,
}: {
  items: GatewayTransaction[];
  onHistory: (row: GatewayTransaction) => void;
}) {
  return (
    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
      <thead className="bg-gray-50 dark:bg-gray-900/50">
        <tr>
          {COLUMNS.map((label) => (
            <th
              key={label}
              className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
        {items.map((row) => (
          <tr key={row.id} className="align-top">
            <td className={`${cell} text-gray-600 dark:text-gray-300`}>
              {formatDateTime(row.createdAt)}
            </td>
            <td className="px-3 py-3 min-w-[180px]">
              <p className="font-medium text-gray-900 dark:text-white">
                {row.customerName ?? "-"}
              </p>
              <p className="text-xs text-gray-500 font-mono">
                {row.invoiceNumber ?? "-"}
              </p>
            </td>
            <td className={mono}>{row.transactionId ?? "-"}</td>
            <td className={mono}>{row.vaNumber ?? "-"}</td>
            <td className={mono}>{row.reference ?? "-"}</td>
            <td className={mono}>{row.pgTransactionId ?? "-"}</td>
            <td className={cell}>
              <p className="text-gray-900 dark:text-white">
                {row.methodName ?? row.methodCode ?? "-"}
              </p>
              <p className="text-xs text-gray-500">{row.gateway}</p>
            </td>
            <td className={`${cell} font-medium text-gray-900 dark:text-white`}>
              {formatRupiah(row.amount)}
            </td>
            <td className={`${cell} text-gray-700 dark:text-gray-300`}>
              {row.receivedAmount === null
                ? "-"
                : formatRupiah(row.receivedAmount)}
            </td>
            <td className={`${cell} text-gray-700 dark:text-gray-300`}>
              {row.fee === null ? "-" : formatRupiah(row.fee)}
            </td>
            <td className={cell}>
              <TransactionStatusBadge status={row.status} />
            </td>
            <td className={`${cell} text-gray-600 dark:text-gray-300`}>
              {formatDateTime(row.paidAt ?? row.expiresAt)}
            </td>
            <td className={`${cell} text-right`}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onHistory(row)}
              >
                Riwayat
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
