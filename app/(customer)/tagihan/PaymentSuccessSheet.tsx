"use client";

import { MdCheckCircle } from "react-icons/md";
import { Button } from "@/components/ui/Button";

type Props = {
  amount: string;
  invoiceNumber?: string;
  methodName?: string;
  onClose: () => void;
  onHome: () => void;
};

/** Konfirmasi setelah gateway atau admin melunasi tagihan yang sedang dibayar. */
export function PaymentSuccessSheet({
  amount,
  invoiceNumber,
  methodName,
  onClose,
  onHome,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-success-title"
    >
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#1a2632] p-6 pb-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0d9488]/10">
          <MdCheckCircle className="h-12 w-12 text-[#0d9488]" />
        </div>
        <h2
          id="payment-success-title"
          className="text-xl font-bold text-[#111418] dark:text-white"
        >
          Pembayaran Berhasil
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Terima kasih, pembayaran Anda sudah kami terima.
        </p>
        <p className="mt-4 text-3xl font-bold text-[#0d9488]">{amount}</p>
        <dl className="mt-4 space-y-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4 text-left text-sm">
          {invoiceNumber && (
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500 dark:text-gray-400">Tagihan</dt>
              <dd className="font-medium text-[#111418] dark:text-white break-all text-right">
                {invoiceNumber}
              </dd>
            </div>
          )}
          {methodName && (
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500 dark:text-gray-400">Metode</dt>
              <dd className="font-medium text-[#111418] dark:text-white text-right">
                {methodName}
              </dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Masa aktif langganan diperpanjang otomatis. Bila internet Anda sempat
          terisolir, koneksi aktif kembali dalam beberapa menit.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onClose}>
            Lihat Riwayat
          </Button>
          <Button onClick={onHome}>Ke Beranda</Button>
        </div>
      </div>
    </div>
  );
}
