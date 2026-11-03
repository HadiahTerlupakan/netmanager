import type {
  ResellerCommissionEntity,
  ResellerCommissionSummaryEntity,
  ResellerSettlementEntity,
} from "../domain/entities/ResellerCommissionEntity";
import type {
  IResellerCommissionRepository,
  CommissionListParams,
  SettlementListParams,
} from "../domain/ports/IResellerCommissionRepository";
import type { IInvoicePaymentStatusReader } from "../domain/ports/IInvoicePaymentStatusReader";
import type { IResellerModuleGate } from "../domain/ports/IResellerModuleGate";
import {
  ResellerConflictError,
  ResellerNotFoundError,
  ResellerValidationError,
} from "../errors/reseller-errors";
import { ResellerCommissionRepository } from "../repositories/ResellerCommissionRepository";
import { FinanceInvoicePaymentStatusReader } from "./finance-invoice-status-reader";
import { FeatureFlagResellerModuleGate } from "./reseller-module-gate";

interface PaidInvoiceInput {
  readonly tenantId?: string | null;
  readonly invoiceId: string;
  readonly pelangganId: string;
  readonly paymentId?: string | null;
  readonly amount: number;
  readonly paidAt: Date;
}

interface UnpaidInvoiceInput {
  readonly tenantId?: string | null;
  readonly invoiceId: string;
}

interface CreateSettlementInput {
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly notes?: string | null;
}

const ACCRUED_STATUS = "ACCRUED";

export class ResellerCommissionService {
  constructor(
    private readonly repository: IResellerCommissionRepository = new ResellerCommissionRepository(),
    private readonly moduleGate: IResellerModuleGate = new FeatureFlagResellerModuleGate(),
    private readonly invoiceStatus: IInvoicePaymentStatusReader = new FinanceInvoicePaymentStatusReader(),
  ) {}

  /**
   * Accrue reseller commission from a fully paid invoice event.
   *
   * Tenant diambil dari pelanggan, bukan hanya dari payload: event tanpa
   * tenantId berjalan di system context, dan semua query sesudahnya memakai
   * tenant pelanggan secara eksplisit.
   *
   * Status invoice dibaca ulang: job INVOICE_PAID yang tiba atau di-retry
   * setelah invoice di-void atau pelunasannya ditarik tidak mengakru komisi.
   * Komisi yang dibatalkan saat invoice sempat tidak lunas dipulihkan bila
   * invoice lunas lagi.
   */
  async accrueFromPaidInvoice(
    input: PaidInvoiceInput,
  ): Promise<ResellerCommissionEntity | null> {
    const customer = await this.repository.findCustomerContext(
      input.tenantId ?? null,
      input.pelangganId,
    );
    if (!customer?.resellerId) return null;
    if (
      customer.tenantId &&
      !(await this.moduleGate.isEnabled(customer.tenantId))
    ) {
      return null;
    }

    if (!(await this.invoiceStatus.isPaid(input.invoiceId))) return null;

    const existing = await this.repository.findCommissionByInvoiceId(
      customer.tenantId,
      input.invoiceId,
    );
    if (existing) return this.restoreIfCancelled(existing, input.paidAt);

    const rule = await this.repository.findActiveCommissionRule({
      tenantId: customer.tenantId,
      resellerId: customer.resellerId,
      hargaPaketId: customer.hargaPaketId,
      at: input.paidAt,
    });
    if (!rule) return null;

    const commissionAmount =
      rule.type === "PERCENTAGE"
        ? Math.floor((input.amount * (rule.rate ?? 0)) / 100)
        : (rule.fixedAmount ?? 0);
    if (commissionAmount <= 0) return null;

    return this.repository.createCommission({
      tenantId: customer.tenantId,
      resellerId: customer.resellerId,
      pelangganId: customer.pelangganId,
      invoiceId: input.invoiceId,
      paymentId: input.paymentId ?? null,
      commissionRuleId: rule.id,
      type: rule.type,
      rate: rule.rate,
      baseAmount: input.amount,
      commissionAmount,
      period: toPeriod(input.paidAt),
      accruedAt: input.paidAt,
    });
  }

