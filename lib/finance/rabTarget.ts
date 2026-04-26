export type RabTargetBasis = "HOMECONNECT" | "HOMEPASS";

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

export function calculateEffectiveRabTargetSubscribers({
  targetBasis,
  targetSubscribers,
  targetHomepass,
  targetTakeUpRatePercent,
}: RabTargetInput): number {
  if (targetBasis !== "HOMEPASS") {
    return Number(targetSubscribers || 0);
  }

  return Math.round(
    Number(targetHomepass || 0) * (Number(targetTakeUpRatePercent || 0) / 100),
  );
}

export function calculateRabProjectedRevenue(input: RabProjectedRevenueInput) {
  return (
    calculateEffectiveRabTargetSubscribers(input) * Number(input.arpu || 0)
  );
}

export function calculateRabUnitCosts({
  totalCapex,
  targetHomepass,
  targetSubscribers,
}: RabUnitCostInput) {
  const capex = Number(totalCapex || 0);
  const homepass = Number(targetHomepass || 0);
  const homeconnect = Number(targetSubscribers || 0);

  return {
    costPerHomepass: homepass > 0 ? Math.round(capex / homepass) : 0,
    costPerHomeconnectRevenue:
      homeconnect > 0 ? Math.round(capex / homeconnect) : 0,
  };
}

export function getRabTargetBasisLabel(targetBasis?: RabTargetBasis) {
  return targetBasis === "HOMEPASS" ? "Homepass Dibangun" : "Homeconnect";
}
