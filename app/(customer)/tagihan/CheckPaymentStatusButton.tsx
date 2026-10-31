"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export type CheckedPaymentStatus =
  | "PAID"
  | "PENDING"
  | "EXPIRED"
  | "FAILED"
  | "NONE";

const STATUS_MESSAGES: Record<CheckedPaymentStatus, string> = {
  PAID: "Pembayaran sudah kami terima.",
  PENDING:
    "Pembayaran belum kami terima. Bila Anda baru saja membayar, tunggu beberapa menit lalu cek lagi.",
  EXPIRED:
    "Kode pembayaran ini sudah kedaluwarsa. Silakan pilih metode pembayaran lagi.",
  FAILED: "Pembayaran tidak berhasil. Silakan pilih metode pembayaran lagi.",
  NONE: "Tidak ada pembayaran yang sedang menunggu untuk tagihan ini.",
};
const CHECK_FAILED_MESSAGE =
  "Status pembayaran belum bisa diperiksa. Coba lagi sebentar lagi.";

type CheckResult = { isError: boolean; text: string };

async function requestPaymentStatus(invoiceId: string) {
  const res = await fetch("/api/customer/payments/check-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceId }),
  });
  const body = (await res.json().catch((): null => null)) as {
    success?: boolean;
    error?: string;
    data?: { status?: CheckedPaymentStatus };
  } | null;
  const status = body?.data?.status;
  if (!res.ok || !body?.success || !status || !(status in STATUS_MESSAGES)) {
    throw new Error(body?.error || CHECK_FAILED_MESSAGE);
  }
  return status;
}

/**
 * Tombol "Saya Sudah Bayar" untuk checkout gateway: server menanyakan
 * status transaksi ke gateway dan melunasinya lewat jalur webhook bila
 * ternyata sudah dibayar. Berguna saat notifikasi gateway terlambat.
 */
export function CheckPaymentStatusButton({
  invoiceId,
  onChecked,
}: {
  invoiceId: string;
  onChecked: (status: CheckedPaymentStatus) => void;
}) {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  const checkStatus = async () => {
    setIsChecking(true);
    setResult(null);
    try {
      const status = await requestPaymentStatus(invoiceId);
      setResult({ isError: false, text: STATUS_MESSAGES[status] });
      onChecked(status);
    } catch (error) {
      setResult({
        isError: true,
        text: error instanceof Error ? error.message : CHECK_FAILED_MESSAGE,
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="mt-4">
      <Button
        variant="success"
        className="w-full"
        onClick={checkStatus}
        loading={isChecking}
      >
        {isChecking
          ? "Memeriksa pembayaran..."
          : "Saya Sudah Bayar, Cek Status"}
      </Button>
      <p
        role="status"
        className={`mt-2 text-xs text-center ${
          result?.isError
            ? "text-red-600 dark:text-red-400"
            : "text-gray-600 dark:text-gray-300"
        }`}
      >
        {result?.text}
      </p>
    </div>
  );
}
