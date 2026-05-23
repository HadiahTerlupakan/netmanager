import type { TerBracket } from "@/modules/salary/core";

export class TerMonthlyStrategy {
  /**
   * Mapping PTKP status → TER kategori (PMK 168/2023 Lampiran A).
   *
   * Kategori A: TK/0, TK/1, K/0
   * Kategori B: TK/2, TK/3, K/1, K/2
   * Kategori C: K/3
   *
   * Untuk status K/I (penghasilan istri digabung), PTKP setara dengan
   * K + PTKP istri (Rp 54 jt). Karena PMK 168/2023 tidak eksplisit
   * mengkategorisasi K/I, kami treat sebagai kategori C (PTKP terbesar).
   */
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
      KI_0: "C",
      KI_1: "C",
      KI_2: "C",
      KI_3: "C",
    };
    const group = groupMap[ptkpStatus];
    if (!group) {
      throw new Error(
        `[TerMonthlyStrategy] PTKP status tidak dikenal: "${ptkpStatus}". Status valid: TK_0..TK_3, K_0..K_3, KI_0..KI_3`,
      );
    }
    return group;
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
