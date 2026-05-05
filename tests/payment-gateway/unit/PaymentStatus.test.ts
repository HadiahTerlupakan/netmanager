import { describe, it, expect } from "vitest";
import {
  PaymentStatus,
  isValidPaymentStatus,
} from "@/modules/payment-gateway/domain/value-objects/PaymentStatus";

describe("PaymentStatus", () => {
  it("should have all required status values", () => {
    expect(PaymentStatus.PENDING).toBe("PENDING");
    expect(PaymentStatus.PAID).toBe("PAID");
    expect(PaymentStatus.EXPIRED).toBe("EXPIRED");
    expect(PaymentStatus.CANCELLED).toBe("CANCELLED");
    expect(PaymentStatus.FAILED).toBe("FAILED");
  });

  it("should validate valid payment status", () => {
    expect(isValidPaymentStatus("PENDING")).toBe(true);
    expect(isValidPaymentStatus("PAID")).toBe(true);
    expect(isValidPaymentStatus("EXPIRED")).toBe(true);
    expect(isValidPaymentStatus("CANCELLED")).toBe(true);
    expect(isValidPaymentStatus("FAILED")).toBe(true);
  });

  it("should reject invalid payment status", () => {
    expect(isValidPaymentStatus("INVALID")).toBe(false);
    expect(isValidPaymentStatus("pending")).toBe(false);
    expect(isValidPaymentStatus("")).toBe(false);
  });
});
