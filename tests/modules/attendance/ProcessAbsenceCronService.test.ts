import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  acquireCronLock: vi.fn(),
  processDailyAbsence: vi.fn(),
  tenantFindMany: vi.fn(),
}));

vi.mock("@/lib/cron-lock", () => ({
  acquireCronLock: mockFns.acquireCronLock,
  CRON_LOCK_UNAVAILABLE_MESSAGE:
    "Layanan cron sementara tidak tersedia. Coba lagi beberapa saat.",
}));

vi.mock("@/modules/attendance/services/AbsenceService", () => ({
  AbsenceService: class MockAbsenceService {
    processDailyAbsence = mockFns.processDailyAbsence;
  },
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    tenant: {
      findMany: mockFns.tenantFindMany,
    },
  },
}));

import { runProcessAbsenceCron } from "@/modules/attendance";

describe("runProcessAbsenceCron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.acquireCronLock.mockResolvedValue("acquired");
    mockFns.tenantFindMany.mockResolvedValue([{ id: "tenant-1" }]);
    mockFns.processDailyAbsence.mockResolvedValue({ processed: 2, absent: 1 });
  });

  it("skips processing when lock is already held", async () => {
    mockFns.acquireCronLock.mockResolvedValue("locked");

    const result = await runProcessAbsenceCron({
      targetDate: new Date("2026-03-29T00:00:00.000Z"),
    });

    expect(result).toEqual({
      status: "locked",
      payload: {
        success: true,
        skipped: true,
        reason: "Lock already held",
      },
    });
    expect(mockFns.acquireCronLock).toHaveBeenCalledWith(
      "processAbsence:2026-03-29",
      60 * 60,
    );
    expect(mockFns.tenantFindMany).not.toHaveBeenCalled();
  });

  it("processes daily absence for every active tenant", async () => {
    const targetDate = new Date("2026-03-29T00:00:00.000Z");

    const result = await runProcessAbsenceCron({ targetDate });

    expect(mockFns.tenantFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true },
    });
    expect(mockFns.processDailyAbsence).toHaveBeenCalledWith(
      targetDate,
      "tenant-1",
    );
    expect(result).toEqual({
      status: "processed",
      payload: {
        success: true,
        date: "2026-03-29",
        tenantsProcessed: 1,
        results: [{ tenantId: "tenant-1", processed: 2, absent: 1 }],
      },
    });
  });
});
