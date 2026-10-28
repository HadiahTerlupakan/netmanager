/**
 * Invoice prorate menagih selisih paket untuk sisa periode berjalan dan
 * hanya dikenali dari nomornya (tidak ada kolom jenis invoice).
 */
export const PRORATE_INVOICE_PREFIX = "PRORATE/";

export function isProrateInvoiceNumber(invoiceNumber: string | null) {
  return Boolean(invoiceNumber?.startsWith(PRORATE_INVOICE_PREFIX));
}
