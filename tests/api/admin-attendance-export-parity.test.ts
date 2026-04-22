import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";
import { getCrossSurfaceAttendanceFixture } from "../fixtures/attendance/crossSurfaceAttendanceFixtures";

const mockFns = vi.hoisted(() => ({
  syncApprovedLeaveToAttendanceRange: vi.fn(),
  syncDayOffAttendanceRange: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
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

import { GET } from "@/app/api/admin/attendance/route";

describe("admin attendance export parity", () => {
  beforeEach(() => {
    mockFns.syncApprovedLeaveToAttendanceRange.mockReset();
    mockFns.syncDayOffAttendanceRange.mockReset();
    mockFns.syncApprovedLeaveToAttendanceRange.mockResolvedValue(undefined);
    mockFns.syncDayOffAttendanceRange.mockResolvedValue(undefined);
    prismaMock.attendance.findMany.mockResolvedValue([]);
    prismaMock.attendanceEvaluation.findMany.mockResolvedValue([]);
  });

  it("exports current labels for the shared attendance fixtures", async () => {
    const noCheckoutFixture = getCrossSurfaceAttendanceFixture(
      "no-checkout-system-closure",
    );
    const warnFixture = getCrossSurfaceAttendanceFixture(
      "outside-geofence-warn-accepted",
    );

    expect(noCheckoutFixture).toBeDefined();
    expect(warnFixture).toBeDefined();

    prismaMock.attendance.findMany.mockResolvedValue([
      {
        id: "attendance-no-checkout",
        tenantId: "tenant-1",
        userId: "user-1",
        checkIn: new Date(noCheckoutFixture!.attendance.checkIn),
        checkOut: noCheckoutFixture!.attendance.checkOut
          ? new Date(noCheckoutFixture!.attendance.checkOut)
          : null,
        status: noCheckoutFixture!.attendance.status,
        notes: noCheckoutFixture!.attendance.notes ?? null,
        user: {
          name: "No Checkout User",
          email: "nocheckout@example.com",
          image: null,
          workingHourMode: "FIXED",
          workDays: ["MONDAY"],
          departments: { name: "Ops" },
          sites: { name: "HQ" },
        },
      },
      {
        id: "attendance-historical-auto-checkout",
        tenantId: "tenant-1",
        userId: "user-3",
        checkIn: new Date("2026-03-27T06:37:00.000Z"),
        checkOut: new Date("2026-03-27T16:59:59.000Z"),
        status: "ABSENT",
        notes: "Auto checkout by system (Mangkir)",
        user: {
          name: "Historical No Checkout",
          email: "history@example.com",
          image: null,
          workingHourMode: "FIXED",
          workDays: ["MONDAY"],
          departments: { name: "Ops" },
          sites: { name: "HQ" },
        },
      },
      {
        id: "attendance-holiday-dayoff",
        tenantId: "tenant-1",
        userId: "user-4",
        checkIn: new Date("2026-03-29T00:00:00.000Z"),
        checkOut: null,
        status: "DAY_OFF",
        notes: "Hari Libur (Day Off) - Auto Generated",
        user: {
          name: "Holiday Day Off",
          email: "holiday@example.com",
          image: null,
          workingHourMode: "FIXED",
          workDays: ["MONDAY"],
          departments: { name: "Ops" },
          sites: { name: "HQ" },
        },
      },
      {
        id: "attendance-offday",
        tenantId: "tenant-1",
        userId: "user-5",
        checkIn: new Date("2026-03-30T00:00:00.000Z"),
        checkOut: null,
        status: "DAY_OFF",
        notes: "Hari Off (Day Off) - Auto Generated",
        user: {
          name: "Regular Off Day",
          email: "offday@example.com",
          image: null,
          workingHourMode: "FIXED",
          workDays: ["MONDAY"],
          departments: { name: "Ops" },
          sites: { name: "HQ" },
        },
      },
      {
        id: "attendance-tukar-libur",
        tenantId: "tenant-1",
        userId: "user-6",
        checkIn: new Date("2026-03-31T00:00:00.000Z"),
        checkOut: null,
        status: "DAY_OFF",
        notes: "Auto-generated from Leave Request",
        user: {
          name: "Tukar Libur User",
          email: "tukar@example.com",
          image: null,
          workingHourMode: "FIXED",
          workDays: ["MONDAY"],
          departments: { name: "Ops" },
          sites: { name: "HQ" },
        },
      },
      {
        id: "attendance-cuti",
        tenantId: "tenant-1",
        userId: "user-7",
        checkIn: new Date("2026-04-01T00:00:00.000Z"),
        checkOut: null,
        status: "PERMIT",
        notes: "Auto-generated from Leave Request (CUTI)",
        user: {
          name: "Cuti User",
          email: "cuti@example.com",
          image: null,
          workingHourMode: "FIXED",
          workDays: ["MONDAY"],
          departments: { name: "Ops" },
          sites: { name: "HQ" },
        },
      },
      {
        id: "attendance-izin",
        tenantId: "tenant-1",
        userId: "user-8",
        checkIn: new Date("2026-04-02T00:00:00.000Z"),
        checkOut: null,
        status: "PERMIT",
        notes: "Auto-generated from Leave Request (IZIN)",
        user: {
          name: "Izin User",
          email: "izin@example.com",
          image: null,
          workingHourMode: "FIXED",
          workDays: ["MONDAY"],
          departments: { name: "Ops" },
          sites: { name: "HQ" },
        },
      },
      {
        id: "attendance-warn",
        tenantId: "tenant-1",
        userId: "user-2",
        checkIn: new Date(warnFixture!.attendance.checkIn),
        checkOut: warnFixture!.attendance.checkOut
          ? new Date(warnFixture!.attendance.checkOut)
          : null,
        status: warnFixture!.attendance.status,
        notes: warnFixture!.attendance.notes ?? null,
        user: {
          name: "Warn User",
          email: "warn@example.com",
          image: null,
          workingHourMode: "FIXED",
          workDays: ["MONDAY"],
          departments: { name: "Ops" },
          sites: { name: "HQ" },
        },
      },
    ]);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/attendance?export=true&page=1&limit=20",
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
    expect(response.headers.get("Content-Type")).toContain("text/csv");

    const csv = await response.text();
    expect(csv).toContain(noCheckoutFixture!.expected.adminExportLabel);
    expect(csv).toContain(warnFixture!.expected.adminExportLabel);
    expect(csv).toContain("TIDAK CHECKOUT");
    expect(csv).toContain("LIBUR NASIONAL");
    expect(csv).toContain("HARI LIBUR");
    expect(csv).toContain("TUKAR LIBUR");
    expect(csv).toContain("CUTI");
    expect(csv).toContain("IZIN");
  });

  it("exports canonical labels even when raw attendance status and notes point to a different meaning", async () => {
    prismaMock.attendance.findMany.mockResolvedValue([
      {
        id: "attendance-canonical-holiday",
        tenantId: "tenant-1",
        userId: "user-99",
        checkIn: new Date("2026-04-03T00:00:00.000Z"),
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
        userId: "user-99",
        workDate: new Date("2026-04-03T00:00:00.000Z"),
        finalStatus: "DAY_OFF",
        reviewState: "FINAL",
        holidayState: "LIBUR_NASIONAL",
        leaveState: null,
        payrollHoldState: "NONE",
        evidenceQuality: "weak-missing-site-config",
        reasonCodes: ["WEAK_GEOFENCE_EVIDENCE"],
        anomalyCodes: ["ATTENDANCE_ACCEPTED_WITHOUT_USABLE_SITE_CONFIG"],
      },
    ]);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/attendance?export=true&page=1&limit=20&startDate=2026-04-01&endDate=2026-04-30",
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

    const csv = await response.text();
    expect(prismaMock.attendanceEvaluation.findMany).toHaveBeenCalled();
    expect(csv).toContain("LIBUR NASIONAL");
    expect(csv).toContain("weak-missing-site-config");
  });

  it("omits pre-join attendance rows from export", async () => {
    prismaMock.attendance.findMany.mockResolvedValue([
      {
        id: "attendance-before-join",
        tenantId: "tenant-1",
        userId: "user-join-1",
        checkIn: new Date("2026-03-20T00:00:00.000Z"),
        checkOut: new Date("2026-03-20T08:00:00.000Z"),
        status: "ON_TIME",
        notes: null,
        user: {
          name: "Before Join",
          email: "before@example.com",
          image: null,
          workingHourMode: "FIXED",
          workDays: ["MONDAY"],
          joinDate: new Date("2026-04-01T00:00:00.000Z"),
          departments: { name: "Ops" },
          sites: { name: "HQ" },
        },
      },
      {
        id: "attendance-after-join",
        tenantId: "tenant-1",
        userId: "user-join-1",
        checkIn: new Date("2026-04-02T00:00:00.000Z"),
        checkOut: new Date("2026-04-02T08:00:00.000Z"),
        status: "ON_TIME",
        notes: null,
        user: {
          name: "After Join",
          email: "after@example.com",
          image: null,
          workingHourMode: "FIXED",
          workDays: ["MONDAY"],
          joinDate: new Date("2026-04-01T00:00:00.000Z"),
          departments: { name: "Ops" },
          sites: { name: "HQ" },
        },
      },
    ] as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/attendance?export=true&page=1&limit=20",
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

    const csv = await response.text();

    expect(csv).not.toContain("Before Join");
    expect(csv).toContain("After Join");
  });
});
