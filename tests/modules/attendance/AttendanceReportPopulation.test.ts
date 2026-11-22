import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import { AttendanceService } from "@/modules/attendance";

const mockFns = vi.hoisted(() => ({
  getStatsByDateRange: vi.fn(),
  getDailyStats: vi.fn(),
  getGroupedStats: vi.fn(),
  getTopEmployees: vi.fn(),
  getUserAttendanceStats: vi.fn(),
  getTopAbsentees: vi.fn(),
  getUserTotalDuration: vi.fn(),
  getUserAbsenceStats: vi.fn(),
  getUserLateStats: vi.fn(),
  findApprovedLeavePeriods: vi.fn(),
  getUserOvertimeStats: vi.fn(),
}));

vi.mock("@/modules/attendance/repositories/AttendanceRepository", () => ({
  AttendanceRepository: class MockAttendanceRepository {
    getStatsByDateRange = mockFns.getStatsByDateRange;
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
    findApprovedLeavePeriods = mockFns.findApprovedLeavePeriods;
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
    mockFns.findApprovedLeavePeriods.mockResolvedValue([]);

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

  // Regresi: kartu Alpha dulu dibaca dari AttendanceEvaluation, yang tidak
  // diisi alpha otomatis — angkanya tidak sama dengan tabel rekap.
  it("kartu alpha = jumlah alpha per pegawai di tabel rekap", async () => {
    const result = await service.getReportData(
      new Date("2026-03-01"),
      new Date("2026-03-31"),
    );

    const tableAlpha = result.employeeSummary.reduce(
      (total, item) => total + item.alpha,
      0,
    );
    expect(result.summary.alphaCount).toBe(3);
    expect(result.summary.alphaCount).toBe(tableAlpha);
  });

  it("ringkasan: hadir, tingkat kehadiran, persen terlambat & alpha", async () => {
    mockFns.getUserLateStats.mockResolvedValueOnce([
      { userId: "user-att", _count: { _all: 2 } },
    ]);

    const result = await service.getReportData(
      new Date("2026-03-01"),
      new Date("2026-03-31"),
    );

    // hadir 10, alpha 3 → hari wajib masuk 13
    expect(result.summary).toMatchObject({
      totalAttendance: 10,
      lateCount: 2,
      alphaCount: 3,
    });
    expect(result.summary.attendanceRate).toBeCloseTo((10 / 13) * 100);
    expect(result.summary.lateRate).toBeCloseTo((2 / 10) * 100);
    expect(result.summary.alphaRate).toBeCloseTo((3 / 13) * 100);
  });

  // Regresi: izin dulu dihitung per pengajuan; cuti 5 hari terbaca 1.
  it("izin dihitung per hari di dalam rentang laporan", async () => {
    mockFns.findApprovedLeavePeriods.mockResolvedValueOnce([
      // 28 Feb–4 Mar WIB: hanya 1–4 Maret yang masuk rentang → 4 hari
      {
        userId: "user-att",
        startDate: new Date("2026-02-27T17:00:00Z"),
        endDate: new Date("2026-03-03T17:00:00Z"),
      },
      // tumpang tindih 4 Maret: tetap dihitung sekali
      {
        userId: "user-att",
        startDate: new Date("2026-03-03T17:00:00Z"),
        endDate: new Date("2026-03-03T17:00:00Z"),
      },
    ]);

    const result = await service.getReportData(
      new Date("2026-02-28T17:00:00Z"),
      new Date("2026-03-31T16:59:59Z"),
      undefined,
      undefined,
      "Asia/Jakarta",
    );

    expect(
      result.employeeSummary.find((item) => item.userId === "user-att")?.izin,
    ).toBe(4);
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

  // Regresi: grafik per site/departemen dihitung tanpa lingkup, sehingga admin
  // ber-site_only melihat angka seluruh site.
  it("meneruskan lingkup site/departemen ke agregasi terkelompok", async () => {
    await service.getReportData(
      new Date("2026-03-01"),
      new Date("2026-03-31"),
      "site-1",
      "dept-1",
    );

    for (const groupBy of ["site", "department"]) {
      expect(mockFns.getGroupedStats).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        groupBy,
        undefined,
        { siteId: "site-1", departmentId: "dept-1" },
      );
    }
  });
});
