export const PTKP_CATEGORIES = [
  "TK_0",
  "TK_1",
  "TK_2",
  "TK_3",
  "K_0",
  "K_1",
  "K_2",
  "K_3",
] as const;

export type PtkpCategory = (typeof PTKP_CATEGORIES)[number];

export class PtkpStatus {
  private constructor(public readonly value: PtkpCategory) {}

  static of(value: string): PtkpStatus {
    if (!PTKP_CATEGORIES.includes(value as PtkpCategory)) {
      throw new Error(
        `Invalid PTKP status: ${value}. Must be one of: ${PTKP_CATEGORIES.join(", ")}`,
      );
    }
    return new PtkpStatus(value as PtkpCategory);
  }

  isMarried(): boolean {
    return this.value.startsWith("K_");
  }

  get dependents(): number {
    return parseInt(this.value.split("_")[1], 10);
  }
}
