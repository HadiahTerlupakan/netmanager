"use client";

import { useState } from "react";
import type { Invoice } from "./checkout";

const MANUAL_METHOD_PREFIX = "MANUAL_";
const MOOTA_MANUAL_CODE = "MOOTA_MANUAL";
const PAYMENT_FAILED_MESSAGE = "Gagal membuat pembayaran";
const PAYMENT_ERROR_MESSAGE = "Terjadi kesalahan saat memproses pembayaran";

type CreatedCheckout = {
  paymentUrl?: string | null;
  vaNumber?: string | null;
  qrString?: string | null;
};

/**
 * Nomor VA / QRIS ditampilkan di kartu menunggu pembayaran; hanya metode
 * tanpa instruksi (kartu kredit, e-wallet login) yang dialihkan ke gateway.
 */
function getGatewayPageUrl(
  checkout: CreatedCheckout | undefined,
  methodCode: string,
) {
  const isManualMethod =
    methodCode.startsWith(MANUAL_METHOD_PREFIX) ||
    methodCode === MOOTA_MANUAL_CODE;
  if (
    !checkout?.paymentUrl ||
    checkout.vaNumber ||
    checkout.qrString ||
    isManualMethod
  ) {
    return null;
  }
  return checkout.paymentUrl;
}

type Options = {
  payableInvoices: Invoice[];
  couponCode?: string;
  refetch: () => Promise<unknown>;
  /** Checkout baru sudah dibuat. */
  onCreated: () => void;
};

/**
 * Membuat checkout untuk semua tagihan yang harus dibayar, dengan metode
 * yang dipilih pelanggan sendiri (tidak ada pilihan bawaan). Bila server
 * menolak, checkout lama tetap berlaku: galatnya saja yang ditampilkan dan
 * daftar dimuat ulang agar kartu mengikuti keadaan server.
 */
export function usePaymentSubmission({
  payableInvoices,
  couponCode,
  refetch,
  onCreated,
}: Options) {
  const [selectedMethodCode, setSelectedMethodCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async () => {
    if (!payableInvoices.length || !selectedMethodCode) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/customer/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceIds: payableInvoices.map((inv) => inv.id),
          couponCode,
          paymentMethod: selectedMethodCode,
          notes: "Payment via Customer Portal",
        }),
      });
      const result = await res.json();
      if (!result.success) {
        setSubmitError(result.error || PAYMENT_FAILED_MESSAGE);
        await refetch();
        return;
      }
      onCreated();
      setSelectedMethodCode("");
      await refetch();
      const gatewayPageUrl = getGatewayPageUrl(result.data, selectedMethodCode);
      if (gatewayPageUrl) window.location.href = gatewayPageUrl;
    } catch {
      setSubmitError(PAYMENT_ERROR_MESSAGE);
      void refetch();
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    selectedMethodCode,
    selectMethod: setSelectedMethodCode,
    isSubmitting,
    submitError,
    clearError: () => setSubmitError(null),
    submit,
  };
}
