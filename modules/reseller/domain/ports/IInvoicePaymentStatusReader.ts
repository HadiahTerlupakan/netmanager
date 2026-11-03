/**
 * Status pelunasan invoice terkini dari modul finance. Event INVOICE_PAID,
 * INVOICE_VOIDED, dan INVOICE_PAYMENT_REVERTED berjalan sebagai job terpisah
 * yang bisa tiba atau di-retry tidak berurutan; komisi mengikuti status
 * sekarang, bukan urutan event.
 */
export interface IInvoicePaymentStatusReader {
  /** True bila invoice ada dan saat ini berstatus PAID. */
  isPaid(invoiceId: string): Promise<boolean>;
  /**
   * Nominal invoice yang saat ini PAID; null bila tidak ada atau tidak lunas.
   * Dipakai menghitung dasar komisi (DPP) dari data invoice, bukan payload.
   */
  findPaidAmounts(invoiceId: string): Promise<PaidInvoiceAmounts | null>;
}

/** Nominal invoice dalam rupiah bulat. */
export interface PaidInvoiceAmounts {
  /** Total tagihan termasuk PPN, setelah potongan/saldo kredit. */
  readonly totalAmount: number;
  /** PPN yang tercatat di invoice (0 bila tidak dikenai PPN). */
  readonly taxAmount: number;
  /**
   * Saldo kredit pelanggan yang dipakai melunasi invoice saat terbit. Disimpan
   * finance di `discountAmount` bersama potongan harga sungguhan, jadi dibaca
   * terpisah (catatan invoice); 0 bila tidak ada.
   */
  readonly saldoKreditUsed: number;
}
