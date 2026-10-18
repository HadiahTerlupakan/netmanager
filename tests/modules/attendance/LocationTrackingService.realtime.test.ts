import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocationTrackingService } from "@/modules/attendance/services/LocationTrackingService";

const mockFns = vi.hoisted(() => ({
  publish: vi.fn().mockResolvedValue(undefined),
  createLocation: vi.fn(),
  createLocationsBatch: vi.fn(),
  findSessionsOverlapping: vi.fn(),
  findById: vi.fn(),
  getTimezone: vi.fn(),
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: {
    publish: mockFns.publish,
  },
}));

vi.mock("@/lib/utils/get-timezone", () => ({
  getTimezone: mockFns.getTimezone,
  getTimezoneSync: vi.fn().mockReturnValue("Asia/Jakarta"),
}));

vi.mock("@/modules/attendance/repositories/LocationTrackingRepository", () => ({
  LocationTrackingRepository: class {
    createLocation = mockFns.createLocation;
    createLocationsBatch = mockFns.createLocationsBatch;
  },
}));

vi.mock("@/modules/attendance/repositories/AttendanceRepository", () => ({
  AttendanceRepository: class {
    findSessionsOverlapping = mockFns.findSessionsOverlapping;
  },
}));

vi.mock("@/modules/users/repositories/UserRepository", () => ({
  UserRepository: class {
    findById = mockFns.findById;
  },
}));

// Service hanya memakai UserLookupService dari barrel `@/modules/users`;
// barrel lengkapnya menarik graf seluruh aplikasi (±1.300 berkas). Dipersempit
// ke implementasi aslinya, yang tetap memakai UserRepository tiruan di atas.
vi.mock("@/modules/users", async () => ({
  UserLookupService: (
    await import("@/modules/users/services/UserLookupService")
  ).UserLookupService,
}));

const NOW = new Date("2026-04-10T12:00:00.000Z");

function closedSession(checkIn: string, checkOut: string) {
  return {
    id: "att-1",
    checkIn: new Date(checkIn),
    checkOut: new Date(checkOut),
    status: "PRESENT",
    user: {
      workingHourMode: "FIXED",
      flexibleTargetHour: null as number | null,
      shift: null as { startTime: string; endTime: string } | null,
    },
  };
}

describe("LocationTrackingService realtime publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockFns.createLocation.mockResolvedValue({
      userId: "user-1",
      latitude: -6.2,
      longitude: 106.8,
      heading: 180,
      isMoving: true,
      batteryLevel: 90,
      recordedAt: new Date("2026-04-10T07:00:00.000Z"),
      accuracy: 5,
      speed: 12,
    });
    mockFns.createLocationsBatch.mockImplementation(
      async (_userId: string, _tenantId: string, rows: unknown[]) => ({
        count: rows.length,
      }),
    );
    mockFns.findSessionsOverlapping.mockResolvedValue([]);
    mockFns.findById.mockResolvedValue({ id: "user-1", tenantId: "tenant-1" });
    mockFns.getTimezone.mockResolvedValue("Asia/Jakarta");
  });

  it("publishes a coordinate-free notice to the tenant admin Firebase stream", async () => {
    const service = new LocationTrackingService();

    await service.saveLocation("user-1", {
      latitude: -6.2,
      longitude: 106.8,
      recordedAt: new Date("2026-04-10T07:00:00.000Z"),
    });

    expect(mockFns.publish).toHaveBeenCalledWith({
      type: "admin.location.update",
      scope: { kind: "admin", id: "location:tenant-1" },
      tenantId: "tenant-1",
      payload: {
        userId: "user-1",
        recordedAt: new Date("2026-04-10T07:00:00.000Z"),
      },
    });
  });

  it("does not publish again for a point that was already stored", async () => {
    mockFns.createLocation.mockResolvedValue(null);
    const service = new LocationTrackingService();

    await service.saveLocation("user-1", {
      latitude: -6.2,
      longitude: 106.8,
      recordedAt: new Date("2026-04-10T07:00:00.000Z"),
    });

    expect(mockFns.publish).not.toHaveBeenCalled();
  });

  it("stores queued offline points from a session that has already ended", async () => {
    mockFns.findSessionsOverlapping.mockResolvedValue([
      closedSession("2026-04-10T01:00:00.000Z", "2026-04-10T10:00:00.000Z"),
    ]);
    const service = new LocationTrackingService();

    const count = await service.saveLocations("user-1", [
      {
        latitude: -6.1,
        longitude: 106.7,
        recordedAt: new Date("2026-04-10T07:00:00.000Z"),
      },
      {
        latitude: -6.3,
        longitude: 106.9,
        recordedAt: new Date("2026-04-10T09:00:00.000Z"),
      },
      {
        // Sesudah check-out: tracking seharusnya sudah berhenti.
        latitude: -6.4,
        longitude: 107.0,
        recordedAt: new Date("2026-04-10T11:00:00.000Z"),
      },
    ]);

    expect(count).toBe(2);
    const stored = mockFns.createLocationsBatch.mock.calls[0][2];
    expect(stored.map((row: { latitude: number }) => row.latitude)).toEqual([
      -6.1, -6.3,
    ]);
    expect(mockFns.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          userId: "user-1",
          recordedAt: new Date("2026-04-10T09:00:00.000Z"),
        },
      }),
    );
  });

  it("stores nothing and publishes nothing when no point falls in a session", async () => {
    const service = new LocationTrackingService();

    const count = await service.saveLocations("user-1", [
      {
        latitude: -6.1,
        longitude: 106.7,
        recordedAt: new Date("2026-04-10T07:00:00.000Z"),
      },
    ]);

    expect(count).toBe(0);
    expect(mockFns.createLocationsBatch).not.toHaveBeenCalled();
    expect(mockFns.publish).not.toHaveBeenCalled();
  });

  it("keeps a lone queued point recorded just before check-in", async () => {
    mockFns.findSessionsOverlapping.mockImplementation(
      async ({ to }: { to: Date }) =>
        to >= new Date("2026-04-10T01:00:00.000Z")
          ? [
              closedSession(
                "2026-04-10T01:00:00.000Z",
                "2026-04-10T10:00:00.000Z",
              ),
            ]
          : [],
    );
    const service = new LocationTrackingService();

    const count = await service.saveLocations("user-1", [
      {
        latitude: -6.1,
        longitude: 106.7,
        recordedAt: new Date("2026-04-10T00:55:00.000Z"),
      },
    ]);

    expect(count).toBe(1);
  });
});
