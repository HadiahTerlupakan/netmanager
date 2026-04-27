import { describe, expect, it, vi } from "vitest";
import { CustomerPaymentMethodService } from "@/modules/finance";

const gatewayManager = {
  getEnabledProviders: vi.fn(),
};
const bankAccountRepository = {
  findActive: vi.fn(),
};

describe("CustomerPaymentMethodService", () => {
  it("menggabungkan metode provider dan rekening manual aktif", async () => {
    gatewayManager.getEnabledProviders.mockResolvedValue([
      { provider: "MOOTA" },
    ]);
    bankAccountRepository.findActive.mockResolvedValue([
      {
        id: "bank-1",
        bankName: "BCA",
        accountName: "PT Net",
        accountNumber: "123",
      },
    ]);
    const service = new CustomerPaymentMethodService(
      gatewayManager as never,
      bankAccountRepository as never,
    );

    const methods = await service.getCustomerPaymentMethods();

    expect(methods).toContainEqual(
      expect.objectContaining({ id: "manual_bank-1", code: "MANUAL_bank-1" }),
    );
    expect(methods.some((method) => method.provider === "MOOTA")).toBe(true);
  });
});
