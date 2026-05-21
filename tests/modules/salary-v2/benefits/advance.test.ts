import { describe, it, expect } from "vitest";
import { SalaryAdvanceService } from "@/modules/salary-v2/benefits/advance/SalaryAdvanceService";
import type { SalaryAdvancePolicy } from "@/modules/salary-v2/core";

const defaultPolicy: SalaryAdvancePolicy = {
  maxPercentOfSalary: 0.3,
  maxActiveAdvances: 2,
  minDaysBetweenRequests: 30,
  approvalRequired: true,
  deductionMethod: "FULL_NEXT",
  maxInstallments: 6,
};

describe("SalaryAdvanceService", () => {
  const service = new SalaryAdvanceService();

  describe("validateRequest", () => {
    it("should approve valid request within limits", () => {
      const result = service.validateRequest({
        requestedAmount: 2000000,
        basicSalary: 8000000,
        activeAdvanceCount: 0,
        lastRequestDate: null,
        requestDate: new Date("2026-05-15"),
        policy: defaultPolicy,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject if amount exceeds max percent of salary", () => {
      const result = service.validateRequest({
        requestedAmount: 3000000,
        basicSalary: 8000000,
        activeAdvanceCount: 0,
        lastRequestDate: null,
        requestDate: new Date("2026-05-15"),
        policy: defaultPolicy,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("EXCEEDS_MAX_PERCENT");
      expect(result.maxAllowed).toBe(2400000);
    });

    it("should reject if max active advances exceeded", () => {
      const result = service.validateRequest({
        requestedAmount: 1000000,
        basicSalary: 8000000,
        activeAdvanceCount: 2,
        lastRequestDate: null,
        requestDate: new Date("2026-05-15"),
        policy: defaultPolicy,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("MAX_ACTIVE_EXCEEDED");
    });

    it("should reject if too soon after last request", () => {
      const result = service.validateRequest({
        requestedAmount: 1000000,
        basicSalary: 8000000,
        activeAdvanceCount: 0,
        lastRequestDate: new Date("2026-05-01"),
        requestDate: new Date("2026-05-15"),
        policy: defaultPolicy,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("TOO_SOON");
    });

    it("should allow if enough days between requests", () => {
      const result = service.validateRequest({
        requestedAmount: 1000000,
        basicSalary: 8000000,
        activeAdvanceCount: 0,
        lastRequestDate: new Date("2026-04-01"),
        requestDate: new Date("2026-05-15"),
        policy: defaultPolicy,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe("calculateDeduction", () => {
    it("should calculate FULL_NEXT deduction", () => {
      const result = service.calculateDeduction({
        amount: 2000000,
        remainingAmount: 2000000,
        deductionMethod: "FULL_NEXT",
        installmentCount: null,
      });

      expect(result.deductionAmount).toBe(2000000);
    });

    it("should calculate INSTALLMENT deduction", () => {
      const result = service.calculateDeduction({
        amount: 3000000,
        remainingAmount: 3000000,
        deductionMethod: "INSTALLMENT",
        installmentCount: 3,
      });

      expect(result.deductionAmount).toBe(1000000);
    });

    it("should not exceed remaining amount for installment", () => {
      const result = service.calculateDeduction({
        amount: 3000000,
        remainingAmount: 500000,
        deductionMethod: "INSTALLMENT",
        installmentCount: 3,
      });

      expect(result.deductionAmount).toBe(500000);
    });
  });
});
