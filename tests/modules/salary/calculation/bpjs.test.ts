import { describe, it, expect } from "vitest";
import { BpjsCalculator } from "@/modules/salary/calculation/calculators/BpjsCalculator";
import { createTestContext } from "@/modules/salary/calculation/helpers/context-helpers";
import { ComponentCategory } from "@/modules/salary/core";

describe("BpjsCalculator", () => {
  const calculator = new BpjsCalculator();

  it("should have correct metadata", () => {
    expect(calculator.name).toBe("Bpjs");
    expect(calculator.order).toBe(50);
    expect(calculator.applicableTo).toBeNull();
  });

  it("should calculate all BPJS for fully enrolled employee", () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        basicSalary: 8000000,
        bpjsConfig: {
          kesehatan: true,
          jht: true,
          jp: true,
          jkk: true,
          jkm: true,
        },
      },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    const deductions = result.lines.filter(
      (l) => l.category === ComponentCategory.DEDUCTION,
    );
    const employerCosts = result.lines.filter(
      (l) => l.category === ComponentCategory.EMPLOYER_COST,
    );

    expect(deductions).toHaveLength(3);
    expect(employerCosts).toHaveLength(5);
  });

  it("should cap BPJS Kesehatan at 12M", () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        basicSalary: 15000000,
        bpjsConfig: {
          kesehatan: true,
          jht: false,
          jp: false,
          jkk: false,
          jkm: false,
        },
      },
      metadata: { effectiveSalary: 15000000 },
    });
    const result = calculator.calculate(ctx);

    const kesEE = result.lines.find((l) => l.componentCode === "BPJS_KES_EE");
    const kesER = result.lines.find((l) => l.componentCode === "BPJS_KES_ER");

    expect(kesEE?.amount).toBe(120000);
    expect(kesER?.amount).toBe(480000);
  });

  it("should not cap BPJS JHT", () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        basicSalary: 20000000,
        bpjsConfig: {
          kesehatan: false,
          jht: true,
          jp: false,
          jkk: false,
          jkm: false,
        },
      },
      metadata: { effectiveSalary: 20000000 },
    });
    const result = calculator.calculate(ctx);

    const jhtEE = result.lines.find((l) => l.componentCode === "BPJS_JHT_EE");
    const jhtER = result.lines.find((l) => l.componentCode === "BPJS_JHT_ER");

    expect(jhtEE?.amount).toBe(400000);
    expect(jhtER?.amount).toBe(740000);
  });

  it("should cap BPJS JP at 10.042M", () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        basicSalary: 15000000,
        bpjsConfig: {
          kesehatan: false,
          jht: false,
          jp: true,
          jkk: false,
          jkm: false,
        },
      },
      metadata: { effectiveSalary: 15000000 },
    });
    const result = calculator.calculate(ctx);

    const jpEE = result.lines.find((l) => l.componentCode === "BPJS_JP_EE");
    const jpER = result.lines.find((l) => l.componentCode === "BPJS_JP_ER");

    expect(jpEE?.amount).toBe(100420);
    expect(jpER?.amount).toBe(200840);
  });

  it("should calculate JKK and JKM (employer only)", () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        basicSalary: 8000000,
        bpjsConfig: {
          kesehatan: false,
          jht: false,
          jp: false,
          jkk: true,
          jkm: true,
        },
      },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    const jkk = result.lines.find((l) => l.componentCode === "BPJS_JKK_ER");
    const jkm = result.lines.find((l) => l.componentCode === "BPJS_JKM_ER");

    expect(jkk?.amount).toBe(Math.floor(8000000 * 0.0024));
    expect(jkk?.category).toBe(ComponentCategory.EMPLOYER_COST);
    expect(jkm?.amount).toBe(Math.floor(8000000 * 0.003));
  });

  it("should skip if not enrolled", () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        bpjsConfig: {
          kesehatan: false,
          jht: false,
          jp: false,
          jkk: false,
          jkm: false,
        },
      },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });
});
