/**
 * Salary Module — Dependency Factory
 *
 * Wires up repositories and services for the payroll system.
 * Services that require unimplemented repositories are commented out
 * and will be enabled as their dependencies become available.
 */

import { PrismaPayrollRunRepository } from "./repositories/PrismaPayrollRunRepository";
import { PrismaPayrollEntryRepository } from "./repositories/PrismaPayrollEntryRepository";
import { PrismaPayrollComponentRepository } from "./repositories/PrismaPayrollComponentRepository";
import { PrismaEmployeePayrollProfileRepository } from "./repositories/PrismaEmployeePayrollProfileRepository";
import { PrismaPayrollPeriodRepository } from "./repositories/PrismaPayrollPeriodRepository";
import { PrismaSalaryAdvanceRepository } from "./repositories/PrismaSalaryAdvanceRepository";
import {
  PayrollCalculationEngine,
  BasicSalaryCalculator,
  ProrataCalculator,
  AttendanceCalculator,
  OvertimeCalculator,
  ComponentCalculator,
  BpjsCalculator,
  LoanDeductionCalculator,
  NetSalaryCalculator,
} from "./calculation";
import { TaxCalculator, InMemoryTaxHistoryProvider } from "./tax";
import { PeriodLockingService } from "./payment";
import { ThrCalculationService } from "./benefits";
import { RapelCalculationService } from "./benefits";
import { SalaryAdvanceService } from "./benefits";
import { PayslipGenerator } from "./reporting";
import { PayrollExportService } from "./reporting";
import { AttendancePayrollBridge } from "./integrations/AttendancePayrollBridge";
import { OvertimePayrollBridge } from "./integrations/OvertimePayrollBridge";
import { LoanPayrollBridge } from "./integrations/LoanPayrollBridge";
import { PrismaApprovalWorkflowRepository } from "./repositories/PrismaApprovalWorkflowRepository";
import { PayrollApprovalService } from "./workflow/approval/PayrollApprovalService";
import { SalaryAdvanceManagementService } from "./benefits/advance/SalaryAdvanceManagementService";

// --- Repositories (singletons) ---

const payrollRunRepo = new PrismaPayrollRunRepository();
const payrollEntryRepo = new PrismaPayrollEntryRepository();
const payrollComponentRepo = new PrismaPayrollComponentRepository();
const employeeProfileRepo = new PrismaEmployeePayrollProfileRepository();
const payrollPeriodRepo = new PrismaPayrollPeriodRepository();
const salaryAdvanceRepo = new PrismaSalaryAdvanceRepository();

/** Get PayrollRun repository instance */
export function getPayrollRunRepository() {
  return payrollRunRepo;
}

/** Get PayrollEntry repository instance */
export function getPayrollEntryRepository() {
  return payrollEntryRepo;
}

/** Get PayrollComponent repository instance */
export function getPayrollComponentRepository() {
  return payrollComponentRepo;
}

/** Get EmployeePayrollProfile repository instance */
export function getEmployeeProfileRepository() {
  return employeeProfileRepo;
}

/** Get PayrollPeriod repository instance */
export function getPayrollPeriodRepository() {
  return payrollPeriodRepo;
}

/** Get SalaryAdvance repository instance */
export function getSalaryAdvanceRepository() {
  return salaryAdvanceRepo;
}

// --- Calculation Engine ---

/** Create a new PayrollCalculationEngine with all calculators.
 *
 *  taxHistoryProvider opsional — kalau null, default `InMemoryTaxHistoryProvider([])`
 *  yang HANYA cocok untuk testing. Untuk production, caller WAJIB pass
 *  provider yang sudah pre-loaded dari DB (lihat PrismaTaxHistoryLoader).
 */
export function getCalculationEngine(
  taxHistoryProvider?: import("./tax/providers/TaxHistoryProvider").ITaxHistoryProvider,
) {
  const provider = taxHistoryProvider ?? new InMemoryTaxHistoryProvider([]);
  return new PayrollCalculationEngine([
    new BasicSalaryCalculator(),
    new ProrataCalculator(),
    new AttendanceCalculator(),
    new OvertimeCalculator(),
    new ComponentCalculator(),
    new BpjsCalculator(),
    new TaxCalculator(provider),
    new LoanDeductionCalculator(),
    new NetSalaryCalculator(),
  ]);
}

// --- Services ---

/** Get PeriodLockingService instance */
export function getPeriodLockingService() {
  return new PeriodLockingService();
}

/** Get THR calculation service */
export function getThrService() {
  return new ThrCalculationService();
}

/** Get Rapel calculation service */
export function getRapelService() {
  return new RapelCalculationService();
}

/** Get Salary Advance service */
export function getAdvanceService() {
  return new SalaryAdvanceService();
}

/** Get Payslip generator */
export function getPayslipGenerator() {
  return new PayslipGenerator();
}

/** Get Payroll export service */
export function getExportService() {
  return new PayrollExportService();
}

// --- Integration Bridges ---

const attendanceBridge = new AttendancePayrollBridge();
const overtimeBridge = new OvertimePayrollBridge();
const loanBridge = new LoanPayrollBridge();

/** Get AttendancePayrollBridge instance */
export function getAttendanceBridge() {
  return attendanceBridge;
}

/** Get OvertimePayrollBridge instance */
export function getOvertimeBridge() {
  return overtimeBridge;
}

/** Get LoanPayrollBridge instance */
export function getLoanBridge() {
  return loanBridge;
}

/** Get PayrollApprovalService instance (2-level: HR → Finance) */
export function getPayrollApprovalService() {
  return new PayrollApprovalService(new PrismaApprovalWorkflowRepository());
}

/** Get SalaryAdvanceManagementService for advance lifecycle orchestration */
export function getAdvanceManagementService() {
  return new SalaryAdvanceManagementService(
    salaryAdvanceRepo,
    payrollPeriodRepo,
  );
}

// --- Services requiring unimplemented repos (TODO: enable when ready) ---
// export function getPayScheduleService() { return new PayScheduleService(payScheduleRepo); }
// export function getComplianceRuleEngine() { return new ComplianceRuleEngine(); }
// export function getPayrollAuditService() { return new PayrollAuditService(); }
