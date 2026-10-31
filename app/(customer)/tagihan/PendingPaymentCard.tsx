"use client";

import { useId, type ReactNode } from "react";
import { MdAccessTime } from "react-icons/md";
import { Button } from "@/components/ui/Button";
import { useExpiryCountdown } from "./useExpiryCountdown";

type Props = {
  isManual: boolean;
  expiresAt?: string | null;
  isExpired: boolean;
  invoiceNumbers: string[];
  onExpire: () => void;
  onChooseMethod: () => void;
  /** Instruksi bayar; disembunyikan begitu checkout kedaluwarsa. */
  children: ReactNode;
};

function CheckoutCountdown(props: { expiresAt: string; onExpire: () => void }) {
  const timeLeft = useExpiryCountdown(props.expiresAt, props.onExpire);
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-[#1a2632] text-orange-600 dark:text-orange-400 rounded border border-orange-200 dark:border-orange-500/20 shadow-sm text-sm">
      <MdAccessTime aria-hidden="true" />
      <span className="font-mono font-bold pt-0.5">
        <span className="sr-only">Sisa waktu </span>
        {timeLeft}
      </span>
    </div>
  );
}

function CheckoutInvoiceList({ invoiceNumbers }: { invoiceNumbers: string[] }) {
  return (
    <div className="mb-4 rounded-lg bg-white/70 dark:bg-[#1a2632]/70 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
      <p className="font-medium">
        Satu pembayaran untuk {invoiceNumbers.length} tagihan:
      </p>
      <ul className="mt-1 space-y-0.5 font-mono">
        {invoiceNumbers.map((invoiceNumber) => (
          <li key={invoiceNumber}>{invoiceNumber}</li>
        ))}
      </ul>
    </div>
  );
}

function ExpiredCheckoutNotice({
  onChooseMethod,
}: {
  onChooseMethod: () => void;
}) {
  return (
    <div className="bg-white dark:bg-[#1a2632] rounded-lg p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
      <p className="text-sm text-[#111418] dark:text-white">
        Kode pembayaran ini sudah kedaluwarsa dan tidak bisa dipakai lagi. Pilih
        metode pembayaran lagi untuk mendapatkan kode baru.
      </p>
      <Button className="w-full mt-4" onClick={onChooseMethod}>
        Pilih Metode Lagi
      </Button>
    </div>
  );
}

/**
 * Kartu checkout yang sedang berjalan. Saat waktunya habis, VA/QR dan
 * nominalnya disembunyikan: kode yang kedaluwarsa tidak bisa dibayar,
 * jadi pelanggan diarahkan memilih metode lagi.
 */
export function PendingPaymentCard({
  isManual,
  expiresAt,
  isExpired,
  invoiceNumbers,
  onExpire,
  onChooseMethod,
  children,
}: Props) {
  const titleId = useId();
  const title = isExpired
    ? "KODE PEMBAYARAN KEDALUWARSA"
    : "MENUNGGU PEMBAYARAN";
  const subtitle = isManual
    ? "Transfer sesuai nominal, lalu unggah bukti transfernya."
    : "Selesaikan pembayaran sebelum waktu habis.";

  return (
    <section
      aria-labelledby={titleId}
      className="p-4 animate-in slide-in-from-top-4 duration-300"
    >
      <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-500/30 rounded-xl p-5 shadow-sm">
        <div className="flex justify-between items-start gap-3 mb-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
              {!isExpired && (
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              )}
              <h3 id={titleId} className="font-bold text-sm">
                {title}
              </h3>
            </div>
            {!isExpired && (
              <p className="text-[#111418] dark:text-white text-xs opacity-80">
                {subtitle}
              </p>
            )}
          </div>
          {expiresAt && !isManual && (
            <CheckoutCountdown expiresAt={expiresAt} onExpire={onExpire} />
          )}
        </div>
        {invoiceNumbers.length > 1 && (
          <CheckoutInvoiceList invoiceNumbers={invoiceNumbers} />
        )}
        {isExpired ? (
          <ExpiredCheckoutNotice onChooseMethod={onChooseMethod} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}
