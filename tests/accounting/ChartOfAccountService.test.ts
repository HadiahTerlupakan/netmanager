import { describe, expect, it, vi, beforeEach } from "vitest";
import { ChartOfAccountService } from "@/modules/accounting/services/coa/ChartOfAccountService";
import type { IChartOfAccountRepository } from "@/modules/accounting/domain/ports/IChartOfAccountRepository";
import type { ChartOfAccount } from "@/modules/accounting/domain/entities/ChartOfAccount";
import { AccountingError } from "@/modules/accounting/errors";

describe("ChartOfAccountService", () => {
  let service: ChartOfAccountService;
  let coaRepo: IChartOfAccountRepository;

  const mockCoa: ChartOfAccount = {
    id: "coa-1",
    tenantId: "tenant-1",
    code: "1-200",
    name: "Piutang Usaha",
    type: "ASSET",
    subtype: "CURRENT_ASSET",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    parentId: null,
    isPostable: true,
    isSystem: false,
    isActive: true,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    coaRepo = {
      create: vi.fn().mockResolvedValue(mockCoa),
      update: vi.fn().mockResolvedValue(mockCoa),
      findById: vi.fn().mockResolvedValue(mockCoa),
      findByCode: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([mockCoa]),
      delete: vi.fn(),
      countChildren: vi.fn().mockResolvedValue(0),
      countLines: vi.fn().mockResolvedValue(0),
    } as unknown as IChartOfAccountRepository;

    service = new ChartOfAccountService(coaRepo);
  });

  describe("create", () => {
    it("creates COA when code is unique", async () => {
      const result = await service.create("tenant-1", {
        code: "1-200",
        name: "Piutang",
        type: "ASSET",
        normalSide: "DEBIT",
      });
      expect(coaRepo.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("throws when code already exists", async () => {
      vi.mocked(coaRepo.findByCode).mockResolvedValue(mockCoa);
      await expect(
        service.create("tenant-1", {
          code: "1-200",
          name: "Duplicate",
          type: "ASSET",
          normalSide: "DEBIT",
        }),
      ).rejects.toThrow(AccountingError);
    });

    it("throws when parent not found", async () => {
      vi.mocked(coaRepo.findById).mockResolvedValue(null);
      await expect(
        service.create("tenant-1", {
          code: "1-201",
          name: "Child",
          type: "ASSET",
          normalSide: "DEBIT",
          parentId: "non-existent",
        }),
      ).rejects.toThrow(AccountingError);
    });
  });

  describe("delete", () => {
    it("deletes non-system COA with no children and no lines", async () => {
      await service.delete("coa-1");
      expect(coaRepo.delete).toHaveBeenCalledWith("coa-1");
    });

    it("throws when COA is system account", async () => {
      vi.mocked(coaRepo.findById).mockResolvedValue({
        ...mockCoa,
        isSystem: true,
      });
      await expect(service.delete("coa-1")).rejects.toThrow(/system/i);
    });

    it("throws when COA has children", async () => {
      vi.mocked(coaRepo.countChildren).mockResolvedValue(3);
      await expect(service.delete("coa-1")).rejects.toThrow(/child/i);
    });

    it("throws when COA has journal lines", async () => {
      vi.mocked(coaRepo.countLines).mockResolvedValue(5);
      await expect(service.delete("coa-1")).rejects.toThrow(/jurnal/i);
    });

    it("throws when COA not found", async () => {
      vi.mocked(coaRepo.findById).mockResolvedValue(null);
      await expect(service.delete("coa-999")).rejects.toThrow(AccountingError);
    });
  });

  describe("update", () => {
    it("throws when trying to set self as parent", async () => {
      await expect(
        service.update("coa-1", { parentId: "coa-1" }),
      ).rejects.toThrow(/parent dirinya sendiri/i);
    });
  });
});
