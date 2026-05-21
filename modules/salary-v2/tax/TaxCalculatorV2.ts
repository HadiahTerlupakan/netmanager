import type {
  IPayrollCalculator,
  CalculationContext,
  CalculationResult,
} from "@/modules/salary-v2/core";
import type { PayrollLine, TenantTaxConfig } from "@/modules/salary-v2/core";
import { ComponentCategory, EmployeeType } from "@/modules/salary-v2/core";
import {
  buildLine,
  sumEarnings,
} from "@/modules/salary-v2/calculation/helpers/line-builder";
import { TerMonthlyStrategy } from "./strategies/TerMonthlyStrategy";
import { ProgressiveAnnualStrategy } from "./strategies/ProgressiveAnnualStrategy";
import { GrossUpIterator } from "./strategies/GrossUpIterator";
import type { ITaxHistoryProvider } from "./providers/TaxHistoryProvider";

export class TaxCalculatorV2 implements IPayrollCalculator {
  name = "TaxV2";
  order = 60;
  applicableTo: EmployeeType[] | null = null;

  private terStrategy = new TerMonthlyStrategy();
  private annualStrategy = new ProgressiveAnnualStrategy();
  private grossUpIterator = new GrossUpIterator();

  constructor(private taxHistoryProvider: ITaxHistoryProvider) {}

  calculate(ctx: CalculationContext): CalculationResult {
    const { employee, previousLines, config, metadata } = ctx;
    const taxConfig = config.tax;
    const currentMonth =
      (metadata.currentMonth as number) ?? new Date().getMonth() + 1;
    const currentYear =
      (metadata.currentYear as number) ?? new Date().getFullYear();
    const isResign = (metadata.isResign as boolean) ?? false;
    const isAnnualCorrection =
      currentMonth === taxConfig.annualCorrectionMonth || isResign;

    const grossIncome = sumEarnings(previousLines);
    const bpjsEmployeeDeductions = previousLines
      .filter(
        (l) =>
          l.category === ComponentCategory.DEDUCTION &&
          l.componentCode.startsWith("BPJS_"),
      )
      .reduce((sum, l) => sum + l.amount, 0);

    const biayaJabatan = Math.min(
      Math.floor(grossIncome * taxConfig.biayaJabatanRate),
      taxConfig.biayaJabatanMax,
    );

    if (isAnnualCorrection) {
      return this.calculateAnnualCorrection(
        ctx,
        grossIncome,
        biayaJabatan,
        bpjsEmployeeDeductions,
        currentYear,
      );
    }

    if (employee.taxMethod === "GROSS_UP") {
      return this.calculateGrossUp(
        ctx,
        grossIncome,
        biayaJabatan,
        bpjsEmployeeDeductions,
      );
    }

    return this.calculateMonthly(
      ctx,
      grossIncome,
      biayaJabatan,
      bpjsEmployeeDeductions,
    );
  }

  private calculateMonthly(
    ctx: CalculationContext,
    grossIncome: number,
    biayaJabatan: number,
    bpjsEmployee: number,
  ): CalculationResult {
    const { employee, config } = ctx;
    const taxConfig = config.tax;

    let monthlyTax: number;

    if (taxConfig.terBrackets.length > 0) {
      const ptkpGroup = TerMonthlyStrategy.getPtkpGroup(employee.ptkpStatus);
      monthlyTax = this.terStrategy.calculate(
        grossIncome,
        ptkpGroup,
        taxConfig.terBrackets,
      );
    } else {
      const ptkpMonthly = this.getMonthlyPtkp(employee.ptkpStatus, taxConfig);
      const taxableIncome =
        grossIncome - biayaJabatan - bpjsEmployee - ptkpMonthly;

      if (taxableIncome <= 0) {
        return this.buildZeroTaxResult(employee.taxMethod);
      }

      const annualizedTaxable = taxableIncome * 12;
      const annualTax = this.annualStrategy.calculateAnnualTax(
        annualizedTaxable,
        taxConfig.progressiveRates,
      );
      monthlyTax = Math.floor(annualTax / 12);
    }

    if (!employee.npwp) {
      monthlyTax = Math.floor(monthlyTax * (1 + taxConfig.npwpSurcharge));
    }

    return this.buildTaxResult(monthlyTax, employee.taxMethod, false);
  }

  private calculateGrossUp(
    ctx: CalculationContext,
    grossIncome: number,
    biayaJabatan: number,
    bpjsEmployee: number,
  ): CalculationResult {
    const { employee, config } = ctx;
    const taxConfig = config.tax;
    const ptkpMonthly = this.getMonthlyPtkp(employee.ptkpStatus, taxConfig);

    const result = this.grossUpIterator.calculate({
      baseGrossIncome: grossIncome,
      biayaJabatan,
      bpjsEmployeeDeduction: bpjsEmployee,
      ptkpMonthly,
      progressiveRates: taxConfig.progressiveRates,
      hasNpwp: !!employee.npwp,
      npwpSurcharge: taxConfig.npwpSurcharge,
    });

    const lines: PayrollLine[] = [];

    if (result.taxAllowance > 0) {
      lines.push(
        buildLine({
          componentCode: "TAX_ALLOWANCE",
          componentName: "Tunjangan Pajak",
          category: ComponentCategory.EARNING,
          amount: result.taxAllowance,
          formula: `gross-up iterative (${result.iterations} iterations)`,
          sortOrder: 39,
        }),
      );
    }

    lines.push(
      buildLine({
        componentCode: "PPH21",
        componentName: "PPh 21",
        category: ComponentCategory.TAX,
        amount: result.totalTax,
        formula: `GROSS_UP converged=${result.converged}`,
        sortOrder: 40,
      }),
    );

    return {
      lines,
      metadata: {
        pph21: result.totalTax,
        grossUpConverged: result.converged,
        grossUpIterations: result.iterations,
      },
    };
  }

