"use client";

import { useEffect, useRef } from "react";

type PaymentSnapshot = {
  status: string;
  paymentId: string | null;
  gatewayStatus: string | null;
};

const ENDED_STATUSES = new Set(["EXPIRED", "FAILED", "CANCELLED"]);
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30_000;

export type PaymentLiveHandlers = {
  onPaid: () => void;
  /**
   * Checkout terbaru bukan yang sedang ditampilkan: diganti di perangkat
   * lain, atau percobaan ganti metode yang gagal (status terbarunya bukan
   * PENDING).
   */
  onReplaced: (gatewayStatus: string | null) => void;
  onEnded: (gatewayStatus: string) => void;
};

function parseSnapshot(raw: string): PaymentSnapshot | null {
  try {
    return JSON.parse(raw) as PaymentSnapshot;
  } catch {
    return null;
  }
}

function reconnectDelay(attempt: number) {
  return Math.min(
    RECONNECT_BASE_DELAY_MS * 2 ** attempt,
    RECONNECT_MAX_DELAY_MS,
  );
}

/**
 * Status live pembayaran invoice yang belum lunas, lewat SSE. Dipasang
 * selama ada invoice terbuka, bukan hanya saat checkout menunggu, agar
 * halaman yang terbuka di perangkat lain ikut berubah ketika pelanggan
 * membayar atau mengganti metode di tempat lain, dan tidak lagi
 * menampilkan VA/QR yang sudah ditutup.
 *
 * Server mengakhiri aliran setelah 30 menit dan jaringan HP sering putus,
 * jadi aliran disambung lagi dengan jeda 1, 2, 4 ... hingga 30 detik;
 * hanya status PAID yang mengakhirinya.
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
    // Satu kali per kejadian, juga lintas sambungan: SSE mengulang status
    // yang sama tiap 5 detik dan lagi setiap kali tersambung.
    let notified = false;
    let isFinished = false;
    let failedAttempts = 0;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const handleSnapshot = (data: PaymentSnapshot) => {
      if (notified) return;
      if (data.status === "PAID") {
        notified = true;
        isFinished = true;
        source?.close();
        handlersRef.current.onPaid();
      } else if (data.paymentId && data.paymentId !== shownPaymentId) {
        notified = true;
        handlersRef.current.onReplaced(data.gatewayStatus);
      } else if (
        shownStatus === "PENDING" &&
        data.gatewayStatus &&
        ENDED_STATUSES.has(data.gatewayStatus)
      ) {
        notified = true;
        handlersRef.current.onEnded(data.gatewayStatus);
      }
    };

    const connect = () => {
      source = new EventSource(
        `/api/customer/payments/sse?invoiceId=${invoiceId}`,
      );
      source.onmessage = (event) => {
        failedAttempts = 0;
        const data = parseSnapshot(event.data);
        if (data) handleSnapshot(data);
      };
      source.onerror = () => {
        source?.close();
        if (isFinished) return;
        retryTimer = setTimeout(connect, reconnectDelay(failedAttempts));
        failedAttempts += 1;
      };
    };

    connect();
    return () => {
      isFinished = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, [invoiceId, shownPaymentId, shownStatus]);
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
