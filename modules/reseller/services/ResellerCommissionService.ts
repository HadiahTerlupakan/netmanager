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
import type { IResellerAccountingEvents } from "../domain/ports/IResellerAccountingEvents";
import type { IResellerModuleGate } from "../domain/ports/IResellerModuleGate";
import {
  calculateCommissionAmount,
  calculateCommissionBase,
} from "../domain/commission-base";
import { isEligibleForCommissionAt } from "../domain/reseller-compliance";
import {
  ResellerConflictError,
  ResellerNotFoundError,
  ResellerValidationError,
} from "../errors/reseller-errors";
import { ResellerCommissionRepository } from "../repositories/ResellerCommissionRepository";
import { EventBusResellerAccountingEvents } from "./event-bus-accounting-events";
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

interface CreateSettlementInput {
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly notes?: string | null;
}

const ACCRUED_STATUS = "ACCRUED";
const REVERSED_STATUS = "REVERSED";
const MIN_ACCRUAL_STEP_MS = 1;

export class ResellerCommissionService {
  constructor(
    private readonly repository: IResellerCommissionRepository = new ResellerCommissionRepository(),
    private readonly moduleGate: IResellerModuleGate = new FeatureFlagResellerModuleGate(),
    private readonly invoiceStatus: IInvoicePaymentStatusReader = new FinanceInvoicePaymentStatusReader(),
    private readonly accountingEvents: IResellerAccountingEvents = new EventBusResellerAccountingEvents(),
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
   *
   * Model agen: hanya kemitraan ACTIVE yang berhak komisi. Status dinilai pada
   * saat `paidAt`, bukan saat event diproses: pembayaran sebelum reseller
   * di-suspend/diputus/dinonaktifkan tetap berkomisi. Aturan yang sama berlaku
   * untuk pemulihan, karena pemulihan memakai `paidAt` pelunasan yang baru.
   *
   * Dasar komisi adalah DPP invoice (total tanpa PPN, lihat
   * `calculateCommissionBase`), dibaca dari invoice, bukan dari `amount`
   * payload yang sudah termasuk PPN. Aturan yang dipakai adalah aturan ACTIVE
   * yang berlaku pada `paidAt` (aturan per paket didahulukan). Komisi yang
   * terbit atau pulih dikabarkan ke accounting untuk jurnal akru.
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
      !customer.resellerStatus ||
      !isEligibleForCommissionAt(
        customer.resellerStatus,
        customer.resellerStatusChangedAt,
        input.paidAt,
      )
    ) {
      return null;
    }
    if (
      customer.tenantId &&
      !(await this.moduleGate.isEnabled(customer.tenantId))
    ) {
      return null;
    }

    const paidAmounts = await this.invoiceStatus.findPaidAmounts(
      input.invoiceId,
    );
    if (!paidAmounts) return null;

    const existing = await this.repository.findCommissionByInvoiceId(
      customer.tenantId,
      input.invoiceId,
    );
    if (existing) return this.handleExistingCommission(existing, input.paidAt);

    const rule = await this.repository.findActiveCommissionRule({
      tenantId: customer.tenantId,
      resellerId: customer.resellerId,
      hargaPaketId: customer.hargaPaketId,
      at: input.paidAt,
    });
    if (!rule) return null;

    const baseAmount = calculateCommissionBase(paidAmounts);
    const commissionAmount = calculateCommissionAmount(rule, baseAmount);
    if (commissionAmount <= 0) return null;

    const created = await this.repository.createCommission({
      tenantId: customer.tenantId,
      resellerId: customer.resellerId,
      pelangganId: customer.pelangganId,
      invoiceId: input.invoiceId,
      paymentId: input.paymentId ?? null,
      commissionRuleId: rule.id,
      type: rule.type,
      rate: rule.rate,
      baseAmount,
      commissionAmount,
      period: toPeriod(input.paidAt),
      accruedAt: input.paidAt,
    });
    return this.announceAccrual(created);
  }

  /**
   * INVOICE_PAID yang diulang (at-least-once) untuk komisi yang sudah ada.
   * Komisi yang dibatalkan dipulihkan. Komisi yang masih aktif tidak dibuat
   * ulang, tetapi event akrunya dikirim ulang: bila proses mati setelah komisi
   * tersimpan dan sebelum event terkirim, hanya ulangan inilah yang membentuk
   * jurnal akrunya. Jurnalnya idempoten per ref, jadi kiriman ganda aman.
   *
   * Komisi yang sudah ditagih balik (REVERSED) terbit ulang sebagai akrual
   * baru: koreksinya tetap dipotongkan dari settlement berikutnya dan akrual
   * baru mengimbanginya, sehingga invoice yang benar-benar lunas tetap
   * berkomisi sekali, sama seperti komisi yang belum sempat dibayar.
   */
  private async handleExistingCommission(
    existing: ResellerCommissionEntity,
    paidAt: Date,
  ): Promise<null | ResellerCommissionEntity> {
    if (existing.status === REVERSED_STATUS) {
      return this.announceAccrual(await this.reaccrue(existing, paidAt));
    }
    if (existing.deletedAt === null) {
      await this.accountingEvents.commissionAccrued(existing);
      return null;
    }
    return this.announceAccrual(
      await this.restoreIfCancelled(existing, paidAt),
    );
  }

  private async announceAccrual(
    commission: ResellerCommissionEntity | null,
  ): Promise<ResellerCommissionEntity | null> {
    if (commission) await this.accountingEvents.commissionAccrued(commission);
    return commission;
  }

  private async reaccrue(
    existing: ResellerCommissionEntity,
    paidAt: Date,
  ): Promise<ResellerCommissionEntity | null> {
    if (existing.deletedAt !== null) return null;
    const accruedAt = nextAccrualTime(existing.accruedAt, paidAt);
    return this.repository.reaccrueReversedCommission({
      commissionId: existing.id,
      invoiceId: existing.invoiceId,
      accruedAt,
      period: toPeriod(accruedAt),
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
    const accruedAt = nextAccrualTime(existing.accruedAt, paidAt);
    return this.repository.restoreCancelledCommission({
      commissionId: existing.id,
      accruedAt,
      period: toPeriod(accruedAt),
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

/**
 * Tanggal akrual baru, wajib setelah akrual sebelumnya: ref jurnal akru dan
 * kunci koreksi memakai `accruedAt`, jadi akrual baru dengan tanggal yang sama
 * (pelunasan lama yang diulang) akan tertahan jurnal dan koreksi akrual lama.
 */
function nextAccrualTime(previousAccruedAt: Date, paidAt: Date): Date {
  if (paidAt.getTime() > previousAccruedAt.getTime()) return paidAt;
  return new Date(previousAccruedAt.getTime() + MIN_ACCRUAL_STEP_MS);
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
