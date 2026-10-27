import { describe, expect, it } from "vitest";

import { getGatewayCredentialFields } from "@/app/admin/pengaturan/payment-gateway/components/gateway-credential-fields";

describe("kolom kredensial gateway", () => {
  // Duitku hanya memakai API Key dan Merchant Code; form dulu meminta
  // "API Secret" untuk semua gateway.
  it("Duitku hanya meminta API Key dan Merchant Code", () => {
    expect(getGatewayCredentialFields("DUITKU")).toEqual({
      apiKey: "API Key",
      merchantId: "Merchant Code",
    });
  });

  it("Tripay meminta Private Key sebagai secret", () => {
    expect(getGatewayCredentialFields("TRIPAY").apiSecret).toBe("Private Key");
  });

  it("Midtrans memakai Server Key dan Client Key tanpa secret", () => {
    const fields = getGatewayCredentialFields("MIDTRANS");
    expect(fields.apiSecret).toBeUndefined();
    expect(fields.clientKey).toBe("Client Key");
  });
});
