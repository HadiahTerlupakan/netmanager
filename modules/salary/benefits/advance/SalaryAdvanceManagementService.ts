import type { SalaryAdvancePolicy } from "@/modules/salary/core";
import type { SalaryAdvance } from "@/modules/salary/core";
import type {
  ISalaryAdvanceRepository,
  IPayrollPeriodRepository,
} from "@/modules/salary/core";
import { getPayrollConfig } from "@/modules/salary/config";
import { logger } from "@/lib/logger";

export type ValidationError =
  | "EXCEEDS_MAX_PERCENT"
  | "MAX_ACTIVE_EXCEEDED"
  | "TOO_SOON";

export interface RequestAdvanceInput {
  tenantId: string;
  userId: string;
  amount: number;
  reason: string | null;
  deductionMethod: "FULL_NEXT" | "INSTALLMENT";
  installmentCount: number | null;
  basicSalary: number;
}

export interface ActionResult {
  success: boolean;
  advance?: SalaryAdvance;
  errors?: ValidationError[];
  message: string;
}

/** Orchestrates salary advance lifecycle: request, approve, reject, disburse. */
export class SalaryAdvanceManagementService {
  constructor(
    private readonly repo: ISalaryAdvanceRepository,
    private readonly periodRepo?: IPayrollPeriodRepository,
  ) {}

  /** Request a new salary advance with policy validation. */
  async requestAdvance(input: RequestAdvanceInput): Promise<ActionResult> {
    const {
      tenantId,
      userId,
      amount,
      reason,
      deductionMethod,
      installmentCount,
      basicSalary,
    } = input;
    const policy = this.getPolicy(tenantId);

    const activeCount = await this.repo.countActive(userId, tenantId);
    const activeAdvances = await this.repo.findActiveByUser(userId, tenantId);
    const lastRequestDate =
      activeAdvances.length > 0 ? activeAdvances[0].requestDate : null;

    const errors = this.validate({
      requestedAmount: amount,
      basicSalary,
      activeAdvanceCount: activeCount,
      lastRequestDate,
      requestDate: new Date(),
      policy,
    });

    if (errors.length > 0) {
      return { success: false, errors, message: this.formatErrors(errors) };
    }

    const advance = await this.repo.create({
      tenantId,
      userId,
      amount,
      requestDate: new Date(),
      approvedBy: null,
      approvedAt: null,
      status: "PENDING",
      deductionMethod,
      installmentCount:
        deductionMethod === "INSTALLMENT"
          ? (installmentCount ?? policy.maxInstallments)
          : null,
      remainingAmount: amount,
      reason,
      rejectionReason: null,
      disbursedAt: null,
    });

    return { success: true, advance, message: "Pengajuan kasbon berhasil" };
  }

  /** Approve a pending advance. */
  async approve(
    id: string,
    tenantId: string,
    approvedBy: string,
  ): Promise<ActionResult> {
    const advance = await this.repo.findById(id, tenantId);
    if (!advance) return { success: false, message: "Kasbon tidak ditemukan" };
    if (advance.status !== "PENDING") {
      return {
        success: false,
        message: `Status ${advance.status} tidak bisa di-approve`,
      };
    }

    const updated = await this.repo.update(id, tenantId, {
      status: "APPROVED",
      approvedBy,
      approvedAt: new Date(),
    });

    return { success: true, advance: updated, message: "Kasbon disetujui" };
  }

  /** Reject a pending advance. */
  async reject(
    id: string,
    tenantId: string,
    rejectionReason: string,
  ): Promise<ActionResult> {
    const advance = await this.repo.findById(id, tenantId);
    if (!advance) return { success: false, message: "Kasbon tidak ditemukan" };
    if (advance.status !== "PENDING") {
      return {
        success: false,
        message: `Status ${advance.status} tidak bisa di-reject`,
      };
    }

    const updated = await this.repo.update(id, tenantId, {
      status: "REJECTED",
      rejectionReason,
    });

    return { success: true, advance: updated, message: "Kasbon ditolak" };
  }

