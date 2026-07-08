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
import { ResellerCommissionRepository } from "../repositories/ResellerCommissionRepository";

interface PaidInvoiceInput {
  readonly tenantId?: string | null;
  readonly invoiceId: string;
  readonly pelangganId: string;
  readonly paymentId?: string | null;
  readonly amount: number;
  readonly paidAt: Date;
}

interface CreateSettlementInput {
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly notes?: string | null;
}

export class ResellerCommissionService {
  constructor(
    private readonly repository: IResellerCommissionRepository = new ResellerCommissionRepository(),
  ) {}

  /** Accrue reseller commission from a fully paid invoice event. */
  async accrueFromPaidInvoice(
    input: PaidInvoiceInput,
  ): Promise<ResellerCommissionEntity | null> {
    const tenantId = input.tenantId ?? null;
    const existing = await this.repository.findCommissionByInvoiceId(
      tenantId,
      input.invoiceId,
    );
    if (existing) return null;

    const customer = await this.repository.findCustomerContext(
      tenantId,
      input.pelangganId,
    );
    if (!customer?.resellerId) return null;

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

  /** List reseller commissions. */
  async listCommissions(params: CommissionListParams): Promise<{
    readonly items: readonly ResellerCommissionEntity[];
    readonly total: number;
  }> {
    return this.repository.findCommissions(params);
  }

  /** Create settlement for accrued commissions in a period. */
  async createSettlement(
    input: CreateSettlementInput,
  ): Promise<ResellerSettlementEntity> {
    return this.repository.createSettlement({
      tenantId: input.tenantId,
      resellerId: input.resellerId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      notes: input.notes ?? null,
    });
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