  /**
   * Batalkan komisi yang belum disettle untuk invoice yang tidak lagi lunas
   * (di-void atau pelunasannya ditarik). Idempoten. Dilewati bila invoice
   * sudah lunas lagi saat event diproses. Komisi yang sudah SETTLED/PAID tidak
   * disentuh (butuh status pembalikan).
   */
  async cancelAccruedForUnpaidInvoice(
    input: UnpaidInvoiceInput,
  ): Promise<number> {
    if (await this.invoiceStatus.isPaid(input.invoiceId)) return 0;
    return this.repository.softDeleteAccruedByInvoiceId({
      tenantId: input.tenantId ?? null,
      invoiceId: input.invoiceId,
    });
  }

  private async restoreIfCancelled(
    existing: ResellerCommissionEntity,
    paidAt: Date,
  ): Promise<ResellerCommissionEntity | null> {
    const isCancelledAccrual =
      existing.deletedAt !== null &&
      existing.status === ACCRUED_STATUS &&
      existing.settlementId === null;
    if (!isCancelledAccrual) return null;
    return this.repository.restoreCancelledCommission({
      commissionId: existing.id,
      accruedAt: paidAt,
      period: toPeriod(paidAt),
    });
  }

  /** List reseller commissions. */
  async listCommissions(params: CommissionListParams): Promise<{
    readonly items: readonly ResellerCommissionEntity[];
    readonly total: number;
  }> {
    return this.repository.findCommissions(params);
  }

  /**
   * Create settlement for accrued commissions in a period.
   *
   * @throws ResellerValidationError periode terbalik atau tidak ada komisi.
   * @throws ResellerNotFoundError reseller tidak ada di tenant.
   * @throws ResellerConflictError komisi sedang disettle permintaan lain.
   */
  async createSettlement(
    input: CreateSettlementInput,
  ): Promise<ResellerSettlementEntity> {
    if (input.periodStart.getTime() > input.periodEnd.getTime()) {
      throw new ResellerValidationError(
        "Awal periode tidak boleh setelah akhir periode",
      );
    }
    if (
      !(await this.repository.resellerExists(input.tenantId, input.resellerId))
    ) {
      throw new ResellerNotFoundError();
    }

    const outcome = await this.repository.createSettlement({
      tenantId: input.tenantId,
      resellerId: input.resellerId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      notes: input.notes ?? null,
    });
    if (outcome.kind === "empty") {
      throw new ResellerValidationError(
        "Tidak ada komisi reseller yang dapat disettle pada periode ini",
      );
    }
    if (outcome.kind === "conflict") {
      throw new ResellerConflictError(
        "Komisi reseller sedang disettle oleh permintaan lain; muat ulang data",
      );
    }
    return outcome.settlement;
  }

  /** List reseller settlements. */
  async listSettlements(params: SettlementListParams): Promise<{
    readonly items: readonly ResellerSettlementEntity[];
    readonly total: number;
  }> {
    return this.repository.findSettlements(params);
  }

  /** Get reseller commission summary for reporting. */
  async getSummary(params: {
    readonly tenantId: string | null;
    readonly resellerId: string;
    readonly periodStart: Date;
    readonly periodEnd: Date;
  }): Promise<ResellerCommissionSummaryEntity> {
    return this.repository.getCommissionSummary(params);
  }
}

function toPeriod(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

let resellerCommissionService: ResellerCommissionService | null = null;

/** Get singleton reseller commission service. */
export function getResellerCommissionService(): ResellerCommissionService {
  if (!resellerCommissionService) {
    resellerCommissionService = new ResellerCommissionService();
  }
  return resellerCommissionService;
}
