import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import { AttendanceService } from "@/modules/attendance/services/AttendanceService";

const mockFns = vi.hoisted(() => ({
  getStatsByDateRange: vi.fn(),
  getEvaluationStatsByDateRange: vi.fn(),
  getDailyStats: vi.fn(),
  getGroupedStats: vi.fn(),
  getTopEmployees: vi.fn(),
  getUserAttendanceStats: vi.fn(),
  getTopAbsentees: vi.fn(),
  getUserTotalDuration: vi.fn(),
  getUserAbsenceStats: vi.fn(),
  getUserLateStats: vi.fn(),
  getUserLeaveStats: vi.fn(),
  getUserOvertimeStats: vi.fn(),
}));

vi.mock("@/modules/attendance/repositories/AttendanceRepository", () => ({
  AttendanceRepository: class MockAttendanceRepository {
    getStatsByDateRange = mockFns.getStatsByDateRange;
    getEvaluationStatsByDateRange = mockFns.getEvaluationStatsByDateRange;
    getDailyStats = mockFns.getDailyStats;
    getGroupedStats = mockFns.getGroupedStats;
    getTopEmployees = mockFns.getTopEmployees;
    getUserAttendanceStats = mockFns.getUserAttendanceStats;
    getTopAbsentees = mockFns.getTopAbsentees;
    getUserTotalDuration = mockFns.getUserTotalDuration;
    getUserAbsenceStats = mockFns.getUserAbsenceStats;
    getUserLateStats = mockFns.getUserLateStats;
  },
}));

vi.mock("@/modules/attendance/repositories/LeaveRepository", () => ({
  LeaveRepository: class MockLeaveRepository {
    getUserLeaveStats = mockFns.getUserLeaveStats;
  },
}));

vi.mock("@/modules/overtime/repositories/OvertimeRepository", () => ({
  OvertimeRepository: class MockOvertimeRepository {
    getUserOvertimeStats = mockFns.getUserOvertimeStats;
  },
}));

describe("AttendanceService report population parity", () => {
  let service: AttendanceService;

  beforeEach(() => {
    service = new AttendanceService();

    mockFns.getStatsByDateRange.mockResolvedValue({
      total: 14,
      avgDurationMinutes: 480,
      statusCounts: {
        ON_TIME: 8,
        LATE: 2,
        ALPHA: 1,
        ABSENT: 3,
      },
    });
    mockFns.getEvaluationStatsByDateRange.mockResolvedValue({
      total: 14,
      avgDurationMinutes: 480,
      statusCounts: {
        ON_TIME: 8,
        LATE: 2,
        ABSENT: 3,
        PERMIT: 1,
      },
    });
    mockFns.getDailyStats.mockResolvedValue([]);
    mockFns.getGroupedStats.mockResolvedValue([]);
    mockFns.getTopEmployees.mockResolvedValue([]);
    mockFns.getUserAttendanceStats.mockResolvedValue([
      { userId: "user-att", _count: { _all: 10 } },
    ]);
    mockFns.getUserOvertimeStats.mockResolvedValue([]);
    mockFns.getTopAbsentees.mockResolvedValue([
      { user: { id: "user-abs", name: "Abs Only" }, count: 3 },
    ]);
    mockFns.getUserTotalDuration.mockResolvedValue(
      new Map([["user-att", 600]]),
    );
    mockFns.getUserAbsenceStats.mockResolvedValue([
      { userId: "user-abs", _count: { _all: 3 } },
    ]);
    mockFns.getUserLateStats.mockResolvedValue([]);
    mockFns.getUserLeaveStats.mockResolvedValue([]);

    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-att",
        name: "Attendance User",
        image: null,
        sites: { id: "site-1", name: "HQ" },
        departments: { id: "dept-1", name: "Ops" },
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        flexibleTargetHour: null,
        shift: null,
      },
      {
        id: "user-abs",
        name: "Abs Only",
        image: null,
        sites: { id: "site-1", name: "HQ" },
        departments: { id: "dept-1", name: "Ops" },
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        flexibleTargetHour: null,
        shift: null,
      },
    ] as never);
  });

  it("derives alphaCount from canonical evaluation summary instead of raw attendance rows", async () => {
    const result = await service.getReportData(
      new Date("2026-03-01"),
      new Date("2026-03-31"),
    );

    expect(result.summary.alphaCount).toBe(3);
  });

  it("keeps absence-only users in employeeSummary when absence stats include them", async () => {
    const result = await service.getReportData(
      new Date("2026-03-01"),
      new Date("2026-03-31"),
    );

    expect(result.employeeSummary.map((item) => item.userId)).toContain(
      "user-abs",
    );
    expect(
      result.employeeSummary.find((item) => item.userId === "user-abs"),
    ).toMatchObject({
      hadir: 0,
      alpha: 3,
    });
  });

  it("derives alphaCount from canonical evaluation stats instead of raw attendance status counts", async () => {
    mockFns.getStatsByDateRange.mockResolvedValueOnce({
      total: 14,
      avgDurationMinutes: 480,
      statusCounts: {
        ON_TIME: 8,
        LATE: 2,
        ALPHA: 4,
      },
    });
    mockFns.getEvaluationStatsByDateRange.mockResolvedValueOnce({
      total: 14,
      avgDurationMinutes: 480,
      statusCounts: {
        ON_TIME: 8,
        LATE: 2,
        ABSENT: 1,
        PERMIT: 3,
      },
    });

    const result = await service.getReportData(
      new Date("2026-03-01"),
      new Date("2026-03-31"),
    );

    expect(result.summary.alphaCount).toBe(1);
  });
});
