import { describe, it, expect } from "vitest";
import {
  PaymentMethod,
  normalizePaymentMethod,
} from "@/modules/payment-gateway/domain/value-objects/PaymentMethod";

describe("PaymentMethod", () => {
  it("should have all payment method values", () => {
    expect(PaymentMethod.BANK_TRANSFER).toBe("BANK_TRANSFER");
    expect(PaymentMethod.VIRTUAL_ACCOUNT).toBe("VIRTUAL_ACCOUNT");
    expect(PaymentMethod.EWALLET).toBe("EWALLET");
    expect(PaymentMethod.CREDIT_CARD).toBe("CREDIT_CARD");
    expect(PaymentMethod.QRIS).toBe("QRIS");
    expect(PaymentMethod.RETAIL).toBe("RETAIL");
    expect(PaymentMethod.MANUAL_TRANSFER).toBe("MANUAL_TRANSFER");
  });

  describe("normalizePaymentMethod", () => {
    it("should normalize bank transfer variations", () => {
      expect(normalizePaymentMethod("BANK_TRANSFER")).toBe(
        PaymentMethod.BANK_TRANSFER,
      );
      expect(normalizePaymentMethod("bank transfer")).toBe(
        PaymentMethod.BANK_TRANSFER,
      );
      expect(normalizePaymentMethod("BANK")).toBe(PaymentMethod.BANK_TRANSFER);
      expect(normalizePaymentMethod("transfer")).toBe(
        PaymentMethod.BANK_TRANSFER,
      );
    });

    it("should normalize virtual account variations", () => {
      expect(normalizePaymentMethod("VIRTUAL_ACCOUNT")).toBe(
        PaymentMethod.VIRTUAL_ACCOUNT,
      );
      expect(normalizePaymentMethod("VA")).toBe(PaymentMethod.VIRTUAL_ACCOUNT);
      expect(normalizePaymentMethod("virtual")).toBe(
        PaymentMethod.VIRTUAL_ACCOUNT,
      );
    });

    it("should normalize ewallet variations", () => {
      expect(normalizePaymentMethod("EWALLET")).toBe(PaymentMethod.EWALLET);
      expect(normalizePaymentMethod("OVO")).toBe(PaymentMethod.EWALLET);
      expect(normalizePaymentMethod("GOPAY")).toBe(PaymentMethod.EWALLET);
      expect(normalizePaymentMethod("DANA")).toBe(PaymentMethod.EWALLET);
    });

    it("should normalize credit card variations", () => {
      expect(normalizePaymentMethod("CREDIT_CARD")).toBe(
        PaymentMethod.CREDIT_CARD,
      );
      expect(normalizePaymentMethod("credit")).toBe(PaymentMethod.CREDIT_CARD);
      expect(normalizePaymentMethod("card")).toBe(PaymentMethod.CREDIT_CARD);
    });

    it("should normalize QRIS", () => {
      expect(normalizePaymentMethod("QRIS")).toBe(PaymentMethod.QRIS);
      expect(normalizePaymentMethod("qris")).toBe(PaymentMethod.QRIS);
    });

    it("should normalize retail variations", () => {
      expect(normalizePaymentMethod("RETAIL")).toBe(PaymentMethod.RETAIL);
      expect(normalizePaymentMethod("ALFAMART")).toBe(PaymentMethod.RETAIL);
      expect(normalizePaymentMethod("INDOMARET")).toBe(PaymentMethod.RETAIL);
    });

    it("should return null for unknown methods", () => {
      expect(normalizePaymentMethod("UNKNOWN")).toBe(null);
      expect(normalizePaymentMethod("")).toBe(null);
      expect(normalizePaymentMethod(null)).toBe(null);
      expect(normalizePaymentMethod(undefined)).toBe(null);
    });
  });
});
