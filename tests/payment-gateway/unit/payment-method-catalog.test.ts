import { describe, expect, it } from "vitest";

import {
  findPaymentMethodProvider,
  getCustomerPaymentMethodsByProvider,
} from "@/modules/payment-gateway/services/payment-method-catalog";

const GATEWAYS = ["DUITKU", "MOOTA", "TRIPAY", "MIDTRANS", "XENDIT", "DANA"];

describe("katalog metode pembayaran", () => {
  // Dulu hanya Duitku dan Moota yang punya metode, jadi gateway lain yang
  // diaktifkan admin tidak pernah ditawarkan ke pelanggan.
  it.each(GATEWAYS)("%s menawarkan setidaknya satu metode", (provider) => {
    expect(
      getCustomerPaymentMethodsByProvider(provider).length,
    ).toBeGreaterThan(0);
  });

  it("kode metode unik di semua gateway sehingga gateway-nya bisa ditentukan", () => {
    const codes = GATEWAYS.flatMap((p) =>
      getCustomerPaymentMethodsByProvider(p).map((m) => m.code),
    );
    expect(new Set(codes).size).toBe(codes.length);
    for (const provider of GATEWAYS) {
      for (const method of getCustomerPaymentMethodsByProvider(provider)) {
        expect(findPaymentMethodProvider(method.code)).toBe(provider);
      }
    }
  });

  // Kode channel dari getpaymentmethod sandbox Duitku (2026-10-28).
  it("Duitku menawarkan DANA, OVO, ShopeePay dan LinkAja", () => {
    const codes = getCustomerPaymentMethodsByProvider("DUITKU")
      .filter((m) => m.type === "EWALLET")
      .map((m) => m.code);
    expect(codes).toEqual(["DA", "OV", "SA", "LA"]);
  });

  it("kode di luar katalog tidak menunjuk gateway mana pun", () => {
    expect(findPaymentMethodProvider("MANUAL_bank-1")).toBeNull();
    expect(findPaymentMethodProvider("ONLINE")).toBeNull();
  });
});
