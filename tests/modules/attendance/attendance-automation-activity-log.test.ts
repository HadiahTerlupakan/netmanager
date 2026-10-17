import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logActivitySafe,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/utils/get-timezone", () => ({
  getTimezoneSync: () => "Asia/Jakarta",
  getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
}));

import { AbsenceService } from "@/modules/attendance/services/AbsenceService";
import { AttendanceSessionGuardService } from "@/modules/attendance/services/AttendanceSessionGuardService";
import { AttendanceSessionPolicyService } from "@/modules/attendance/services/AttendanceSessionPolicyService";
import { NoCheckoutRepairService } from "@/modules/attendance/services/NoCheckoutRepairService";
import { processAttendanceAutoCheckoutJob } from "@/modules/attendance/services/auto-checkout.helpers";

const CHECK_IN = new Date("2026-10-17T01:00:00.000Z"); // 08:00 WIB
const AUTO_CHECKOUT_AT = new Date("2026-10-17T11:30:00.000Z");

function lastActivity() {
  expect(logActivitySafe).toHaveBeenCalledTimes(1);
  return logActivitySafe.mock.calls[0][0];
}

describe("Log Aktivitas proses otomatis absensi", () => {
  beforeEach(() => {
    logActivitySafe.mockReset();
    vi.restoreAllMocks();
  });

  it("mencatat ABSENT otomatis dari proses harian", async () => {
    const service = new AbsenceService();
    const internals = service as unknown as {
      attendanceRepo: { create: unknown };
      publishAbsentEvent: unknown;
      createAbsentAttendance: (input: unknown) => Promise<string>;
    };
    internals.attendanceRepo.create = vi.fn();
    internals.publishAbsentEvent = vi.fn();

    await internals.createAbsentAttendance({
      user: { id: "user-1", name: "Budi" },
      startOfDay: new Date("2026-10-16T17:00:00.000Z"),
      tenantId: "tenant-1",
    });

    expect(lastActivity()).toMatchObject({
      action: "AUTO_ABSENT",
      subject: "Absensi Budi 2026-10-17",
      actor: { type: "system", id: "cron:process-absence" },
      tenantId: "tenant-1",
      details: { employeeId: "user-1", employeeName: "Budi" },
    });
  });

  it("mencatat DAY_OFF otomatis dari proses harian", async () => {
    const service = new AbsenceService();
    const internals = service as unknown as {
      attendanceRepo: { create: unknown };
      createDayOffAttendance: (input: unknown) => Promise<string>;
    };
    internals.attendanceRepo.create = vi.fn();

    await internals.createDayOffAttendance({
      user: { id: "user-1", name: "Budi" },
      startOfDay: new Date("2026-10-16T17:00:00.000Z"),
      isHoliday: true,
      tenantId: "tenant-1",
    });

    expect(lastActivity()).toMatchObject({
      action: "AUTO_DAY_OFF",
      subject: "Absensi Budi 2026-10-17",
      details: { hariLibur: true },
    });
  });

  it("mencatat auto-checkout dari job antrean", async () => {
    vi.spyOn(
      AttendanceSessionPolicyService.prototype,
      "resolve",
    ).mockReturnValue({
      shouldAutoCheckout: true,
      autoCheckoutAt: AUTO_CHECKOUT_AT,
      nextStatus: "NO_CHECKOUT",
    } as never);

    const result = await processAttendanceAutoCheckoutJob({
      attendance: {
        id: "att-1",
        userId: "user-1",
        checkIn: CHECK_IN,
        checkOut: null,
        status: "ON_TIME",
        notes: null,
        user: { name: "Budi", workingHourMode: "FIXED" },
      } as never,
      data: {
        attendanceId: "att-1",
        tenantId: "tenant-1",
        mode: "FIXED",
        expectedAutoCheckoutAt: AUTO_CHECKOUT_AT.toISOString(),
        sourceCheckInDate: "2026-10-17",
      } as never,
      timezone: "Asia/Jakarta",
      attendanceRepo: {
        updateOpenSessionForAutoCheckout: vi.fn().mockResolvedValue(1),
      } as never,
      sessionPolicyService: new AttendanceSessionPolicyService(),
    });

    expect(result).toEqual({ attendanceId: "att-1", status: "processed" });
    expect(lastActivity()).toMatchObject({
      action: "AUTO_CHECKOUT",
      subject: "Absensi Budi 2026-10-17",
      actor: { type: "system", id: "job:attendance-auto-checkout" },
      tenantId: "tenant-1",
      details: { attendanceId: "att-1", status: "NO_CHECKOUT" },
    });
  });

  it("mencatat sesi lama yang ditutup saat check-in berikutnya", async () => {
    vi.spyOn(
      AttendanceSessionPolicyService.prototype,
      "resolve",
    ).mockReturnValue({} as never);
    vi.spyOn(
      AttendanceSessionPolicyService.prototype,
      "buildAutoCheckoutUpdate",
    ).mockReturnValue({
      checkOut: AUTO_CHECKOUT_AT,
      notes: "Auto-Checkout",
      status: "NO_CHECKOUT",
    } as never);
    const attendanceRepo = {
      findManyStaleSessions: vi.fn().mockResolvedValue([
        {
          id: "att-0",
          checkIn: new Date("2026-10-16T01:00:00.000Z"),
          checkOut: null,
          status: "ON_TIME",
          notes: null,
        },
      ]),
      update: vi.fn(),
    };

    await new AttendanceSessionGuardService(
      attendanceRepo as never,
    ).processAutoCheckout({
      userId: "user-1",
      tenantId: "tenant-1",
      userDetails: null,
      effectiveToday: new Date("2026-10-16T17:00:00.000Z"),
      checkInTime: CHECK_IN,
      timezone: "Asia/Jakarta",
    });

    expect(lastActivity()).toMatchObject({
      action: "AUTO_CHECKOUT",
      subject: "Absensi 2026-10-16",
      userId: "user-1",
      tenantId: "tenant-1",
      details: { attendanceId: "att-0", status: "NO_CHECKOUT" },
    });
  });

  it("mencatat perbaikan status NO_CHECKOUT oleh skrip", async () => {
    const service = new NoCheckoutRepairService(
      {
        findCandidates: vi.fn().mockResolvedValue([
          {
            id: "att-2",
            tenantId: "tenant-1",
            userId: "user-1",
            checkIn: CHECK_IN,
            checkOut: AUTO_CHECKOUT_AT,
            checkOutPhoto: "/foto.jpg",
            checkOutLocation: null,
            status: "NO_CHECKOUT",
            notes: null,
            user: {
              name: "Budi",
              workingHourMode: "FIXED",
              startWorkTime: "08:00",
              shift: null,
            },
          },
        ]),
        updateStatus: vi.fn(),
      },
      { calculateStatus: vi.fn().mockResolvedValue("ON_TIME") } as never,
      { recompute: vi.fn() } as never,
    );

    await service.repair({
      tenantId: "tenant-1",
      startDate: CHECK_IN,
      endDate: AUTO_CHECKOUT_AT,
      dryRun: false,
      actorId: "operator-1",
      timezone: "Asia/Jakarta",
    });

    expect(lastActivity()).toMatchObject({
      action: "AUTO_STATUS_REPAIR",
      subject: "Absensi Budi 2026-10-17",
      actor: { type: "system", id: "script:repair-no-checkout" },
      details: {
        attendanceId: "att-2",
        statusLama: "NO_CHECKOUT",
        statusBaru: "ON_TIME",
        operatorId: "operator-1",
      },
    });
  });
});
