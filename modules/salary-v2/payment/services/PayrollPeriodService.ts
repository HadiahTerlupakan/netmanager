import type {
  IPayrollPeriodRepository,
  PayrollPeriod,
} from "@/modules/salary-v2/core";
import { PayrollError } from "@/modules/salary-v2/core";

export interface CreatePeriodInput {
  tenantId: string;
  scheduleId: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["PROCESSING"],
  PROCESSING: ["CLOSED", "OPEN"],
  CLOSED: ["LOCKED"],
  LOCKED: [],
};

export class PayrollPeriodService {
  constructor(private repo: IPayrollPeriodRepository) {}

  async getCurrent(
    scheduleId: string,
    tenantId: string,
  ): Promise<PayrollPeriod | null> {
    return this.repo.findCurrent(scheduleId, tenantId);
  }

  async getById(id: string, tenantId: string): Promise<PayrollPeriod | null> {
    return this.repo.findById(id, tenantId);
  }

  async createPeriod(input: CreatePeriodInput): Promise<PayrollPeriod> {
    const hasOverlap = await this.repo.checkOverlap(
      input.scheduleId,
      input.tenantId,
      input.periodStart,
      input.periodEnd,
    );

    if (hasOverlap) {
      throw new PayrollError(
        "PERIOD_OVERLAP",
        "Period overlaps with existing period",
      );
    }

    return this.repo.create({
      ...input,
      status: "OPEN",
      lockedAt: null,
      lockedBy: null,
      unlockReason: null,
      unlockCount: 0,
    });
  }

  async startProcessing(id: string, tenantId: string): Promise<PayrollPeriod> {
    const period = await this.requirePeriod(id, tenantId);
    this.validateTransition(period.status, "PROCESSING");
    return this.repo.updateStatus(id, tenantId, "PROCESSING");
  }

  async close(id: string, tenantId: string): Promise<PayrollPeriod> {
    const period = await this.requirePeriod(id, tenantId);
    this.validateTransition(period.status, "CLOSED");
    return this.repo.updateStatus(id, tenantId, "CLOSED");
  }

  async lock(
    id: string,
    tenantId: string,
    lockedBy: string,
  ): Promise<PayrollPeriod> {
    const period = await this.requirePeriod(id, tenantId);
    this.validateTransition(period.status, "LOCKED");
    return this.repo.update(id, tenantId, {
      status: "LOCKED",
      lockedAt: new Date(),
      lockedBy,
    });
  }

  async unlock(
    id: string,
    tenantId: string,
    reason: string,
  ): Promise<PayrollPeriod> {
    const period = await this.requirePeriod(id, tenantId);
    if (period.status !== "LOCKED") {
      throw PayrollError.invalidTransition(period.status, "CLOSED");
    }
    return this.repo.update(id, tenantId, {
      status: "CLOSED",
      lockedAt: null,
      lockedBy: null,
      unlockReason: reason,
      unlockCount: period.unlockCount + 1,
    });
  }

  private async requirePeriod(
    id: string,
    tenantId: string,
  ): Promise<PayrollPeriod> {
    const period = await this.repo.findById(id, tenantId);
    if (!period) throw PayrollError.notFound("period", id);
    return period;
  }

  private validateTransition(from: string, to: string): void {
    const allowed = VALID_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw PayrollError.invalidTransition(from, to);
    }
  }
}
