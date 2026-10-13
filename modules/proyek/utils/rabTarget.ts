export type RabTargetBasis = "HOMECONNECT" | "HOMEPASS";

const DEFAULT_NUMERIC_VALUE = 0;
const PERCENTAGE_DIVISOR = 100;

interface RabTargetInput {
  targetBasis?: RabTargetBasis;
  targetSubscribers?: number | null;
  targetHomepass?: number | null;
  targetTakeUpRatePercent?: number | null;
}

interface RabProjectedRevenueInput extends RabTargetInput {
  arpu?: number | null;
}

interface RabUnitCostInput {
  totalCapex?: number | null;
  targetHomepass?: number | null;
  targetSubscribers?: number | null;
}

/** Menghitung target subscriber efektif berdasarkan basis RAB. */
export function calculateEffectiveRabTargetSubscribers({
  targetBasis,
  targetSubscribers,
  targetHomepass,
  targetTakeUpRatePercent,
}: RabTargetInput): number {
  if (targetBasis !== "HOMEPASS") {
    return toNumber(targetSubscribers);
  }

  return Math.round(
    toNumber(targetHomepass) *
      (toNumber(targetTakeUpRatePercent) / PERCENTAGE_DIVISOR),
  );
}

/** Menghitung proyeksi revenue berdasarkan target efektif dan ARPU. */
export function calculateRabProjectedRevenue(
  input: RabProjectedRevenueInput,
): number {
  return calculateEffectiveRabTargetSubscribers(input) * toNumber(input.arpu);
}

/** Menghitung unit cost homepass dan homeconnect revenue. */
export function calculateRabUnitCosts({
  totalCapex,
  targetHomepass,
  targetSubscribers,
}: RabUnitCostInput) {
  const capex = toNumber(totalCapex);
  const homepass = toNumber(targetHomepass);
  const homeconnect = toNumber(targetSubscribers);

  return {
    costPerHomepass: calculateRoundedUnitCost(capex, homepass),
    costPerHomeconnectRevenue: calculateRoundedUnitCost(capex, homeconnect),
  };
}

/** Menghasilkan label basis target RAB untuk tampilan UI. */
export function getRabTargetBasisLabel(targetBasis?: RabTargetBasis): string {
  return targetBasis === "HOMEPASS" ? "Homepass Dibangun" : "Homeconnect";
}

function toNumber(value?: number | null): number {
  return Number(value || DEFAULT_NUMERIC_VALUE);
}

function calculateRoundedUnitCost(
  totalAmount: number,
  divisor: number,
): number {
  if (divisor <= DEFAULT_NUMERIC_VALUE) {
    return DEFAULT_NUMERIC_VALUE;
  }

  return Math.round(totalAmount / divisor);
}
