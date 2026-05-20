import { describe, expect, it, vi, beforeEach } from "vitest";
import { JournalReverseService } from "@/modules/accounting/services/journal/JournalReverseService";
import type { IJournalRepository } from "@/modules/accounting/domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "@/modules/accounting/domain/ports/IChartOfAccountRepository";
import type { IPeriodRepository } from "@/modules/accounting/domain/ports/IPeriodRepository";
import type { JournalEntry } from "@/modules/accounting/domain/entities/JournalEntry";
import type { AccountingPeriod } from "@/modules/accounting/domain/entities/AccountingPeriod";
import {
  JournalAlreadyReversedError,
  AccountingError,
  PeriodClosedError,
} from "@/modules/accounting/errors";

describe("JournalReverseService", () => {
  let service: JournalReverseService;
  let journalRepo: IJournalRepository;
  let coaRepo: IChartOfAccountRepository;
  let periodRepo: IPeriodRepository;

  const mockEntry: JournalEntry = {
    id: "je-1",
    tenantId: "tenant-1",
    entryNumber: "JV-2026-05-0001",
    entryDate: new Date("2026-05-15"),
    periodId: "period-1",
    source: "MANUAL",
    sourceRefType: null,
    sourceRefId: null,
    description: "Test journal",
    status: "POSTED",
    reversalOfId: null,
    postedAt: new Date(),
    postedBy: "user-1",
    lines: [
      {
        id: "jl-1",
        entryId: "je-1",
        coaId: "coa-1",
        side: "DEBIT",
        amount: "100000.00",
        description: null,
        lineOrder: 1,
      },
      {
        id: "jl-2",
        entryId: "je-1",
        coaId: "coa-2",
        side: "CREDIT",
        amount: "100000.00",
        description: null,
        lineOrder: 2,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
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
    journalRepo = {
      create: vi
        .fn()
        .mockResolvedValue({
          id: "je-reversal",
          entryNumber: "JV-2026-05-0002",
        } as JournalEntry),
      findById: vi.fn().mockResolvedValue(mockEntry),
      findBySource: vi.fn().mockResolvedValue(null),
      list: vi.fn(),
      markReversed: vi.fn(),
      countByMonth: vi.fn().mockResolvedValue(1),
    } as unknown as IJournalRepository;

    coaRepo = {
      findById: vi.fn(),
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
      findByYearMonth: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      list: vi.fn(),
      lockForUpdate: vi.fn(),
    } as unknown as IPeriodRepository;

    service = new JournalReverseService(journalRepo, coaRepo, periodRepo);
  });

  it("reverses a POSTED journal — creates reversal with flipped DR/CR", async () => {
    const result = await service.reverse("je-1", "Koreksi", "user-1");
    expect(journalRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "REVERSAL",
        reversalOfId: "je-1",
      }),
    );
    expect(journalRepo.markReversed).toHaveBeenCalledWith(
      "je-1",
      "je-reversal",
    );
    expect(result).toBeDefined();
  });

  it("reversal lines are flipped (DEBIT→CREDIT, CREDIT→DEBIT)", async () => {
    await service.reverse("je-1", "Koreksi", "user-1");
    const createCall = vi.mocked(journalRepo.create).mock.calls[0][0];
    expect(createCall.lines[0].side).toBe("CREDIT");
    expect(createCall.lines[1].side).toBe("DEBIT");
  });

  it("throws JournalAlreadyReversedError when status is REVERSED", async () => {
    vi.mocked(journalRepo.findById).mockResolvedValue({
      ...mockEntry,
      status: "REVERSED",
    });
    await expect(service.reverse("je-1", "reason", "user-1")).rejects.toThrow(
      JournalAlreadyReversedError,
    );
  });

  it("throws when journal not found", async () => {
    vi.mocked(journalRepo.findById).mockResolvedValue(null);
    await expect(service.reverse("je-999", "reason", "user-1")).rejects.toThrow(
      AccountingError,
    );
  });

  it("throws when journal status is DRAFT", async () => {
    vi.mocked(journalRepo.findById).mockResolvedValue({
      ...mockEntry,
      status: "DRAFT",
    });
    await expect(service.reverse("je-1", "reason", "user-1")).rejects.toThrow(
      AccountingError,
    );
  });

  it("throws PeriodClosedError when current period is CLOSED", async () => {
    vi.mocked(periodRepo.findByDate).mockResolvedValue({
      ...mockPeriod,
      status: "CLOSED",
    });
    await expect(service.reverse("je-1", "reason", "user-1")).rejects.toThrow(
      PeriodClosedError,
    );
  });
});
