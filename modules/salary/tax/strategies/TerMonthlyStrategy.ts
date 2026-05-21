import type { TerBracket } from "@/modules/salary/core";

export class TerMonthlyStrategy {
  static getPtkpGroup(ptkpStatus: string): string {
    const groupMap: Record<string, string> = {
      TK_0: "A",
      TK_1: "A",
      K_0: "A",
      TK_2: "B",
      TK_3: "B",
      K_1: "B",
      K_2: "B",
      K_3: "C",
    };
    return groupMap[ptkpStatus] ?? "A";
  }

  calculate(
    grossMonthlyIncome: number,
    ptkpGroup: string,
    brackets: TerBracket[],
  ): number {
    const applicableBrackets = brackets
      .filter((b) => b.ptkpGroup === ptkpGroup)
      .sort((a, b) => a.minIncome - b.minIncome);

    if (applicableBrackets.length === 0) return 0;

    for (let i = applicableBrackets.length - 1; i >= 0; i--) {
      const bracket = applicableBrackets[i];
      if (grossMonthlyIncome >= bracket.minIncome) {
        return Math.floor(grossMonthlyIncome * bracket.rate);
      }
    }

    return 0;
  }
}
