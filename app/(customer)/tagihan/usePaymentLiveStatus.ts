"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/Toast";

type PaymentSnapshot = {
  status: string;
  paymentId: string | null;
  gatewayStatus: string | null;
};

const ENDED_STATUSES = new Set(["EXPIRED", "FAILED", "CANCELLED"]);

export type PaymentLiveHandlers = {
  onPaid: () => void;
  /** Checkout terbaru bukan yang sedang ditampilkan (diganti di perangkat lain). */
  onReplaced: () => void;
  onEnded: (gatewayStatus: string) => void;
};

/**
 * Status live pembayaran invoice yang belum lunas, lewat SSE. Dipasang
 * selama ada invoice terbuka, bukan hanya saat checkout menunggu, agar
 * halaman yang terbuka di perangkat lain ikut berubah ketika pelanggan
 * membayar atau mengganti metode di tempat lain, dan tidak lagi
 * menampilkan VA/QR yang sudah ditutup.
 */
export function usePaymentLiveStatus(
  invoiceId: string | undefined,
  shown: { paymentId?: string; gatewayStatus?: string },
  handlers: PaymentLiveHandlers,
) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const { paymentId: shownPaymentId, gatewayStatus: shownStatus } = shown;
  useEffect(() => {
    if (!invoiceId) return;
    // Satu kali per kejadian: SSE mengulang status yang sama tiap 5 detik.
    let notified = false;
    const source = new EventSource(
      `/api/customer/payments/sse?invoiceId=${invoiceId}`,
    );
    source.onmessage = (event) => {
      let data: PaymentSnapshot;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (notified) return;
      if (data.status === "PAID") {
        notified = true;
        source.close();
        handlersRef.current.onPaid();
      } else if (data.paymentId && data.paymentId !== shownPaymentId) {
        notified = true;
        handlersRef.current.onReplaced();
      } else if (
        shownStatus === "PENDING" &&
        data.gatewayStatus &&
        ENDED_STATUSES.has(data.gatewayStatus)
      ) {
        notified = true;
        handlersRef.current.onEnded(data.gatewayStatus);
      }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [invoiceId, shownPaymentId, shownStatus]);
}

type WatchedInvoice = {
  id: string;
  invoiceNumber: string;
  remainingAmount: number;
  lastPayment?: { id?: string; gatewayStatus?: string };
};

export type PaidSummary = {
  amount: number;
  invoiceNumber?: string;
  methodName?: string;
};

/**
 * Umpan balik halaman tagihan: layar sukses saat lunas, toast saat metode
 * diganti di perangkat lain atau checkout berakhir, dan pesan setelah
 * kembali dari halaman e-wallet/gateway.
 */
export function useTagihanLiveUpdates(options: {
  watchedInvoice?: WatchedInvoice;
  hasActivePayment: boolean;
  methodName?: string;
  refetch: () => unknown;
  onPaid: (summary: PaidSummary) => void;
}) {
  const { showToast } = useToast();
  const { watchedInvoice, hasActivePayment, methodName, refetch, onPaid } =
    options;

  usePaymentLiveStatus(
    watchedInvoice?.id,
    {
      paymentId: watchedInvoice?.lastPayment?.id,
      gatewayStatus: watchedInvoice?.lastPayment?.gatewayStatus,
    },
    {
      onPaid: () => {
        onPaid({
          amount: watchedInvoice?.remainingAmount ?? 0,
          invoiceNumber: watchedInvoice?.invoiceNumber,
          methodName,
        });
        refetch();
      },
      onReplaced: () => {
        if (hasActivePayment) {
          showToast(
            "info",
            "Metode pembayaran diperbarui. Gunakan instruksi bayar yang tampil sekarang.",
          );
        }
        refetch();
      },
      onEnded: (gatewayStatus) => {
        showToast(
          "warning",
          gatewayStatus === "EXPIRED"
            ? "Waktu pembayaran habis. Silakan pilih metode dan bayar lagi."
            : "Pembayaran tidak berhasil. Silakan coba lagi atau pilih metode lain.",
        );
        refetch();
      },
    },
  );

  // resultCode di URL hanya petunjuk dari gateway; status lunas tetap
  // menunggu server lewat SSE.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resultCode = params.get("resultCode");
    if (!resultCode) return;
    window.history.replaceState(null, "", window.location.pathname);
    showToast(...gatewayReturnNotice(resultCode));
    refetch();
  }, [showToast, refetch]);
}

/** Kode hasil returnUrl Duitku: 00 berhasil, 02 dibatalkan, lainnya tertunda. */
export function gatewayReturnNotice(
  resultCode: string,
): ["info" | "warning", string] {
  if (resultCode === "00") return ["info", "Memeriksa pembayaran Anda..."];
  if (resultCode === "02") {
    return ["warning", "Pembayaran dibatalkan. Anda bisa memilih metode lain."];
  }
  return [
    "info",
    "Pembayaran belum selesai. Lanjutkan atau ganti metode pembayaran.",
  ];
}
