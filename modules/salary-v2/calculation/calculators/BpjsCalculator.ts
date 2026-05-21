import type {
  IPayrollCalculator,
  CalculationContext,
  CalculationResult,
  EmployeeType,
  PayrollLine,
} from "@/modules/salary-v2/core";
import { ComponentCategory } from "@/modules/salary-v2/core";
import { buildLine } from "../helpers/line-builder";

export class BpjsCalculator implements IPayrollCalculator {
  name = "Bpjs";
  order = 50;
  applicableTo: EmployeeType[] | null = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { employee, config, metadata } = ctx;
    const bpjsEnrollment = employee.bpjsConfig;
    const bpjsRates = config.bpjs;
    const effectiveSalary =
      (metadata.effectiveSalary as number) ?? employee.basicSalary;
    const lines: PayrollLine[] = [];

    if (bpjsEnrollment.kesehatan) {
      const base = bpjsRates.kesehatan.maxBase
        ? Math.min(effectiveSalary, bpjsRates.kesehatan.maxBase)
        : effectiveSalary;

      lines.push(
        buildLine({
          componentCode: "BPJS_KES_EE",
          componentName: "BPJS Kesehatan (Karyawan)",
          category: ComponentCategory.DEDUCTION,
          amount: Math.floor(base * bpjsRates.kesehatan.employeeRate),
          formula: `min(${effectiveSalary}, ${bpjsRates.kesehatan.maxBase}) × ${bpjsRates.kesehatan.employeeRate}`,
          sortOrder: 30,
        }),
      );
      lines.push(
        buildLine({
          componentCode: "BPJS_KES_ER",
          componentName: "BPJS Kesehatan (Perusahaan)",
          category: ComponentCategory.EMPLOYER_COST,
          amount: Math.floor(base * bpjsRates.kesehatan.employerRate),
          formula: `min(${effectiveSalary}, ${bpjsRates.kesehatan.maxBase}) × ${bpjsRates.kesehatan.employerRate}`,
          sortOrder: 31,
        }),
      );
    }

    if (bpjsEnrollment.jht) {
      const base = bpjsRates.jht.maxBase
        ? Math.min(effectiveSalary, bpjsRates.jht.maxBase)
        : effectiveSalary;

      lines.push(
        buildLine({
          componentCode: "BPJS_JHT_EE",
          componentName: "BPJS JHT (Karyawan)",
          category: ComponentCategory.DEDUCTION,
          amount: Math.floor(base * bpjsRates.jht.employeeRate),
          formula: `${base} × ${bpjsRates.jht.employeeRate}`,
          sortOrder: 32,
        }),
      );
      lines.push(
        buildLine({
          componentCode: "BPJS_JHT_ER",
          componentName: "BPJS JHT (Perusahaan)",
          category: ComponentCategory.EMPLOYER_COST,
          amount: Math.floor(base * bpjsRates.jht.employerRate),
          formula: `${base} × ${bpjsRates.jht.employerRate}`,
          sortOrder: 33,
        }),
      );
    }

    if (bpjsEnrollment.jp) {
      const base = bpjsRates.jp.maxBase
        ? Math.min(effectiveSalary, bpjsRates.jp.maxBase)
        : effectiveSalary;

      lines.push(
        buildLine({
          componentCode: "BPJS_JP_EE",
          componentName: "BPJS JP (Karyawan)",
          category: ComponentCategory.DEDUCTION,
          amount: Math.floor(base * bpjsRates.jp.employeeRate),
          formula: `min(${effectiveSalary}, ${bpjsRates.jp.maxBase}) × ${bpjsRates.jp.employeeRate}`,
          sortOrder: 34,
        }),
      );
      lines.push(
        buildLine({
          componentCode: "BPJS_JP_ER",
          componentName: "BPJS JP (Perusahaan)",
          category: ComponentCategory.EMPLOYER_COST,
          amount: Math.floor(base * bpjsRates.jp.employerRate),
          formula: `min(${effectiveSalary}, ${bpjsRates.jp.maxBase}) × ${bpjsRates.jp.employerRate}`,
          sortOrder: 35,
        }),
      );
    }

    if (bpjsEnrollment.jkk) {
      lines.push(
        buildLine({
          componentCode: "BPJS_JKK_ER",
          componentName: "BPJS JKK (Perusahaan)",
          category: ComponentCategory.EMPLOYER_COST,
          amount: Math.floor(effectiveSalary * bpjsRates.jkk.employerRate),
          formula: `${effectiveSalary} × ${bpjsRates.jkk.employerRate}`,
          sortOrder: 36,
        }),
      );
    }

    if (bpjsEnrollment.jkm) {
      lines.push(
        buildLine({
          componentCode: "BPJS_JKM_ER",
          componentName: "BPJS JKM (Perusahaan)",
          category: ComponentCategory.EMPLOYER_COST,
          amount: Math.floor(effectiveSalary * bpjsRates.jkm.employerRate),
          formula: `${effectiveSalary} × ${bpjsRates.jkm.employerRate}`,
          sortOrder: 37,
        }),
      );
    }

    return { lines };
  }
}
