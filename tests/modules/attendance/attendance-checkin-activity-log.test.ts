import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logActivitySafe,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { AttendanceMutationService } from "@/modules/attendance/services/AttendanceMutationService";

type InternalMethods = Record<string, (...args: unknown[]) => unknown>;

const CHECK_IN_TIME = new Date("2026-10-16T23:55:00.000Z"); // 06:55 WIB, 17 Okt

function createService() {
  const service = new AttendanceMutationService(
    {
      resolveCheckInGeofence: vi.fn().mockResolvedValue({
        status: "INSIDE",
        distance: 12,
        siteName: "Site Karawang",
      }),
      resolveCheckOutGeofence: vi.fn().mockResolvedValue({}),
    } as never,
    { publishCheckInEvent: vi.fn(), publishCheckOutEvent: vi.fn() } as never,
    {
      processAutoCheckout: vi.fn(),
      assertNoActiveSessionConflict: vi.fn(),
    } as never,
    {
      validateCheckInTimeWindow: vi.fn().mockResolvedValue({ isValid: true }),
    } as never,
    { getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta") } as never,
    {
      findFirstActiveForCheckout: vi
        .fn()
        .mockResolvedValue({ id: "att-1", notes: null, status: "ON_TIME" }),
    } as never,
    {} as never,
    {} as never,
  );
  const internals = service as unknown as InternalMethods;
  vi.spyOn(internals, "prepareCheckInContext").mockResolvedValue({
    checkInTime: CHECK_IN_TIME,
    effectiveToday: new Date("2026-10-16T17:00:00.000Z"),
    timezone: "Asia/Jakarta",
    userDetails: null,
  });
  vi.spyOn(internals, "createCheckInAttendance").mockResolvedValue({
    id: "att-1",
    status: "ON_TIME",
    geofenceStatus: "INSIDE",
    geofenceDistance: 12,
    geofenceSiteName: "Site Karawang",
  });
  vi.spyOn(internals, "evaluateCreatedAttendance").mockResolvedValue({});
  vi.spyOn(internals, "updateCheckoutAttendance").mockResolvedValue({});
  vi.spyOn(internals, "evaluateCheckoutAttendance").mockResolvedValue({});
  vi.spyOn(internals, "buildCheckoutResult").mockReturnValue({
    attendance: {
      id: "att-1",
      checkIn: CHECK_IN_TIME,
      checkOut: new Date("2026-10-17T10:05:00.000Z"),
      status: "ON_TIME",
      checkOutGeofenceStatus: "INSIDE",
      checkOutGeofenceDistance: 8,
    },
    evaluation: {},
    warning: "Checkout lebih awal",
  });
  return service;
}

function lastActivity() {
  expect(logActivitySafe).toHaveBeenCalledTimes(1);
  return logActivitySafe.mock.calls[0][0];
}

describe("Log Aktivitas check-in & check-out (web dan mobile)", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("mencatat check-in dengan status, geofence, dan tanggal lokal", async () => {
    await createService().checkIn({
      userId: "user-1",
      tenantId: "tenant-1",
      photoUrl: "/foto.jpg",
      location: "-6.3,107.3",
      latitude: -6.3,
      longitude: 107.3,
    } as never);

    expect(lastActivity()).toEqual({
      action: "CHECK_IN",
      subject: "Absensi 2026-10-17",
      userId: "user-1",
      tenantId: "tenant-1",
      details: {
        attendanceId: "att-1",
        status: "ON_TIME",
        waktu: CHECK_IN_TIME.toISOString(),
        location: "-6.3,107.3",
        geofenceStatus: "INSIDE",
        geofenceSiteName: "Site Karawang",
        geofenceDistance: 12,
        offline: false,
      },
    });
  });

  it("mencatat check-out dengan status akhir dan peringatan", async () => {
    await createService().checkOut({
      userId: "user-1",
      tenantId: "tenant-1",
      photoUrl: null,
      location: "-6.3,107.3",
    });

    expect(lastActivity()).toEqual({
      action: "CHECK_OUT",
      subject: "Absensi 2026-10-17",
      userId: "user-1",
      tenantId: "tenant-1",
      details: {
        attendanceId: "att-1",
        status: "ON_TIME",
        waktu: "2026-10-17T10:05:00.000Z",
        location: "-6.3,107.3",
        geofenceStatus: "INSIDE",
        geofenceDistance: 8,
        offline: false,
        warning: "Checkout lebih awal",
      },
    });
  });
});

describe("Ketahanan pencatat check-out", () => {
  it("tidak menggagalkan check-out bila zona waktu gagal diambil", async () => {
    const service = createService();
    (service as unknown as Record<string, unknown>).timezoneService = {
      getTimezone: vi.fn().mockRejectedValue(new Error("redis down")),
    };

    await expect(
      service.checkOut({
        userId: "user-1",
        tenantId: "tenant-1",
        photoUrl: null,
        location: null,
      }),
    ).resolves.toMatchObject({ warning: "Checkout lebih awal" });
  });
});
