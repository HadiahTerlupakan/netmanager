import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockFns = vi.hoisted(() => ({
  runAttendanceCronOrchestrator: vi.fn(),
  acquireCronLock: vi.fn(),
}));

vi.mock("@/lib/cron-lock", () => ({
  acquireCronLock: mockFns.acquireCronLock,
  CRON_LOCK_UNAVAILABLE_MESSAGE:
    "Layanan cron sementara tidak tersedia. Coba lagi beberapa saat.",
}));

vi.mock(
  "@/modules/attendance/services/AttendanceCronOrchestratorService",
  () => ({
    runAttendanceCronOrchestrator: mockFns.runAttendanceCronOrchestrator,
  }),
);

import { GET } from "@/app/api/cron/attendance-orchestrator/route";

describe("attendance-orchestrator cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
  });

  it("rejects unauthorized request", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/cron/attendance-orchestrator"),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(mockFns.acquireCronLock).not.toHaveBeenCalled();
  });

  it("returns a skip response when orchestrator lock is already held", async () => {
    mockFns.acquireCronLock.mockResolvedValue("locked");

    const response = await GET(
      new NextRequest("http://localhost/api/cron/attendance-orchestrator", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.skipped).toBe(true);
    expect(json.data.reason).toBe("Lock already held");
    expect(mockFns.acquireCronLock).toHaveBeenCalledWith(
      "route:attendanceOrchestrator",
      14 * 60,
    );
    expect(mockFns.runAttendanceCronOrchestrator).not.toHaveBeenCalled();
  });

  it("runs orchestrator when lock is acquired", async () => {
    mockFns.acquireCronLock.mockResolvedValue("acquired");
    mockFns.runAttendanceCronOrchestrator.mockResolvedValue({
      jobs: [{ name: "attendance-alert:auto", result: { checked: 10 } }],
    });

    const response = await GET(
      new NextRequest("http://localhost/api/cron/attendance-orchestrator", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(mockFns.runAttendanceCronOrchestrator).toHaveBeenCalledOnce();
    expect(json.data.jobs).toEqual([
      { name: "attendance-alert:auto", result: { checked: 10 } },
    ]);
  });
});
