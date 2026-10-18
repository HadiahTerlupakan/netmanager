import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { LocationTrackingRepository } from "@/modules/attendance/repositories/LocationTrackingRepository";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employeeLocation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

const AT_SEVEN = new Date("2026-04-10T07:00:00.000Z");
const AT_EIGHT = new Date("2026-04-10T08:00:00.000Z");

describe("LocationTrackingRepository", () => {
  let repository: LocationTrackingRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new LocationTrackingRepository();
  });

  it("does not store a point the phone resent after a timeout", async () => {
    vi.mocked(prisma.employeeLocation.findFirst).mockResolvedValue({
      id: "existing",
    } as never);

    const result = await repository.createLocation("user-1", "tenant-1", {
      latitude: -6.2,
      longitude: 106.8,
      recordedAt: AT_SEVEN,
    });

    expect(result).toBeNull();
    expect(prisma.employeeLocation.create).not.toHaveBeenCalled();
  });

  it("skips batch points already stored and duplicates within the batch", async () => {
    vi.mocked(prisma.employeeLocation.findMany).mockResolvedValue([
      { recordedAt: AT_SEVEN },
    ] as never);
    vi.mocked(prisma.employeeLocation.createMany).mockResolvedValue({
      count: 1,
    });

    await repository.createLocationsBatch("user-1", "tenant-1", [
      { latitude: 1, longitude: 1, recordedAt: AT_SEVEN },
      { latitude: 2, longitude: 2, recordedAt: AT_EIGHT },
      { latitude: 2, longitude: 2, recordedAt: AT_EIGHT },
    ]);

    const { data } = vi.mocked(prisma.employeeLocation.createMany).mock
      .calls[0][0] as { data: Array<{ recordedAt: Date }> };
    expect(data.map((row) => row.recordedAt)).toEqual([AT_EIGHT]);
  });

  it("does not write anything when every batch point is already stored", async () => {
    vi.mocked(prisma.employeeLocation.findMany).mockResolvedValue([
      { recordedAt: AT_SEVEN },
    ] as never);

    const result = await repository.createLocationsBatch("user-1", null, [
      { latitude: 1, longitude: 1, recordedAt: AT_SEVEN },
    ]);

    expect(result).toEqual({ count: 0 });
    expect(prisma.employeeLocation.createMany).not.toHaveBeenCalled();
  });
});
