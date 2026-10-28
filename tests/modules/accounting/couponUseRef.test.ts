import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { couponUseRef } from "@/modules/accounting/services/event-handlers/coupon-used-accounting.handler";

// Kunci per kupon membuat pemakaian kedua mendapat jurnal pemakaian pertama,
// sehingga potongannya tidak pernah mengkredit Piutang.
describe("kunci jurnal pemakaian kupon", () => {
  it("berbeda untuk setiap tagihan yang memakai kupon yang sama", () => {
    expect(couponUseRef("kupon-1", ["inv-1"])).not.toBe(
      couponUseRef("kupon-1", ["inv-2"]),
    );
  });

  it("tidak bergantung pada urutan tagihan", () => {
    expect(couponUseRef("kupon-1", ["inv-2", "inv-1"])).toBe(
      "kupon-1:inv-1,inv-2",
    );
  });
});
