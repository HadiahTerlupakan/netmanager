import { describe, it, expect, beforeEach, vi } from "vitest";
import { PayrollPeriodService } from "@/modules/salary/payment/services/PayrollPeriodService";
import type {
  IPayrollPeriodRepository,
  PayrollPeriod,
} from "@/modules/salary/core";

const mockPeriod: PayrollPeriod = {
  id: "period-1",
  tenantId: "tenant-1",
  scheduleId: "schedule-1",
  periodStart: new Date("2026-04-26"),
  periodEnd: new Date("2026-05-25"),
  payDate: new Date("2026-05-28"),
  status: "OPEN",
  lockedAt: null,
  lockedBy: null,
  unlockReason: null,
  unlockCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PayrollPeriodService", () => {
  let service: PayrollPeriodService;
  let mockRepo: IPayrollPeriodRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(mockPeriod),
      findCurrent: vi.fn().mockResolvedValue(mockPeriod),
      findAll: vi.fn().mockResolvedValue([mockPeriod]),
      create: vi.fn().mockResolvedValue(mockPeriod),
      update: vi.fn().mockResolvedValue(mockPeriod),
      updateStatus: vi
        .fn()
        .mockResolvedValue({ ...mockPeriod, status: "PROCESSING" }),
      checkOverlap: vi.fn().mockResolvedValue(false),
    };
    service = new PayrollPeriodService(mockRepo);
  });

  it("should get current period", async () => {
    const result = await service.getCurrent("schedule-1", "tenant-1");
    expect(result).toEqual(mockPeriod);
  });

  it("should create period if no overlap", async () => {
    await service.createPeriod({
      tenantId: "tenant-1",
      scheduleId: "schedule-1",
      periodStart: new Date("2026-05-26"),
      periodEnd: new Date("2026-06-25"),
      payDate: new Date("2026-06-28"),
    });
    expect(mockRepo.checkOverlap).toHaveBeenCalled();
    expect(mockRepo.create).toHaveBeenCalled();
  });

  it("should throw if period overlaps", async () => {
    vi.mocked(mockRepo.checkOverlap).mockResolvedValue(true);

    await expect(
      service.createPeriod({
        tenantId: "tenant-1",
        scheduleId: "schedule-1",
        periodStart: new Date("2026-04-26"),
        periodEnd: new Date("2026-05-25"),
        payDate: new Date("2026-05-28"),
      }),
    ).rejects.toThrow();
  });

  it("should transition OPEN → PROCESSING", async () => {
    await service.startProcessing("period-1", "tenant-1");
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      "period-1",
      "tenant-1",
      "PROCESSING",
    );
  });

  it("should reject invalid transition OPEN → LOCKED", async () => {
    await expect(
      service.lock("period-1", "tenant-1", "user-1"),
    ).rejects.toThrow();
  });

  it("should transition CLOSED → LOCKED", async () => {
    const closedPeriod = { ...mockPeriod, status: "CLOSED" as const };
    vi.mocked(mockRepo.findById).mockResolvedValue(closedPeriod);
    vi.mocked(mockRepo.update).mockResolvedValue({
      ...closedPeriod,
      status: "LOCKED" as const,
      lockedAt: new Date(),
      lockedBy: "user-1",
    });

    await service.lock("period-1", "tenant-1", "user-1");
    expect(mockRepo.update).toHaveBeenCalled();
  });

  it("should unlock LOCKED period with reason", async () => {
    const lockedPeriod = {
      ...mockPeriod,
      status: "LOCKED" as const,
      unlockCount: 0,
    };
    vi.mocked(mockRepo.findById).mockResolvedValue(lockedPeriod);
    vi.mocked(mockRepo.update).mockResolvedValue({
      ...lockedPeriod,
      status: "CLOSED" as const,
      unlockCount: 1,
      unlockReason: "Koreksi data",
    });

    await service.unlock("period-1", "tenant-1", "Koreksi data");
    expect(mockRepo.update).toHaveBeenCalledWith(
      "period-1",
      "tenant-1",
      expect.objectContaining({
        status: "CLOSED",
        unlockReason: "Koreksi data",
        unlockCount: 1,
      }),
    );
  });
});
