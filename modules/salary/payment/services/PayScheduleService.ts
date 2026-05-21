import type {
  IPayScheduleRepository,
  PaySchedule,
} from "@/modules/salary/core";

export interface CreateScheduleInput {
  tenantId: string;
  name: string;
  frequency: PaySchedule["frequency"];
  cutOffDay: number | null;
  cutOffDayOfWeek: number | null;
  payDay: number;
  payDayOffset: number | null;
  gracePeriodDays: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface PeriodDates {
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
}

/**
 * Service for managing pay schedules and generating period dates.
 */
export class PayScheduleService {
  constructor(private repo: IPayScheduleRepository) {}

  /** Get a schedule by ID within a tenant */
  async getById(id: string, tenantId: string): Promise<PaySchedule | null> {
    return this.repo.findById(id, tenantId);
  }

  /** Get the default schedule for a tenant */
  async getDefault(tenantId: string): Promise<PaySchedule | null> {
    return this.repo.findDefault(tenantId);
  }

  /** List all schedules for a tenant */
  async listAll(tenantId: string): Promise<PaySchedule[]> {
    return this.repo.findAll(tenantId);
  }

  /** Create a new pay schedule */
  async create(input: CreateScheduleInput): Promise<PaySchedule> {
    return this.repo.create(input);
  }

  /** Update an existing pay schedule */
  async update(
    id: string,
    tenantId: string,
    data: Partial<PaySchedule>,
  ): Promise<PaySchedule> {
    return this.repo.update(id, tenantId, data);
  }

  /** Delete a pay schedule */
  async delete(id: string, tenantId: string): Promise<void> {
    return this.repo.delete(id, tenantId);
  }

  /**
   * Generate period start, end, and pay dates for a given schedule, year, and month.
   * For MONTHLY frequency: period runs from (cutOffDay+1 of prev month) to (cutOffDay of current month).
   */
  generatePeriodDates(
    schedule: PaySchedule,
    year: number,
    month: number,
  ): PeriodDates {
    const cutOffDay = schedule.cutOffDay ?? 25;

    const periodEnd = new Date(year, month - 1, cutOffDay);
    const periodStart = new Date(year, month - 2, cutOffDay + 1);
    const payDate = new Date(year, month - 1, schedule.payDay);

    return { periodStart, periodEnd, payDate };
  }
}
