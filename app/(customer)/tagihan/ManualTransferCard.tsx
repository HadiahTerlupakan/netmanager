"use client";

import { useState } from "react";
import { MdContentCopy } from "react-icons/md";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import { ReceiptUploader } from "./ReceiptUploader";
import type { BankAccountDetails, PaymentMethod } from "./checkout";
import type { PaymentMethodsState } from "./usePaymentMethods";

const CANCEL_FAILED_MESSAGE =
  "Transfer belum bisa dibatalkan. Coba lagi sebentar lagi.";

/** Rekening tujuan checkout manual yang bisa ditampilkan ke pelanggan. */
export type BankAccountState =
  | { status: "ready"; details: BankAccountDetails }
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "inactive" };

/**
 * Rekening checkout manual: dari daftar metode, atau dari `bankAccount`
 * payment bila admin sudah menonaktifkannya (daftar hanya memuat rekening
 * aktif). Pemberitahuan "tidak aktif" hanya bila keduanya kosong.
 */
export function resolveBankAccount(
  methods: PaymentMethodsState,
  checkoutMethod?: PaymentMethod,
  paymentAccount?: BankAccountDetails | null,
): BankAccountState {
  const details = checkoutMethod?.details ?? paymentAccount;
  if (details) return { status: "ready", details };
  if (methods.isLoading) return { status: "loading" };
  if (methods.error) return { status: "error", retry: methods.retry };
  return { status: "inactive" };
}

type Props = {
  invoiceId: string;
  /** Total checkout, bukan bagian invoice ini saja. */
  amount: number;
  hasReceipt: boolean;
  bank: BankAccountState;
  onCopy: (text: string, label: string) => void;
  /** Memuat ulang daftar tagihan. */
  refresh: () => Promise<unknown>;
  /** Setelah dibatalkan: buka pilihan metode. */
  onCancelled: () => void;
};

/**
 * Kartu transfer bank manual yang menunggu: rekening tujuan, nominal,
 * unggah bukti, dan jalan keluar "Batalkan / Ganti Metode".
 */
export function ManualTransferCard(props: Props) {
  return (
    <div className="bg-white dark:bg-[#1a2632] rounded-lg p-4 border border-gray-100 dark:border-gray-800 shadow-sm mb-4">
      <BankAccountDetails bank={props.bank} onCopy={props.onCopy} />
      <div className="border-t border-dashed border-gray-200 dark:border-gray-700 py-2" />
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 mt-1 font-medium">
        Nominal Transfer:
      </p>
      <div className="flex justify-between items-center">
        <p className="font-bold text-[#0d9488] text-xl">
          {formatCurrency(props.amount)}
        </p>
        <Button
          variant="outline"
          size="sm"
          aria-label="Salin nominal transfer"
          onClick={() => props.onCopy(String(props.amount), "Nominal")}
        >
          <MdContentCopy /> Salin
        </Button>
      </div>
      <ReceiptUploader
        invoiceId={props.invoiceId}
        hasReceipt={props.hasReceipt}
        onUploaded={props.refresh}
      />
      <CancelManualTransfer
        invoiceId={props.invoiceId}
        refresh={props.refresh}
        onCancelled={props.onCancelled}
      />
    </div>
  );
}

function BankAccountDetails({
  bank,
  onCopy,
}: {
  bank: BankAccountState;
  onCopy: Props["onCopy"];
}) {
  if (bank.status === "loading") {
    return (
      <div
        role="status"
        className="h-14 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse mb-3"
      >
        <span className="sr-only">Memuat rekening tujuan</span>
      </div>
    );
  }
  if (bank.status === "error") {
    return (
      <div className="mb-3 text-sm text-gray-700 dark:text-gray-300">
        <p>Detail rekening tujuan belum bisa dimuat.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={bank.retry}
        >
          Coba Lagi
        </Button>
      </div>
    );
  }
  if (bank.status === "inactive") {
    // Rekening tidak ada di daftar metode dan tidak dikirim bersama payment
    // (server lama, atau rekeningnya sudah terhapus).
    return (
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="text-sm font-semibold">
          Rekening tujuan pembayaran ini sudah tidak aktif.
        </p>
        <p className="mt-1 text-xs">
          Jangan transfer ke rekening tersebut. Batalkan lalu pilih metode lain.
          Bila Anda sudah terlanjur mentransfer, unggah bukti transfernya agar
          admin memeriksanya.
        </p>
      </div>
    );
  }

  const { details } = bank;
  return (
    <>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">
        Transfer Bank Manual ({details.bankName}):
      </p>
      <div className="flex justify-between items-center mb-3">
        <div>
          <p className="font-bold text-[#111418] dark:text-white text-lg">
            {details.accountNumber}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            a.n {details.accountName}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-label="Salin nomor rekening"
          onClick={() => onCopy(details.accountNumber, "Nomor Rekening")}
        >
          <MdContentCopy /> Salin
        </Button>
      </div>
    </>
  );
}

function CancelManualTransfer({
  invoiceId,
  refresh,
  onCancelled,
}: Pick<Props, "invoiceId" | "refresh" | "onCancelled">) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelTransfer = async () => {
    setIsCancelling(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/payments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const body = (await res.json().catch((): null => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !body?.success) {
        // 409: sudah diverifikasi atau ditolak di sela-sela; tampilkan
        // keadaan terbarunya.
        setError(body?.error || CANCEL_FAILED_MESSAGE);
        setIsConfirming(false);
        await refresh();
        return;
      }
      await refresh();
      onCancelled();
    } catch {
      setError(CANCEL_FAILED_MESSAGE);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-4">
      {isConfirming ? (
        <div className="rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="text-xs">
            Sudah terlanjur transfer? Jangan dibatalkan, cukup unggah bukti
            transfernya. Batalkan hanya bila Anda belum mentransfer.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="destructive"
              onClick={cancelTransfer}
              loading={isCancelling}
            >
              Ya, Batalkan
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsConfirming(false)}
              disabled={isCancelling}
            >
              Tidak
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setIsConfirming(true)}
        >
          Batalkan / Ganti Metode
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
