import {
  calculateWorkDays,
  getDefaultWorkDaysString,
} from "../utils/salary-calculation-helpers";
import type { UserCalculationData } from "../utils/salary-calculation-helpers";

type SalaryLine = {
  name: string;
  amount: number;
  quantity?: number;
  rate?: number;
  notes?: string;
};

type UserComponent = Awaited<
  ReturnType<
    {
      getUserComponents(userId: string): Promise<
        Array<{
          amount: number;
          notes: string | null;
          component: {
            name: string;
            type: "EARNING" | "DEDUCTION";
            rateType: string;
          };
        }>
      >;
    }["getUserComponents"]
  >
>[number];

/** Menghitung komponen salary user menjadi earning dan deduction lines. */
export class SalaryComponentCalculationService {
  /** Bangun earning/deduction dari komponen salary user. */
  buildComponentLines(input: {
    components: UserComponent[];
    user: UserCalculationData;
    effectiveBasicSalary: number;
    attendanceWorkDays: number;
    isProrated: boolean;
    periodEndDate: Date;
  }) {
    const earnings: SalaryLine[] = [];
    const deductions: SalaryLine[] = [];

    for (const component of input.components) {
      const line = this.buildComponentLine(component, input);
      if (component.component.type === "EARNING") {
        earnings.push(line);
      } else {
        deductions.push(line);
      }
    }

    return { earnings, deductions };
  }

  private buildComponentLine(
    component: UserComponent,
    input: {
      user: UserCalculationData;
      effectiveBasicSalary: number;
      attendanceWorkDays: number;
      isProrated: boolean;
      periodEndDate: Date;
    },
  ): SalaryLine {
    const amount = this.calculateComponentAmount(component, input);
    return {
      name: component.component.name,
      amount: Math.round(amount.value),
      rate: amount.rate,
      notes: component.notes || undefined,
    };
  }

  private calculateComponentAmount(
    component: UserComponent,
    input: {
      user: UserCalculationData;
      effectiveBasicSalary: number;
      attendanceWorkDays: number;
      isProrated: boolean;
      periodEndDate: Date;
    },
  ) {
    if (component.component.rateType === "PERCENTAGE") {
      return {
        value: Math.round(
          (input.effectiveBasicSalary * component.amount) / 100,
        ),
        rate: component.amount,
      };
    }

    if (!this.shouldProrateEarning(component, input)) {
      return { value: component.amount, rate: undefined };
    }

    if (input.effectiveBasicSalary === 0) {
      return { value: 0, rate: undefined };
    }

    const workDaysSinceJoin = calculateWorkDays(
      input.user.joinDate!,
      input.periodEndDate,
      input.user.workDays || getDefaultWorkDaysString(),
    );
    return {
      value: (component.amount / input.attendanceWorkDays) * workDaysSinceJoin,
      rate: undefined,
    };
  }

  private shouldProrateEarning(
    component: UserComponent,
    input: { isProrated: boolean },
  ) {
    return input.isProrated && component.component.type === "EARNING";
  }
}
