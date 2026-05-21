import { describe, it, expect } from "vitest";
import type { TenantPayrollConfig } from "@/modules/salary-v2/core/config/TenantPayrollConfig";
import { DEFAULT_BPJS_CONFIG } from "@/modules/salary-v2/core/config/BpjsConfig";
import { DEFAULT_TAX_CONFIG } from "@/modules/salary-v2/core/config/TaxConfig";
import { DEFAULT_OVERTIME_CONFIG } from "@/modules/salary-v2/core/config/OvertimeConfig";
import { OvertimeDayType } from "@/modules/salary-v2/core/domain/enums";

describe("Configuration Types", () => {
  describe("BpjsConfig", () => {
    it("should have correct default BPJS rates", () => {
      expect(DEFAULT_BPJS_CONFIG.kesehatan.employeeRate).toBe(0.01);
      expect(DEFAULT_BPJS_CONFIG.kesehatan.employerRate).toBe(0.04);
      expect(DEFAULT_BPJS_CONFIG.kesehatan.maxBase).toBe(12000000);
      expect(DEFAULT_BPJS_CONFIG.jht.employeeRate).toBe(0.02);
      expect(DEFAULT_BPJS_CONFIG.jht.employerRate).toBe(0.037);
      expect(DEFAULT_BPJS_CONFIG.jp.employeeRate).toBe(0.01);
      expect(DEFAULT_BPJS_CONFIG.jp.employerRate).toBe(0.02);
      expect(DEFAULT_BPJS_CONFIG.jp.maxBase).toBe(10042000);
      expect(DEFAULT_BPJS_CONFIG.jp.maxAge).toBe(57);
      expect(DEFAULT_BPJS_CONFIG.jkk.employerRate).toBe(0.0024);
      expect(DEFAULT_BPJS_CONFIG.jkm.employerRate).toBe(0.003);
    });
  });

  describe("TaxConfig", () => {
    it("should have correct default tax config", () => {
      expect(DEFAULT_TAX_CONFIG.defaultMethod).toBe("NET");
      expect(DEFAULT_TAX_CONFIG.npwpSurcharge).toBe(0.2);
      expect(DEFAULT_TAX_CONFIG.biayaJabatanRate).toBe(0.05);
      expect(DEFAULT_TAX_CONFIG.biayaJabatanMax).toBe(500000);
      expect(DEFAULT_TAX_CONFIG.biayaJabatanMaxAnnual).toBe(6000000);
      expect(DEFAULT_TAX_CONFIG.annualCorrectionMonth).toBe(12);
    });

    it("should have progressive rates matching Pasal 17", () => {
      const rates = DEFAULT_TAX_CONFIG.progressiveRates;
      expect(rates).toHaveLength(5);
      expect(rates[0]).toEqual({
        minAmount: 0,
        maxAmount: 60000000,
        rate: 0.05,
      });
      expect(rates[1]).toEqual({
        minAmount: 60000000,
        maxAmount: 250000000,
        rate: 0.15,
      });
      expect(rates[2]).toEqual({
        minAmount: 250000000,
        maxAmount: 500000000,
        rate: 0.25,
      });
      expect(rates[3]).toEqual({
        minAmount: 500000000,
        maxAmount: 5000000000,
        rate: 0.3,
      });
      expect(rates[4]).toEqual({
        minAmount: 5000000000,
        maxAmount: null,
        rate: 0.35,
      });
    });
  });

  describe("OvertimeConfig", () => {
    it("should have correct default overtime config (PP 35/2021)", () => {
      expect(DEFAULT_OVERTIME_CONFIG.maxHoursPerDay).toBe(4);
      expect(DEFAULT_OVERTIME_CONFIG.maxHoursPerWeek).toBe(18);
      expect(DEFAULT_OVERTIME_CONFIG.rateBase).toBe("1/173");
      expect(DEFAULT_OVERTIME_CONFIG.capEnforcement).toBe("SOFT_WARNING");
    });

    it("should have correct workday tiers", () => {
      const workdayTiers = DEFAULT_OVERTIME_CONFIG.tiers.filter(
        (t) => t.dayType === OvertimeDayType.WORKDAY,
      );
      expect(workdayTiers).toHaveLength(2);
      expect(workdayTiers[0]).toEqual({
        dayType: "WORKDAY",
        fromHour: 0,
        toHour: 1,
        multiplier: 1.5,
      });
      expect(workdayTiers[1]).toEqual({
        dayType: "WORKDAY",
        fromHour: 1,
        toHour: null,
        multiplier: 2,
      });
    });

    it("should have correct holiday tiers", () => {
      const holidayTiers = DEFAULT_OVERTIME_CONFIG.tiers.filter(
        (t) => t.dayType === OvertimeDayType.HOLIDAY,
      );
      expect(holidayTiers).toHaveLength(3);
      expect(holidayTiers[0].multiplier).toBe(2);
      expect(holidayTiers[1].multiplier).toBe(3);
      expect(holidayTiers[2].multiplier).toBe(4);
    });
  });

  describe("TenantPayrollConfig", () => {
    it("should compose all sub-configs", () => {
      const config: TenantPayrollConfig = {
        tenantId: "tenant-1",
        bpjs: DEFAULT_BPJS_CONFIG,
        tax: DEFAULT_TAX_CONFIG,
        overtime: DEFAULT_OVERTIME_CONFIG,
        thrConfig: {
          eligibleAfterMonths: 1,
          fullEntitlementMonths: 12,
          prorata: true,
          components: ["BASIC_SALARY"],
          paymentDeadlineDays: 7,
        },
        advancePolicy: {
          maxPercentOfSalary: 0.3,
          maxActiveAdvances: 2,
          minDaysBetweenRequests: 30,
          approvalRequired: true,
          deductionMethod: "FULL_NEXT",
          maxInstallments: 6,
        },
        periodLocking: {
          autoLockAfterPaid: true,
          autoLockDelayDays: 3,
          requireApprovalToUnlock: true,
          maxUnlockCount: 2,
        },
      };
      expect(config.bpjs.kesehatan.employeeRate).toBe(0.01);
      expect(config.thrConfig.eligibleAfterMonths).toBe(1);
      expect(config.advancePolicy.maxPercentOfSalary).toBe(0.3);
      expect(config.periodLocking.autoLockAfterPaid).toBe(true);
    });
  });
});
