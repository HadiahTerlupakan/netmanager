import type {
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
  /** Komisi ACCRUED dibatalkan → jurnal akrunya dibalik. */
  commissionCancelled(commission: ResellerCommissionEntity): Promise<void>;
  /** Settlement dibayar → Dr Utang Komisi / Cr Kas/Bank. */
  settlementPaid(settlement: ResellerSettlementEntity): Promise<void>;
}
