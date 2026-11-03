import type {
  ResellerCommissionAdjustmentEntity,
  ResellerCommissionEntity,
  ResellerSettlementEntity,
} from "../entities/ResellerCommissionEntity";

/**
 * Kabar ke modul accounting (lewat event) agar komisi dibukukan sebagai beban
 * dan utang, bukan pengurang pendapatan. Implementasi tidak melempar: transaksi
 * bisnisnya sudah tersimpan, dan event persisten di-retry oleh outbox.
 */
export interface IResellerAccountingEvents {
  /** Komisi terakru atau dipulihkan → jurnal akru. */
  commissionAccrued(commission: ResellerCommissionEntity): Promise<void>;
  /**
   * Komisi yang belum dibayar (ACCRUED, atau SETTLED di settlement yang belum
   * dibayar) dibatalkan → jurnal akrunya dibalik.
   */
  commissionCancelled(commission: ResellerCommissionEntity): Promise<void>;
  /**
   * Komisi yang sudah dibayar ditagih balik → Dr Utang Komisi / Cr Beban
   * Komisi (idempoten per koreksi).
   */
  commissionClawedBack(
    adjustment: ResellerCommissionAdjustmentEntity,
  ): Promise<void>;
  /** Settlement dibayar → Dr Utang Komisi / Cr Kas/Bank. */
  settlementPaid(settlement: ResellerSettlementEntity): Promise<void>;
}
