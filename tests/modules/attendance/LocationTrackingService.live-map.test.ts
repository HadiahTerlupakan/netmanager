import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getTenantIdFromContext: vi.fn(),
  getTimezone: vi.fn(),
  findOpenSessionsForLiveMap: vi.fn(),
  getLatestLocationsForUsers: vi.fn(),
}));

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: mockFns.getTenantIdFromContext,
}));

vi.mock("@/lib/utils/get-timezone", () => ({
  getTimezone: mockFns.getTimezone,
  getTimezoneSync: vi.fn().mockReturnValue("Asia/Jakarta"),
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: { publish: vi.fn() },
}));

vi.mock("@/modules/attendance/repositories/AttendanceRepository", () => ({
  AttendanceRepository: class {
    findOpenSessionsForLiveMap = mockFns.findOpenSessionsForLiveMap;
  },
}));

vi.mock("@/modules/attendance/repositories/LocationTrackingRepository", () => ({
  LocationTrackingRepository: class {
    getLatestLocationsForUsers = mockFns.getLatestLocationsForUsers;
  },
}));

vi.mock("@/modules/users", () => ({
  UserRepository: class {},
  UserLookupService: class {},
}));

const NOW = new Date("2026-04-10T18:00:00.000Z"); // 01:00 WIB, 11 April

function session(overrides: {
  userId: string;
  checkIn: string;
  shift?: { startTime: string; endTime: string };
  workingHourMode?: "FIXED" | "SHIFT" | "FLEXIBLE";
}) {
  return {
    id: `att-${overrides.userId}`,
    userId: overrides.userId,
    checkIn: new Date(overrides.checkIn),
    checkOut: null as Date | null,
    status: "PRESENT",
    user: {
      id: overrides.userId,
      name: overrides.userId,
      image: null as string | null,
      sites: { name: "HQ" },
      departments: { name: "Ops" },
      workingHourMode: overrides.workingHourMode ?? "SHIFT",
      flexibleTargetHour: null as number | null,
      shift: overrides.shift ?? null,
    },
  };
}

function location(userId: string, recordedAt: string, isMoving = false) {
  return {
    userId,
    latitude: -6.2,
    longitude: 106.8,
    accuracy: 5,
    speed: 0,
    heading: 0,
    isMoving,
    batteryLevel: 0.9,
    recordedAt: new Date(recordedAt),
  };
}

async function getLiveLocations() {
  const { LocationTrackingService } =
    await import("@/modules/attendance/services/LocationTrackingService");
  return new LocationTrackingService().getLiveLocations();
}

describe("LocationTrackingService live map", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockFns.getTenantIdFromContext.mockResolvedValue({
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });
    mockFns.getTimezone.mockResolvedValue("Asia/Jakarta");
    mockFns.findOpenSessionsForLiveMap.mockResolvedValue([]);
    mockFns.getLatestLocationsForUsers.mockResolvedValue([]);
  });

  it("keeps an overnight shift on the map after midnight", async () => {
    mockFns.findOpenSessionsForLiveMap.mockResolvedValue([
      session({
        userId: "night",
        checkIn: "2026-04-10T14:00:00.000Z", // 21:00 WIB, 10 April
        shift: { startTime: "21:00", endTime: "05:00" },
      }),
    ]);
    mockFns.getLatestLocationsForUsers.mockResolvedValue([
      location("night", "2026-04-10T17:55:00.000Z"),
    ]);

    const result = await getLiveLocations();

    expect(result.map((entry) => entry.userId)).toEqual(["night"]);
  });

  it("drops a session whose schedule has ended even if it was never checked out", async () => {
    mockFns.findOpenSessionsForLiveMap.mockResolvedValue([
      session({
        userId: "forgot",
        checkIn: "2026-04-10T01:00:00.000Z", // 08:00 WIB, shift 08-17
        shift: { startTime: "08:00", endTime: "17:00" },
      }),
    ]);

    const result = await getLiveLocations();

    expect(result).toEqual([]);
    expect(mockFns.getLatestLocationsForUsers).not.toHaveBeenCalled();
  });

  it("looks back far enough for sessions that started yesterday", async () => {
    await getLiveLocations();

    const { since, tenantId } =
      mockFns.findOpenSessionsForLiveMap.mock.calls[0][0];
    expect(tenantId).toBe("tenant-1");
    expect(NOW.getTime() - since.getTime()).toBe(36 * 60 * 60 * 1000);
  });

  it("does not show a location recorded before the current session", async () => {
    mockFns.findOpenSessionsForLiveMap.mockResolvedValue([
      session({
        userId: "fresh",
        checkIn: "2026-04-10T17:00:00.000Z",
        workingHourMode: "FLEXIBLE",
      }),
    ]);
    mockFns.getLatestLocationsForUsers.mockResolvedValue([
      location("fresh", "2026-04-09T10:00:00.000Z"),
    ]);

    const result = await getLiveLocations();

    expect(result).toEqual([]);
    const recordedSince = mockFns.getLatestLocationsForUsers.mock.calls[0][3];
    expect(recordedSince).toEqual(new Date("2026-04-10T16:45:00.000Z"));
  });

  it("stops reporting an employee as moving once the moving point is stale", async () => {
    mockFns.findOpenSessionsForLiveMap.mockResolvedValue([
      session({
        userId: "stale",
        checkIn: "2026-04-10T16:00:00.000Z",
        workingHourMode: "FLEXIBLE",
      }),
      session({
        userId: "moving",
        checkIn: "2026-04-10T16:00:00.000Z",
        workingHourMode: "FLEXIBLE",
      }),
    ]);
    mockFns.getLatestLocationsForUsers.mockResolvedValue([
      location("stale", "2026-04-10T17:00:00.000Z", true),
      location("moving", "2026-04-10T17:55:00.000Z", true),
    ]);

    const result = await getLiveLocations();

    expect(
      Object.fromEntries(result.map((entry) => [entry.userId, entry.isMoving])),
    ).toEqual({ stale: false, moving: true });
  });

  it("shows only the latest open session per employee", async () => {
    mockFns.findOpenSessionsForLiveMap.mockResolvedValue([
      session({
        userId: "dup",
        checkIn: "2026-04-10T17:00:00.000Z",
        workingHourMode: "FLEXIBLE",
      }),
      session({
        userId: "dup",
        checkIn: "2026-04-10T07:00:00.000Z",
        workingHourMode: "FLEXIBLE",
      }),
    ]);
    mockFns.getLatestLocationsForUsers.mockResolvedValue([
      location("dup", "2026-04-10T17:30:00.000Z"),
    ]);

    const result = await getLiveLocations();

    expect(result).toHaveLength(1);
    expect(result[0].checkInTime).toEqual(new Date("2026-04-10T17:00:00.000Z"));
  });

  it("does not fail the whole map for one employee with a malformed shift time", async () => {
    mockFns.findOpenSessionsForLiveMap.mockResolvedValue([
      session({
        userId: "broken",
        checkIn: "2026-04-10T17:00:00.000Z",
        shift: { startTime: "08:30:00", endTime: "17:00:00" },
      }),
      session({
        userId: "fine",
        checkIn: "2026-04-10T17:00:00.000Z",
        workingHourMode: "FLEXIBLE",
      }),
    ]);
    mockFns.getLatestLocationsForUsers.mockResolvedValue([
      location("broken", "2026-04-10T17:30:00.000Z"),
      location("fine", "2026-04-10T17:30:00.000Z"),
    ]);

    const result = await getLiveLocations();

    expect(result.map((entry) => entry.userId).sort()).toEqual([
      "broken",
      "fine",
    ]);
  });
});
