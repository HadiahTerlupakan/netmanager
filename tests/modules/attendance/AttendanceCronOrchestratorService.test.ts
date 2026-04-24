import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  runScheduledAttendanceCheck: vi.fn(),
  processIncompleteAttendance: vi.fn(),
  runAutoCheckout: vi.fn(),
  processDailyAbsence: vi.fn(),
  tenantFindMany: vi.fn(),
}));

vi.mock("@/modules/attendance/services/AttendanceAlertService", () => ({
  runScheduledAttendanceCheck: mockFns.runScheduledAttendanceCheck,
  processIncompleteAttendance: mockFns.processIncompleteAttendance,
}));

vi.mock("@/modules/attendance/services/AutoCheckoutService", () => ({
  AutoCheckoutService: {
    runAutoCheckout: mockFns.runAutoCheckout,
  },
}));

vi.mock("@/modules/attendance/services/AbsenceService", () => ({
  AbsenceService: class MockAbsenceService {
    processDailyAbsence = mockFns.processDailyAbsence;
  },
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    tenant: {
      findMany: mockFns.tenantFindMany,
    },
  },
}));

describe("AttendanceCronOrchestratorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.runScheduledAttendanceCheck.mockResolvedValue({ checked: 10 });
    mockFns.processIncompleteAttendance.mockResolvedValue({ processed: 3 });
    mockFns.runAutoCheckout.mockResolvedValue(2);
    mockFns.processDailyAbsence.mockResolvedValue({ processed: 4, absent: 1 });
    mockFns.tenantFindMany.mockResolvedValue([{ id: "tenant-1" }]);
  });

  it("returns auto-checkout on every orchestrator tick", async () => {
    const { getDueAttendanceCronJobs } =
      await import("@/modules/attendance/services/AttendanceCronOrchestratorService");

    expect(getDueAttendanceCronJobs(new Date("2026-04-21T10:01:00"))).toEqual([
      "auto-checkout",
    ]);
    expect(getDueAttendanceCronJobs(new Date("2026-04-21T10:15:00"))).toEqual([
      "attendance-alert:auto",
      "auto-checkout",
    ]);
  });

  it("runs process-incomplete job at 22:00 alongside auto attendance check and auto-checkout", async () => {
    const { runAttendanceCronOrchestrator } =
      await import("@/modules/attendance/services/AttendanceCronOrchestratorService");

    const result = await runAttendanceCronOrchestrator({
      now: new Date("2026-04-21T22:00:00"),
    });

    expect(mockFns.runScheduledAttendanceCheck).toHaveBeenCalledOnce();
    expect(mockFns.processIncompleteAttendance).toHaveBeenCalledOnce();
    expect(mockFns.runAutoCheckout).toHaveBeenCalledOnce();
    expect(mockFns.processDailyAbsence).not.toHaveBeenCalled();
    expect(result.jobs.map((job: { name: string }) => job.name)).toEqual([
      "attendance-alert:auto",
      "attendance-alert:process",
      "auto-checkout",
    ]);
  });

  it("runs process-absence for every active tenant at 01:00 alongside auto-checkout", async () => {
    const { runAttendanceCronOrchestrator } =
      await import("@/modules/attendance/services/AttendanceCronOrchestratorService");

    const result = await runAttendanceCronOrchestrator({
      now: new Date("2026-04-21T01:00:00"),
    });

    expect(mockFns.tenantFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true },
    });
    expect(mockFns.processDailyAbsence).toHaveBeenCalledWith(
      new Date("2026-04-20T01:00:00"),
      "tenant-1",
    );
    expect(mockFns.runAutoCheckout).toHaveBeenCalledOnce();
    expect(result.jobs.map((job: { name: string }) => job.name)).toEqual([
      "attendance-alert:auto",
      "process-absence",
      "auto-checkout",
    ]);
  });
});
