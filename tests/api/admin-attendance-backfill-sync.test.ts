import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  syncApprovedLeaveToAttendanceRange: vi.fn(),
  syncDayOffAttendanceRange: vi.fn(),
  recomputeHistoricalAttendanceEvaluations: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiPaginatedWithSummary: (data: unknown, meta: unknown) =>
    NextResponse.json({ success: true, data, ...((meta as object) || {}) }),
  apiSuccess: (
    data: unknown,
    options?: { status?: number; message?: string },
  ) =>
    NextResponse.json(
      {
        success: true,
        data,
        ...(options?.message ? { message: options.message } : {}),
      },
      { status: options?.status ?? 200 },
    ),
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: vi.fn().mockResolvedValue([]),
  isSuperAdmin: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/utils/get-timezone", () => ({
  getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
}));

vi.mock("@/modules/attendance/services/LeaveService", () => ({
  LeaveService: class MockLeaveService {
    syncApprovedLeaveToAttendanceRange =
      mockFns.syncApprovedLeaveToAttendanceRange;
  },
}));

vi.mock("@/modules/attendance/services/AbsenceService", () => ({
  AbsenceService: class MockAbsenceService {
    syncDayOffAttendanceRange = mockFns.syncDayOffAttendanceRange;
  },
}));

vi.mock("@/modules/attendance", async () => {
  const actual = await vi.importActual<typeof import("@/modules/attendance")>(
    "@/modules/attendance",
  );
  return {
    ...actual,
    AttendanceService: class MockAttendanceService {
      recomputeHistoricalAttendanceEvaluations =
        mockFns.recomputeHistoricalAttendanceEvaluations;
    },
  };
});

describe("admin attendance route historical status backfill", () => {
  beforeEach(() => {
    mockFns.syncApprovedLeaveToAttendanceRange.mockReset();
    mockFns.syncDayOffAttendanceRange.mockReset();
    mockFns.recomputeHistoricalAttendanceEvaluations.mockReset();
    mockFns.syncApprovedLeaveToAttendanceRange.mockResolvedValue(undefined);
    mockFns.syncDayOffAttendanceRange.mockResolvedValue(undefined);
    mockFns.recomputeHistoricalAttendanceEvaluations.mockResolvedValue({
      processedCount: 2,
      evaluations: [
        {
          workDate: new Date("2026-03-08T00:00:00.000Z"),
          finalStatus: "PERMIT",
        },
        { workDate: new Date("2026-03-09T00:00:00.000Z"), finalStatus: "LATE" },
      ],
    });

    prismaMock.attendance.findMany.mockResolvedValue([]);
    prismaMock.attendance.count.mockResolvedValue(0);
    prismaMock.attendance.groupBy.mockResolvedValue([]);
  });

  it("does not sync leave/day-off on read path (sync is event-driven, not sync-on-read)", async () => {
    const { GET } = await import("@/app/api/admin/attendance/route");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/attendance?page=1&limit=20&startDate=2026-03-01&endDate=2026-03-31",
      ),
      {
        session: {
          user: {
            id: "admin-1",
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    expect(response.status).toBe(200);
    expect(mockFns.syncApprovedLeaveToAttendanceRange).not.toHaveBeenCalled();
    expect(mockFns.syncDayOffAttendanceRange).not.toHaveBeenCalled();
  });

  it("recomputes canonical attendance evaluations for the requested historical range through admin route", async () => {
    const { POST } = await import("@/app/api/admin/attendance/recompute/route");

    const response = await POST(
      new NextRequest("http://localhost/api/admin/attendance/recompute", {
        method: "POST",
        body: JSON.stringify({
          userId: "user-1",
          startDate: "2026-03-08",
          endDate: "2026-03-09",
        }),
      }),
      {
        session: {
          user: {
            id: "admin-1",
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    expect(response.status).toBe(200);
    expect(
      mockFns.recomputeHistoricalAttendanceEvaluations,
    ).toHaveBeenCalledWith({
      userId: "user-1",
      tenantId: "tenant-1",
      startDate: new Date("2026-03-07T17:00:00.000Z"),
      endDate: new Date("2026-03-09T16:59:59.999Z"),
      actorId: "admin-1",
    });

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        processedCount: 2,
      },
    });
  });
});
