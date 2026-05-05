import { describe, it, expect } from "vitest";
import {
  ProviderType,
  isValidProviderType,
  SIGNATURE_REQUIRED,
} from "@/modules/payment-gateway/domain/value-objects/ProviderType";

describe("ProviderType", () => {
  it("should have all supported providers", () => {
    expect(ProviderType.XENDIT).toBe("XENDIT");
    expect(ProviderType.MIDTRANS).toBe("MIDTRANS");
    expect(ProviderType.DUITKU).toBe("DUITKU");
    expect(ProviderType.BRI).toBe("BRI");
    expect(ProviderType.BCA).toBe("BCA");
    expect(ProviderType.TRIPAY).toBe("TRIPAY");
    expect(ProviderType.DANA).toBe("DANA");
    expect(ProviderType.MOOTA).toBe("MOOTA");
  });

  it("should validate valid provider types", () => {
    expect(isValidProviderType("XENDIT")).toBe(true);
    expect(isValidProviderType("MIDTRANS")).toBe(true);
    expect(isValidProviderType("MOOTA")).toBe(true);
  });

  it("should reject invalid provider types", () => {
    expect(isValidProviderType("INVALID")).toBe(false);
    expect(isValidProviderType("xendit")).toBe(false);
    expect(isValidProviderType("")).toBe(false);
  });

  it("should have signature requirements defined", () => {
    expect(SIGNATURE_REQUIRED.XENDIT).toBe(true);
    expect(SIGNATURE_REQUIRED.MIDTRANS).toBe(true);
    expect(SIGNATURE_REQUIRED.DUITKU).toBe(false);
  });
});
