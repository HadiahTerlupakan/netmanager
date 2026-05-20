import { describe, expect, it, vi, beforeEach } from "vitest";
import { RecurringEngineService } from "@/modules/accounting/services/recurring/RecurringEngineService";
import type { IRecurringRepository } from "@/modules/accounting/domain/ports/IRecurringRepository";
import type { IJournalRepository } from "@/modules/accounting/domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "@/modules/accounting/domain/ports/IChartOfAccountRepository";
import type { IPeriodRepository } from "@/modules/accounting/domain/ports/IPeriodRepository";
import type { RecurringJournalTemplate } from "@/modules/accounting/domain/entities/RecurringJournalTemplate";
import type { AccountingPeriod } from "@/modules/accounting/domain/entities/AccountingPeriod";
import type { JournalEntry } from "@/modules/accounting/domain/entities/JournalEntry";

describe("RecurringEngineService", () => {
  let service: RecurringEngineService;
  let recurringRepo: IRecurringRepository;
  let journalRepo: IJournalRepository;
  let coaRepo: IChartOfAccountRepository;
  let periodRepo: IPeriodRepository;

  const mockTemplate: RecurringJournalTemplate = {
    id: "tpl-1",
    tenantId: "tenant-1",
    name: "Sewa Kantor",
    description: null,
    frequency: "MONTHLY",
    dayOfMonth: 5,
    startDate: new Date("2026-01-01"),
    endDate: null,
    templateLines: [
      {
        coaId: "coa-expense",
        side: "DEBIT",
        amount: "5000000",
        description: null,
      },
      {
        coaId: "coa-bank",
        side: "CREDIT",
        amount: "5000000",
        description: null,
      },
    ],
    isActive: true,
    lastGeneratedAt: null,
  };

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
    recurringRepo = {
      findDueToday: vi.fn().mockResolvedValue([mockTemplate]),
      markGenerated: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    } as unknown as IRecurringRepository;

    journalRepo = {
      create: vi.fn().mockResolvedValue({ id: "je-recurring" } as JournalEntry),
      findById: vi.fn(),
      findBySource: vi.fn().mockResolvedValue(null),
      list: vi.fn(),
      markReversed: vi.fn(),
      countByMonth: vi.fn().mockResolvedValue(0),
    } as unknown as IJournalRepository;

    coaRepo = {
      findById: vi.fn().mockResolvedValue({ id: "coa-1", isPostable: true }),
      findByCode: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
      countChildren: vi.fn(),
      countLines: vi.fn(),
    } as unknown as IChartOfAccountRepository;

    periodRepo = {
      findByDate: vi.fn().mockResolvedValue(mockPeriod),
      findById: vi.fn(),
      findByYearMonth: vi.fn().mockResolvedValue(mockPeriod),
      create: vi.fn(),
      updateStatus: vi.fn(),
      list: vi.fn(),
      lockForUpdate: vi.fn(),
    } as unknown as IPeriodRepository;

    service = new RecurringEngineService(
      recurringRepo,
      journalRepo,
      coaRepo,
      periodRepo,
    );
  });

  it("processes due templates and generates journals", async () => {
    const result = await service.processAll(new Date("2026-05-05"));
    expect(result.generated).toBe(1);
    expect(result.errors).toBe(0);
    expect(recurringRepo.markGenerated).toHaveBeenCalledWith(
      "tpl-1",
      expect.any(Date),
    );
    expect(journalRepo.create).toHaveBeenCalled();
  });

  it("skips QUARTERLY template when month is not quarter start", async () => {
    const quarterlyTemplate = {
      ...mockTemplate,
      frequency: "QUARTERLY" as const,
    };
    vi.mocked(recurringRepo.findDueToday).mockResolvedValue([
      quarterlyTemplate,
    ]);

    const result = await service.processAll(new Date("2026-05-05"));
    expect(result.skipped).toBe(1);
    expect(result.generated).toBe(0);
  });

  it("processes QUARTERLY template on quarter start month (Jan, Apr, Jul, Oct)", async () => {
    const quarterlyTemplate = {
      ...mockTemplate,
      frequency: "QUARTERLY" as const,
    };
    vi.mocked(recurringRepo.findDueToday).mockResolvedValue([
      quarterlyTemplate,
    ]);

    const result = await service.processAll(new Date("2026-01-05"));
    expect(result.generated).toBe(1);
  });

  it("skips YEARLY template when month is not January", async () => {
    const yearlyTemplate = { ...mockTemplate, frequency: "YEARLY" as const };
    vi.mocked(recurringRepo.findDueToday).mockResolvedValue([yearlyTemplate]);

    const result = await service.processAll(new Date("2026-05-05"));
    expect(result.skipped).toBe(1);
  });

  it("uses idempotent sourceRefId format: templateId-YYYY-MM", async () => {
    await service.processAll(new Date("2026-05-05"));
    const createCall = vi.mocked(journalRepo.findBySource).mock.calls[0];
    expect(createCall[2]).toBe("tpl-1-2026-05");
  });

  it("counts errors when journal creation fails", async () => {
    vi.mocked(journalRepo.findBySource).mockResolvedValue(null);
    vi.mocked(journalRepo.create).mockRejectedValue(new Error("DB error"));

    const result = await service.processAll(new Date("2026-05-05"));
    expect(result.errors).toBe(1);
    expect(result.generated).toBe(0);
  });

  it("returns zero counts when no templates due", async () => {
    vi.mocked(recurringRepo.findDueToday).mockResolvedValue([]);
    const result = await service.processAll(new Date("2026-05-05"));
    expect(result).toEqual({ generated: 0, skipped: 0, errors: 0 });
  });
});
