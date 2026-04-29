import { logger } from "@/lib/logger";
import type { LeaveType } from "@prisma/client";
import type { IHolidayRepository } from "../domain/ports/IHolidayRepository";
import type { ILeaveBalanceRepository } from "../domain/ports/ILeaveBalanceRepository";
import { LeaveBalanceRepository } from "../repositories/LeaveBalanceRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { calculateWorkingDays } from "../utils/calculateWorkingDays";

type LeaveBalanceInput = {
  userId: string;
  tenantId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  workDays: string | null;
  workingHourMode?: string | null;
};

export class LeaveBalanceUsageService {
  constructor(
    private readonly balanceRepository: ILeaveBalanceRepository &
      LeaveBalanceRepository,
    private readonly holidayRepository: IHolidayRepository & HolidayRepository,
  ) {}

  /** Hitung hari cuti yang mempengaruhi saldo leave. */
  async calculateLeaveDays(input: LeaveBalanceInput) {
    if (!this.shouldUseBalance(input)) return 0;
    return calculateWorkingDays(
      input.startDate,
      input.endDate,
      input.workDays,
      this.holidayRepository,
      input.tenantId,
    );
  }

  /** Validasi saldo leave cukup untuk jumlah hari tertentu. */
  async hasEnoughDays(input: LeaveBalanceInput, leaveDays: number) {
    if (leaveDays <= 0) return true;
    return this.balanceRepository.hasEnoughDays(
      input.userId,
      input.startDate.getFullYear(),
      input.type,
      leaveDays,
      input.tenantId,
    );
  }

  /** Tambahkan pemakaian saldo cuti jika jumlah hari valid. */
  async incrementUsed(input: LeaveBalanceInput, leaveDays: number) {
    if (leaveDays <= 0) return;
    try {
      await this.balanceRepository.incrementUsed(
        input.userId,
        input.startDate.getFullYear(),
        input.type,
        leaveDays,
        input.tenantId,
      );
    } catch (error) {
      logger.error(
        "Failed to update leave balance",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /** Kembalikan saldo cuti yang sebelumnya sudah dipakai. */
  async refundUsed(input: LeaveBalanceInput) {
    if (!this.shouldUseBalance(input)) return;
    try {
      const leaveDays = await this.calculateLeaveDays(input);
      await this.balanceRepository.decrementUsed(
        input.userId,
        input.startDate.getFullYear(),
        input.type,
        leaveDays,
        input.tenantId,
      );
    } catch (error) {
      logger.error(
        "Failed to refund leave balance",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /** Tentukan apakah jenis leave perlu mengubah saldo. */
  shouldUseBalance(input: Pick<LeaveBalanceInput, "workingHourMode" | "type">) {
    return input.workingHourMode !== "FLEXIBLE" && input.type !== "TUKAR_LIBUR";
  }
}
