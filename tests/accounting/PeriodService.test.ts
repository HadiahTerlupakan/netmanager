import { describe, expect, it, vi, beforeEach } from "vitest";
import { PeriodService } from "@/modules/accounting/services/period/PeriodService";
import type { IPeriodRepository } from "@/modules/accounting/domain/ports/IPeriodRepository";
import type { AccountingPeriod } from "@/modules/accounting/domain/entities/AccountingPeriod";

describe("PeriodService", () => {
  let service: PeriodService;
  let periodRepo: IPeriodRepository;

  const mockPeriod: AccountingPeriod = {
    id: "period-1",
    tenantId: "tenant-1",
    year: 2026,
    month: 5,
    status: "OPEN",
    closedAt: null,
    closedBy: null,
    startDate: new Date("2026-05-01"),
    endDate: new Date("2026-05-31"),
  };

  beforeEach(() => {
    periodRepo = {
      findById: vi.fn().mockResolvedValue(mockPeriod),
      findByYearMonth: vi.fn().mockResolvedValue(null),
      findByDate: vi.fn().mockResolvedValue(mockPeriod),
      create: vi.fn().mockResolvedValue(mockPeriod),
      updateStatus: vi.fn(),
      list: vi.fn().mockResolvedValue([mockPeriod]),
      lockForUpdate: vi.fn(),
    } as unknown as IPeriodRepository;

    service = new PeriodService(periodRepo);
  });

  describe("ensureCurrentPeriod", () => {
    it("returns existing period when found", async () => {
      vi.mocked(periodRepo.findByYearMonth).mockResolvedValue(mockPeriod);
      const result = await service.ensureCurrentPeriod(
        "tenant-1",
        new Date("2026-05-15"),
      );
      expect(result).toBe(mockPeriod);
      expect(periodRepo.create).not.toHaveBeenCalled();
    });

    it("creates new period when not found", async () => {
      vi.mocked(periodRepo.findByYearMonth).mockResolvedValue(null);
      await service.ensureCurrentPeriod("tenant-1", new Date("2026-05-15"));
      expect(periodRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          year: 2026,
          month: 5,
          status: "OPEN",
        }),
      );
    });

    it("calculates correct start/end dates", async () => {
      vi.mocked(periodRepo.findByYearMonth).mockResolvedValue(null);
      await service.ensureCurrentPeriod("tenant-1", new Date("2026-12-20"));
      expect(periodRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2026,
          month: 12,
          startDate: new Date(2026, 11, 1),
          endDate: new Date(2026, 12, 0),
        }),
      );
    });
  });

  describe("list", () => {
    it("returns periods for tenant", async () => {
      const result = await service.list("tenant-1");
      expect(periodRepo.list).toHaveBeenCalledWith("tenant-1");
      expect(result).toEqual([mockPeriod]);
    });
  });
});
