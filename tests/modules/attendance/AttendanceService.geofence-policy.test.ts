import { describe, expect, it, vi } from "vitest";
import type { AttendanceStatus } from "@prisma/client";

import {
  AttendanceTimezoneService,
  GeofenceService,
  now,
  prismaMock,
  service,
} from "./AttendanceService.test-setup";

describe("geofence policy enforcement", () => {
  it("rejects check-in for strict users outside the geofence", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      workingHourMode: "FIXED",
      shiftId: null,
      attendanceGeofencePolicy: "STRICT",
      shift: null,
    });
    prismaMock.attendance.findMany.mockResolvedValueOnce([]);
    prismaMock.attendance.findFirst.mockResolvedValueOnce(null);

    vi.spyOn(
      GeofenceService.prototype,
      "validateGeofence",
    ).mockResolvedValueOnce({
      isInside: false,
      nearestDistance: 250,
      nearestSiteName: "Kantor Pusat",
      nearestSiteId: "site-1",
    });

    await expect(
      service.checkIn({
        userId: "strict-user",
        photoUrl: null,
        location: "Remote",
        notes: "",
        latitude: -6.2,
        longitude: 106.8,
      }),
    ).rejects.toThrow("OUTSIDE_GEOFENCE");
  });

  it("allows check-in for warn users outside the geofence and stores outside metadata", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      workingHourMode: "FIXED",
      shiftId: null,
      attendanceGeofencePolicy: "WARN",
      shift: null,
    });
    prismaMock.attendance.findMany.mockResolvedValueOnce([]);
    prismaMock.attendance.findFirst.mockResolvedValueOnce(null);

    vi.spyOn(
      GeofenceService.prototype,
      "validateGeofence",
    ).mockResolvedValueOnce({
      isInside: false,
      nearestDistance: 150,
      nearestSiteName: "Site Hybrid",
      nearestSiteId: "site-2",
    });

    prismaMock.attendance.create.mockResolvedValueOnce({
      id: "att-1",
      tenantId: "tenant-1",
      userId: "warn-user",
      checkIn: new Date("2026-03-08T01:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      geofenceStatus: "OUTSIDE",
      geofenceDistance: 150,
      geofenceSiteName: "Site Hybrid",
    });

    const result = await service.checkIn({
      userId: "warn-user",
      tenantId: "tenant-1",
      photoUrl: null,
      location: "Client site",
      notes: "",
      latitude: -6.21,
      longitude: 106.81,
    });

    expect(prismaMock.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          geofenceStatus: "OUTSIDE",
          geofenceDistance: 150,
          geofenceSiteName: "Site Hybrid",
        }),
      }),
    );
    expect(result).toMatchObject({
      attendance: expect.objectContaining({
        geofenceStatus: "OUTSIDE",
        geofenceDistance: 150,
        geofenceSiteName: "Site Hybrid",
      }),
      evaluation: expect.objectContaining({
        finalStatus: "PERMIT",
        reviewState: "PENDING_REVIEW",
      }),
    });
  });

  it("rejects check-out for strict users outside the geofence", async () => {
    prismaMock.attendance.findFirst.mockResolvedValueOnce({
      id: "att-2",
      userId: "strict-user",
      checkIn: new Date("2026-03-08T01:00:00.000Z"),
      checkOut: null,
      notes: "Masuk tepat waktu",
      user: {
        workingHourMode: "FIXED",
        flexibleTargetHour: null,
        name: "Strict User",
        attendanceGeofencePolicy: "STRICT",
      },
    });

    vi.spyOn(
      GeofenceService.prototype,
      "validateGeofence",
    ).mockResolvedValueOnce({
      isInside: false,
      nearestDistance: 400,
      nearestSiteName: "HQ",
      nearestSiteId: "site-1",
    });

    await expect(
      service.checkOut({
        userId: "strict-user",
        photoUrl: null,
        location: "Rumah",
        latitude: -6.22,
        longitude: 106.82,
      }),
    ).rejects.toThrow("OUTSIDE_GEOFENCE");
  });

  it("rejects a new check-in when a flexible session from yesterday is still active but not yet stale", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T08:00:00.000Z"));

    prismaMock.user.findUnique.mockResolvedValueOnce({
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      workingHourMode: "FLEXIBLE",
      shiftId: null,
      attendanceGeofencePolicy: "WARN",
      shift: null,
    });

    prismaMock.attendance.findMany.mockResolvedValueOnce([
      {
        id: "att-flex-active",
        checkIn: new Date("2026-03-07T10:00:00.000Z"),
        checkOut: null,
        status: "ON_TIME",
        notes: null,
      },
    ] as never);
    prismaMock.attendance.findFirst.mockResolvedValueOnce({
      id: "att-flex-active",
      checkIn: new Date("2026-03-07T10:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      user: {
        workingHourMode: "FLEXIBLE",
        flexibleTargetHour: 8,
        shift: null,
      },
    });

    await expect(
      service.checkIn({
        userId: "flex-user",
        photoUrl: null,
        location: "Remote",
        notes: "",
        latitude: -6.2,
        longitude: 106.8,
      }),
    ).rejects.toThrow("DUPLICATE_ENTRY");
  });

  it("auto-checks out a stale flexible session older than 24 hours before allowing a new check-in", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      workingHourMode: "FLEXIBLE",
      shiftId: null,
      attendanceGeofencePolicy: "WARN",
      shift: null,
    });

    const staleFlexibleSession: {
      id: string;
      checkIn: Date;
      checkOut: Date | null;
      status: AttendanceStatus;
      notes: string | null;
      user: {
        workingHourMode: "FLEXIBLE";
        flexibleTargetHour: number;
        shift: null;
      };
    } = {
      id: "att-flex-stale",
      checkIn: new Date("2026-03-07T07:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      notes: null,
      user: {
        workingHourMode: "FLEXIBLE",
        flexibleTargetHour: 8,
        shift: null,
      },
    };

    prismaMock.attendance.findMany.mockResolvedValueOnce([
      {
        id: staleFlexibleSession.id,
        checkIn: staleFlexibleSession.checkIn,
        checkOut: staleFlexibleSession.checkOut,
        status: staleFlexibleSession.status,
        notes: staleFlexibleSession.notes,
      },
    ] as never);
    prismaMock.attendance.findFirst.mockImplementationOnce(
      async (): Promise<typeof staleFlexibleSession | null> => {
        return prismaMock.attendance.update.mock.calls.length > 0
          ? null
          : staleFlexibleSession;
      },
    );
    prismaMock.attendance.update.mockResolvedValueOnce({
      id: staleFlexibleSession.id,
      checkIn: staleFlexibleSession.checkIn,
      checkOut: new Date("2026-03-08T07:00:00.000Z"),
      status: staleFlexibleSession.status,
      notes: "Auto checkout by system (Mangkir)",
    } as never);
    prismaMock.attendance.create.mockResolvedValueOnce({
      id: "att-flex-new",
      userId: "flex-user",
      tenantId: "tenant-1",
      checkIn: now,
      checkOut: null,
      status: "ON_TIME",
      location: "Remote",
      notes: "",
    } as never);
    prismaMock.leaveRequest.findFirst.mockResolvedValueOnce(null);
    prismaMock.holiday.findFirst.mockResolvedValueOnce(null);
    prismaMock.overtime.findFirst.mockResolvedValueOnce(null);
    prismaMock.attendanceEvaluation.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.checkIn({
        userId: "flex-user",
        photoUrl: null,
        location: "Remote",
        notes: "",
        latitude: -6.2,
        longitude: 106.8,
        tenantId: "tenant-1",
      }),
    ).resolves.toMatchObject({
      attendance: expect.objectContaining({
        id: "att-flex-new",
      }),
    });

    expect(prismaMock.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: staleFlexibleSession.id },
        data: expect.objectContaining({
          checkOut: new Date("2026-03-08T07:00:00.000Z"),
          status: "ON_TIME",
        }),
      }),
    );
  });

  it("rejects a new check-in when an overnight shift session is still active after midnight", async () => {
    vi.spyOn(
      AttendanceTimezoneService.prototype,
      "getEffectiveDate",
    ).mockReturnValueOnce({
      now: new Date("2026-03-07T18:00:00.000Z"),
      startOfDay: new Date("2026-03-07T00:00:00.000Z"),
      tzOffsetMs: 0,
    });

    prismaMock.user.findUnique.mockResolvedValueOnce({
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      workingHourMode: "SHIFT",
      shiftId: "shift-1",
      attendanceGeofencePolicy: "WARN",
      shift: {
        startTime: "21:00",
        endTime: "04:00",
      },
    });
    prismaMock.attendance.findMany.mockResolvedValueOnce([]);
    prismaMock.attendance.findFirst.mockResolvedValueOnce({
      id: "att-shift-overnight",
      checkIn: new Date("2026-03-07T15:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      user: {
        workingHourMode: "SHIFT",
        flexibleTargetHour: null,
        shift: {
          startTime: "21:00",
          endTime: "04:00",
        },
      },
    });

    await expect(
      service.checkIn({
        userId: "shift-user",
        photoUrl: null,
        location: "Remote",
        notes: "",
        latitude: -6.2,
        longitude: 106.8,
      }),
    ).rejects.toThrow("DUPLICATE_ENTRY");
  });
});