  /** Disburse an approved advance and emit event for accounting. */
  async disburse(
    id: string,
    tenantId: string,
    accountId?: string,
  ): Promise<ActionResult> {
    const advance = await this.repo.findById(id, tenantId);
    if (!advance) return { success: false, message: "Kasbon tidak ditemukan" };
    if (advance.status !== "APPROVED") {
      return {
        success: false,
        message: `Status ${advance.status} tidak bisa dicairkan`,
      };
    }

    // Guard: cegah disburse ke periode yang sudah LOCKED.
    // Tanpa guard ini, jurnal akan otomatis dibuatkan periode baru oleh
    // PeriodService.ensureCurrentPeriod — mengakibatkan jurnal salah periode.
    if (this.periodRepo) {
      const disbursedAt = new Date();
      const containing = await this.periodRepo.findContainingDate(
        tenantId,
        disbursedAt,
      );
      if (containing && containing.status === "LOCKED") {
        return {
          success: false,
          message:
            "Periode penggajian yang mencakup tanggal pencairan sudah terkunci. Buka kunci dulu atau atur tanggal disburse di periode aktif.",
        };
      }
    }

    const updated = await this.repo.update(id, tenantId, {
      status: "DISBURSED",
      disbursedAt: new Date(),
    });

    this.emitDisbursedEvent(updated!, accountId).catch((err) => {
      logger.warn(
        `[SalaryAdvanceManagement] Failed to emit disbursed event for ${id}: ${err instanceof Error ? err.message : "unknown"}`,
      );
    });

    return {
      success: true,
      advance: updated,
      message: "Kasbon berhasil dicairkan",
    };
  }

  private getPolicy(tenantId: string): SalaryAdvancePolicy {
    return getPayrollConfig(tenantId).advancePolicy;
  }

  private validate(input: {
    requestedAmount: number;
    basicSalary: number;
    activeAdvanceCount: number;
    lastRequestDate: Date | null;
    requestDate: Date;
    policy: SalaryAdvancePolicy;
  }): ValidationError[] {
    const {
      requestedAmount,
      basicSalary,
      activeAdvanceCount,
      lastRequestDate,
      requestDate,
      policy,
    } = input;
    const errors: ValidationError[] = [];

    const maxAllowed = Math.floor(basicSalary * policy.maxPercentOfSalary);
    if (requestedAmount > maxAllowed) {
      errors.push("EXCEEDS_MAX_PERCENT");
    }

    if (activeAdvanceCount >= policy.maxActiveAdvances) {
      errors.push("MAX_ACTIVE_EXCEEDED");
    }

    if (lastRequestDate) {
      const daysSince = Math.floor(
        (requestDate.getTime() - lastRequestDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysSince < policy.minDaysBetweenRequests) {
        errors.push("TOO_SOON");
      }
    }

    return errors;
  }

  private formatErrors(errors: ValidationError[]): string {
    const messages: Record<ValidationError, string> = {
      EXCEEDS_MAX_PERCENT: "Jumlah melebihi batas maksimal yang diperbolehkan",
      MAX_ACTIVE_EXCEEDED: "Masih ada kasbon aktif yang belum selesai",
      TOO_SOON: "Belum memenuhi jarak waktu minimum antar pengajuan",
    };
    return errors.map((e) => messages[e]).join(". ");
  }

  private async emitDisbursedEvent(
    advance: SalaryAdvance,
    accountId?: string,
  ): Promise<void> {
    const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
    await eventBus.publish(EVENT_NAMES.SALARY_ADVANCE_DISBURSED, {
      advanceId: advance.id,
      tenantId: advance.tenantId,
      userId: advance.userId,
      amount: String(advance.amount),
      accountId,
      disbursedAt: advance.disbursedAt!.toISOString(),
    });
  }
}
