import { describe, expect, it } from "vitest";
import {
  canRequestPackageUpgrade,
  canUseCustomerPortal,
} from "@/lib/customer-portal-access";

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

describe("canRequestPackageUpgrade", () => {
  it("hanya mengizinkan pelanggan AKTIF, sama seperti server", () => {
    expect(canRequestPackageUpgrade("AKTIF")).toBe(true);
    for (const status of ["ISOLIR", "NONAKTIF", "MAINTENANCE", undefined]) {
      expect(canRequestPackageUpgrade(status)).toBe(false);
    }
  });
});
