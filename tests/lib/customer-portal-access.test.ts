import { describe, expect, it } from "vitest";
import { canUseCustomerPortal } from "@/lib/customer-portal-access";

describe("canUseCustomerPortal", () => {
  it.each(["AKTIF", "ISOLIR", "NONAKTIF", "MAINTENANCE"])(
    "mengizinkan status %s",
    (status) => {
      expect(canUseCustomerPortal(status)).toBe(true);
    },
  );

  it("menutup portal untuk pelanggan dismantle dan status kosong", () => {
    expect(canUseCustomerPortal("DISMANTLE")).toBe(false);
    expect(canUseCustomerPortal(null)).toBe(false);
    expect(canUseCustomerPortal("")).toBe(false);
  });
});
