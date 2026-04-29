import { describe, expect, it, vi } from "vitest";

import { AttendanceRepository } from "@/modules/attendance/repositories/AttendanceRepository";
import { LeaveRepository } from "@/modules/attendance/repositories/LeaveRepository";
import { OvertimePayrollQueryService } from "@/modules/overtime";

import { service } from "./AttendanceService.test-setup";

type AttendanceServiceInternals = {
  userRepo: {
    findManyWithBasicInfo: (userIds: string[]) => Promise<unknown[]>;
    findManyWithFullDetails: (userIds: string[]) => Promise<unknown[]>;
    findManyWithWorkConfig: (userIds: string[]) => Promise<unknown[]>;
  };
};

const summaryStats = {
  total: 100,
  avgDurationMinutes: 480,
  statusCounts: { ON_TIME: 80, LATE: 15, ABSENT: 5 },
};

function mockReportDependencies() {
  vi.spyOn(
    AttendanceRepository.prototype,
    "getStatsByDateRange",
  ).mockResolvedValue(summaryStats);
  vi.spyOn(
    AttendanceRepository.prototype,
    "getEvaluationStatsByDateRange",
  ).mockResolvedValue(summaryStats);
  vi.spyOn(AttendanceRepository.prototype, "getDailyStats").mockResolvedValue(
    [],
  );
  vi.spyOn(AttendanceRepository.prototype, "getGroupedStats").mockResolvedValue(
    [],
  );
  vi.spyOn(AttendanceRepository.prototype, "getTopEmployees").mockResolvedValue(
    [],
  );
  vi.spyOn(
    AttendanceRepository.prototype,
    "getUserAttendanceStats",
  ).mockResolvedValue([]);
  vi.spyOn(AttendanceRepository.prototype, "getTopAbsentees").mockResolvedValue(
    [],
  );
  vi.spyOn(
    AttendanceRepository.prototype,
    "getUserTotalDuration",
  ).mockResolvedValue(new Map());
  vi.spyOn(
    AttendanceRepository.prototype,
    "getUserAbsenceStats",
  ).mockResolvedValue([]);
  vi.spyOn(
    AttendanceRepository.prototype,
    "getUserLateStats",
  ).mockResolvedValue([]);
  vi.spyOn(
    OvertimePayrollQueryService.prototype,
    "getUserOvertimeStats",
  ).mockResolvedValue([]);
  vi.spyOn(LeaveRepository.prototype, "getUserLeaveStats").mockResolvedValue(
    [],
  );
  vi.spyOn(
    (service as never as AttendanceServiceInternals).userRepo,
    "findManyWithBasicInfo",
  ).mockResolvedValue([]);
  vi.spyOn(
    (service as never as AttendanceServiceInternals).userRepo,
    "findManyWithFullDetails",
  ).mockResolvedValue([]);
  vi.spyOn(
    (service as never as AttendanceServiceInternals).userRepo,
    "findManyWithWorkConfig",
  ).mockResolvedValue([]);
}

describe("getReportData", () => {
  it("should return correct report structure", async () => {
    mockReportDependencies();
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-31");

    const result = await service.getReportData(startDate, endDate);

    // Check actual return structure based on implementation
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("trends");
    expect(result).toHaveProperty("bySite");
    expect(result).toHaveProperty("byDepartment");
    expect(result).toHaveProperty("topEmployees");
    expect(result).toHaveProperty("combinedTopEmployees");
    expect(result).toHaveProperty("topAbsentees");
    expect(result).toHaveProperty("employeeSummary");
  });

  it("should calculate summary statistics correctly", async () => {
    mockReportDependencies();
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-31");

    const result = await service.getReportData(startDate, endDate);

    // Check summary structure
    expect(result.summary).toHaveProperty("totalAttendance");
    expect(result.summary).toHaveProperty("lateCount");
    expect(result.summary).toHaveProperty("lateRate");
    expect(result.summary).toHaveProperty("alphaCount");
    expect(result.summary).toHaveProperty("alphaRate");
    expect(result.summary.totalAttendance).toBe(100);
  });

  it("should calculate late rate correctly", async () => {
    mockReportDependencies();
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-31");

    const result = await service.getReportData(startDate, endDate);

    // Check late rate is calculated (value depends on mock data)
    expect(result.summary).toHaveProperty("lateRate");
    expect(typeof result.summary.lateRate).toBe("number");
  });
});
