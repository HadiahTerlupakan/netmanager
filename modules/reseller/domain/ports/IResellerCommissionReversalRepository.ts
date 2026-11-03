import type {
  ResellerCommissionAdjustmentEntity,
  ResellerCommissionEntity,
} from "../entities/ResellerCommissionEntity";

export interface UnpaidInvoiceReversalParams {
  /** Null bila event tanpa tenant: komisi dicari berdasarkan invoice saja. */
  readonly tenantId: string | null;
  readonly invoiceId: string;
  /** Alasan koreksi untuk komisi yang sudah dibayar. */
  readonly reason: string;
}

/** Hasil pembalikan komisi satu invoice yang tidak lagi lunas. */
export interface UnpaidInvoiceReversal {
  /**
   * Komisi yang dibatalkan oleh panggilan ini: ACCRUED, atau SETTLED yang
   * dikeluarkan dari settlement yang belum dibayar. Replay → kosong.
   */
  readonly cancelled: readonly ResellerCommissionEntity[];
  /**
   * Koreksi (clawback) semua komisi invoice ini yang sudah dibayar, termasuk
   * yang tercatat oleh panggilan sebelumnya: dikabarkan ulang agar jurnal yang
   * tertinggal (proses mati sebelum event terkirim) tetap terbentuk.
   */
  readonly clawbacks: readonly ResellerCommissionAdjustmentEntity[];
}

/**
 * Pembalikan komisi saat invoice di-void atau pelunasannya ditarik.
 * Semua langkahnya atomik per invoice dan idempoten.
 */
export interface IResellerCommissionReversalRepository {
  /**
   * - ACCRUED → dibatalkan (soft-delete).
   * - SETTLED di settlement PENDING/APPROVED → dikeluarkan dari settlement
   *   (kembali ACCRUED lalu dibatalkan, sehingga pulih bila invoice lunas
   *   lagi); total settlement dihitung ulang, settlement kosong dibatalkan.
   * - Komisi di settlement PAID → REVERSED + koreksi untuk settlement
   *   berikutnya (unique per komisi).
   */
  reverseForUnpaidInvoice(
    params: UnpaidInvoiceReversalParams,
  ): Promise<UnpaidInvoiceReversal>;
}
