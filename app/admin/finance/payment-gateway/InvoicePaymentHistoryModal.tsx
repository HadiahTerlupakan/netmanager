"use client";

import { Modal } from "@/components/ui/Modal";
import { useApi } from "@/lib/hooks/useApi";
import { TransactionStatusBadge } from "./TransactionStatusBadge";
import {
  formatDateTime,
  formatRupiah,
  type GatewayTransaction,
  type GatewayTransactionsResponse,
} from "./transaction-types";

const HISTORY_LIMIT = 50;

/** Semua percobaan bayar gateway untuk satu tagihan, dari yang terbaru. */
export function InvoicePaymentHistoryModal({
  transaction,
  onClose,
}: {
  transaction: GatewayTransaction;
  onClose: () => void;
}) {
  const { data, isLoading } = useApi<GatewayTransactionsResponse>(
    transaction.invoiceId
      ? `/api/admin/payment-gateway/transactions?invoiceId=${transaction.invoiceId}&limit=${HISTORY_LIMIT}`
      : null,
  );
  const attempts = data?.items ?? [transaction];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Riwayat bayar ${transaction.invoiceNumber ?? ""}`}
      size="lg"
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {transaction.customerName ?? "Pelanggan"} · status tagihan:{" "}
        <span className="font-medium">{transaction.invoiceStatus ?? "-"}</span>
      </p>
      {isLoading ? (
        <p className="text-sm text-gray-500">Memuat riwayat...</p>
      ) : (
        <ol className="space-y-3">
          {attempts.map((attempt) => (
            <li
              key={attempt.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {attempt.methodName ?? attempt.methodCode ?? attempt.gateway}
                </span>
                <TransactionStatusBadge status={attempt.status} />
              </div>
              <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                <Item
                  label="Dibuat"
                  value={formatDateTime(attempt.createdAt)}
                />
                <Item label="Nominal" value={formatRupiah(attempt.amount)} />
                <Item
                  label={attempt.paidAt ? "Dibayar" : "Batas waktu"}
                  value={formatDateTime(attempt.paidAt ?? attempt.expiresAt)}
                />
                <Item label="Gateway" value={attempt.gateway || "-"} />
                <Item label="No. VA / kode" value={attempt.vaNumber ?? "-"} />
                <Item label="Order ID" value={attempt.reference ?? "-"} />
                <Item
                  label="PG Transaction ID"
                  value={attempt.pgTransactionId ?? "-"}
                />
                <Item
                  label="Biaya / diterima"
                  value={
                    attempt.fee === null || attempt.receivedAmount === null
                      ? "-"
                      : `${formatRupiah(attempt.fee)} / ${formatRupiah(attempt.receivedAmount)}`
                  }
                />
                <Item
                  label="Ref. gateway"
                  value={attempt.transactionId ?? "-"}
                />
              </dl>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 min-w-0">
      <dt className="shrink-0">{label}:</dt>
      <dd className="font-mono break-all text-gray-800 dark:text-gray-200">
        {value}
      </dd>
    </div>
  );
}
