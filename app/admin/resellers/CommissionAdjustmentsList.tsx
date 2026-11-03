"use client";

import { LoadErrorState } from "./LoadErrorState";
import {
  describeAdjustmentBalance,
  formatDate,
  formatRupiah,
  type CommissionAdjustment,
} from "./commission-ui";

type CommissionAdjustmentsListProps = {
  readonly adjustments: readonly CommissionAdjustment[];
  readonly error: Error | null;
  readonly onRetry: () => void;
};

/**
 * Koreksi (clawback) komisi yang sudah dibayar lalu invoice-nya di-void atau
 * pelunasannya ditarik. Dipotongkan otomatis dari settlement berikutnya.
 */
export function CommissionAdjustmentsList({
  adjustments,
  error,
  onRetry,
}: CommissionAdjustmentsListProps) {
  if (error) {
    return (
      <LoadErrorState
        title="Gagal memuat koreksi komisi"
        error={error}
        onRetry={onRetry}
      />
    );
  }
  if (adjustments.length === 0) return null;

  return (
    <section className="mt-4" aria-labelledby="commission-adjustments-title">
      <h3
        id="commission-adjustments-title"
        className="text-sm font-semibold text-gray-900 dark:text-white"
      >
        Koreksi komisi
      </h3>
      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
        Komisi yang sudah dibayar lalu invoice-nya dibatalkan. Nilainya dipotong
        dari settlement berikutnya.
      </p>
      <ul className="space-y-2">
        {adjustments.map((adjustment) => (
          <li
            key={adjustment.id}
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40"
          >
            <div className="font-medium text-gray-900 dark:text-white">
              −{formatRupiah(adjustment.amount)} · Invoice{" "}
              {adjustment.invoiceId}
            </div>
            <div className="text-gray-600 dark:text-gray-300">
              {adjustment.reason} · {formatDate(adjustment.createdAt)}
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              {describeAdjustmentBalance(adjustment)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
