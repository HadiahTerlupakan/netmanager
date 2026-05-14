/**
 * OvertimeFactory
 *
 * Factory pattern for creating Overtime requests with different configurations.
 */

import type { OvertimeStatus } from "@prisma/client";

export interface CreateOvertimeInput {
  userId: string;
  reason: string;
  status: OvertimeStatus;
  isHolidayOvertime?: boolean;
  isNationalHoliday?: boolean;
  isOffDay?: boolean;
  holidayDescription?: string;
}

export class OvertimeFactory {
  /**
   * Create standard overtime request
   */
  static createStandardRequest(dto: {
    userId: string;
    reason: string;
  }): CreateOvertimeInput {
    return {
      userId: dto.userId,
      reason: dto.reason,
      status: "PENDING",
      isHolidayOvertime: false,
      isNationalHoliday: false,
      isOffDay: false,
    };
  }

  /**
   * Create holiday overtime request
   */
  static createHolidayRequest(dto: {
    userId: string;
    reason: string;
    holidayDescription: string;
    isNationalHoliday: boolean;
  }): CreateOvertimeInput {
    return {
      userId: dto.userId,
      reason: dto.reason,
      status: "PENDING",
      isHolidayOvertime: true,
      isNationalHoliday: dto.isNationalHoliday,
      isOffDay: false,
      holidayDescription: dto.holidayDescription,
    };
  }

  /**
   * Create off-day overtime request
   */
  static createOffDayRequest(dto: {
    userId: string;
    reason: string;
  }): CreateOvertimeInput {
    return {
      userId: dto.userId,
      reason: dto.reason,
      status: "PENDING",
      isHolidayOvertime: true,
      isNationalHoliday: false,
      isOffDay: true,
      holidayDescription: "Hari Libur Karyawan",
    };
  }

  /**
   * Calculate overtime duration in minutes
   */
  static calculateDuration(startTime: Date, endTime: Date): number {
    const durationMs = endTime.getTime() - startTime.getTime();
    return Math.max(0, Math.round(durationMs / 60000));
  }

  /**
   * Format duration for display
   */
  static formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) {
      return `${mins} menit`;
    }
    if (mins === 0) {
      return `${hours} jam`;
    }
    return `${hours} jam ${mins} menit`;
  }
}
