/**
 * Overtime DTOs (Data Transfer Objects)
 */

import type { OvertimeStatusValue } from "../domain/entities/OvertimeEntity";

// ==================== Response DTOs ====================

/**
 * DTO for overtime list views
 */
export interface OvertimeListItemDTO {
  id: string;
  employeeName: string | null;
  employeeEmail: string;
  reason: string;
  startTime: string | null;
  endTime: string | null;
  duration: number | null;
  status: OvertimeStatusValue;
  isHolidayOvertime: boolean;
  createdAt: string;
}

/**
 * DTO for overtime detail views
 */
export interface OvertimeDetailDTO {
  id: string;
  reason: string;
  startTime: string | null;
  endTime: string | null;
  startPhoto: string | null;
  startLocation: string | null;
  endPhoto: string | null;
  endLocation: string | null;
  duration: number | null;
  status: OvertimeStatusValue;
  rejectionReason: string | null;
  isHolidayOvertime: boolean;
  isNationalHoliday: boolean;
  isOffDay: boolean;
  holidayDescription: string | null;
  createdAt: string;
  updatedAt: string;
  employee: {
    id: string;
    name: string | null;
    email: string;
  };
  approvedBy: {
    id: string;
    name: string | null;
  } | null;
}

/**
 * DTO for overtime summary (dashboard)
 */
export interface OvertimeSummaryDTO {
  totalRequests: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalHours: number;
  holidayOvertimeCount: number;
}

// ==================== Request DTOs ====================

/**
 * DTO for creating overtime request
 */
export interface CreateOvertimeDTO {
  reason: string;
  startTime?: string;
  startPhoto?: string;
  startLocation?: string;
}

/**
 * DTO for ending overtime
 */
export interface EndOvertimeDTO {
  endPhoto?: string;
  endLocation?: string;
}

/**
 * DTO for approving/rejecting overtime
 */
export interface UpdateOvertimeStatusDTO {
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}