  private calculateAnnualCorrection(
    ctx: CalculationContext,
    currentGross: number,
    currentBiayaJabatan: number,
    currentBpjs: number,
    year: number,
  ): CalculationResult {
    const { employee, config } = ctx;
    const taxConfig = config.tax;

    const history = this.taxHistoryProvider.getYtdHistory(
      employee.userId,
      year,
    );

    const totalGross = history.totalGrossIncome + currentGross;
    const totalBiayaJabatan = Math.min(
      history.totalBiayaJabatan + currentBiayaJabatan,
      taxConfig.biayaJabatanMaxAnnual,
    );
    const totalBpjs = history.totalBpjsEmployee + currentBpjs;

    const ptkpEntry = taxConfig.ptkpTable.find(
      (p) => p.status === employee.ptkpStatus,
    );
    const ptkpAnnual = ptkpEntry?.annualAmount ?? 0;

    const result = this.annualStrategy.calculatePartialYearTax({
      totalGrossIncome: totalGross,
      totalBiayaJabatan: totalBiayaJabatan,
      totalBpjsEmployee: totalBpjs,
      ptkpAnnual,
      progressiveRates: taxConfig.progressiveRates,
      totalTaxPaidYtd: history.totalTaxPaid,
      monthsWorked: history.monthsWorked + 1,
      hasNpwp: !!employee.npwp,
      npwpSurcharge: taxConfig.npwpSurcharge,
    });

    const finalTax = Math.max(0, result.finalMonthTax);
    const category =
      employee.taxMethod === "NETT"
        ? ComponentCategory.EMPLOYER_COST
        : ComponentCategory.TAX;

    const lines: PayrollLine[] = [];

    if (employee.taxMethod === "GROSS_UP" && finalTax > 0) {
      lines.push(
        buildLine({
          componentCode: "TAX_ALLOWANCE",
          componentName: "Tunjangan Pajak",
          category: ComponentCategory.EARNING,
          amount: finalTax,
          formula: `gross-up annual correction`,
          sortOrder: 39,
        }),
      );
    }

    lines.push(
      buildLine({
        componentCode: "PPH21",
        componentName: "PPh 21 (Koreksi Tahunan)",
        category:
          employee.taxMethod === "GROSS_UP" ? ComponentCategory.TAX : category,
        amount: finalTax,
        formula: `annual: due=${result.annualTaxDue} - paid=${history.totalTaxPaid}`,
        sortOrder: 40,
      }),
    );

    return {
      lines,
      metadata: {
        pph21: finalTax,
        isAnnualCorrection: true,
        annualTaxDue: result.annualTaxDue,
        ytdTaxPaid: history.totalTaxPaid,
      },
    };
  }

  private buildZeroTaxResult(taxMethod: string): CalculationResult {
    const category =
      taxMethod === "NETT"
        ? ComponentCategory.EMPLOYER_COST
        : ComponentCategory.TAX;
    return {
      lines: [
        buildLine({
          componentCode: "PPH21",
          componentName: "PPh 21",
          category,
          amount: 0,
          formula: "taxableIncome <= PTKP",
          sortOrder: 40,
        }),
      ],
      metadata: { pph21: 0 },
    };
  }

  private buildTaxResult(
    monthlyTax: number,
    taxMethod: string,
    isAnnualCorrection: boolean,
  ): CalculationResult {
    const lines: PayrollLine[] = [];

    if (taxMethod === "NETT") {
      lines.push(
        buildLine({
          componentCode: "PPH21",
          componentName: "PPh 21 (Ditanggung Perusahaan)",
          category: ComponentCategory.EMPLOYER_COST,
          amount: monthlyTax,
          formula: `NETT monthly`,
          sortOrder: 40,
        }),
      );
    } else {
      lines.push(
        buildLine({
          componentCode: "PPH21",
          componentName: "PPh 21",
          category: ComponentCategory.TAX,
          amount: monthlyTax,
          formula: `NET monthly`,
          sortOrder: 40,
        }),
      );
    }

    return { lines, metadata: { pph21: monthlyTax, isAnnualCorrection } };
  }

  private getMonthlyPtkp(
    ptkpStatus: string,
    taxConfig: TenantTaxConfig,
  ): number {
    const entry = taxConfig.ptkpTable.find((p) => p.status === ptkpStatus);
    if (!entry) return 0;
    return Math.floor(entry.annualAmount / 12);
  }
}
