import type { PayrollPeriod } from "../entities/PayrollPeriod";
import type { PayrollPeriodStatus } from "../enums";

export interface PeriodFilter {
  tenantId: string;
  scheduleId?: string;
  status?: PayrollPeriodStatus;
  fromDate?: Date;
  toDate?: Date;
}

export interface IPayrollPeriodRepository {
  findById(id: string, tenantId: string): Promise<PayrollPeriod | null>;
  findCurrent(
    scheduleId: string,
    tenantId: string,
  ): Promise<PayrollPeriod | null>;
  /**
   * Cari periode yang covers tanggal tertentu (untuk guard locking).
   * Mengembalikan periode pertama yang cocok di tenant; null kalau tidak ada.
   */
  findContainingDate(
    tenantId: string,
    date: Date,
  ): Promise<PayrollPeriod | null>;
  findAll(filter: PeriodFilter): Promise<PayrollPeriod[]>;
  create(
    data: Omit<PayrollPeriod, "id" | "createdAt" | "updatedAt">,
  ): Promise<PayrollPeriod>;
  update(
    id: string,
    tenantId: string,
    data: Partial<PayrollPeriod>,
  ): Promise<PayrollPeriod>;
  updateStatus(
    id: string,
    tenantId: string,
    status: PayrollPeriodStatus,
  ): Promise<PayrollPeriod>;
  checkOverlap(
    scheduleId: string,
    tenantId: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ): Promise<boolean>;
}
