/**
 * Status pelunasan invoice terkini dari modul finance. Event INVOICE_PAID,
 * INVOICE_VOIDED, dan INVOICE_PAYMENT_REVERTED berjalan sebagai job terpisah
 * yang bisa tiba atau di-retry tidak berurutan; komisi mengikuti status
 * sekarang, bukan urutan event.
 */
export interface IInvoicePaymentStatusReader {
  /** True bila invoice ada dan saat ini berstatus PAID. */
  isPaid(invoiceId: string): Promise<boolean>;
}
