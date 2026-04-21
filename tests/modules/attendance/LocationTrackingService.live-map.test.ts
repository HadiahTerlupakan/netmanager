import { beforeEach, describe, expect, it, vi } from "vitest";

import { toStartOfDay } from "@/lib/utils/server-datetime";

const mockFns = vi.hoisted(() => ({
  getTenantIdFromContext: vi.fn().mockResolvedValue({
    tenantId: "tenant-1",
    isSuperAdmin: false,
  }),
  getTimezone: vi.fn().mockResolvedValue("America/New_York"),
  findMany: vi.fn().mockResolvedValue([]),
  getLatestLocationsForUsers: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: mockFns.getTenantIdFromContext,
}));

vi.mock("@/lib/utils/get-timezone", () => ({
  getTimezone: mockFns.getTimezone,
  getTimezoneSync: vi.fn().mockReturnValue("Asia/Jakarta"),
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: {
    publish: vi.fn(),
  },
}));

vi.mock("@/modules/attendance/repositories/AttendanceRepository", () => ({
  AttendanceRepository: class {
    findMany = mockFns.findMany;
  },
}));

vi.mock("@/modules/attendance/repositories/LocationTrackingRepository", () => ({
  LocationTrackingRepository: class {
    getLatestLocationsForUsers = mockFns.getLatestLocationsForUsers;
  },
}));

vi.mock("@/modules/users", () => ({
  UserRepository: class {},
}));

describe("LocationTrackingService live map timezone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T12:00:00.000Z"));
    mockFns.getTenantIdFromContext.mockResolvedValue({
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });
    mockFns.getTimezone.mockResolvedValue("America/New_York");
    mockFns.findMany.mockResolvedValue([]);
    mockFns.getLatestLocationsForUsers.mockResolvedValue([]);
  });

  it("uses tenant timezone boundaries when querying active attendances for live map", async () => {
    const { LocationTrackingService } =
      await import("@/modules/attendance/services/LocationTrackingService");
    const service = new LocationTrackingService();

    await service.getLiveLocations();

    expect(mockFns.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          checkIn: {
            gte: toStartOfDay(
              new Date("2026-04-10T12:00:00.000Z"),
              "America/New_York",
            ),
          },
        }),
      }),
    );
  });
});
