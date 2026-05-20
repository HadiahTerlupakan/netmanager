import { describe, expect, it, vi, beforeEach } from "vitest";
import { JournalPostingService } from "@/modules/accounting/services/journal/JournalPostingService";
import { JournalNumberGenerator } from "@/modules/accounting/services/journal/JournalNumberGenerator";
import {
  JournalUnbalancedError,
  PeriodClosedError,
  CoaNotFoundError,
  CoaNotPostableError,
} from "@/modules/accounting/errors";
import type { IJournalRepository } from "@/modules/accounting/domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "@/modules/accounting/domain/ports/IChartOfAccountRepository";
import type { IPeriodRepository } from "@/modules/accounting/domain/ports/IPeriodRepository";
import type { JournalEntry } from "@/modules/accounting/domain/entities/JournalEntry";

describe("JournalPostingService", () => {
  let service: JournalPostingService;
  let journalRepo: IJournalRepository;
  let coaRepo: IChartOfAccountRepository;
  let periodRepo: IPeriodRepository;

  const mockPeriod = {
    id: "period-1",
    tenantId: "tenant-1",
    year: 2026,
    month: 5,
    status: "OPEN" as const,
    closedAt: null,
    closedBy: null,
    startDate: new Date("2026-05-01"),
    endDate: new Date("2026-05-31"),
  };

  const mockCoa = {
    id: "coa-1",
    tenantId: "tenant-1",
    code: "1-200",
    name: "Piutang",
    type: "ASSET" as const,
    subtype: null,
    normalSide: "DEBIT" as const,
    cashFlowCategory: null,
    parentId: null,
    isPostable: true,
    isSystem: true,
    isActive: true,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    journalRepo = {
      create: vi.fn().mockResolvedValue({
        id: "je-1",
        entryNumber: "JV-2026-05-0001",
      } as JournalEntry),
      findById: vi.fn(),
      findBySource: vi.fn().mockResolvedValue(null),
      list: vi.fn(),
      markReversed: vi.fn(),
      countByMonth: vi.fn().mockResolvedValue(0),
    } as unknown as IJournalRepository;

    coaRepo = {
      findById: vi.fn().mockResolvedValue(mockCoa),
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

    const numberGen = new JournalNumberGenerator(journalRepo);
    service = new JournalPostingService(
      journalRepo,
      coaRepo,
      periodRepo,
      numberGen,
    );
  });

  describe("postManual", () => {
    const validDto = {
      entryDate: new Date("2026-05-15"),
      description: "Test manual journal",
      lines: [
        { coaId: "coa-1", side: "DEBIT" as const, amount: "100000.00" },
        { coaId: "coa-2", side: "CREDIT" as const, amount: "100000.00" },
      ],
    };

    it("creates a POSTED journal when valid", async () => {
      const result = await service.postManual("tenant-1", validDto, "user-1");
      expect(journalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          source: "MANUAL",
          status: "POSTED",
          postedBy: "user-1",
        }),
      );
      expect(result).toBeDefined();
    });

    it("throws JournalUnbalancedError when lines unbalanced", async () => {
      const unbalanced = {
        ...validDto,
        lines: [
          { coaId: "coa-1", side: "DEBIT" as const, amount: "100000.00" },
          { coaId: "coa-2", side: "CREDIT" as const, amount: "50000.00" },
        ],
      };
      await expect(
        service.postManual("tenant-1", unbalanced, "user-1"),
      ).rejects.toThrow(JournalUnbalancedError);
    });

    it("throws PeriodClosedError when period is CLOSED", async () => {
      vi.mocked(periodRepo.findByDate).mockResolvedValue({
        ...mockPeriod,
        status: "CLOSED",
      });
      await expect(
        service.postManual("tenant-1", validDto, "user-1"),
      ).rejects.toThrow(PeriodClosedError);
    });

    it("throws CoaNotFoundError when COA does not exist", async () => {
      vi.mocked(coaRepo.findById).mockResolvedValue(null);
      await expect(
        service.postManual("tenant-1", validDto, "user-1"),
      ).rejects.toThrow(CoaNotFoundError);
    });

    it("throws CoaNotPostableError when COA is header account", async () => {
      vi.mocked(coaRepo.findById).mockResolvedValue({
        ...mockCoa,
        isPostable: false,
      });
      await expect(
        service.postManual("tenant-1", validDto, "user-1"),
      ).rejects.toThrow(CoaNotPostableError);
    });
  });

  describe("postAuto", () => {
    const autoParams = {
      source: "AUTO_INVOICE_PAID" as const,
      sourceRefType: "Invoice",
      sourceRefId: "inv-123",
      entryDate: new Date("2026-05-15"),
      description: "Auto journal invoice paid",
      lines: [
        { coaId: "coa-1", side: "DEBIT" as const, amount: "100000.00" },
        { coaId: "coa-2", side: "CREDIT" as const, amount: "100000.00" },
      ],
    };

    it("creates journal when no duplicate exists", async () => {
      const result = await service.postAuto("tenant-1", autoParams);
      expect(journalRepo.findBySource).toHaveBeenCalledWith(
        "tenant-1",
        "AUTO_INVOICE_PAID",
        "inv-123",
      );
      expect(journalRepo.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("returns existing journal when duplicate found (idempotent)", async () => {
      const existing = {
        id: "je-existing",
        entryNumber: "JV-2026-05-0001",
      } as JournalEntry;
      vi.mocked(journalRepo.findBySource).mockResolvedValue(existing);
      const result = await service.postAuto("tenant-1", autoParams);
      expect(journalRepo.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });
});
