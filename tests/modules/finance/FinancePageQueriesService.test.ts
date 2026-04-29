import { describe, expect, it, vi } from "vitest";
import { FinancePageQueriesService } from "@/modules/finance/services/FinancePageQueriesService";

describe("FinancePageQueriesService", () => {
  it("returns unpaid purchase orders with related expense transactions", async () => {
    const repository = {
      findUnpaidBillsPageData: vi.fn().mockResolvedValue({
        unpaidPos: [
          {
            id: "po-1",
            poNumber: "PO-001",
            transactions: [{ amount: 150000 }],
          },
        ],
        accounts: [{ id: "account-1", name: "Cash" }],
      }),
    };
    const service = new FinancePageQueriesService(repository);

    const result = await service.getUnpaidBillsPageData();

    expect(repository.findUnpaidBillsPageData).toHaveBeenCalledOnce();
    expect(result.unpaidPos[0]?.transactions).toEqual([{ amount: 150000 }]);
    expect(result.accounts).toEqual([{ id: "account-1", name: "Cash" }]);
  });
});
