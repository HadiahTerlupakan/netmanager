import type {
  IPayrollCalculator,
  CalculationContext,
  CalculationResult,
  EmployeeType,
  PayrollLine,
  TenantTaxConfig,
} from "@/modules/salary-v2/core";
import { ComponentCategory } from "@/modules/salary-v2/core";
import { buildLine, sumEarnings } from "../helpers/line-builder";

export class TaxCalculator implements IPayrollCalculator {
  name = "Tax";
  order = 60;
  applicableTo: EmployeeType[] | null = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { employee, previousLines, config } = ctx;
    const taxConfig = config.tax;

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

    const taxableIncome = grossIncome - biayaJabatan - bpjsEmployeeDeductions;

    const ptkpMonthly = this.getMonthlyPtkp(employee.ptkpStatus, taxConfig);
    const netTaxable = taxableIncome - ptkpMonthly;

    if (netTaxable <= 0) {
      return {
        lines: [
          buildLine({
            componentCode: "PPH21",
            componentName: "PPh 21",
            category:
              employee.taxMethod === "NETT"
                ? ComponentCategory.EMPLOYER_COST
                : ComponentCategory.TAX,
            amount: 0,
            formula: "taxableIncome <= PTKP",
            sortOrder: 40,
          }),
        ],
        metadata: { pph21: 0, taxableIncome: netTaxable },
      };
    }

    const annualizedTaxable = netTaxable * 12;
    const annualTax = this.calculateProgressiveTax(
      annualizedTaxable,
      taxConfig,
    );
    let monthlyTax = Math.floor(annualTax / 12);

    if (!employee.npwp) {
      monthlyTax = Math.floor(monthlyTax * (1 + taxConfig.npwpSurcharge));
    }

    const lines: PayrollLine[] = [];

    if (employee.taxMethod === "GROSS_UP") {
      lines.push(
        buildLine({
          componentCode: "TAX_ALLOWANCE",
          componentName: "Tunjangan Pajak",
          category: ComponentCategory.EARNING,
          amount: monthlyTax,
          formula: `gross-up PPh 21`,
          sortOrder: 39,
        }),
      );
      lines.push(
        buildLine({
          componentCode: "PPH21",
          componentName: "PPh 21",
          category: ComponentCategory.TAX,
          amount: monthlyTax,
          formula: `TER: annualized(${annualizedTaxable}) / 12`,
          sortOrder: 40,
        }),
      );
    } else if (employee.taxMethod === "NETT") {
      lines.push(
        buildLine({
          componentCode: "PPH21",
          componentName: "PPh 21 (Ditanggung Perusahaan)",
          category: ComponentCategory.EMPLOYER_COST,
          amount: monthlyTax,
          formula: `NETT: annualized(${annualizedTaxable}) / 12`,
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
          formula: `NET: annualized(${annualizedTaxable}) / 12`,
          sortOrder: 40,
        }),
      );
    }

    return {
      lines,
      metadata: { pph21: monthlyTax, taxableIncome: netTaxable },
    };
  }

  private getMonthlyPtkp(
    ptkpStatus: string,
    taxConfig: TenantTaxConfig,
  ): number {
    const entry = taxConfig.ptkpTable.find((p) => p.status === ptkpStatus);
    if (!entry) return 0;
    return Math.floor(entry.annualAmount / 12);
  }

  private calculateProgressiveTax(
    annualTaxable: number,
    taxConfig: TenantTaxConfig,
  ): number {
    let remaining = annualTaxable;
    let totalTax = 0;

    for (const bracket of taxConfig.progressiveRates) {
      if (remaining <= 0) break;

      const bracketSize =
        bracket.maxAmount !== null
          ? bracket.maxAmount - bracket.minAmount
          : remaining;

      const taxableInBracket = Math.min(remaining, bracketSize);
      totalTax += Math.floor(taxableInBracket * bracket.rate);
      remaining -= taxableInBracket;
    }

    return totalTax;
  }
}
