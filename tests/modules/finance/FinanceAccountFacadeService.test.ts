import { describe, expect, it, vi } from "vitest";
import { FinanceAccountFacadeService } from "@/modules/finance/services/FinanceAccountFacadeService";

describe("FinanceAccountFacadeService", () => {
  it("creates active accounts with nullable optional fields", async () => {
    const financialAccountRepo = {
      create: vi.fn().mockResolvedValue({ id: "account-1" }),
      findActive: vi.fn(),
      transferBetweenAccounts: vi.fn(),
      findRecentMutations: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    };
    const service = new FinanceAccountFacadeService(financialAccountRepo);

    const result = await service.createAccount({
      name: "Cash",
      type: "CASH",
    });

    expect(financialAccountRepo.create).toHaveBeenCalledWith({
      name: "Cash",
      type: "CASH",
      accountNumber: null,
      description: null,
      balance: 0,
      isActive: true,
    });
    expect(result).toEqual({ id: "account-1" });
  });
});
