import { NextRequest, NextResponse } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  syncApprovedLeaveToAttendanceRange: vi.fn(),
  syncDayOffAttendanceRange: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiPaginatedWithSummary: (data: unknown, meta: unknown) =>
    NextResponse.json({ success: true, data, ...((meta as object) || {}) }),
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/auth", () => ({
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

describe("admin attendance status detail filter", () => {
  let getAdminAttendance: (typeof import("@/app/api/admin/attendance/route"))["GET"];

  beforeAll(async () => {
    vi.useRealTimers();
    ({ GET: getAdminAttendance } =
      await import("@/app/api/admin/attendance/route"));
  });

  beforeEach(() => {
    mockFns.syncApprovedLeaveToAttendanceRange.mockReset();
    mockFns.syncDayOffAttendanceRange.mockReset();
    mockFns.syncApprovedLeaveToAttendanceRange.mockResolvedValue(undefined);
    mockFns.syncDayOffAttendanceRange.mockResolvedValue(undefined);
    prismaMock.attendance.findMany.mockResolvedValue([]);
    prismaMock.attendance.count.mockResolvedValue(0);
    prismaMock.attendance.groupBy.mockResolvedValue([]);
    prismaMock.attendanceEvaluation.findMany.mockResolvedValue([]);
  });

  it("uses canonical evaluation for CUTI filter even when raw attendance notes do not contain leave markers", async () => {
    prismaMock.attendance.findMany.mockResolvedValue([
      {
        id: "attendance-cuti-canonical",
        tenantId: "tenant-1",
        userId: "user-1",
        checkIn: new Date("2026-04-01T00:00:00.000Z"),
        checkOut: null,
        status: "ON_TIME",
        notes: "Hadir normal",
        user: {
          name: "Canonical Cuti",
          email: "cuti@example.com",
          image: null,
          workingHourMode: "FIXED",
          workDays: ["MONDAY"],
          departments: { name: "Ops" },
          sites: { name: "HQ" },
        },
      },
    ]);
    prismaMock.attendanceEvaluation.findMany.mockResolvedValue([
      {
        tenantId: "tenant-1",
        userId: "user-1",
        workDate: new Date("2026-04-01T00:00:00.000Z"),
        finalStatus: "PERMIT",
        reviewState: "FINAL",
        leaveState: "CUTI",
        holidayState: null,
        payrollHoldState: "NONE",
        evidenceQuality: "weak-missing-site-config",
        reasonCodes: ["WEAK_GEOFENCE_EVIDENCE"],
        anomalyCodes: ["ATTENDANCE_ACCEPTED_WITHOUT_USABLE_SITE_CONFIG"],
      },
    ]);

    const response = await getAdminAttendance(
      new NextRequest(
        "http://localhost/api/admin/attendance?page=1&limit=20&statusDetail=CUTI&startDate=2026-04-01&endDate=2026-04-30",
      ),
      { session: { user: { id: "admin-1", tenantId: "tenant-1" } } } as never,
    );

    const json = await response.json();
    expect(prismaMock.attendanceEvaluation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          evidenceQuality: true,
          reasonCodes: true,
          anomalyCodes: true,
        }),
      }),
    );
    expect(json.data).toHaveLength(1);
    expect(json.data[0].canonical.evidenceQuality).toBe(
      "weak-missing-site-config",
    );
    expect(json.data[0].canonical.reasonCodes).toContain(
      "WEAK_GEOFENCE_EVIDENCE",
    );
  });

  it("uses canonical evaluation for HARI_LIBUR filter even when raw attendance status is still ON_TIME", async () => {
    prismaMock.attendance.findMany.mockResolvedValue([
      {
        id: "attendance-holiday-canonical",
        tenantId: "tenant-1",
        userId: "user-2",
        checkIn: new Date("2026-04-02T00:00:00.000Z"),
        checkOut: null,
        status: "ON_TIME",
        notes: "Hadir normal",
        user: {
          name: "Canonical Holiday",
          email: "holiday@example.com",
          image: null,
          workingHourMode: "FIXED",
          workDays: ["MONDAY"],
          departments: { name: "Ops" },
          sites: { name: "HQ" },
        },
      },
    ]);
    prismaMock.attendanceEvaluation.findMany.mockResolvedValue([
      {
        tenantId: "tenant-1",
        userId: "user-2",
        workDate: new Date("2026-04-02T00:00:00.000Z"),
        finalStatus: "DAY_OFF",
        reviewState: "FINAL",
        leaveState: null,
        holidayState: "LIBUR_NASIONAL",
        payrollHoldState: "NONE",
      },
    ]);

    const response = await getAdminAttendance(
      new NextRequest(
        "http://localhost/api/admin/attendance?page=1&limit=20&statusDetail=HARI_LIBUR&startDate=2026-04-01&endDate=2026-04-30",
      ),
      { session: { user: { id: "admin-1", tenantId: "tenant-1" } } } as never,
    );

    const json = await response.json();
    expect(prismaMock.attendanceEvaluation.findMany).toHaveBeenCalled();
    expect(json.data).toHaveLength(1);
  });

  it("maps ABSENT filter to true absence rows and excludes historical auto-checkout rows", async () => {
    await getAdminAttendance(
      new NextRequest(
        "http://localhost/api/admin/attendance?page=1&limit=20&statusDetail=ABSENT&startDate=2026-04-01&endDate=2026-04-30",
      ),
      { session: { user: { id: "admin-1", tenantId: "tenant-1" } } } as never,
    );

    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ status: { in: ["ALPHA", "ABSENT"] } }),
            expect.objectContaining({
              NOT: expect.objectContaining({
                AND: expect.arrayContaining([
                  expect.objectContaining({
                    status: { in: ["ALPHA", "ABSENT"] },
                  }),
                  expect.objectContaining({ checkOut: { not: null } }),
                ]),
              }),
            }),
          ]),
        }),
      }),
    );
  });

  it("maps NO_CHECKOUT filter to real NO_CHECKOUT rows plus historical auto-checkout rows", async () => {
    await getAdminAttendance(
      new NextRequest(
        "http://localhost/api/admin/attendance?page=1&limit=20&statusDetail=NO_CHECKOUT&startDate=2026-04-01&endDate=2026-04-30",
      ),
      { session: { user: { id: "admin-1", tenantId: "tenant-1" } } } as never,
    );

    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { status: "NO_CHECKOUT" },
            expect.objectContaining({
              AND: expect.arrayContaining([
                expect.objectContaining({
                  status: { in: ["ALPHA", "ABSENT"] },
                }),
                expect.objectContaining({ checkOut: { not: null } }),
              ]),
            }),
          ]),
        }),
      }),
    );
  });
});
