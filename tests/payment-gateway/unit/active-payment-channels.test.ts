import { beforeEach, describe, expect, it, vi } from "vitest";

import { getActivePaymentChannels } from "@/modules/payment-gateway/services/active-payment-channels";

const gateway = { getActivePaymentMethods: vi.fn() };
let tenantNumber = 0;

/** Tenant berbeda per tes: cache-nya hidup di tingkat module. */
const lookup = (amount = 100000) =>
  getActivePaymentChannels(
    { provider: "DUITKU", tenantId: `tenant-${tenantNumber}`, amount },
    gateway as never,
  );

describe("kanal pembayaran aktif", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantNumber += 1;
  });

  // Daftar kanal dibaca setiap kali pelanggan membuka pilihan metode.
  it("ditanyakan ke gateway sekali lalu disimpan", async () => {
    gateway.getActivePaymentMethods.mockResolvedValue(["BC", "SP"]);

    const first = await lookup();
    const second = await lookup();

    expect([...(first ?? [])]).toEqual(["BC", "SP"]);
    expect(second).toEqual(first);
    expect(gateway.getActivePaymentMethods).toHaveBeenCalledTimes(1);
    expect(gateway.getActivePaymentMethods).toHaveBeenCalledWith(
      "DUITKU",
      100000,
      `tenant-${tenantNumber}`,
    );
  });

  it("nominal berbeda ditanyakan sendiri", async () => {
    gateway.getActivePaymentMethods.mockResolvedValue(["SP"]);

    await lookup(11100);
    await lookup(222000);

    expect(gateway.getActivePaymentMethods).toHaveBeenCalledTimes(2);
  });

  it("gateway yang tidak terjangkau menghasilkan null, bukan daftar kosong", async () => {
    gateway.getActivePaymentMethods.mockRejectedValue(new Error("ETIMEDOUT"));

    await expect(lookup()).resolves.toBeNull();
    await expect(lookup()).resolves.toBeNull();
    // Kegagalan juga disimpan sebentar, agar halaman tidak menunggu Duitku
    // yang lambat di setiap pembukaan.
    expect(gateway.getActivePaymentMethods).toHaveBeenCalledTimes(1);
  });

  it("gateway tanpa daftar kanal menghasilkan null", async () => {
    gateway.getActivePaymentMethods.mockResolvedValue(null);

    await expect(lookup()).resolves.toBeNull();
  });
});
