"use client";

import { useCallback, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  gatewayReturnNotice,
  usePaymentLiveStatus,
} from "./usePaymentLiveStatus";

const POLL_INTERVAL_MS = 15_000;
// focus dan visibilitychange datang bersamaan saat pelanggan kembali ke tab.
const RETURN_REFETCH_DEDUPE_MS = 2000;
// Tagihan yang baru lunas termasuk yang terbaru; 20 memberi ruang lebih.
const PAID_INVOICES_URL = "/api/customer/invoices?status=PAID&limit=20";
const REPLACED_NOTICE =
  "Metode pembayaran diperbarui. Gunakan instruksi bayar yang tampil sekarang.";

type WatchedInvoice = {
  id: string;
  invoiceNumber: string;
  remainingAmount: number;
  lastPayment?: { id?: string; gatewayStatus?: string | null } | null;
};

export type PaidSummary = {
  amount: number;
  invoiceNumber?: string;
  methodName?: string;
};

/** Checkout menunggu yang sedang ditampilkan, dengan ringkasan untuk layar sukses. */
export type ShownCheckout = {
  invoiceId: string;
  summary: PaidSummary;
};

type Options = {
  /** Invoice yang dipantau lewat SSE. */
  watchedInvoice?: WatchedInvoice;
  /** Kosong bila tidak ada checkout yang menunggu atau waktunya sudah habis. */
  shownCheckout?: ShownCheckout;
  outstandingInvoiceIds: string[];
  refetch: () => Promise<unknown>;
  onPaid: (summary: PaidSummary) => void;
};

async function isInvoicePaid(invoiceId: string) {
  try {
    const res = await fetch(PAID_INVOICES_URL);
    if (!res.ok) return false;
    const body = (await res.json()) as {
      data?: { invoices?: Array<{ id: string }> };
    };
    return Boolean(body.data?.invoices?.some((inv) => inv.id === invoiceId));
  } catch {
    return false;
  }
}

/**
 * Umpan balik halaman tagihan: layar sukses saat lunas, toast saat metode
 * diganti di perangkat lain atau checkout berakhir, dan pesan setelah
 * kembali dari halaman e-wallet/gateway.
 *
 * Selain SSE, daftar dimuat ulang tiap 15 detik selama checkout menunggu
 * dan setiap kali pelanggan kembali ke tab. Checkout yang lalu hilang dari
 * daftar tagihan terbuka diperiksa ke daftar tagihan lunas, jadi pelunasan
 * tetap terlihat walau SSE terblokir. `announcePaid` dipakai tombol cek
 * status; tiap tagihan hanya dirayakan sekali.
 */
export function useTagihanLiveUpdates(options: Options) {
  const { showToast } = useToast();
  const latest = useRef(options);
  // Checkout terakhir yang ditampilkan, disimpan setelah hilang dari daftar
  // untuk memeriksa apakah ia lunas.
  const trackedCheckout = useRef<ShownCheckout | undefined>(undefined);
  useEffect(() => {
    latest.current = options;
    if (options.shownCheckout) trackedCheckout.current = options.shownCheckout;
  });
  const announcedInvoiceIds = useRef(new Set<string>());

  const announcePaid = useCallback(
    (invoiceId: string, fallback?: PaidSummary) => {
      if (announcedInvoiceIds.current.has(invoiceId)) return;
      const tracked = trackedCheckout.current;
      const summary =
        tracked?.invoiceId === invoiceId ? tracked.summary : fallback;
      if (!summary) return;
      announcedInvoiceIds.current.add(invoiceId);
      latest.current.onPaid(summary);
    },
    [],
  );

  const { watchedInvoice, shownCheckout } = options;
  usePaymentLiveStatus(
    watchedInvoice?.id,
    {
      paymentId: watchedInvoice?.lastPayment?.id,
      gatewayStatus: watchedInvoice?.lastPayment?.gatewayStatus ?? undefined,
    },
    {
      onPaid: () => {
        if (watchedInvoice) {
          announcePaid(watchedInvoice.id, {
            amount: watchedInvoice.remainingAmount,
            invoiceNumber: watchedInvoice.invoiceNumber,
          });
        }
        void latest.current.refetch();
      },
      onReplaced: (gatewayStatus) => {
        // Percobaan ganti metode yang ditolak gateway juga membuat payment
        // baru (FAILED); tidak ada instruksi baru untuk ditampilkan.
        if (gatewayStatus === "PENDING" && latest.current.shownCheckout) {
          showToast("info", REPLACED_NOTICE);
        }
        void latest.current.refetch();
      },
      onEnded: (gatewayStatus) => {
        showToast(
          "warning",
          gatewayStatus === "EXPIRED"
            ? "Waktu pembayaran habis. Silakan pilih metode dan bayar lagi."
            : "Pembayaran tidak berhasil. Silakan coba lagi atau pilih metode lain.",
        );
        void latest.current.refetch();
      },
    },
  );

  const isCheckoutShown = Boolean(shownCheckout);
  const outstandingKey = options.outstandingInvoiceIds.join(",");
  useEffect(() => {
    const tracked = trackedCheckout.current;
    if (isCheckoutShown || !tracked) return;
    if (outstandingKey.split(",").includes(tracked.invoiceId)) return;
    trackedCheckout.current = undefined;
    void isInvoicePaid(tracked.invoiceId).then((isPaid) => {
      if (isPaid) announcePaid(tracked.invoiceId, tracked.summary);
    });
  }, [isCheckoutShown, outstandingKey, announcePaid]);

  useEffect(() => {
    if (!isCheckoutShown) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void latest.current.refetch();
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isCheckoutShown]);

  useEffect(() => {
    let lastRefetchAt = Number.NEGATIVE_INFINITY;
    const refetchOnReturn = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefetchAt < RETURN_REFETCH_DEDUPE_MS) return;
      lastRefetchAt = now;
      void latest.current.refetch();
    };
    window.addEventListener("focus", refetchOnReturn);
    document.addEventListener("visibilitychange", refetchOnReturn);
    return () => {
      window.removeEventListener("focus", refetchOnReturn);
      document.removeEventListener("visibilitychange", refetchOnReturn);
    };
  }, []);

  // resultCode di URL hanya petunjuk dari gateway; status lunas tetap
  // menunggu server lewat SSE.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resultCode = params.get("resultCode");
    if (!resultCode) return;
    window.history.replaceState(null, "", window.location.pathname);
    showToast(...gatewayReturnNotice(resultCode));
    void latest.current.refetch();
  }, [showToast]);

  return { announcePaid };
}
