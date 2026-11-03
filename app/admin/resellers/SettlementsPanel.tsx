"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import { LoadErrorState } from "./LoadErrorState";
import { SettlementPaymentForm } from "./SettlementPaymentForm";
import {
  formatDate,
  formatRupiah,
  nextSettlementAction,
  PAYMENT_METHOD_LABELS,
  resellerApiUrl,
  SETTLEMENT_STATUS_LABELS,
  type PaymentForm,
  type Settlement,
  type SettlementPaymentMethod,
} from "./commission-ui";
import { getErrorMessage, sendResellerMutation } from "./reseller-requests";

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white";

type SettlementsPanelProps = {
  readonly resellerId: string;
  /** Izin reseller:update + transactions:create. */
  readonly canManage: boolean;
  /** Dipanggil setelah settlement berubah, untuk memuat ulang komisi. */
  readonly onChanged?: () => void;
};

/**
 * Settlement komisi: PENDING → disetujui → dibayar dari rekening Kas & Bank.
 * Pembayaran membuat jurnal Dr Utang Komisi Reseller / Cr rekening terpilih.
 */
export function SettlementsPanel({
  resellerId,
  canManage,
  onChanged,
}: SettlementsPanelProps) {
  const settlementsUrl = resellerApiUrl(resellerId, "settlements");
  const settlementsQuery = useApi<readonly Settlement[]>(
    `${settlementsUrl}?limit=10`,
  );
  const [period, setPeriod] = useState({ periodStart: "", periodEnd: "" });
  const [payingId, setPayingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const settlements = settlementsQuery.data ?? [];

  const runMutation = async (
    action: () => Promise<void>,
    successMessage: string,
  ) => {
    setIsSaving(true);
    try {
      await action();
      toast.success(successMessage);
      await settlementsQuery.mutate();
      onChanged?.();
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const createSettlement = () =>
    runMutation(
      () => sendResellerMutation(settlementsUrl, "POST", period),
      "Settlement dibuat",
    );

  const approve = (settlement: Settlement) =>
    runMutation(
      () =>
        sendResellerMutation(
          `${settlementsUrl}/${settlement.id}/approve`,
          "POST",
        ),
      "Settlement disetujui",
    );

  const pay = async (settlement: Settlement, form: PaymentForm) => {
    const isPaid = await runMutation(
      () =>
        sendResellerMutation(`${settlementsUrl}/${settlement.id}/pay`, "POST", {
          ...form,
          paymentReference: form.paymentReference || null,
        }),
      "Settlement ditandai dibayar",
    );
    if (isPaid) setPayingId(null);
  };

  return (
    <section
      aria-labelledby="settlements-title"
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <h2
        id="settlements-title"
        className="font-semibold text-gray-900 dark:text-white"
      >
        Settlement komisi
      </h2>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Kumpulkan komisi terbit dalam satu periode, setujui, lalu catat
        pembayarannya.
      </p>
      {canManage && (
        <form
          className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            void createSettlement();
          }}
        >
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Dari
            <input
              className={INPUT_CLASS}
              type="date"
              required
              value={period.periodStart}
              onChange={(event) =>
                setPeriod({ ...period, periodStart: event.target.value })
              }
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Sampai
            <input
              className={INPUT_CLASS}
              type="date"
              required
              value={period.periodEnd}
              onChange={(event) =>
                setPeriod({ ...period, periodEnd: event.target.value })
              }
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" size="sm" disabled={isSaving}>
              Buat settlement
            </Button>
          </div>
        </form>
      )}
      {settlementsQuery.error ? (
        <LoadErrorState
          title="Gagal memuat settlement"
          error={settlementsQuery.error}
          onRetry={() => void settlementsQuery.refetch()}
        />
      ) : settlements.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {settlementsQuery.isLoading ? "Memuat..." : "Belum ada settlement."}
        </p>
      ) : (
        <ul className="space-y-2">
          {settlements.map((settlement) => {
            const action = canManage
              ? nextSettlementAction(settlement.status)
              : null;
            return (
              <li
                key={settlement.id}
                className="rounded-xl border border-gray-100 p-3 text-sm dark:border-gray-700"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {formatDate(settlement.periodStart)} –{" "}
                      {formatDate(settlement.periodEnd)} ·{" "}
                      {formatRupiah(settlement.totalAmount)}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {settlement.commissionCount} komisi ·{" "}
                      {SETTLEMENT_STATUS_LABELS[settlement.status]}
                      {settlement.paidAt && ` ${formatDate(settlement.paidAt)}`}
                      {settlement.paymentMethod &&
                        ` · ${PAYMENT_METHOD_LABELS[settlement.paymentMethod as SettlementPaymentMethod] ?? settlement.paymentMethod}`}
                      {settlement.paymentReference &&
                        ` · Ref ${settlement.paymentReference}`}
                    </div>
                  </div>
                  {action === "approve" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSaving}
                      onClick={() => void approve(settlement)}
                    >
                      Setujui
                    </Button>
                  )}
                  {action === "pay" && payingId !== settlement.id && (
                    <Button
                      size="sm"
                      disabled={isSaving}
                      onClick={() => setPayingId(settlement.id)}
                    >
                      Catat pembayaran
                    </Button>
                  )}
                </div>
                {action === "pay" && payingId === settlement.id && (
                  <SettlementPaymentForm
                    resellerId={resellerId}
                    isSaving={isSaving}
                    onCancel={() => setPayingId(null)}
                    onSubmit={(form) => void pay(settlement, form)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
