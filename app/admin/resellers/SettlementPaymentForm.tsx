"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import {
  PAYMENT_METHOD_LABELS,
  resellerApiUrl,
  todayInputValue,
  type PaymentForm,
  type SettlementPaymentMethod,
} from "./commission-ui";

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white";

type PaymentAccount = {
  readonly id: string;
  readonly name: string;
  readonly balance: number;
};

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

type SettlementPaymentFormProps = {
  readonly resellerId: string;
  readonly isSaving: boolean;
  readonly onSubmit: (form: PaymentForm) => void;
  readonly onCancel: () => void;
};

/**
 * Form catat pembayaran settlement: tanggal, metode, referensi, rekening.
 * Rekening dimuat dari endpoint reseller yang izinnya sama dengan aksi bayar,
 * dan saldonya ditampilkan karena pembayaran ditolak bila saldo kurang.
 */
export function SettlementPaymentForm({
  resellerId,
  isSaving,
  onSubmit,
  onCancel,
}: SettlementPaymentFormProps) {
  const accountsQuery = useApi<readonly PaymentAccount[]>(
    resellerApiUrl(resellerId, "payment-accounts"),
  );
  const accounts = accountsQuery.data ?? [];
  const [form, setForm] = useState<PaymentForm>({
    paidAt: todayInputValue(),
    paymentMethod: "BANK_TRANSFER",
    paymentReference: "",
    accountId: "",
  });

  return (
    <form
      aria-label="Catat pembayaran settlement"
      className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <label className="text-sm text-gray-700 dark:text-gray-300">
        Tanggal bayar
        <input
          className={INPUT_CLASS}
          type="date"
          required
          value={form.paidAt}
          onChange={(event) => setForm({ ...form, paidAt: event.target.value })}
        />
      </label>
      <label className="text-sm text-gray-700 dark:text-gray-300">
        Metode
        <select
          className={INPUT_CLASS}
          value={form.paymentMethod}
          onChange={(event) =>
            setForm({
              ...form,
              paymentMethod: event.target.value as SettlementPaymentMethod,
            })
          }
        >
          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-gray-700 dark:text-gray-300">
        Rekening Kas & Bank
        <select
          className={INPUT_CLASS}
          required
          value={form.accountId}
          onChange={(event) =>
            setForm({ ...form, accountId: event.target.value })
          }
        >
          <option value="">
            {accountsQuery.error ? "Rekening gagal dimuat" : "Pilih rekening"}
          </option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} (saldo {rupiah.format(account.balance)})
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-gray-700 dark:text-gray-300">
        No. referensi (opsional)
        <input
          className={INPUT_CLASS}
          maxLength={100}
          value={form.paymentReference}
          onChange={(event) =>
            setForm({ ...form, paymentReference: event.target.value })
          }
        />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={isSaving}>
          Simpan pembayaran
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSaving}
          onClick={onCancel}
        >
          Batal
        </Button>
      </div>
    </form>
  );
}
