import type { ResellerSettlementEntity } from "../entities/ResellerCommissionEntity";

export interface ApproveSettlementData {
  readonly settlementId: string;
  readonly approvedAt: Date;
  readonly approvedById: string | null;
}

export interface PaySettlementData {
  readonly tenantId: string | null;
  readonly settlementId: string;
  readonly paidAt: Date;
  readonly paidById: string | null;
  readonly paymentMethod: string;
  readonly paymentReference: string | null;
  readonly paymentAccountId: string;
}

/** Rekening Kas & Bank yang bisa dipilih untuk membayar settlement. */
export interface SettlementPaymentAccount {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly balance: number;
}

/** Hasil APPROVED → PAID. */
export type PaySettlementOutcome =
  | { readonly kind: "paid"; readonly settlement: ResellerSettlementEntity }
  /** Status asalnya sudah bukan APPROVED; pemanggil membaca ulang. */
  | { readonly kind: "status-changed" }
  /** Saldo rekening Kas & Bank kurang dari total settlement; tidak ada yang berubah. */
  | { readonly kind: "insufficient-balance" };

/**
 * Transisi status settlement. Setiap transisi bersyarat status asalnya, jadi
 * dua permintaan yang berlomba tidak sama-sama berhasil; null berarti status
 * asalnya sudah berubah dan pemanggil harus membaca ulang.
 */
export interface IResellerSettlementRepository {
  /** Settlement milik reseller di tenant (belum dihapus). */
  findById(
    tenantId: string | null,
    resellerId: string,
    settlementId: string,
  ): Promise<ResellerSettlementEntity | null>;
  /** PENDING → APPROVED. */
  approve(
    data: ApproveSettlementData,
  ): Promise<ResellerSettlementEntity | null>;
  /**
   * APPROVED → PAID, sekaligus komisinya SETTLED → PAID dan saldo rekening
   * Kas & Bank dikurangi total settlement, dalam satu transaksi.
   */
  markPaid(data: PaySettlementData): Promise<PaySettlementOutcome>;
  /** Rekening Kas & Bank aktif milik tenant, urut nama. */
  listPaymentAccounts(
    tenantId: string | null,
  ): Promise<readonly SettlementPaymentAccount[]>;
  /** Rekening Kas & Bank aktif milik tenant. */
  paymentAccountExists(
    tenantId: string | null,
    accountId: string,
  ): Promise<boolean>;
}
