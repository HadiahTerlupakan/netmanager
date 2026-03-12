export type VarianceLabel = 'UNTUNG' | 'RUGI' | 'SESUAI'

export interface RabRevisionVarianceInput {
  originalCapex: bigint
  originalOpex: bigint
  finalCapex: bigint
  finalOpex: bigint
  actualCapex: bigint
  actualOpex: bigint
}

export interface RabRevisionVarianceSummary {
  originalTotal: bigint
  finalTotal: bigint
  actualTotal: bigint
  capexVariance: bigint
  opexVariance: bigint
  netVariance: bigint
  capexLabel: VarianceLabel
  opexLabel: VarianceLabel
  netLabel: VarianceLabel
}

export function getVarianceLabel(variance: bigint): VarianceLabel {
  if (variance > 0n) {
    return 'UNTUNG'
  }

  if (variance < 0n) {
    return 'RUGI'
  }

  return 'SESUAI'
}

export function buildRabRevisionVarianceSummary(
  input: RabRevisionVarianceInput,
): RabRevisionVarianceSummary {
  const originalTotal = input.originalCapex + input.originalOpex
  const finalTotal = input.finalCapex + input.finalOpex
  const actualTotal = input.actualCapex + input.actualOpex
  const capexVariance = input.finalCapex - input.actualCapex
  const opexVariance = input.finalOpex - input.actualOpex
  const netVariance = finalTotal - actualTotal

  return {
    originalTotal,
    finalTotal,
    actualTotal,
    capexVariance,
    opexVariance,
    netVariance,
    capexLabel: getVarianceLabel(capexVariance),
    opexLabel: getVarianceLabel(opexVariance),
    netLabel: getVarianceLabel(netVariance),
  }
}
