import { describe, expect, it, vi } from "vitest";

import { PaymentGatewayTestService } from "@/modules/finance/services/PaymentGatewayTestService";

// Tes koneksi dulu hanya meneruskan API Key: Duitku dites dengan Merchant
// Code kosong sehingga selalu ditolak, apa pun kredensial yang diisi admin.
describe("PaymentGatewayTestService", () => {
  it("meneruskan Merchant Code dan secret dari form ke provider", async () => {
    const testProviderConnection = vi.fn().mockResolvedValue({ success: true });
    const service = new PaymentGatewayTestService({
      testProviderConnection,
    } as never);

    await service.testConnection({
      provider: "DUITKU",
      apiKey: " kunci ",
      apiSecret: "rahasia",
      merchantId: " DS123 ",
      isProduction: false,
    });

    expect(testProviderConnection).toHaveBeenCalledWith("DUITKU", {
      apiKey: "kunci",
      apiSecret: "rahasia",
      merchantId: "DS123",
      clientKey: "",
      isProduction: false,
    });
  });
});
