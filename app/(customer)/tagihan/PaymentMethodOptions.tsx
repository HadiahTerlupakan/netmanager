"use client";

import { Button } from "@/components/ui/Button";
import type { PaymentMethodsState } from "./usePaymentMethods";

type Props = {
  methods: PaymentMethodsState;
  /** id label "Metode Pembayaran", nama aksesibel radiogroup. */
  labelledBy: string;
  selectedCode: string;
  onSelect: (code: string) => void;
};

/**
 * Pilihan metode bayar sebagai radio bawaan browser: bisa dipilih dengan
 * papan ketik (Tab, panah, spasi) dan dibacakan pembaca layar. Gagal
 * dimuat dan daftar kosong dibedakan; hanya yang pertama bisa dicoba lagi.
 */
export function PaymentMethodOptions({
  methods,
  labelledBy,
  selectedCode,
  onSelect,
}: Props) {
  if (methods.isLoading) {
    return (
      <div
        role="status"
        className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"
      >
        <span className="sr-only">Memuat metode pembayaran</span>
      </div>
    );
  }
  if (methods.error) {
    return (
      <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-300 rounded-lg">
        <p>Gagal memuat metode pembayaran. Coba lagi.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={methods.retry}
        >
          Coba Lagi
        </Button>
      </div>
    );
  }
  if (methods.list.length === 0) {
    return (
      <p className="p-3 text-sm text-gray-600 bg-gray-50 dark:bg-gray-800/60 dark:text-gray-300 rounded-lg">
        Tidak ada metode pembayaran tersedia
      </p>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid grid-cols-1 gap-2"
    >
      {methods.list.map((method) => {
        const isSelected = method.code === selectedCode;
        return (
          <label
            key={method.id}
            className={`flex items-center justify-between gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#0d9488] has-[:focus-visible]:ring-offset-2 dark:has-[:focus-visible]:ring-offset-[#1a2632] ${
              isSelected
                ? "border-[#0d9488] bg-[#0d9488]/5 dark:bg-[#0d9488]/10"
                : "border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
            }`}
          >
            <input
              type="radio"
              name="payment-method"
              value={method.code}
              checked={isSelected}
              onChange={() => onSelect(method.code)}
              className="sr-only"
            />
            <span className="flex flex-col">
              <span className="text-sm font-semibold">{method.name}</span>
              <span className="text-[10px] text-gray-500 uppercase">
                {method.group}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                isSelected ? "border-[#0d9488]" : "border-gray-300"
              }`}
            >
              {isSelected && (
                <span className="w-2 h-2 rounded-full bg-[#0d9488]" />
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
