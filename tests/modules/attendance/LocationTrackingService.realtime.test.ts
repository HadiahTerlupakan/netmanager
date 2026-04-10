import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  publish: vi.fn().mockResolvedValue(undefined),
  createLocation: vi.fn(),
  createLocationsBatch: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: {
    publish: mockFns.publish,
  },
}));

vi.mock("@/modules/attendance/repositories/LocationTrackingRepository", () => ({
  LocationTrackingRepository: class {
    createLocation = mockFns.createLocation;
    createLocationsBatch = mockFns.createLocationsBatch;
  },
}));

vi.mock("@/modules/attendance/repositories/AttendanceRepository", () => ({
  AttendanceRepository: class {},
}));

vi.mock("@/modules/users", () => ({
  UserRepository: class {
    findById = mockFns.findById;
  },
}));

describe("LocationTrackingService realtime publishing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFns.createLocation.mockResolvedValue({
      latitude: -6.2,
      longitude: 106.8,
      heading: 180,
      isMoving: true,
      batteryLevel: 90,
      recordedAt: new Date("2026-04-10T07:00:00.000Z"),
      accuracy: 5,
      speed: 12,
    });
    mockFns.createLocationsBatch.mockResolvedValue({ count: 2 });
    mockFns.findById.mockResolvedValue({ id: "user-1", tenantId: "tenant-1" });
  });

  it("publishes the saved location to the tenant admin Firebase stream", async () => {
    const { LocationTrackingService } =
      await import("@/modules/attendance/services/LocationTrackingService");
    const service = new LocationTrackingService();

    await service.saveLocation("user-1", {
      latitude: -6.2,
      longitude: 106.8,
      heading: 180,
      isMoving: true,
      batteryLevel: 90,
      recordedAt: new Date("2026-04-10T07:00:00.000Z"),
      accuracy: 5,
      speed: 12,
    });

    expect(mockFns.publish).toHaveBeenCalledWith({
      type: "admin.location.update",
      scope: { kind: "admin", id: "location:tenant-1" },
      payload: {
        userId: "user-1",
        latitude: -6.2,
        longitude: 106.8,
        heading: 180,
        isMoving: true,
        batteryLevel: 90,
        recordedAt: new Date("2026-04-10T07:00:00.000Z"),
        accuracy: 5,
        speed: 12,
      },
    });
  });

  it("publishes the latest batched location to the tenant admin Firebase stream", async () => {
    const { LocationTrackingService } =
      await import("@/modules/attendance/services/LocationTrackingService");
    const service = new LocationTrackingService();

    await service.saveLocations("user-1", [
      {
        latitude: -6.1,
        longitude: 106.7,
        recordedAt: new Date("2026-04-10T07:00:00.000Z"),
        isMoving: false,
      },
      {
        latitude: -6.3,
        longitude: 106.9,
        heading: 45,
        recordedAt: new Date("2026-04-10T08:00:00.000Z"),
        isMoving: true,
        batteryLevel: 88,
        accuracy: 7,
        speed: 15,
      },
    ]);

    expect(mockFns.publish).toHaveBeenCalledWith({
      type: "admin.location.update",
      scope: { kind: "admin", id: "location:tenant-1" },
      payload: {
        userId: "user-1",
        latitude: -6.3,
        longitude: 106.9,
        heading: 45,
        isMoving: true,
        batteryLevel: 88,
        recordedAt: new Date("2026-04-10T08:00:00.000Z"),
        accuracy: 7,
        speed: 15,
      },
    });
  });
});
