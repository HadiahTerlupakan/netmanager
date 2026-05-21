import { describe, it, expect } from "vitest";
import {
  PayrollRunStatus,
  PayrollEntryStatus,
  PayrollRunType,
  EmployeeType,
  TaxMethod,
  PayFrequency,
  ComponentCategory,
  ComponentCalculationType,
  PaymentBatchStatus,
  PaymentItemStatus,
  PayrollPeriodStatus,
  SalaryAdvanceStatus,
  AuditAction,
  ComplianceSeverity,
  OvertimeDayType,
  OvertimeCapEnforcement,
} from "@/modules/salary-v2/core/domain/enums";

describe("Salary V2 Enums", () => {
  describe("PayrollRunStatus", () => {
    it("should have all workflow statuses", () => {
      expect(PayrollRunStatus.DRAFT).toBe("DRAFT");
      expect(PayrollRunStatus.CALCULATING).toBe("CALCULATING");
      expect(PayrollRunStatus.CALCULATED).toBe("CALCULATED");
      expect(PayrollRunStatus.AUDITED).toBe("AUDITED");
      expect(PayrollRunStatus.APPROVED).toBe("APPROVED");
      expect(PayrollRunStatus.PAID).toBe("PAID");
      expect(PayrollRunStatus.CLOSED).toBe("CLOSED");
      expect(PayrollRunStatus.REJECTED).toBe("REJECTED");
      expect(PayrollRunStatus.REVISION_REQUESTED).toBe("REVISION_REQUESTED");
    });
  });

  describe("PayrollEntryStatus", () => {
    it("should have all entry statuses", () => {
      expect(PayrollEntryStatus.PENDING).toBe("PENDING");
      expect(PayrollEntryStatus.CALCULATED).toBe("CALCULATED");
      expect(PayrollEntryStatus.ERROR).toBe("ERROR");
      expect(PayrollEntryStatus.APPROVED).toBe("APPROVED");
      expect(PayrollEntryStatus.PAID).toBe("PAID");
    });
  });

  describe("PayrollRunType", () => {
    it("should have all run types", () => {
      expect(PayrollRunType.REGULAR).toBe("REGULAR");
      expect(PayrollRunType.THR).toBe("THR");
      expect(PayrollRunType.BONUS).toBe("BONUS");
      expect(PayrollRunType.RAPEL).toBe("RAPEL");
      expect(PayrollRunType.ADVANCE).toBe("ADVANCE");
    });
  });

  describe("EmployeeType", () => {
    it("should have all employee types", () => {
      expect(EmployeeType.PKWTT).toBe("PKWTT");
      expect(EmployeeType.PKWT).toBe("PKWT");
      expect(EmployeeType.DAILY).toBe("DAILY");
      expect(EmployeeType.FREELANCE).toBe("FREELANCE");
    });
  });

  describe("TaxMethod", () => {
    it("should have all tax methods", () => {
      expect(TaxMethod.NET).toBe("NET");
      expect(TaxMethod.GROSS_UP).toBe("GROSS_UP");
      expect(TaxMethod.NETT).toBe("NETT");
    });
  });

  describe("PayFrequency", () => {
    it("should have all frequencies", () => {
      expect(PayFrequency.MONTHLY).toBe("MONTHLY");
      expect(PayFrequency.BI_WEEKLY).toBe("BI_WEEKLY");
      expect(PayFrequency.WEEKLY).toBe("WEEKLY");
      expect(PayFrequency.DAILY).toBe("DAILY");
      expect(PayFrequency.ON_DEMAND).toBe("ON_DEMAND");
    });
  });

  describe("ComponentCategory", () => {
    it("should have all categories", () => {
      expect(ComponentCategory.EARNING).toBe("EARNING");
      expect(ComponentCategory.DEDUCTION).toBe("DEDUCTION");
      expect(ComponentCategory.TAX).toBe("TAX");
      expect(ComponentCategory.EMPLOYER_COST).toBe("EMPLOYER_COST");
    });
  });

  describe("ComponentCalculationType", () => {
    it("should have all calculation types", () => {
      expect(ComponentCalculationType.FIXED).toBe("FIXED");
      expect(ComponentCalculationType.PERCENTAGE).toBe("PERCENTAGE");
      expect(ComponentCalculationType.FORMULA).toBe("FORMULA");
      expect(ComponentCalculationType.PER_HOUR).toBe("PER_HOUR");
      expect(ComponentCalculationType.PER_DAY).toBe("PER_DAY");
      expect(ComponentCalculationType.PER_UNIT).toBe("PER_UNIT");
    });
  });

  describe("PaymentBatchStatus", () => {
    it("should have all batch statuses", () => {
      expect(PaymentBatchStatus.PENDING).toBe("PENDING");
      expect(PaymentBatchStatus.PROCESSING).toBe("PROCESSING");
      expect(PaymentBatchStatus.COMPLETED).toBe("COMPLETED");
      expect(PaymentBatchStatus.PARTIAL_FAILED).toBe("PARTIAL_FAILED");
    });
  });

  describe("SalaryAdvanceStatus", () => {
    it("should have all advance statuses", () => {
      expect(SalaryAdvanceStatus.PENDING).toBe("PENDING");
      expect(SalaryAdvanceStatus.APPROVED).toBe("APPROVED");
      expect(SalaryAdvanceStatus.DISBURSED).toBe("DISBURSED");
      expect(SalaryAdvanceStatus.DEDUCTED).toBe("DEDUCTED");
      expect(SalaryAdvanceStatus.REJECTED).toBe("REJECTED");
    });
  });

  describe("PaymentItemStatus", () => {
    it("should have all item statuses", () => {
      expect(PaymentItemStatus.PENDING).toBe("PENDING");
      expect(PaymentItemStatus.SUCCESS).toBe("SUCCESS");
      expect(PaymentItemStatus.FAILED).toBe("FAILED");
      expect(PaymentItemStatus.RETRY).toBe("RETRY");
    });
  });

  describe("PayrollPeriodStatus", () => {
    it("should have all period statuses", () => {
      expect(PayrollPeriodStatus.OPEN).toBe("OPEN");
      expect(PayrollPeriodStatus.PROCESSING).toBe("PROCESSING");
      expect(PayrollPeriodStatus.CLOSED).toBe("CLOSED");
      expect(PayrollPeriodStatus.LOCKED).toBe("LOCKED");
    });
  });

  describe("AuditAction", () => {
    it("should have all audit actions", () => {
      expect(AuditAction.CREATED).toBe("CREATED");
      expect(AuditAction.UPDATED).toBe("UPDATED");
      expect(AuditAction.DELETED).toBe("DELETED");
      expect(AuditAction.STATUS_CHANGED).toBe("STATUS_CHANGED");
      expect(AuditAction.RECALCULATED).toBe("RECALCULATED");
      expect(AuditAction.LOCKED).toBe("LOCKED");
      expect(AuditAction.UNLOCKED).toBe("UNLOCKED");
    });
  });

  describe("ComplianceSeverity", () => {
    it("should have all severity levels", () => {
      expect(ComplianceSeverity.ERROR).toBe("ERROR");
      expect(ComplianceSeverity.WARNING).toBe("WARNING");
    });
  });

  describe("OvertimeDayType", () => {
    it("should have all day types", () => {
      expect(OvertimeDayType.WORKDAY).toBe("WORKDAY");
      expect(OvertimeDayType.HOLIDAY).toBe("HOLIDAY");
      expect(OvertimeDayType.NATIONAL_HOLIDAY).toBe("NATIONAL_HOLIDAY");
    });
  });

  describe("OvertimeCapEnforcement", () => {
    it("should have all enforcement types", () => {
      expect(OvertimeCapEnforcement.HARD_BLOCK).toBe("HARD_BLOCK");
      expect(OvertimeCapEnforcement.SOFT_WARNING).toBe("SOFT_WARNING");
      expect(OvertimeCapEnforcement.LOG_ONLY).toBe("LOG_ONLY");
    });
  });
});
