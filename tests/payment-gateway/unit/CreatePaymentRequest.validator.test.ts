import { describe, it, expect } from "vitest";
import {
  validateCreatePaymentRequest,
  ValidationError,
} from "@/modules/payment-gateway/validators/CreatePaymentRequest.validator";

describe("CreatePaymentRequest Validator", () => {
  const validData = {
    orderId: "INV-001",
    amount: 100000,
    customerName: "John Doe",
    customerEmail: "john@example.com",
    customerPhone: "081234567890",
    description: "Payment for invoice INV-001",
  };

  it("should validate correct payment request", () => {
    const result = validateCreatePaymentRequest(validData);
    expect(result).toEqual({
      ...validData,
      expiryHours: 24, // default value
    });
  });

  it("should accept optional fields", () => {
    const dataWithOptional = {
      ...validData,
      expiryHours: 48,
      paymentMethods: ["BANK_TRANSFER", "EWALLET"],
      tenantId: "tenant-123",
    };

    const result = validateCreatePaymentRequest(dataWithOptional);
    expect(result).toEqual(dataWithOptional);
  });

  it("should reject missing required fields", () => {
    const invalidData = {
      orderId: "INV-001",
      // missing amount
      customerName: "John Doe",
    };

    expect(() => validateCreatePaymentRequest(invalidData)).toThrow(
      ValidationError,
    );
  });

  it("should reject invalid email", () => {
    const invalidData = {
      ...validData,
      customerEmail: "invalid-email",
    };

    expect(() => validateCreatePaymentRequest(invalidData)).toThrow(
      ValidationError,
    );
  });

  it("should reject invalid phone number", () => {
    const invalidData = {
      ...validData,
      customerPhone: "123", // too short
    };

    expect(() => validateCreatePaymentRequest(invalidData)).toThrow(
      ValidationError,
    );
  });

  it("should reject negative amount", () => {
    const invalidData = {
      ...validData,
      amount: -1000,
    };

    expect(() => validateCreatePaymentRequest(invalidData)).toThrow(
      ValidationError,
    );
  });

  it("should accept valid Indonesian phone formats", () => {
    const phoneFormats = [
      "081234567890",
      "6281234567890",
      "+6281234567890",
      "08123456789",
    ];

    phoneFormats.forEach((phone) => {
      const data = { ...validData, customerPhone: phone };
      const result = validateCreatePaymentRequest(data);
      expect(result.customerPhone).toBe(phone);
    });
  });
});
