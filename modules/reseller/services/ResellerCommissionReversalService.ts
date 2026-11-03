import type { ResellerCommissionAdjustmentEntity } from "../domain/entities/ResellerCommissionEntity";
import type { IInvoicePaymentStatusReader } from "../domain/ports/IInvoicePaymentStatusReader";
import type { IResellerAccountingEvents } from "../domain/ports/IResellerAccountingEvents";
import type {
  AdjustmentListParams,
  IResellerCommissionAdjustmentRepository,
} from "../domain/ports/IResellerCommissionAdjustmentRepository";
import type { IResellerCommissionReversalRepository } from "../domain/ports/IResellerCommissionReversalRepository";
import { ResellerCommissionAdjustmentRepository } from "../repositories/ResellerCommissionAdjustmentRepository";
import { ResellerCommissionReversalRepository } from "../repositories/ResellerCommissionReversalRepository";
import { EventBusResellerAccountingEvents } from "./event-bus-accounting-events";
import { FinanceInvoicePaymentStatusReader } from "./finance-invoice-status-reader";

interface UnpaidInvoiceInput {
  readonly tenantId?: string | null;
  readonly invoiceId: string;
  /** Alasan yang dicatat pada koreksi komisi yang sudah dibayar. */
  readonly reason: string;
}

/** Ringkasan pembalikan untuk log handler. */
export interface UnpaidInvoiceReversalSummary {
  readonly cancelledCount: number;
  readonly clawbackCount: number;
}

const NOTHING_REVERSED: UnpaidInvoiceReversalSummary = {
  cancelledCount: 0,
  clawbackCount: 0,
};

/**
 * Pembalikan komisi reseller saat invoice di-void atau pelunasannya ditarik.
 *
 * - Belum dibayar (ACCRUED, atau SETTLED di settlement PENDING/APPROVED):
 *   dibatalkan dan jurnal akrunya dibalik.
 * - Sudah dibayar (settlement PAID): ditagih balik (REVERSED) lewat koreksi
 *   yang dipotongkan dari settlement berikutnya, dengan jurnal Dr Utang
 *   Komisi / Cr Beban Komisi. Akun REVENUE tidak pernah disentuh.
 */
export class ResellerCommissionReversalService {
  constructor(
    private readonly reversals: IResellerCommissionReversalRepository = new ResellerCommissionReversalRepository(),
    private readonly adjustments: IResellerCommissionAdjustmentRepository = new ResellerCommissionAdjustmentRepository(),
    private readonly invoiceStatus: IInvoicePaymentStatusReader = new FinanceInvoicePaymentStatusReader(),
    private readonly accountingEvents: IResellerAccountingEvents = new EventBusResellerAccountingEvents(),
  ) {}

  /**
   * Balik komisi invoice yang tidak lagi lunas. Idempoten (at-least-once):
   * dilewati bila invoice sudah lunas lagi saat event diproses; komisi yang
   * sudah dibatalkan tidak dikabarkan ulang, tetapi semua koreksi invoice ini
   * dikabarkan ulang karena jurnalnya idempoten per koreksi.
   */
  async reverseForUnpaidInvoice(
    input: UnpaidInvoiceInput,
  ): Promise<UnpaidInvoiceReversalSummary> {
    if (await this.invoiceStatus.isPaid(input.invoiceId)) {
      return NOTHING_REVERSED;
    }
    const reversal = await this.reversals.reverseForUnpaidInvoice({
      tenantId: input.tenantId ?? null,
      invoiceId: input.invoiceId,
      reason: input.reason,
    });
    for (const commission of reversal.cancelled) {
      await this.accountingEvents.commissionCancelled(commission);
    }
    for (const adjustment of reversal.clawbacks) {
      await this.accountingEvents.commissionClawedBack(adjustment);
    }
    return {
      cancelledCount: reversal.cancelled.length,
      clawbackCount: reversal.clawbacks.length,
    };
  }

  /** Koreksi (clawback) komisi reseller, terbaru dulu. */
  async listAdjustments(params: AdjustmentListParams): Promise<{
    readonly items: readonly ResellerCommissionAdjustmentEntity[];
    readonly total: number;
  }> {
    return this.adjustments.findAdjustments(params);
  }
}

let resellerCommissionReversalService: ResellerCommissionReversalService | null =
  null;

/** Get singleton reseller commission reversal service. */
export function getResellerCommissionReversalService(): ResellerCommissionReversalService {
  if (!resellerCommissionReversalService) {
    resellerCommissionReversalService = new ResellerCommissionReversalService();
  }
  return resellerCommissionReversalService;
}
