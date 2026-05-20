import { describe, expect, it, vi, beforeEach } from "vitest";
import { BankReconciliationService } from "@/modules/accounting/services/reconciliation/BankReconciliationService";
import type { IReconciliationRepository } from "@/modules/accounting/domain/ports/IReconciliationRepository";
import type { BankReconciliation } from "@/modules/accounting/domain/entities/BankReconciliation";
import { AccountingError } from "@/modules/accounting/errors";

describe("BankReconciliationService", () => {
  let service: BankReconciliationService;
  let reconRepo: IReconciliationRepository;

  const mockRecon: BankReconciliation = {
    id: "recon-1",
    tenantId: "tenant-1",
    coaId: "coa-bank",
    statementDate: new Date("2026-05-31"),
    statementBalance: "10000000.00",
    bookBalance: "9500000.00",
    reconciledBalance: "0.00",
    status: "DRAFT",
    completedAt: null,
    completedBy: null,
    lines: [
      {
        id: "line-1",
        reconciliationId: "recon-1",
        journalLineId: "jl-1",
        bankRefDate: new Date("2026-05-10"),
        bankRefDescription: "Transfer masuk",
        bankRefAmount: "500000.00",
        matchStatus: "MATCHED",
      },
      {
        id: "line-2",
        reconciliationId: "recon-1",
        journalLineId: null,
        bankRefDate: new Date("2026-05-15"),
        bankRefDescription: "Biaya admin",
        bankRefAmount: "50000.00",
        matchStatus: "UNMATCHED",
      },
    ],
  };

  beforeEach(() => {
    reconRepo = {
      create: vi.fn().mockResolvedValue(mockRecon),
      findById: vi.fn().mockResolvedValue(mockRecon),
      list: vi.fn().mockResolvedValue([mockRecon]),
      addLines: vi.fn(),
      updateLineMatch: vi.fn(),
      complete: vi
        .fn()
        .mockResolvedValue({ ...mockRecon, status: "COMPLETED" }),
    } as unknown as IReconciliationRepository;

    service = new BankReconciliationService(reconRepo);
  });

  describe("create", () => {
    it("creates reconciliation session", async () => {
      const result = await service.create("tenant-1", {
        coaId: "coa-bank",
        statementDate: new Date("2026-05-31"),
        statementBalance: "10000000.00",
        bookBalance: "9500000.00",
      });
      expect(reconRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "tenant-1", coaId: "coa-bank" }),
      );
      expect(result).toBeDefined();
    });
  });

  describe("loadBankRows", () => {
    it("adds bank statement rows as UNMATCHED lines", async () => {
      await service.loadBankRows("recon-1", [
        {
          date: new Date("2026-05-10"),
          description: "Transfer",
          amount: "500000",
        },
        {
          date: new Date("2026-05-11"),
          description: "Bayar",
          amount: "-100000",
        },
      ]);
      expect(reconRepo.addLines).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            matchStatus: "UNMATCHED",
            bankRefDescription: "Transfer",
          }),
          expect.objectContaining({
            matchStatus: "UNMATCHED",
            bankRefDescription: "Bayar",
          }),
        ]),
      );
    });
  });

  describe("manualMatch", () => {
    it("updates line match status to MANUAL_MATCH", async () => {
      await service.manualMatch("line-2", "jl-99");
      expect(reconRepo.updateLineMatch).toHaveBeenCalledWith(
        "line-2",
        "jl-99",
        "MANUAL_MATCH",
      );
    });
  });

  describe("complete", () => {
    it("completes reconciliation with matched total", async () => {
      const result = await service.complete("recon-1", "user-1");
      expect(reconRepo.complete).toHaveBeenCalledWith(
        "recon-1",
        "500000.00",
        "user-1",
      );
      expect(result.status).toBe("COMPLETED");
    });

    it("throws when reconciliation not found", async () => {
      vi.mocked(reconRepo.findById).mockResolvedValue(null);
      await expect(service.complete("recon-999", "user-1")).rejects.toThrow(
        AccountingError,
      );
    });

    it("throws when already completed", async () => {
      vi.mocked(reconRepo.findById).mockResolvedValue({
        ...mockRecon,
        status: "COMPLETED",
      });
      await expect(service.complete("recon-1", "user-1")).rejects.toThrow(
        AccountingError,
      );
    });
  });
});
