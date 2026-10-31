import { isRouteServiceError } from "@/lib/api/route-service-error";

const HTTP_CONFLICT = 409;

/**
 * Hasil aksi tagihan "Batalkan & Buat Tagihan Baru" yang ikut dalam respons
 * simpan form edit pelanggan, supaya admin tahu bila tagihan tidak diganti.
 */
export type InvoiceActionOutcome = {
  invoiceActionFailed?: true;
  invoiceActionMessage?: string;
};

/** Pesan untuk tagihan yang tidak dibatalkan; kosong bila semuanya diganti. */
export function describeKeptInvoices(
  keptInvoices: Array<{ message: string }>,
): InvoiceActionOutcome {
  if (keptInvoices.length === 0) return {};
  const reasons = keptInvoices.map((kept) => kept.message).join(" ");
  return {
    invoiceActionMessage: `${reasons} Tagihan baru tidak dibuat; ulangi setelah pembayarannya selesai atau kedaluwarsa.`,
  };
}

/** Pesan saat penggantian tagihan gagal setelah data pelanggan tersimpan. */
export function describeInvoiceActionFailure(
  error: unknown,
): InvoiceActionOutcome {
  const isCustomerPaying =
    isRouteServiceError(error) && error.status === HTTP_CONFLICT;
  return {
    invoiceActionFailed: true,
    invoiceActionMessage: isCustomerPaying
      ? "Data pelanggan tersimpan, tetapi tagihan tidak diganti karena pelanggan sedang membuat pembayaran. Coba lagi sebentar lagi."
      : "Data pelanggan tersimpan, tetapi tagihan baru gagal dibuat. Coba lagi atau buat tagihan secara manual.",
  };
}
